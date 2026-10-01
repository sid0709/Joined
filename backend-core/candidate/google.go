package candidate

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/google"
)

const googleEventsURL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

// Google is the job hunter's Google Calendar, reached through the shared OAuth client.
type Google struct {
	OAuth *google.Client
	// RedirectURL is joined-backend's calendar callback, registered in Google Cloud.
	RedirectURL string
}

func (g *Google) Configured() bool {
	return g != nil && g.OAuth.Configured() && g.RedirectURL != ""
}

// AuthURL asks for calendar access. It always shows the consent screen so Google
// sends a refresh token even when the person granted the calendar before.
func (g *Google) AuthURL(state string) string {
	return g.OAuth.AuthURL(google.AuthRequest{
		RedirectURL: g.RedirectURL,
		Scopes:      []string{google.ScopeOpenID, google.ScopeEmail, google.ScopeCalendarEvents},
		State:       state,
		Offline:     true,
		Consent:     true,
	})
}

func (g *Google) Exchange(ctx context.Context, code string) (GoogleAccount, error) {
	token, err := g.OAuth.Exchange(ctx, code, g.RedirectURL, "")
	if err != nil {
		return GoogleAccount{}, err
	}
	profile, err := g.OAuth.Profile(ctx, token.AccessToken)
	if err != nil {
		return GoogleAccount{}, err
	}
	return GoogleAccount{Email: profile.Email, RefreshToken: token.RefreshToken}, nil
}

func (g *Google) ListEvents(ctx context.Context, refreshToken string, from, to time.Time) ([]CalEvent, error) {
	access, err := g.OAuth.AccessToken(ctx, refreshToken)
	if err != nil {
		return nil, err
	}
	endpoint, err := url.Parse(googleEventsURL)
	if err != nil {
		return nil, err
	}
	query := endpoint.Query()
	query.Set("timeMin", from.UTC().Format(time.RFC3339))
	query.Set("timeMax", to.UTC().Format(time.RFC3339))
	query.Set("singleEvents", "true")
	query.Set("orderBy", "startTime")
	query.Set("maxResults", "50")
	endpoint.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+access)
	res, err := g.OAuth.HTTPClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, err := google.ReadBody(res)
	if err != nil {
		return nil, err
	}
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("google calendar list: %s", res.Status)
	}
	var payload struct {
		Items []googleEvent `json:"items"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	events := make([]CalEvent, 0, len(payload.Items))
	for _, item := range payload.Items {
		if item.Status == "cancelled" {
			continue
		}
		event, ok := item.asCalEvent()
		if ok {
			events = append(events, event)
		}
	}
	return events, nil
}

func (g *Google) CreateEvent(ctx context.Context, refreshToken string, event CalEvent) (string, error) {
	access, err := g.OAuth.AccessToken(ctx, refreshToken)
	if err != nil {
		return "", err
	}
	start := googleDateTime(event.Date, event.Start)
	end := googleDateTime(event.Date, event.End)
	payload, err := json.Marshal(map[string]any{
		"summary":     event.Title,
		"description": event.Description,
		"location":    event.Where,
		"start":       map[string]string{"dateTime": start, "timeZone": "UTC"},
		"end":         map[string]string{"dateTime": end, "timeZone": "UTC"},
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleEventsURL, strings.NewReader(string(payload)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+access)
	req.Header.Set("Content-Type", "application/json")
	res, err := g.OAuth.HTTPClient().Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, err := google.ReadBody(res)
	if err != nil {
		return "", err
	}
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("google calendar create: %s", res.Status)
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &created); err != nil {
		return "", err
	}
	return created.ID, nil
}

type googleEvent struct {
	ID          string     `json:"id"`
	Status      string     `json:"status"`
	Summary     string     `json:"summary"`
	Description string     `json:"description"`
	Location    string     `json:"location"`
	Start       googleWhen `json:"start"`
	End         googleWhen `json:"end"`
}

type googleWhen struct {
	Date     string `json:"date"`
	DateTime string `json:"dateTime"`
}

func (e googleEvent) asCalEvent() (CalEvent, bool) {
	date, start := splitWhen(e.Start)
	_, end := splitWhen(e.End)
	if date == "" {
		return CalEvent{}, false
	}
	if start == "" {
		start = "09:00"
	}
	if end == "" {
		end = start
	}
	return CalEvent{
		ID:          e.ID,
		Title:       e.Summary,
		Description: e.Description,
		Date:        date,
		Start:       start,
		End:         end,
		Where:       e.Location,
	}, true
}

func splitWhen(when googleWhen) (date, clock string) {
	if when.Date != "" {
		return when.Date, ""
	}
	if when.DateTime == "" {
		return "", ""
	}
	parsed, err := time.Parse(time.RFC3339, when.DateTime)
	if err != nil {
		parsed, err = time.Parse("2006-01-02T15:04:05-07:00", when.DateTime)
	}
	if err != nil {
		return "", ""
	}
	return parsed.Format("2006-01-02"), parsed.Format("15:04")
}

func googleDateTime(date, clock string) string {
	if clock == "" {
		clock = "09:00"
	}
	return date + "T" + clock + ":00Z"
}
