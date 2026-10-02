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

const (
	googleEventsURL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
	// eventsPerPage is Google's maximum page size; maxEventPages caps one read.
	eventsPerPage = "250"
	maxEventPages = 4
	dayLayout     = "2006-01-02"
	clockLayout   = "15:04"
)

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

// ListEvents reads the primary calendar between from and to. zone (an IANA name)
// sets the clock the times come back in; blank keeps each event's own offset.
func (g *Google) ListEvents(ctx context.Context, refreshToken string, from, to time.Time, zone string) ([]CalEvent, error) {
	access, err := g.OAuth.AccessToken(ctx, refreshToken)
	if err != nil {
		return nil, err
	}
	var loc *time.Location
	if zone != "" {
		if loc, err = time.LoadLocation(zone); err != nil {
			return nil, ErrInvalidInput
		}
	}
	events := []CalEvent{}
	pageToken := ""
	for page := 0; page < maxEventPages; page++ {
		endpoint, err := url.Parse(googleEventsURL)
		if err != nil {
			return nil, err
		}
		query := endpoint.Query()
		query.Set("timeMin", from.UTC().Format(time.RFC3339))
		query.Set("timeMax", to.UTC().Format(time.RFC3339))
		query.Set("singleEvents", "true")
		query.Set("orderBy", "startTime")
		query.Set("maxResults", eventsPerPage)
		if zone != "" {
			query.Set("timeZone", zone)
		}
		if pageToken != "" {
			query.Set("pageToken", pageToken)
		}
		endpoint.RawQuery = query.Encode()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+access)
		body, err := g.call(req, "list")
		if err != nil {
			return nil, err
		}
		var payload struct {
			Items         []googleEvent `json:"items"`
			NextPageToken string        `json:"nextPageToken"`
		}
		if err := json.Unmarshal(body, &payload); err != nil {
			return nil, err
		}
		for _, item := range payload.Items {
			if item.Status == "cancelled" {
				continue
			}
			if event, ok := item.asCalEvent(loc); ok {
				events = append(events, event)
			}
		}
		if payload.NextPageToken == "" {
			break
		}
		pageToken = payload.NextPageToken
	}
	return events, nil
}

// CreateEvent adds an interview to the primary calendar. Date, Start, and End are
// the job hunter's own clock in event.TimeZone; blank means UTC.
func (g *Google) CreateEvent(ctx context.Context, refreshToken string, event CalEvent) (string, error) {
	access, err := g.OAuth.AccessToken(ctx, refreshToken)
	if err != nil {
		return "", err
	}
	payload, err := json.Marshal(map[string]any{
		"summary":     event.Title,
		"description": event.Description,
		"location":    event.Where,
		"start":       googleWhenFor(event.Date, event.Start, event.TimeZone),
		"end":         googleWhenFor(event.Date, event.End, event.TimeZone),
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
	body, err := g.call(req, "create")
	if err != nil {
		return "", err
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &created); err != nil {
		return "", err
	}
	return created.ID, nil
}

// call sends a Calendar API request and returns the body, or an error carrying
// Google's own reason (accessNotConfigured, insufficientPermissions, ...).
func (g *Google) call(req *http.Request, op string) ([]byte, error) {
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
		return nil, calendarError(op, res.StatusCode, body)
	}
	return body, nil
}

func calendarError(op string, status int, body []byte) error {
	var failure struct {
		Error struct {
			Message string `json:"message"`
			Errors  []struct {
				Reason string `json:"reason"`
			} `json:"errors"`
		} `json:"error"`
	}
	detail := ""
	if json.Unmarshal(body, &failure) == nil {
		if len(failure.Error.Errors) > 0 && failure.Error.Errors[0].Reason != "" {
			detail = failure.Error.Errors[0].Reason + ": "
		}
		detail += failure.Error.Message
	}
	if detail == "" {
		return fmt.Errorf("google calendar %s: status %d", op, status)
	}
	return fmt.Errorf("google calendar %s: status %d: %s", op, status, detail)
}

type googleEvent struct {
	ID          string     `json:"id"`
	Status      string     `json:"status"`
	Summary     string     `json:"summary"`
	Description string     `json:"description"`
	Location    string     `json:"location"`
	HTMLLink    string     `json:"htmlLink"`
	Start       googleWhen `json:"start"`
	End         googleWhen `json:"end"`
}

type googleWhen struct {
	Date     string `json:"date"`
	DateTime string `json:"dateTime"`
	TimeZone string `json:"timeZone,omitempty"`
}

// asCalEvent reads an event in loc, or in its own offset when loc is nil. An
// all-day event keeps Start "09:00" for the interview import; AllDay marks it.
func (e googleEvent) asCalEvent(loc *time.Location) (CalEvent, bool) {
	date, start := splitWhen(e.Start, loc)
	endDate, end := splitWhen(e.End, loc)
	if date == "" {
		return CalEvent{}, false
	}
	allDay := e.Start.Date != ""
	if allDay {
		// Google's all-day end date is exclusive; keep the last day the event covers.
		endDate = lastDay(date, endDate)
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
		EndDate:     endDate,
		Start:       start,
		End:         end,
		Where:       e.Location,
		AllDay:      allDay,
		Link:        e.HTMLLink,
	}, true
}

func splitWhen(when googleWhen, loc *time.Location) (date, clock string) {
	if when.Date != "" {
		return when.Date, ""
	}
	if when.DateTime == "" {
		return "", ""
	}
	parsed, err := time.Parse(time.RFC3339, when.DateTime)
	if err != nil {
		return "", ""
	}
	if loc != nil {
		parsed = parsed.In(loc)
	}
	return parsed.Format(dayLayout), parsed.Format(clockLayout)
}

// lastDay turns an exclusive all-day end into the last day covered, never before start.
func lastDay(start, exclusiveEnd string) string {
	end, err := time.Parse(dayLayout, exclusiveEnd)
	if err != nil {
		return start
	}
	last := end.AddDate(0, 0, -1).Format(dayLayout)
	if last < start {
		return start
	}
	return last
}

// googleWhenFor is a Calendar API start or end: local clock time in zone, or UTC
// when zone is blank.
func googleWhenFor(date, clock, zone string) map[string]string {
	if clock == "" {
		clock = "09:00"
	}
	if zone == "" {
		return map[string]string{"dateTime": date + "T" + clock + ":00Z", "timeZone": "UTC"}
	}
	return map[string]string{"dateTime": date + "T" + clock + ":00", "timeZone": zone}
}
