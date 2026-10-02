package candidate

import (
	"context"
	"net/url"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type CalendarProvider interface {
	Configured() bool
	AuthURL(state string) string
	Exchange(ctx context.Context, code string) (GoogleAccount, error)
	ListEvents(ctx context.Context, refreshToken string, from, to time.Time, zone string) ([]CalEvent, error)
	CreateEvent(ctx context.Context, refreshToken string, event CalEvent) (string, error)
}

type GoogleAccount struct {
	Email        string
	RefreshToken string
}

type storedConnection struct {
	UserID       string    `bson:"userId"`
	Email        string    `bson:"email"`
	RefreshToken string    `bson:"refreshToken"`
	ConnectedAt  time.Time `bson:"connectedAt"`
}

type storedOAuthState struct {
	State     string    `bson:"state"`
	UserID    string    `bson:"userId"`
	ExpiresAt time.Time `bson:"expiresAt"`
}

const oauthStateTTL = 15 * time.Minute
const calendarHorizon = 90 * 24 * time.Hour

func (s *Store) CalendarStatus(ctx context.Context, userID string) (CalendarConnection, error) {
	conn, err := s.connection(ctx, userID)
	if err == ErrNotFound {
		return CalendarConnection{Connected: false}, nil
	}
	if err != nil {
		return CalendarConnection{}, err
	}
	return CalendarConnection{Connected: true, Email: conn.Email}, nil
}

func (s *Store) StartGoogle(ctx context.Context, userID string, now time.Time) (string, error) {
	if s.calendar == nil || !s.calendar.Configured() {
		return "", ErrNotConfigured
	}
	state, err := newPublicID()
	if err != nil {
		return "", err
	}
	_, err = s.collection(oauthStatesCollection).InsertOne(ctx, storedOAuthState{
		State:     state,
		UserID:    userID,
		ExpiresAt: now.UTC().Add(oauthStateTTL),
	})
	if err != nil {
		return "", err
	}
	return s.calendar.AuthURL(state), nil
}

func (s *Store) CompleteGoogle(ctx context.Context, state, code string, now time.Time) (string, error) {
	if s.calendar == nil || !s.calendar.Configured() {
		return "", ErrNotConfigured
	}
	var record storedOAuthState
	err := s.collection(oauthStatesCollection).FindOne(ctx, bson.D{{Key: "state", Value: state}}).Decode(&record)
	if notFound(err) {
		return "", ErrInvalidInput
	}
	if err != nil {
		return "", err
	}
	_, _ = s.collection(oauthStatesCollection).DeleteOne(ctx, bson.D{{Key: "state", Value: state}})
	if !record.ExpiresAt.After(now) {
		return "", ErrInvalidInput
	}
	account, err := s.calendar.Exchange(ctx, code)
	if err != nil {
		return "", err
	}
	if err := s.ConnectGoogle(ctx, record.UserID, account, now); err != nil {
		return "", err
	}
	return record.UserID, nil
}

// ConnectGoogle saves a job hunter's calendar grant and pulls in matching
// interviews. Sign in with Google calls it too when the calendar was granted.
func (s *Store) ConnectGoogle(ctx context.Context, userID string, account GoogleAccount, now time.Time) error {
	if account.RefreshToken == "" || account.Email == "" {
		return ErrInvalidInput
	}
	_, err := s.collection(calendarCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: userID}}, bson.D{
		{Key: "$set", Value: storedConnection{
			UserID:       userID,
			Email:        account.Email,
			RefreshToken: account.RefreshToken,
			ConnectedAt:  now.UTC(),
		}},
	}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return err
	}
	_, _ = s.SyncGoogle(ctx, userID, now)
	return nil
}

func (s *Store) DisconnectGoogle(ctx context.Context, userID string) error {
	_, err := s.collection(calendarCollection).DeleteOne(ctx, bson.D{{Key: "userId", Value: userID}})
	return err
}

func (s *Store) SyncGoogle(ctx context.Context, userID string, now time.Time) ([]Interview, error) {
	if s.calendar == nil || !s.calendar.Configured() {
		return nil, ErrNotConfigured
	}
	conn, err := s.connection(ctx, userID)
	if err != nil {
		return nil, err
	}
	events, err := s.calendar.ListEvents(ctx, conn.RefreshToken, now.Add(-24*time.Hour), now.Add(calendarHorizon), "")
	if err != nil {
		return nil, err
	}
	apps, err := s.listApplications(ctx, userID)
	if err != nil {
		return nil, err
	}
	created := []Interview{}
	for _, event := range events {
		app, ok := MatchOpenApplication(event.Title, event.Description, apps)
		if !ok {
			continue
		}
		if event.GoogleID() == "" {
			continue
		}
		exists, err := s.hasGoogleEvent(ctx, userID, event.ID)
		if err != nil {
			return nil, err
		}
		if exists {
			continue
		}
		item, err := buildInterview(userID, app, InterviewInput{
			ApplicationID: app.ID,
			Round:         clip(event.Title, 80),
			Date:          event.Date,
			Start:         event.Start,
			End:           event.End,
			Format:        "video",
			Where:         event.Where,
			Status:        StatusUnconfirmed,
			Source:        SourceCalendar,
		}, now)
		if err != nil {
			continue
		}
		item.GoogleEventID = event.ID
		if _, err := s.collection(interviewsCollection).InsertOne(ctx, item); err != nil {
			if isDup(err) {
				continue
			}
			return nil, err
		}
		if err := s.setApplicationStage(ctx, userID, app.ID, stageOnInterviewScheduled(app.ColumnID), "Interview invite from calendar", now); err != nil {
			return nil, err
		}
		created = append(created, normalizeInterview(item))
	}
	return created, nil
}

func (e CalEvent) GoogleID() string {
	return strings.TrimSpace(e.ID)
}

func (s *Store) connection(ctx context.Context, userID string) (storedConnection, error) {
	var conn storedConnection
	err := s.collection(calendarCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&conn)
	if notFound(err) {
		return storedConnection{}, ErrNotFound
	}
	if err != nil {
		return storedConnection{}, err
	}
	return conn, nil
}

func (s *Store) hasGoogleEvent(ctx context.Context, userID, eventID string) (bool, error) {
	err := s.collection(interviewsCollection).FindOne(ctx, bson.D{
		{Key: "userId", Value: userID},
		{Key: "googleEventId", Value: eventID},
	}).Err()
	if notFound(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func SettingsRedirect(origin, result string) string {
	origin = strings.TrimRight(origin, "/")
	values := url.Values{}
	if result != "" {
		values.Set("calendar", result)
	}
	next := origin + "/settings"
	if encoded := values.Encode(); encoded != "" {
		next += "?" + encoded
	}
	return next
}
