package candidate

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const roleClosedActivity = "Role closed"

// NotifyJobClosed posts an in-app notice on each open applicant's thread and
// records "Role closed" on that application. Failures are logged, never
// returned: a missed notice must not undo the close. The backend has no
// outbound mailer; the application thread is the candidate notice channel.
func (s *Store) NotifyJobClosed(ctx context.Context, companyID, companyName, jobID, title, reason string, now time.Time) {
	if s == nil || strings.TrimSpace(companyID) == "" || strings.TrimSpace(jobID) == "" {
		return
	}
	apps, err := s.applicationsForJob(ctx, companyID, jobID)
	if err != nil {
		slog.Error("job close notify", "job", jobID, "error", err)
		return
	}
	text := jobClosedNotice(companyName, title, reason)
	for _, app := range closeNoticeAudience(companyID, jobID, apps) {
		if err := s.notifyOneJobClosed(ctx, app, text, now); err != nil {
			slog.Error("job close notify", "job", jobID, "application", app.ID, "error", err)
		}
	}
}

func (s *Store) notifyOneJobClosed(ctx context.Context, app Application, text string, now time.Time) error {
	thread, err := s.threadByApplication(ctx, app.ID)
	if errors.Is(err, ErrNotFound) {
		if ensureErr := s.ensureThread(ctx, app, now); ensureErr != nil {
			return ensureErr
		}
		thread, err = s.threadByApplication(ctx, app.ID)
	}
	if errors.Is(err, ErrNotFound) || (err == nil && thread.ID == "") {
		return nil
	}
	if err != nil {
		return err
	}
	if err := s.postJobClosedNotice(ctx, thread.ID, text, now); err != nil {
		return err
	}
	if err := s.noteRoleClosed(ctx, app, now); err != nil {
		slog.Error("job close activity", "application", app.ID, "error", err)
	}
	return nil
}

func (s *Store) applicationsForJob(ctx context.Context, companyID, jobID string) ([]Application, error) {
	cursor, err := s.collection(applicationsCollection).Find(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "jobId", Value: jobID},
	}, options.Find().SetSort(bson.D{{Key: "updated", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	items := []Application{}
	if err := cursor.All(ctx, &items); err != nil {
		return nil, err
	}
	for i := range items {
		items[i] = normalizeApplication(items[i])
	}
	return items, nil
}

func (s *Store) threadByApplication(ctx context.Context, applicationID string) (storedThread, error) {
	var doc storedThread
	err := s.collection(threadsCollection).FindOne(ctx, bson.D{{Key: "applicationId", Value: applicationID}}).Decode(&doc)
	if notFound(err) {
		return storedThread{}, ErrNotFound
	}
	if err != nil {
		return storedThread{}, err
	}
	return doc, nil
}

func (s *Store) postJobClosedNotice(ctx context.Context, threadID, text string, now time.Time) error {
	text = strings.TrimSpace(text)
	if threadID == "" || text == "" || len([]rune(text)) > maxMessage {
		return ErrInvalidInput
	}
	id, err := newPublicID()
	if err != nil {
		return err
	}
	_, err = s.collection(messagesCollection).InsertOne(ctx, Message{
		ID:        id,
		ThreadID:  threadID,
		From:      AuthorEvent,
		Text:      text,
		Notice:    true,
		CreatedAt: now.UTC(),
	})
	return err
}

func (s *Store) noteRoleClosed(ctx context.Context, app Application, now time.Time) error {
	event := prependEvent(nil, roleClosedActivity, now)[0]
	_, err := s.collection(applicationsCollection).UpdateOne(ctx, bson.D{
		{Key: "id", Value: app.ID},
		{Key: "companyId", Value: app.CompanyID},
	}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "updated", Value: now.UTC()}}},
		{Key: "$push", Value: bson.D{{Key: "activity", Value: bson.D{
			{Key: "$each", Value: []ApplicationEvent{event}},
			{Key: "$position", Value: 0},
		}}}},
	})
	return err
}

// closeNoticeAudience is the open applications on this job.
// Closed columns are already finished: withdrawn, rejected, hired, or no response.
// Saved rows are not applications. Hired and rejected company stages are terminal
// even when the candidate column was not rewritten.
func closeNoticeAudience(companyID, jobID string, apps []Application) []Application {
	companyID = strings.TrimSpace(companyID)
	jobID = strings.TrimSpace(jobID)
	if companyID == "" || jobID == "" {
		return nil
	}
	out := make([]Application, 0, len(apps))
	for _, app := range openApplications(apps) {
		if app.CompanyID != companyID || app.JobID != jobID || app.ID == "" {
			continue
		}
		stage := CompanyBoardStage(app.ColumnID, app.CompanyStage, app.ClosedReason)
		if stage == boardHired || stage == boardRejected {
			continue
		}
		out = append(out, app)
	}
	return out
}

func jobClosedNotice(company, title, reason string) string {
	company = strings.TrimSpace(company)
	title = strings.TrimSpace(title)
	reason = strings.TrimSpace(reason)
	if title == "" {
		title = "this role"
	}
	var lead string
	switch {
	case company != "" && reason != "":
		lead = company + " closed " + title + ": " + reason + ". It is no longer accepting applications."
	case company != "":
		lead = company + " closed " + title + ". It is no longer accepting applications."
	case reason != "":
		lead = title + " is closed: " + reason + ". It is no longer accepting applications."
	default:
		lead = title + " is closed and no longer accepting applications."
	}
	return clip(lead, maxMessage)
}
