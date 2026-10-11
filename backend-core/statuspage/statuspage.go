// Package statuspage is the public status page (joinedhq.com/status): what each
// part of Joined is doing now, 90 days of daily uptime, and the incidents staff
// write. Live status comes from Prometheus probes labeled with a component
// (deploy/prometheus/prometheus.yml); daily uptime and incidents live in Mongo.
package statuspage

import "time"

// Status is how a component, or the whole site, is doing.
type Status string

const (
	Operational   Status = "operational"
	Degraded      Status = "degraded"
	PartialOutage Status = "partial_outage"
	MajorOutage   Status = "major_outage"
	// Unknown means nothing measured it: Prometheus did not answer, or no probe
	// carries this component yet.
	Unknown Status = "unknown"
)

// severity orders statuses; Unknown sits below every measured status so a
// monitoring gap never reads as an outage.
var severity = map[Status]int{Unknown: -1, Operational: 0, Degraded: 1, PartialOutage: 2, MajorOutage: 3}

// worse returns the more severe of two statuses.
func worse(a, b Status) Status {
	if severity[b] > severity[a] {
		return b
	}
	return a
}

// Component is one part of Joined the page lists. ID matches the probes'
// component label in deploy/prometheus/prometheus.yml.
type Component struct {
	ID          string
	Name        string
	Description string
	// DownStatus is what a failing probe means for people: an outage, or only
	// degraded when something else keeps the feature working.
	DownStatus Status
}

// Components are listed in this order on the page.
var Components = []Component{
	{
		ID:          "website",
		Name:        "Website",
		Description: "Job search, profiles, and applications in the browser.",
		DownStatus:  MajorOutage,
	},
	{
		ID:          "api",
		Name:        "API",
		Description: "Sign-in, saved jobs, applications, and messages.",
		DownStatus:  MajorOutage,
	},
	{
		ID:          "search",
		Name:        "Personalized search",
		Description: "Ranking jobs for you. While it is down, search still works without ranking.",
		DownStatus:  Degraded,
	},
}

// KnownComponent reports whether id is on the page.
func KnownComponent(id string) bool {
	for _, c := range Components {
		if c.ID == id {
			return true
		}
	}
	return false
}

const (
	// HistoryDays is how many daily bars each component shows.
	HistoryDays = 90
	// PastIncidentDays is how many days the incident history lists, today included.
	PastIncidentDays = 14
	// dayLayout is a UTC calendar day: the page's days run midnight to midnight UTC.
	dayLayout = "2006-01-02"
)

// dayOf is t's UTC calendar day.
func dayOf(t time.Time) string {
	return t.UTC().Format(dayLayout)
}

// startOfDay is midnight UTC on t's day.
func startOfDay(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
