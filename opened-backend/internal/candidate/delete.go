package candidate

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func compactIDs(ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func (s *Store) deleteApplications(ctx context.Context, filter bson.D) error {
	ids, err := s.stringIDs(ctx, applicationsCollection, filter, "id")
	if err != nil {
		return err
	}
	if len(ids) > 0 {
		if _, err := s.collection(interviewsCollection).DeleteMany(ctx, bson.D{
			{Key: "applicationId", Value: bson.D{{Key: "$in", Value: ids}}},
		}); err != nil {
			return err
		}
	}
	_, err = s.collection(applicationsCollection).DeleteMany(ctx, filter)
	return err
}

func (s *Store) deleteThreads(ctx context.Context, filter bson.D) error {
	ids, err := s.stringIDs(ctx, threadsCollection, filter, "id")
	if err != nil {
		return err
	}
	if len(ids) > 0 {
		in := bson.D{{Key: "threadId", Value: bson.D{{Key: "$in", Value: ids}}}}
		if _, err := s.collection(messagesCollection).DeleteMany(ctx, in); err != nil {
			return err
		}
		if _, err := s.collection(threadReadsCollection).DeleteMany(ctx, in); err != nil {
			return err
		}
	}
	_, err = s.collection(threadsCollection).DeleteMany(ctx, filter)
	return err
}

func (s *Store) stringIDs(ctx context.Context, collection string, filter bson.D, field string) ([]string, error) {
	cursor, err := s.collection(collection).Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var ids []string
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		id, _ := doc[field].(string)
		if id != "" {
			ids = append(ids, id)
		}
	}
	return ids, cursor.Err()
}
