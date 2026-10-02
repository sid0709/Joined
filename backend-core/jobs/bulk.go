package jobs

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/sync/errgroup"
)

// bulkFetchBatch is how many documents a bulk run reads per query while workers run.
const bulkFetchBatch = 200

// runBulk reads the documents for ids in batches and hands each to one of workers
// goroutines. A work error stops the whole run; per-item failures are the work
// function's to report. load returns one batch of documents.
func runBulk[ID any, Doc any](
	ctx context.Context,
	ids []ID,
	workers int,
	load func(context.Context, []ID) ([]Doc, error),
	work func(context.Context, Doc) error,
) error {
	group, ctx := errgroup.WithContext(ctx)
	docs := make(chan Doc, max(workers, bulkFetchBatch))
	for range max(workers, 1) {
		group.Go(func() error {
			for doc := range docs {
				if err := work(ctx, doc); err != nil {
					return err
				}
			}
			return nil
		})
	}
	group.Go(func() error {
		defer close(docs)
		for start := 0; start < len(ids); start += bulkFetchBatch {
			batch, err := load(ctx, ids[start:min(start+bulkFetchBatch, len(ids))])
			if err != nil {
				return err
			}
			for _, doc := range batch {
				select {
				case docs <- doc:
				case <-ctx.Done():
					return ctx.Err()
				}
			}
		}
		return nil
	})
	return group.Wait()
}

// findAll decodes every document filter matches.
func findAll[Doc any](ctx context.Context, coll *mongo.Collection, filter any, opts ...options.Lister[options.FindOptions]) ([]Doc, error) {
	cursor, err := coll.Find(ctx, filter, opts...)
	if err != nil {
		return nil, err
	}
	var docs []Doc
	err = cursor.All(ctx, &docs)
	return docs, err
}
