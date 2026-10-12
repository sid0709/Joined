package statuspage

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/Joined/backend-core/monitoring"
)

var now = time.Date(2026, 10, 11, 15, 0, 0, 0, time.UTC)

func discard() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// fakeProm answers the current query with current and the uptime query with uptime.
type fakeProm struct {
	current map[string]float64
	uptime  map[string]float64
	err     error
	asked   []string
}

func (f *fakeProm) Query(_ context.Context, query string, at time.Time) ([]monitoring.Sample, error) {
	f.asked = append(f.asked, query+"@"+at.Format(time.RFC3339))
	if f.err != nil {
		return nil, f.err
	}
	values := f.current
	if strings.HasPrefix(query, "avg_over_time") {
		values = f.uptime
	}
	var out []monitoring.Sample
	for component, value := range values {
		out = append(out, monitoring.Sample{Labels: map[string]string{"component": component}, Value: value})
	}
	return out, nil
}

func (f *fakeProm) QueryRange(context.Context, string, time.Time, time.Time, time.Duration) ([]monitoring.Series, error) {
	return nil, nil
}

func component(t *testing.T, page Page, id string) ComponentView {
	t.Helper()
	for _, c := range page.Components {
		if c.ID == id {
			return c
		}
	}
	t.Fatalf("no component %q", id)
	return ComponentView{}
}

func TestPageFromProbes(t *testing.T) {
	store := &Memory{}
	_ = store.RecordUptime(context.Background(), "2026-10-10", map[string]float64{"api": 0.9}, now)
	_ = store.RecordUptime(context.Background(), "2026-10-11", map[string]float64{"api": 1}, now)
	prom := &fakeProm{current: map[string]float64{"website": 1, "api": 1, "search": 0}}

	page, err := NewService(prom, store, discard()).Page(context.Background(), now)
	if err != nil {
		t.Fatal(err)
	}
	if !page.Live || page.Status != Degraded {
		t.Fatalf("search down only degrades the site: %s live=%v", page.Status, page.Live)
	}
	if got := component(t, page, "search").Status; got != Degraded {
		t.Fatalf("search = %s", got)
	}
	api := component(t, page, "api")
	if len(api.Days) != HistoryDays || api.Days[HistoryDays-1].Date != "2026-10-11" {
		t.Fatalf("days run oldest to today: %d, last %s", len(api.Days), api.Days[len(api.Days)-1].Date)
	}
	if api.Days[HistoryDays-2].Tone != ToneDown || api.Days[0].Tone != ToneNone {
		t.Fatalf("90%% is down, unmeasured is none: %+v %+v", api.Days[HistoryDays-2], api.Days[0])
	}
	if api.Uptime == nil || *api.Uptime != 0.95 {
		t.Fatalf("uptime averages measured days: %v", api.Uptime)
	}
	if len(page.History) != PastIncidentDays || page.History[0].Date != "2026-10-11" {
		t.Fatalf("history starts today: %+v", page.History[0])
	}
}

func TestPageWithoutPrometheusUsesIncidents(t *testing.T) {
	store := &Memory{}
	ctx := context.Background()
	incident, err := store.CreateIncident(ctx, NewIncident{
		Title: "Slow sign-in", Impact: ImpactMajor, Components: []string{"api"}, Message: "Looking into it.",
	}, "staff@joined", now.Add(-26*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	prom := &fakeProm{err: monitoring.ErrUnavailable}

	page, err := NewService(prom, store, discard()).Page(ctx, now)
	if err != nil {
		t.Fatal(err)
	}
	if page.Live || page.Status != PartialOutage {
		t.Fatalf("status = %s live=%v", page.Status, page.Live)
	}
	if got := component(t, page, "website").Status; got != Unknown {
		t.Fatalf("unmeasured website = %s", got)
	}
	api := component(t, page, "api")
	for _, day := range api.Days[HistoryDays-2:] {
		if day.Tone != ToneDown || len(day.Incidents) != 1 {
			t.Fatalf("an ongoing major incident marks every day it spans: %+v", day)
		}
	}
	if len(page.Active) != 1 || page.Active[0].Updates[0].Message != "Looking into it." {
		t.Fatalf("active: %+v", page.Active)
	}

	// Resolving it clears the live status but keeps the history.
	if _, err := store.UpdateIncident(ctx, incident.ID, NewUpdate{Phase: Resolved, Message: "Fixed."}, "staff@joined", now); err != nil {
		t.Fatal(err)
	}
	page, _ = NewService(prom, store, discard()).Page(ctx, now.Add(time.Minute))
	if len(page.Active) != 0 || component(t, page, "api").Status != Unknown {
		t.Fatalf("resolved: %+v", page.Active)
	}
	if got := page.History[1].Incidents; len(got) != 1 || got[0].Phase != Resolved {
		t.Fatalf("yesterday lists the incident: %+v", got)
	}
}

func TestPageIsCached(t *testing.T) {
	prom := &fakeProm{current: map[string]float64{"api": 1}}
	svc := NewService(prom, &Memory{}, discard())
	_, _ = svc.Page(context.Background(), now)
	_, _ = svc.Page(context.Background(), now.Add(PageTTL/2))
	if len(prom.asked) != 1 {
		t.Fatalf("asked Prometheus %d times within the TTL", len(prom.asked))
	}
	_, _ = svc.Page(context.Background(), now.Add(PageTTL))
	if len(prom.asked) != 2 {
		t.Fatal("a stale page is rebuilt")
	}
}

func TestRecorderSavesTodayAndYesterday(t *testing.T) {
	store := &Memory{}
	prom := &fakeProm{uptime: map[string]float64{"api": 0.99, "not-a-component": 1}}
	if err := NewRecorder(prom, store, discard()).Record(context.Background(), now); err != nil {
		t.Fatal(err)
	}
	got, _ := store.Uptime(context.Background(), "2026-10-01")
	if got["api"]["2026-10-11"] != 0.99 || got["api"]["2026-10-10"] != 0.99 {
		t.Fatalf("uptime: %+v", got)
	}
	if _, ok := got["not-a-component"]; ok {
		t.Fatal("unknown components are not stored")
	}
	if !strings.Contains(prom.asked[0], "[54000s:1m]") || !strings.Contains(prom.asked[1], "[86400s:1m])@2026-10-11T00:00:00Z") {
		t.Fatalf("windows: %v", prom.asked)
	}
}

func TestIncidentValidation(t *testing.T) {
	store := &Memory{}
	ctx := context.Background()
	cases := []NewIncident{
		{Impact: ImpactMinor, Components: []string{"api"}, Message: "m"},
		{Title: "t", Impact: "huge", Components: []string{"api"}, Message: "m"},
		{Title: "t", Impact: ImpactMinor, Components: []string{"billing"}, Message: "m"},
		{Title: "t", Impact: ImpactMinor, Components: []string{"api"}, Message: "  "},
	}
	for _, in := range cases {
		if _, err := store.CreateIncident(ctx, in, "", now); !errors.Is(err, ErrInvalid) {
			t.Errorf("%+v: err = %v", in, err)
		}
	}
	if _, err := store.UpdateIncident(ctx, "missing", NewUpdate{Phase: Monitoring, Message: "m"}, "", now); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing incident: %v", err)
	}
}
