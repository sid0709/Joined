package statuspage

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/monitoring"
)

// PageTTL is how long one built page is served before it is built again. The
// page is public and gets busiest during an outage; this keeps Prometheus and
// Mongo out of that traffic.
const PageTTL = 30 * time.Second

// Day thresholds: below these a day's bar turns orange, then red.
const (
	degradedBelow = 0.999
	downBelow     = 0.95
)

// Day tones for the bars.
const (
	ToneUp       = "up"
	ToneDegraded = "degraded"
	ToneDown     = "down"
	ToneNone     = "none"
)

// Page is what joinedhq.com/status shows.
type Page struct {
	Status Status `json:"status"`
	// Live is false when Prometheus did not answer: statuses then come from
	// incidents alone.
	Live       bool             `json:"live"`
	UpdatedAt  time.Time        `json:"updatedAt"`
	Components []ComponentView  `json:"components"`
	Active     []PublicIncident `json:"activeIncidents"`
	// History is the last PastIncidentDays days, today first, each with the
	// incidents that started that day.
	History []IncidentDay `json:"history"`
}

// ComponentView is one component's row.
type ComponentView struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      Status `json:"status"`
	// Uptime is the average over the measured days, or nil before any.
	Uptime *float64  `json:"uptime"`
	Days   []DayView `json:"days"`
}

// DayView is one bar: oldest first, today last.
type DayView struct {
	Date      string   `json:"date"`
	Uptime    *float64 `json:"uptime"`
	Tone      string   `json:"tone"`
	Incidents []string `json:"incidents,omitempty"`
}

// PublicIncident is an incident without staff names.
type PublicIncident struct {
	ID         string         `json:"id"`
	Title      string         `json:"title"`
	Impact     Impact         `json:"impact"`
	Phase      Phase          `json:"status"`
	Components []string       `json:"components"`
	Updates    []PublicUpdate `json:"updates"`
	CreatedAt  time.Time      `json:"createdAt"`
	ResolvedAt *time.Time     `json:"resolvedAt,omitempty"`
}

// PublicUpdate is one timeline post without its author.
type PublicUpdate struct {
	Phase   Phase     `json:"status"`
	Message string    `json:"message"`
	At      time.Time `json:"at"`
}

// IncidentDay is one day of the incident history.
type IncidentDay struct {
	Date      string           `json:"date"`
	Incidents []PublicIncident `json:"incidents"`
}

// Service builds the page, cached for PageTTL.
type Service struct {
	prom  monitoring.Querier
	store Store
	log   *slog.Logger

	mu    sync.Mutex
	page  Page
	until time.Time
}

// NewService builds pages from prom (nil: incidents only) and store.
func NewService(prom monitoring.Querier, store Store, log *slog.Logger) *Service {
	return &Service{prom: prom, store: store, log: log}
}

// Page returns the cached page, or builds it when the cache is stale.
func (s *Service) Page(ctx context.Context, now time.Time) (Page, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if now.Before(s.until) {
		return s.page, nil
	}
	page, err := s.build(ctx, now)
	if err != nil {
		return Page{}, err
	}
	s.page, s.until = page, now.Add(PageTTL)
	return page, nil
}

func (s *Service) build(ctx context.Context, now time.Time) (Page, error) {
	today := startOfDay(now)
	first := today.AddDate(0, 0, -(HistoryDays - 1))
	uptime, err := s.store.Uptime(ctx, dayOf(first))
	if err != nil {
		return Page{}, err
	}
	incidents, err := s.store.Incidents(ctx, first)
	if err != nil {
		return Page{}, err
	}
	current, live := s.current(ctx, now)
	return assemble(now, current, live, uptime, incidents), nil
}

// current is each component's probe result now (1 up, 0 down). live is false
// when Prometheus could not be asked.
func (s *Service) current(ctx context.Context, now time.Time) (map[string]float64, bool) {
	if s.prom == nil {
		return nil, false
	}
	samples, err := s.prom.Query(ctx, currentQuery, now)
	if err != nil {
		s.log.Warn("status current", "error", err)
		return nil, false
	}
	out := make(map[string]float64, len(samples))
	for _, sample := range samples {
		out[sample.Labels["component"]] = sample.Value
	}
	return out, true
}

// assemble is the page from what was read; it does no I/O.
func assemble(now time.Time, current map[string]float64, live bool, uptime map[string]map[string]float64, incidents []Incident) Page {
	today := startOfDay(now)
	page := Page{Status: Unknown, Live: live, UpdatedAt: now.UTC()}
	for _, incident := range incidents {
		if incident.active() {
			page.Active = append(page.Active, public(incident))
		}
	}
	for _, component := range Components {
		view := ComponentView{ID: component.ID, Name: component.Name, Description: component.Description, Status: Unknown}
		if probe, ok := current[component.ID]; ok {
			view.Status = Operational
			if probe < 1 {
				view.Status = component.DownStatus
			}
		}
		for _, incident := range incidents {
			if incident.active() && affects(incident, component.ID) {
				view.Status = worse(view.Status, incident.Impact.status())
			}
		}
		view.Days, view.Uptime = days(component.ID, today, now, uptime[component.ID], incidents)
		page.Components = append(page.Components, view)
		page.Status = worse(page.Status, view.Status)
	}
	page.History = history(today, incidents)
	return page
}

func days(component string, today, now time.Time, uptime map[string]float64, incidents []Incident) ([]DayView, *float64) {
	out := make([]DayView, 0, HistoryDays)
	var total float64
	var measured int
	for offset := HistoryDays - 1; offset >= 0; offset-- {
		start := today.AddDate(0, 0, -offset)
		end := start.Add(24 * time.Hour)
		day := DayView{Date: dayOf(start), Tone: ToneNone}
		if value, ok := uptime[day.Date]; ok {
			day.Uptime = &value
			day.Tone = uptimeTone(value)
			total += value
			measured++
		}
		for _, incident := range incidents {
			if !affects(incident, component) || !incident.CreatedAt.Before(end) || incident.end(now).Before(start) {
				continue
			}
			day.Incidents = append(day.Incidents, incident.Title)
			day.Tone = worseTone(day.Tone, impactTone(incident.Impact))
		}
		out = append(out, day)
	}
	if measured == 0 {
		return out, nil
	}
	average := total / float64(measured)
	return out, &average
}

func history(today time.Time, incidents []Incident) []IncidentDay {
	out := make([]IncidentDay, 0, PastIncidentDays)
	for offset := 0; offset < PastIncidentDays; offset++ {
		date := dayOf(today.AddDate(0, 0, -offset))
		day := IncidentDay{Date: date, Incidents: []PublicIncident{}}
		for _, incident := range incidents {
			if dayOf(incident.CreatedAt) == date {
				day.Incidents = append(day.Incidents, public(incident))
			}
		}
		out = append(out, day)
	}
	return out
}

func affects(incident Incident, component string) bool {
	for _, id := range incident.Components {
		if id == component {
			return true
		}
	}
	return false
}

func public(incident Incident) PublicIncident {
	updates := make([]PublicUpdate, len(incident.Updates))
	for i, u := range incident.Updates {
		updates[i] = PublicUpdate{Phase: u.Phase, Message: u.Message, At: u.At}
	}
	return PublicIncident{
		ID: incident.ID, Title: incident.Title, Impact: incident.Impact, Phase: incident.Phase,
		Components: incident.Components, Updates: updates,
		CreatedAt: incident.CreatedAt, ResolvedAt: incident.ResolvedAt,
	}
}

var toneRank = map[string]int{ToneNone: 0, ToneUp: 1, ToneDegraded: 2, ToneDown: 3}

func worseTone(a, b string) string {
	if toneRank[b] > toneRank[a] {
		return b
	}
	return a
}

func uptimeTone(uptime float64) string {
	switch {
	case uptime < downBelow:
		return ToneDown
	case uptime < degradedBelow:
		return ToneDegraded
	default:
		return ToneUp
	}
}

// impactTone is the bar colour an incident gives its days. An incident with no
// impact (a notice) leaves the bar as measured.
func impactTone(impact Impact) string {
	switch impact {
	case ImpactMajor, ImpactCritical:
		return ToneDown
	case ImpactMinor:
		return ToneDegraded
	default:
		return ToneNone
	}
}
