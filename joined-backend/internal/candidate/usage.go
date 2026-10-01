package candidate

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// JobUsage is how many candidates applied to a job and how many interviews
// those applications produced.
type JobUsage struct {
	Applications int
	Interviews   int
}

// UsageByJob counts applications and non-cancelled interviews for each job id.
func (s *Store) UsageByJob(ctx context.Context, jobIDs []string) (map[string]JobUsage, error) {
	usage := make(map[string]JobUsage, len(jobIDs))
	if len(jobIDs) == 0 {
		return usage, nil
	}
	cursor, err := s.collection(applicationsCollection).Find(
		ctx,
		bson.D{{Key: "jobId", Value: bson.D{{Key: "$in", Value: jobIDs}}}},
		options.Find().SetProjection(bson.D{{Key: "id", Value: 1}, {Key: "jobId", Value: 1}}),
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	jobByApplication := map[string]string{}
	for cursor.Next(ctx) {
		var app struct {
			ID    string `bson:"id"`
			JobID string `bson:"jobId"`
		}
		if err := cursor.Decode(&app); err != nil {
			return nil, err
		}
		entry := usage[app.JobID]
		entry.Applications++
		usage[app.JobID] = entry
		jobByApplication[app.ID] = app.JobID
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	if len(jobByApplication) == 0 {
		return usage, nil
	}

	applicationIDs := make([]string, 0, len(jobByApplication))
	for id := range jobByApplication {
		applicationIDs = append(applicationIDs, id)
	}
	interviews, err := s.collection(interviewsCollection).Find(
		ctx,
		bson.D{
			{Key: "applicationId", Value: bson.D{{Key: "$in", Value: applicationIDs}}},
			{Key: "status", Value: bson.D{{Key: "$ne", Value: StatusCancelled}}},
		},
		options.Find().SetProjection(bson.D{{Key: "applicationId", Value: 1}}),
	)
	if err != nil {
		return nil, err
	}
	defer interviews.Close(ctx)
	for interviews.Next(ctx) {
		var row struct {
			ApplicationID string `bson:"applicationId"`
		}
		if err := interviews.Decode(&row); err != nil {
			return nil, err
		}
		jobID := jobByApplication[row.ApplicationID]
		entry := usage[jobID]
		entry.Interviews++
		usage[jobID] = entry
	}
	return usage, interviews.Err()
}
