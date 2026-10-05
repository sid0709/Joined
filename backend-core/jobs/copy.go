package jobs

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/sync/errgroup"
)

const (
	copyBatchSize int32 = 500
	// copyWriters is how many batches are written at once while the next ones are read.
	copyWriters             = 8
	copyProgressEvery       = 5000
	copySampleSize          = 20
	stagingSuffix           = "_importing"
	namespaceNotFound int32 = 26
	dropTimeout             = 30 * time.Second
)

// Copy replaces temp_jobs with a fresh copy of the source jobs. It builds the copy in a
// staging collection, checks it, and swaps it in, so readers never see half a copy.
// Jobs the crawler ingested straight into temp_jobs are carried over, and jobs already
// published are left out, so temp_jobs only holds jobs still waiting.
func (s *Store) Copy(ctx context.Context, progress Progress) (CopyResult, error) {
	if !s.copyMu.TryLock() {
		return CopyResult{}, ErrCopyInProgress
	}
	defer s.copyMu.Unlock()
	return s.copy(ctx, orNoProgress(progress))
}

func (s *Store) copy(ctx context.Context, progress Progress) (CopyResult, error) {
	src := s.source()
	stagingName := s.destCollection + stagingSuffix
	staging := s.client.Database(s.destDB).Collection(stagingName)

	if err := dropIfExists(ctx, staging); err != nil {
		return CopyResult{}, fmt.Errorf("clear staging collection: %w", err)
	}

	renamed := false
	defer func() {
		if renamed {
			return
		}
		dropCtx, cancel := context.WithTimeout(context.Background(), dropTimeout)
		defer cancel()
		if err := dropIfExists(dropCtx, staging); err != nil {
			slog.Error("drop staging collection", "collection", stagingName, "error", err)
		}
	}()

	if estimate, err := src.EstimatedDocumentCount(ctx); err == nil {
		progress.Total(estimate)
	}
	copied, err := insertAll(ctx, src, staging, progress)
	if err != nil {
		return CopyResult{}, err
	}

	sourceCount, err := src.CountDocuments(ctx, bson.D{})
	if err != nil {
		return CopyResult{}, fmt.Errorf("count source jobs: %w", err)
	}
	if sourceCount != copied {
		return CopyResult{}, fmt.Errorf("copied %d documents but %s has %d", copied, s.sourceDB+"."+s.sourceCollection, sourceCount)
	}

	if err := verifySample(ctx, src, staging, copied); err != nil {
		return CopyResult{}, err
	}

	indexCount, err := copyIndexes(ctx, src, staging)
	if err != nil {
		return CopyResult{}, err
	}

	// Hold crawler ingest off from here until the swap, so no job lands in the old
	// collection after its crawled jobs were carried over.
	s.tempWriteMu.Lock()
	defer s.tempWriteMu.Unlock()
	kept, err := s.keepCrawledJobs(ctx, staging)
	if err != nil {
		return CopyResult{}, err
	}
	published, err := s.deletePublishedJobs(ctx, staging)
	if err != nil {
		return CopyResult{}, err
	}

	if err := renameCollection(ctx, s.client, s.destDB, stagingName, s.destCollection); err != nil {
		return CopyResult{}, err
	}
	renamed = true

	return CopyResult{
		Copied:      copied,
		Kept:        kept,
		Published:   published,
		Source:      s.sourceDB + "." + s.sourceCollection,
		Destination: s.destDB + "." + s.destCollection,
		Indexes:     indexCount,
	}, nil
}

// insertAll reads src in batches and writes each batch to dst while the next is read,
// with up to copyWriters batches in flight.
func insertAll(ctx context.Context, src, dst *mongo.Collection, progress Progress) (int64, error) {
	cursor, err := src.Find(ctx, bson.D{}, options.Find().SetBatchSize(copyBatchSize))
	if err != nil {
		return 0, fmt.Errorf("read source jobs: %w", err)
	}
	defer cursor.Close(ctx)

	group, ctx := errgroup.WithContext(ctx)
	batches := make(chan []any, copyWriters)
	var copied atomic.Int64
	for range copyWriters {
		group.Go(func() error {
			for batch := range batches {
				if _, err := dst.InsertMany(ctx, batch, options.InsertMany().SetOrdered(false)); err != nil {
					return fmt.Errorf("insert jobs: %w", err)
				}
				progress.Done(int64(len(batch)))
				total := copied.Add(int64(len(batch)))
				if total/copyProgressEvery != (total-int64(len(batch)))/copyProgressEvery {
					slog.Info("copying jobs", "copied", total)
				}
			}
			return nil
		})
	}
	group.Go(func() error {
		defer close(batches)
		batch := make([]any, 0, copyBatchSize)
		for cursor.Next(ctx) {
			batch = append(batch, exactDocument(append(bson.Raw(nil), cursor.Current...)))
			if len(batch) < int(copyBatchSize) {
				continue
			}
			select {
			case batches <- batch:
			case <-ctx.Done():
				return ctx.Err()
			}
			batch = make([]any, 0, copyBatchSize)
		}
		if err := cursor.Err(); err != nil {
			return fmt.Errorf("read source jobs: %w", err)
		}
		if len(batch) > 0 {
			select {
			case batches <- batch:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		return nil
	})
	err = group.Wait()
	return copied.Load(), err
}

func verifySample(ctx context.Context, src, dst *mongo.Collection, copied int64) error {
	if copied == 0 {
		return nil
	}
	size := copySampleSize
	if copied < int64(size) {
		size = int(copied)
	}

	cursor, err := src.Aggregate(ctx, mongo.Pipeline{
		bson.D{{Key: "$sample", Value: bson.D{{Key: "size", Value: size}}}},
		bson.D{{Key: "$project", Value: bson.D{{Key: "_id", Value: 1}}}},
	})
	if err != nil {
		return fmt.Errorf("sample source jobs: %w", err)
	}
	defer cursor.Close(ctx)

	checked := 0
	for cursor.Next(ctx) {
		var row struct {
			ID bson.ObjectID `bson:"_id"`
		}
		if err := cursor.Decode(&row); err != nil {
			return fmt.Errorf("decode sample id: %w", err)
		}
		left, err := findRaw(ctx, src, row.ID)
		if err != nil {
			return err
		}
		right, err := findRaw(ctx, dst, row.ID)
		if err != nil {
			return err
		}
		if !bytes.Equal(left, right) {
			return fmt.Errorf("document %s does not match the source", row.ID.Hex())
		}
		checked++
	}
	if err := cursor.Err(); err != nil {
		return fmt.Errorf("sample source jobs: %w", err)
	}
	if checked != size {
		return fmt.Errorf("verified %d documents, expected %d", checked, size)
	}
	return nil
}

func findRaw(ctx context.Context, coll *mongo.Collection, id bson.ObjectID) (bson.Raw, error) {
	var raw bson.Raw
	err := coll.FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&raw)
	if err != nil {
		return nil, fmt.Errorf("read document %s: %w", id.Hex(), err)
	}
	return raw, nil
}

func copyIndexes(ctx context.Context, src, dst *mongo.Collection) (int, error) {
	cursor, err := src.Indexes().List(ctx)
	if err != nil {
		return 0, fmt.Errorf("list source indexes: %w", err)
	}
	defer cursor.Close(ctx)

	indexes := bson.A{}
	for cursor.Next(ctx) {
		raw := append(bson.Raw(nil), cursor.Current...)
		var elements bson.D
		if err := bson.Unmarshal(raw, &elements); err != nil {
			return 0, fmt.Errorf("decode source index: %w", err)
		}
		name := ""
		cleaned := make(bson.D, 0, len(elements))
		for _, element := range elements {
			if element.Key == "name" {
				if value, ok := element.Value.(string); ok {
					name = value
				}
			}
			switch element.Key {
			case "v", "ns", "background":
				continue
			default:
				cleaned = append(cleaned, element)
			}
		}
		if name == "_id_" {
			continue
		}
		indexes = append(indexes, cleaned)
	}
	if err := cursor.Err(); err != nil {
		return 0, fmt.Errorf("list source indexes: %w", err)
	}
	if len(indexes) == 0 {
		return 0, nil
	}

	err = dst.Database().RunCommand(ctx, bson.D{
		{Key: "createIndexes", Value: dst.Name()},
		{Key: "indexes", Value: indexes},
	}).Err()
	if err != nil {
		return 0, fmt.Errorf("create indexes: %w", err)
	}
	return len(indexes), nil
}

func renameCollection(ctx context.Context, client *mongo.Client, db, from, to string) error {
	err := client.Database("admin").RunCommand(ctx, bson.D{
		{Key: "renameCollection", Value: db + "." + from},
		{Key: "to", Value: db + "." + to},
		{Key: "dropTarget", Value: true},
	}).Err()
	if err != nil {
		return fmt.Errorf("rename %s.%s to %s: %w", db, from, to, err)
	}
	return nil
}

func dropIfExists(ctx context.Context, coll *mongo.Collection) error {
	err := coll.Drop(ctx)
	if err == nil || isNamespaceNotFound(err) {
		return nil
	}
	return err
}

func isNamespaceNotFound(err error) bool {
	var command mongo.CommandError
	return errors.As(err, &command) && (command.Code == namespaceNotFound || command.Name == "NamespaceNotFound")
}
