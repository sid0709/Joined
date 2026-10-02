package candidate

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/google"
)

// fakeGoogle answers the token endpoint and the Calendar API.
type fakeGoogle func(req *http.Request) (int, string)

func (f fakeGoogle) RoundTrip(req *http.Request) (*http.Response, error) {
	status, body := f(req)
	return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
}

func calendarWith(f fakeGoogle) *Google {
	return &Google{
		OAuth:       &google.Client{ClientID: "id", ClientSecret: "secret", HTTP: &http.Client{Transport: f}},
		RedirectURL: "http://localhost/cb",
	}
}

func isTokenRequest(req *http.Request) bool {
	return req.URL.Host == "oauth2.googleapis.com"
}

func TestListEventsPagesInTheJobHuntersZone(t *testing.T) {
	var queries []string
	cal := calendarWith(func(req *http.Request) (int, string) {
		if isTokenRequest(req) {
			return http.StatusOK, `{"access_token":"at"}`
		}
		queries = append(queries, req.URL.RawQuery)
		if req.URL.Query().Get("pageToken") == "" {
			return http.StatusOK, `{"nextPageToken":"p2","items":[
				{"id":"a","summary":"Standup","htmlLink":"https://calendar.google.com/a","start":{"dateTime":"2026-10-05T15:00:00Z"},"end":{"dateTime":"2026-10-05T15:30:00Z"}},
				{"id":"gone","status":"cancelled","start":{"dateTime":"2026-10-05T16:00:00Z"},"end":{"dateTime":"2026-10-05T17:00:00Z"}}]}`
		}
		return http.StatusOK, `{"items":[{"id":"b","summary":"Trip","start":{"date":"2026-10-08"},"end":{"date":"2026-10-11"}}]}`
	})
	from := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	events, err := cal.ListEvents(context.Background(), "rt", from, from.AddDate(0, 1, 0), "America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	if len(queries) != 2 || !strings.Contains(queries[0], "timeZone=America%2FNew_York") || !strings.Contains(queries[1], "pageToken=p2") {
		t.Fatalf("queries = %v", queries)
	}
	if len(events) != 2 {
		t.Fatalf("events = %+v", events)
	}
	standup, trip := events[0], events[1]
	if standup.Date != "2026-10-05" || standup.Start != "11:00" || standup.End != "11:30" || standup.AllDay || standup.Link == "" {
		t.Errorf("15:00Z in New York should read 11:00: %+v", standup)
	}
	if !trip.AllDay || trip.Date != "2026-10-08" || trip.EndDate != "2026-10-10" {
		t.Errorf("all-day trip should cover Oct 8 to Oct 10: %+v", trip)
	}
}

func TestCalendarErrorsCarryGooglesReason(t *testing.T) {
	cal := calendarWith(func(req *http.Request) (int, string) {
		if isTokenRequest(req) {
			return http.StatusOK, `{"access_token":"at"}`
		}
		return http.StatusForbidden, `{"error":{"message":"Google Calendar API has not been used in project 1","errors":[{"reason":"accessNotConfigured"}]}}`
	})
	_, err := cal.ListEvents(context.Background(), "rt", time.Now(), time.Now().AddDate(0, 0, 1), "")
	if err == nil || !strings.Contains(err.Error(), "403") || !strings.Contains(err.Error(), "accessNotConfigured") {
		t.Fatalf("err = %v", err)
	}
	if got := calendarError("create", 500, []byte("not json")).Error(); got != "google calendar create: status 500" {
		t.Errorf("plain error = %q", got)
	}
}

func TestCreateEventUsesTheJobHuntersZone(t *testing.T) {
	var sent map[string]map[string]string
	cal := calendarWith(func(req *http.Request) (int, string) {
		if isTokenRequest(req) {
			return http.StatusOK, `{"access_token":"at"}`
		}
		var body map[string]json.RawMessage
		raw, _ := io.ReadAll(req.Body)
		_ = json.Unmarshal(raw, &body)
		sent = map[string]map[string]string{}
		for _, key := range []string{"start", "end"} {
			var when map[string]string
			_ = json.Unmarshal(body[key], &when)
			sent[key] = when
		}
		return http.StatusOK, `{"id":"new-event"}`
	})
	id, err := cal.CreateEvent(context.Background(), "rt", CalEvent{
		Title: "Acme · Onsite", Date: "2026-10-05", Start: "10:00", End: "11:00", TimeZone: "America/New_York",
	})
	if err != nil || id != "new-event" {
		t.Fatalf("id = %q, err = %v", id, err)
	}
	if sent["start"]["dateTime"] != "2026-10-05T10:00:00" || sent["start"]["timeZone"] != "America/New_York" || sent["end"]["dateTime"] != "2026-10-05T11:00:00" {
		t.Fatalf("10:00 local must stay 10:00 in its zone: %v", sent)
	}
	if utc := googleWhenFor("2026-10-05", "10:00", ""); utc["dateTime"] != "2026-10-05T10:00:00Z" || utc["timeZone"] != "UTC" {
		t.Errorf("no zone falls back to UTC: %v", utc)
	}
}

func TestFeedRangeBoundsTheRequest(t *testing.T) {
	from, to, err := feedRange("2026-09-27", "2026-11-07", "America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	if from.Format(time.RFC3339) != "2026-09-27T00:00:00-04:00" || to.Format(time.RFC3339) != "2026-11-08T00:00:00-05:00" {
		t.Errorf("range = %s .. %s", from.Format(time.RFC3339), to.Format(time.RFC3339))
	}
	bad := [][3]string{
		{"2026-10-10", "2026-10-01", ""},
		{"2026-01-01", "2026-06-01", ""},
		{"10/01/2026", "2026-10-31", ""},
		{"2026-10-01", "2026-10-31", "Mars/Olympus"},
	}
	for _, tc := range bad {
		if _, _, err := feedRange(tc[0], tc[1], tc[2]); err != ErrInvalidInput {
			t.Errorf("%v: err = %v, want ErrInvalidInput", tc, err)
		}
	}
}

func TestFeedEventsHidesWhatJoinedAlreadyShows(t *testing.T) {
	events := []CalEvent{
		{ID: "late", Title: "Dinner", Date: "2026-10-05", Start: "19:00", End: "20:00"},
		{ID: "pushed", Title: "Acme · Onsite", Date: "2026-10-05", Start: "10:00", End: "11:00"},
		{ID: "trip", Title: "Trip", Date: "2026-10-05", EndDate: "2026-10-06", Start: "09:00", End: "09:00", AllDay: true},
		{ID: "early", Date: "2026-10-05", Start: "08:00", End: "08:30"},
	}
	got := feedEvents(events, map[string]bool{"pushed": true})
	ids := make([]string, len(got))
	for i, event := range got {
		ids[i] = event.ID
	}
	if strings.Join(ids, ",") != "trip,early,late" {
		t.Fatalf("order = %v, want all-day first, then by start, without the linked interview", ids)
	}
	if got[0].Start != "" || got[0].EndDate != "2026-10-06" || got[1].Title != "(No title)" {
		t.Errorf("events = %+v", got)
	}
}
