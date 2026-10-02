package scout

import (
	"context"
	"errors"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// RemovedScout is what a deleted scout account published, so the caller can
// remove those jobs' applications and any company page that exists only for them.
type RemovedScout struct {
	CompanyIDs []string
	JobIDs     []string
}

// DeleteUser removes the scout profile and every record that belongs to it:
// submissions, earnings, payouts, notifications, API keys, and audit rows.
func (s *Store) DeleteUser(ctx context.Context, userID string) (RemovedScout, error) {
	cursor, err := s.collection(submissionsCollection).Find(ctx, bson.D{{Key: "scoutUserId", Value: userID}},
		options.Find().SetProjection(bson.D{
			{Key: "companyId", Value: 1},
			{Key: "jobId", Value: 1},
			{Key: "jobRef", Value: 1},
		}))
	if err != nil {
		return RemovedScout{}, err
	}
	defer cursor.Close(ctx)

	removed := RemovedScout{}
	subjects := []string{userID}
	for cursor.Next(ctx) {
		var doc struct {
			ID        bson.ObjectID `bson:"_id"`
			CompanyID string        `bson:"companyId"`
			JobID     string        `bson:"jobId"`
			JobRef    string        `bson:"jobRef"`
		}
		if err := cursor.Decode(&doc); err != nil {
			return RemovedScout{}, err
		}
		subjects = append(subjects, doc.ID.Hex())
		if doc.CompanyID != "" {
			removed.CompanyIDs = append(removed.CompanyIDs, doc.CompanyID)
		}
		if doc.JobID != "" {
			removed.JobIDs = append(removed.JobIDs, doc.JobID)
		}
		if doc.JobRef != "" && s.publisher != nil {
			if err := s.publisher.UnpublishScouted(ctx, doc.JobRef); err != nil && !errors.Is(err, jobs.ErrInvalidID) {
				return RemovedScout{}, err
			}
		}
	}
	if err := cursor.Err(); err != nil {
		return RemovedScout{}, err
	}

	owned := []struct {
		collection string
		key        string
	}{
		{profilesCollection, "userId"},
		{submissionsCollection, "scoutUserId"},
		{earningsCollection, "scoutUserId"},
		{payoutsCollection, "scoutUserId"},
		{notificationsCollection, "scoutUserId"},
		{apiKeysCollection, "userId"},
		{idempotencyCollection, "userId"},
	}
	for _, item := range owned {
		if _, err := s.collection(item.collection).DeleteMany(ctx, bson.D{{Key: item.key, Value: userID}}); err != nil {
			return RemovedScout{}, err
		}
	}
	_, err = s.collection(auditCollection).DeleteMany(ctx, bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "actor", Value: userID}},
		bson.D{{Key: "subjectId", Value: bson.D{{Key: "$in", Value: subjects}}}},
	}}})
	if err != nil {
		return RemovedScout{}, err
	}
	return removed, nil
}

// HasCompanySubmissions reports whether any submission still names this company.
func (s *Store) HasCompanySubmissions(ctx context.Context, companyID string) (bool, error) {
	if companyID == "" {
		return false, nil
	}
	n, err := s.collection(submissionsCollection).CountDocuments(ctx, bson.D{{Key: "companyId", Value: companyID}})
	return n > 0, err
}

// SubmissionCompanyIDs lists every company a scout submission points at.
func (s *Store) SubmissionCompanyIDs(ctx context.Context) ([]string, error) {
	var ids []string
	err := s.collection(submissionsCollection).Distinct(ctx, "companyId", bson.D{{Key: "companyId", Value: bson.D{{Key: "$gt", Value: ""}}}}).Decode(&ids)
	// None comes back as "no documents".
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return ids, err
}
