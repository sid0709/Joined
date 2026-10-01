package candidate

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	googleAuthURL    = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL   = "https://oauth2.googleapis.com/token"
	googleUserURL    = "https://www.googleapis.com/oauth2/v2/userinfo"
	googleEventsURL  = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
	googleEventScope = "https://www.googleapis.com/auth/calendar.events"
	googleEmailScope = "https://www.googleapis.com/auth/userinfo.email"
	maxGoogleBody    = 1 << 20
)

type Google struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	HTTP         *http.Client
}

func (g *Google) Configured() bool {
	return g != nil && g.ClientID != "" && g.ClientSecret != "" && g.RedirectURL != ""
}

func (g *Google) client() *http.Client {
	if g.HTTP != nil {
		return g.HTTP
	}
	return http.DefaultClient
}

func (g *Google) AuthURL(state string) string {
	values := url.Values{
		"client_id":     {g.ClientID},
		"redirect_uri":  {g.RedirectURL},
		"response_type": {"code"},
		"scope":         {googleEventScope + " " + googleEmailScope},
		"access_type":   {"offline"},
		"prompt":        {"consent"},
		"state":         {state},
	}
	return googleAuthURL + "?" + values.Encode()
}

func (g *Google) Exchange(ctx context.Context, code string) (GoogleAccount, error) {
	token, err := g.token(ctx, url.Values{
		"code":          {code},
		"client_id":     {g.ClientID},
		"client_secret": {g.ClientSecret},
		"redirect_uri":  {g.RedirectURL},
		"grant_type":    {"authorization_code"},
	})
	if err != nil {
		return GoogleAccount{}, err
	}
	email, err := g.email(ctx, token.AccessToken)
	if err != nil {
		return GoogleAccount{}, err
	}
	return GoogleAccount{Email: email, RefreshToken: token.RefreshToken}, nil
}

func (g *Google) ListEvents(ctx context.Context, refreshToken string, from, to time.Time) ([]CalEvent, error) {
	access, err := g.accessToken(ctx, refreshToken)
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
	res, err := g.client().Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, err := readBody(res)
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
	access, err := g.accessToken(ctx, refreshToken)
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
	res, err := g.client().Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, err := readBody(res)
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

type googleToken struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type googleEvent struct {
	ID          string `json:"id"`
	Status      string `json:"status"`
	Summary     string `json:"summary"`
	Description string `json:"description"`
	Location    string `json:"location"`
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

func (g *Google) accessToken(ctx context.Context, refreshToken string) (string, error) {
	token, err := g.token(ctx, url.Values{
		"refresh_token": {refreshToken},
		"client_id":     {g.ClientID},
		"client_secret": {g.ClientSecret},
		"grant_type":    {"refresh_token"},
	})
	if err != nil {
		return "", err
	}
	return token.AccessToken, nil
}

func (g *Google) token(ctx context.Context, values url.Values) (googleToken, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleTokenURL, strings.NewReader(values.Encode()))
	if err != nil {
		return googleToken{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := g.client().Do(req)
	if err != nil {
		return googleToken{}, err
	}
	defer res.Body.Close()
	body, err := readBody(res)
	if err != nil {
		return googleToken{}, err
	}
	if res.StatusCode >= 300 {
		return googleToken{}, fmt.Errorf("google token: %s", res.Status)
	}
	var token googleToken
	if err := json.Unmarshal(body, &token); err != nil {
		return googleToken{}, err
	}
	return token, nil
}

func (g *Google) email(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleUserURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	res, err := g.client().Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, err := readBody(res)
	if err != nil {
		return "", err
	}
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("google userinfo: %s", res.Status)
	}
	var payload struct {
		Email string `json:"email"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", err
	}
	return strings.ToLower(strings.TrimSpace(payload.Email)), nil
}

func readBody(res *http.Response) ([]byte, error) {
	return io.ReadAll(io.LimitReader(res.Body, maxGoogleBody))
}
