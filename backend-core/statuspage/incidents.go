package statuspage

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// Impact is how bad an incident is for people.
type Impact string

const (
	ImpactNone     Impact = "none"
	ImpactMinor    Impact = "minor"
	ImpactMajor    Impact = "major"
	ImpactCritical Impact = "critical"
)

// status is the component status an unresolved incident of this impact implies.
func (i Impact) status() Status {
	switch i {
	case ImpactMinor:
		return Degraded
	case ImpactMajor:
		return PartialOutage
	case ImpactCritical:
		return MajorOutage
	default:
		return Operational
	}
}

func (i Impact) valid() bool {
	switch i {
	case ImpactNone, ImpactMinor, ImpactMajor, ImpactCritical:
		return true
	}
	return false
}

// Phase is where an incident stands.
type Phase string

const (
	Investigating Phase = "investigating"
	Identified    Phase = "identified"
	Monitoring    Phase = "monitoring"
	Resolved      Phase = "resolved"
)

func (p Phase) valid() bool {
	switch p {
	case Investigating, Identified, Monitoring, Resolved:
		return true
	}
	return false
}

const (
	maxTitleChars   = 200
	maxMessageChars = 5000
)

var (
	// ErrInvalid wraps a reason the incident or update cannot be saved.
	ErrInvalid = errors.New("invalid incident")
	// ErrNotFound means no incident has that id.
	ErrNotFound = errors.New("incident not found")
)

// Update is one post on an incident's timeline.
type Update struct {
	Phase   Phase     `json:"status" bson:"status"`
	Message string    `json:"message" bson:"message"`
	At      time.Time `json:"at" bson:"at"`
	// By is the staff member who posted it. The public page leaves it out.
	By string `json:"by,omitempty" bson:"by,omitempty"`
}

// Incident is something staff tell people about, from first post to resolved.
type Incident struct {
	ID         string   `json:"id" bson:"_id"`
	Title      string   `json:"title" bson:"title"`
	Impact     Impact   `json:"impact" bson:"impact"`
	Components []string `json:"components" bson:"components"`
	Phase      Phase    `json:"status" bson:"status"`
	// Updates are newest first.
	Updates    []Update   `json:"updates" bson:"updates"`
	CreatedAt  time.Time  `json:"createdAt" bson:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt" bson:"updatedAt"`
	ResolvedAt *time.Time `json:"resolvedAt,omitempty" bson:"resolvedAt,omitempty"`
}

// active reports whether the incident still affects its components.
func (i Incident) active() bool {
	return i.Phase != Resolved
}

// end is when the incident stopped mattering: resolved, or still going at now.
func (i Incident) end(now time.Time) time.Time {
	if i.ResolvedAt != nil {
		return *i.ResolvedAt
	}
	return now
}

// NewIncident opens an incident with its first update.
type NewIncident struct {
	Title      string   `json:"title"`
	Impact     Impact   `json:"impact"`
	Components []string `json:"components"`
	Phase      Phase    `json:"status"`
	Message    string   `json:"message"`
}

// NewUpdate posts to an incident. Impact, when set, changes the incident's impact.
type NewUpdate struct {
	Phase   Phase   `json:"status"`
	Message string  `json:"message"`
	Impact  *Impact `json:"impact,omitempty"`
}

func invalid(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, args...))
}

func cleanMessage(message string) (string, error) {
	message = strings.TrimSpace(message)
	if message == "" {
		return "", invalid("message is required")
	}
	if utf8.RuneCountInString(message) > maxMessageChars {
		return "", invalid("message is longer than %d characters", maxMessageChars)
	}
	return message, nil
}

// incident builds the stored incident from staff input, or says what is wrong.
func (n NewIncident) incident(id, by string, now time.Time) (Incident, error) {
	title := strings.TrimSpace(n.Title)
	if title == "" {
		return Incident{}, invalid("title is required")
	}
	if utf8.RuneCountInString(title) > maxTitleChars {
		return Incident{}, invalid("title is longer than %d characters", maxTitleChars)
	}
	if !n.Impact.valid() {
		return Incident{}, invalid("impact must be none, minor, major, or critical")
	}
	phase := n.Phase
	if phase == "" {
		phase = Investigating
	}
	if !phase.valid() {
		return Incident{}, invalid("status must be investigating, identified, monitoring, or resolved")
	}
	components, err := cleanComponents(n.Components)
	if err != nil {
		return Incident{}, err
	}
	message, err := cleanMessage(n.Message)
	if err != nil {
		return Incident{}, err
	}
	now = now.UTC()
	incident := Incident{
		ID:         id,
		Title:      title,
		Impact:     n.Impact,
		Components: components,
		Phase:      phase,
		Updates:    []Update{{Phase: phase, Message: message, At: now, By: by}},
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if phase == Resolved {
		incident.ResolvedAt = &now
	}
	return incident, nil
}

// update checks a post and returns it ready to store.
func (n NewUpdate) update(by string, now time.Time) (Update, error) {
	if !n.Phase.valid() {
		return Update{}, invalid("status must be investigating, identified, monitoring, or resolved")
	}
	if n.Impact != nil && !n.Impact.valid() {
		return Update{}, invalid("impact must be none, minor, major, or critical")
	}
	message, err := cleanMessage(n.Message)
	if err != nil {
		return Update{}, err
	}
	return Update{Phase: n.Phase, Message: message, At: now.UTC(), By: by}, nil
}

// apply records an update on the incident in memory, the way the Mongo store does.
func (i *Incident) apply(u Update, impact *Impact) {
	i.Updates = append([]Update{u}, i.Updates...)
	i.Phase = u.Phase
	i.UpdatedAt = u.At
	if impact != nil {
		i.Impact = *impact
	}
	if u.Phase == Resolved {
		at := u.At
		i.ResolvedAt = &at
	} else {
		i.ResolvedAt = nil
	}
}

func cleanComponents(ids []string) ([]string, error) {
	seen := make(map[string]bool, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		if !KnownComponent(id) {
			return nil, invalid("unknown component %q", id)
		}
		seen[id] = true
		out = append(out, id)
	}
	if len(out) == 0 {
		return nil, invalid("pick at least one component")
	}
	return out, nil
}
