package jobs

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	copyBatchSize     int32 = 200
	copyProgressEvery int64 = 2000
	copySampleSize          = 20
	stagingSuffix           = "_importing"
	namespaceNotFound int32 = 26
	dropTimeout             = 30 * time.Second
)

func (s *Store) Copy(ctx context.Context) (CopyResult, error) {
	if !s.copyMu.TryLock() {
		return CopyResult{}, ErrCopyInProgress
	}
	defer s.copyMu.Unlock()
	return s.copy(ctx)
}

func (s *Store) copy(ctx context.Context) (CopyResult, error) {
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

	copied, err := insertAll(ctx, src, staging)
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

	if err := renameCollection(ctx, s.client, s.destDB, stagingName, s.destCollection); err != nil {
		return CopyResult{}, err
	}
	renamed = true

	return CopyResult{
		Copied:      copied,
		Source:      s.sourceDB + "." + s.sourceCollection,
		Destination: s.destDB + "." + s.destCollection,
		Indexes:     indexCount,
	}, nil
}

func insertAll(ctx context.Context, src, dst *mongo.Collection) (int64, error) {
	cursor, err := src.Find(ctx, bson.D{}, options.Find().SetBatchSize(copyBatchSize))
	if err != nil {
		return 0, fmt.Errorf("read source jobs: %w", err)
	}
	defer cursor.Close(ctx)

	batch := make([]any, 0, copyBatchSize)
	var copied int64
	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		if _, err := dst.InsertMany(ctx, batch); err != nil {
			return fmt.Errorf("insert jobs: %w", err)
		}
		copied += int64(len(batch))
		batch = make([]any, 0, copyBatchSize)
		if copied%copyProgressEvery == 0 {
			slog.Info("copying jobs", "copied", copied)
		}
		return nil
	}

	for cursor.Next(ctx) {
		raw := append(bson.Raw(nil), cursor.Current...)
		batch = append(batch, exactDocument(raw))
		if len(batch) == int(copyBatchSize) {
			if err := flush(); err != nil {
				return copied, err
			}
		}
	}
	if err := cursor.Err(); err != nil {
		return copied, fmt.Errorf("read source jobs: %w", err)
	}
	if err := flush(); err != nil {
		return copied, err
	}
	return copied, nil
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
