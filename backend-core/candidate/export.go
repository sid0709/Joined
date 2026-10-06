package candidate

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// UserExport is the candidate rows one account owns. Refresh tokens and
// schedule secrets are not fields on these types.
type UserExport struct {
	Profile      *storedProfile   `json:"profile,omitempty"`
	Resumes      []ResumeExport   `json:"resumes"`
	SavedJobs    []SavedJob       `json:"savedJobs"`
	Applications []Application    `json:"applications"`
	Interviews   []Interview      `json:"interviews"`
	Calendar     []CalendarExport `json:"calendarConnections"`
	Messages     []MessageExport  `json:"messages"`
}

// ResumeExport is a résumé label or file URL already stored for this account.
type ResumeExport struct {
	Label   string `json:"label,omitempty"`
	FileURL string `json:"fileUrl,omitempty"`
}

// CalendarExport is a connected calendar without its refresh token.
type CalendarExport struct {
	Email       string    `json:"email,omitempty"`
	ConnectedAt time.Time `json:"connectedAt"`
}

// MessageExport is one message the account can already see.
// Counterpart is an opaque id plus the display name on the thread.
type MessageExport struct {
	ID              string    `json:"id"`
	ThreadID        string    `json:"threadId"`
	AuthorID        string    `json:"authorId"`
	CounterpartID   string    `json:"counterpartId"`
	CounterpartName string    `json:"counterpartName"`
	Text            string    `json:"text"`
	CreatedAt       time.Time `json:"createdAt"`
}

func emptyUserExport() UserExport {
	return UserExport{
		Resumes:      []ResumeExport{},
		SavedJobs:    []SavedJob{},
		Applications: []Application{},
		Interviews:   []Interview{},
		Calendar:     []CalendarExport{},
		Messages:     []MessageExport{},
	}
}

// ExportUser reads rows owned by userID. A store without Mongo returns an empty bundle.
func (s *Store) ExportUser(ctx context.Context, userID string) (UserExport, error) {
	if s == nil || s.client == nil || userID == "" {
		return emptyUserExport(), nil
	}
	out := emptyUserExport()
	var profile storedProfile
	err := s.collection(profilesCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&profile)
	if err != nil && !notFound(err) {
		return UserExport{}, err
	}
	if err == nil {
		out.Profile = &profile
	}
	saved, err := s.listSaved(ctx, userID)
	if err != nil {
		return UserExport{}, err
	}
	out.SavedJobs = saved
	apps, err := s.listApplications(ctx, userID)
	if err != nil {
		return UserExport{}, err
	}
	out.Applications = apps
	out.Resumes = resumeExports(apps)
	interviews, err := s.listInterviews(ctx, bson.D{{Key: "userId", Value: userID}})
	if err != nil {
		return UserExport{}, err
	}
	out.Interviews = interviews
	out.Calendar, err = s.exportCalendar(ctx, userID)
	if err != nil {
		return UserExport{}, err
	}
	out.Messages, err = s.exportMessages(ctx, userID)
	if err != nil {
		return UserExport{}, err
	}
	return out, nil
}

func resumeExports(apps []Application) []ResumeExport {
	seen := map[string]struct{}{}
	out := []ResumeExport{}
	for _, app := range apps {
		label := app.Resume
		if label == "" {
			continue
		}
		if _, ok := seen[label]; ok {
			continue
		}
		seen[label] = struct{}{}
		out = append(out, ResumeExport{Label: label})
	}
	if out == nil {
		return []ResumeExport{}
	}
	return out
}

func (s *Store) exportCalendar(ctx context.Context, userID string) ([]CalendarExport, error) {
	var conn storedConnection
	err := s.collection(calendarCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&conn)
	if notFound(err) {
		return []CalendarExport{}, nil
	}
	if err != nil {
		return nil, err
	}
	return []CalendarExport{calendarExport(conn)}, nil
}

func calendarExport(conn storedConnection) CalendarExport {
	return CalendarExport{Email: conn.Email, ConnectedAt: conn.ConnectedAt}
}

func (s *Store) exportMessages(ctx context.Context, userID string) ([]MessageExport, error) {
	cursor, err := s.collection(threadsCollection).Find(ctx, bson.D{{Key: "candidateUserId", Value: userID}})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	docs := []storedThread{}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := []MessageExport{}
	for _, doc := range docs {
		if doc.CandidateUserID != userID {
			continue
		}
		msgs, err := s.threadMessages(ctx, doc.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, messageExports(doc.CompanyID, doc.CompanyName, msgs)...)
	}
	return out, nil
}

func messageExports(counterpartID, counterpartName string, msgs []Message) []MessageExport {
	out := make([]MessageExport, 0, len(msgs))
	for _, msg := range msgs {
		out = append(out, MessageExport{
			ID:              msg.ID,
			ThreadID:        msg.ThreadID,
			AuthorID:        msg.AuthorID,
			CounterpartID:   counterpartID,
			CounterpartName: counterpartName,
			Text:            msg.Text,
			CreatedAt:       msg.CreatedAt,
		})
	}
	return out
}
