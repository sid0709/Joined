package candidate

import (
	"context"
	"errors"
	"log/slog"
	"sort"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/google"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// What the Interviews calendar can show from Google.
const (
	FeedConnected    = "connected"
	FeedNotConnected = "not_connected"
	// FeedReconnect means Google no longer accepts the saved grant: revoked, or
	// expired (Google ends grants after 7 days while an app is in Testing).
	FeedReconnect = "reconnect"
	// FeedUnavailable means Google could not be read just now.
	FeedUnavailable = "unavailable"

	// maxFeedDays covers a month view and the days around it.
	maxFeedDays = 62
)

// CalendarFeed is the job hunter's own Google Calendar beside their Joined interviews.
type CalendarFeed struct {
	Status string      `json:"status"`
	Email  string      `json:"email,omitempty"`
	Events []FeedEvent `json:"events"`
}

// FeedEvent is one Google Calendar event, read-only in Joined. Times are the job
// hunter's own clock in the zone the feed was asked for.
type FeedEvent struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	// Date is the start day, and EndDate the last day an all-day event covers.
	Date     string `json:"date"`
	EndDate  string `json:"endDate,omitempty"`
	Start    string `json:"start,omitempty"`
	End      string `json:"end,omitempty"`
	AllDay   bool   `json:"allDay"`
	Location string `json:"location,omitempty"`
	Link     string `json:"link,omitempty"`
}

// GoogleEvents reads the job hunter's Google Calendar from the first to the last
// day (YYYY-MM-DD) in zone. Events Joined already shows as interviews, imported
// or pushed, are left out so nothing appears twice.
func (s *Store) GoogleEvents(ctx context.Context, userID, firstDay, lastDay, zone string) (CalendarFeed, error) {
	from, to, err := feedRange(firstDay, lastDay, zone)
	if err != nil {
		return CalendarFeed{}, err
	}
	if s.calendar == nil || !s.calendar.Configured() {
		return CalendarFeed{Status: FeedNotConnected, Events: []FeedEvent{}}, nil
	}
	conn, err := s.connection(ctx, userID)
	if errors.Is(err, ErrNotFound) || (err == nil && conn.RefreshToken == "") {
		return CalendarFeed{Status: FeedNotConnected, Events: []FeedEvent{}}, nil
	}
	if err != nil {
		return CalendarFeed{}, err
	}
	feed := CalendarFeed{Status: FeedConnected, Email: conn.Email, Events: []FeedEvent{}}
	events, err := s.calendar.ListEvents(ctx, conn.RefreshToken, from, to, zone)
	if errors.Is(err, google.ErrInvalidGrant) {
		feed.Status = FeedReconnect
		return feed, nil
	}
	if err != nil {
		slog.Error("google calendar feed", "user", userID, "error", err)
		feed.Status = FeedUnavailable
		return feed, nil
	}
	linked, err := s.linkedGoogleEvents(ctx, userID)
	if err != nil {
		return CalendarFeed{}, err
	}
	feed.Events = feedEvents(events, linked)
	return feed, nil
}

// feedRange turns the requested days into the instants to ask Google for.
func feedRange(firstDay, lastDay, zone string) (time.Time, time.Time, error) {
	loc := time.UTC
	if zone != "" {
		var err error
		if loc, err = time.LoadLocation(zone); err != nil {
			return time.Time{}, time.Time{}, ErrInvalidInput
		}
	}
	from, err := time.ParseInLocation(dayLayout, firstDay, loc)
	if err != nil {
		return time.Time{}, time.Time{}, ErrInvalidInput
	}
	last, err := time.ParseInLocation(dayLayout, lastDay, loc)
	if err != nil || last.Before(from) || last.Sub(from) > maxFeedDays*24*time.Hour {
		return time.Time{}, time.Time{}, ErrInvalidInput
	}
	return from, last.AddDate(0, 0, 1), nil
}

// feedEvents keeps the events Joined does not already show, earliest first.
func feedEvents(events []CalEvent, linked map[string]bool) []FeedEvent {
	out := make([]FeedEvent, 0, len(events))
	for _, event := range events {
		if linked[event.GoogleID()] {
			continue
		}
		item := FeedEvent{
			ID:       event.GoogleID(),
			Title:    event.Title,
			Date:     event.Date,
			AllDay:   event.AllDay,
			Location: event.Where,
			Link:     event.Link,
		}
		if item.Title == "" {
			item.Title = "(No title)"
		}
		if event.AllDay {
			item.EndDate = event.EndDate
		} else {
			item.Start, item.End = event.Start, event.End
		}
		out = append(out, item)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Date != out[j].Date {
			return out[i].Date < out[j].Date
		}
		return out[i].AllDay && !out[j].AllDay || out[i].AllDay == out[j].AllDay && out[i].Start < out[j].Start
	})
	return out
}

// linkedGoogleEvents is every Google event ID the job hunter's interviews point to.
func (s *Store) linkedGoogleEvents(ctx context.Context, userID string) (map[string]bool, error) {
	var ids []string
	err := s.collection(interviewsCollection).Distinct(ctx, "googleEventId", bson.D{
		{Key: "userId", Value: userID},
		{Key: "googleEventId", Value: bson.D{{Key: "$exists", Value: true}, {Key: "$ne", Value: ""}}},
	}).Decode(&ids)
	// No linked interviews comes back as "no documents".
	if err != nil && !notFound(err) {
		return nil, err
	}
	linked := make(map[string]bool, len(ids))
	for _, id := range ids {
		linked[id] = true
	}
	return linked, nil
}
