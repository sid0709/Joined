package monitoring

import (
	"strconv"
	"time"
)

const (
	// slotStep is one bar on today's strip. A UTC day is SlotsPerDay of these.
	slotStep = 15 * time.Minute
	// SlotsPerDay is how many 15-minute bars today draws, including the future.
	SlotsPerDay = 96
	// HistoryDays is the daily strip, matching the public status page.
	HistoryDays = 90

	downBelow     = 0.95
	degradedBelow = 0.999

	dayLayout = "2006-01-02"
)

// Slot is one 15-minute bar.
type Slot struct {
	At     time.Time `json:"at"`
	Tone   string    `json:"tone"`
	Uptime *float64  `json:"uptime"`
}

// Day is one UTC day on the 90-day strip.
type Day struct {
	Date   string   `json:"date"`
	Uptime *float64 `json:"uptime"`
	Tone   string   `json:"tone"`
}

// Strip is the VPS or one service: live state, today in 15-minute bars, and 90 days.
type Strip struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	TodayUptime *float64 `json:"todayUptime"`
	LatencyMS   *float64 `json:"latencyMs,omitempty"`
	Up          *bool    `json:"up,omitempty"`
	Today       []Slot   `json:"today"`
	Days        []Day    `json:"days"`
}

// Public components, in the order the status page lists them.
var componentStrips = []struct{ ID, Name string }{
	{"website", "Website"},
	{"api", "API"},
	{"search", "Personalized search"},
}

type slotQuery struct {
	name  string
	query string
}

// slotQueries are range queries from 00:15 UTC through now, step 15m.
// Each point is the end of its bucket.
var slotQueries = []slotQuery{
	{name: "component", query: `min by (component) (avg_over_time(probe_success{component!=""}[15m]))`},
	{name: "instance", query: `avg_over_time(probe_success[15m])`},
	{name: "cpu", query: `max_over_time((100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))))[15m:1m])`},
	{name: "memory", query: `max_over_time((100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))[15m:1m])`},
	{name: "disk", query: `max_over_time((100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}))[15m:1m])`},
}

func startOfDay(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func emptyToday(day time.Time) []Slot {
	out := make([]Slot, SlotsPerDay)
	for i := range out {
		out[i] = Slot{At: day.Add(time.Duration(i) * slotStep), Tone: ToneNone}
	}
	return out
}

// ToneNone is a bar with nothing measured, including the rest of today.
const ToneNone = "none"

func buildStrips(now time.Time, slots map[string][]Series, services []ServiceStatus) []Strip {
	day := startOfDay(now)
	host := Strip{ID: HostID, Name: "VPS", Today: emptyToday(day)}
	fillHost(&host, now, slots)
	out := []Strip{host}

	byComponent := map[string][]ServiceStatus{}
	for _, service := range services {
		if service.Kind == "probe" && service.Component != "" {
			byComponent[service.Component] = append(byComponent[service.Component], service)
		}
	}
	componentSeries := indexSeries(slots["component"], "component")
	for _, component := range componentStrips {
		strip := Strip{ID: component.ID, Name: component.Name, Today: emptyToday(day)}
		fillUptime(&strip, now, componentSeries[component.ID])
		if probes := byComponent[component.ID]; len(probes) > 0 {
			up := true
			var latency float64
			var latencyN int
			for _, probe := range probes {
				if !probe.Up {
					up = false
				}
				if probe.LatencyMS != nil {
					latency += *probe.LatencyMS
					latencyN++
				}
			}
			strip.Up = &up
			if latencyN > 0 {
				avg := latency / float64(latencyN)
				strip.LatencyMS = &avg
			}
		}
		out = append(out, strip)
	}

	instanceSeries := indexSeries(slots["instance"], "instance")
	for _, service := range services {
		if service.Kind != "probe" || service.Component != "" {
			continue
		}
		up := service.Up
		strip := Strip{
			ID: service.Target, Name: service.Name, Today: emptyToday(day),
			LatencyMS: service.LatencyMS, Up: &up,
		}
		fillUptime(&strip, now, instanceSeries[service.Target])
		out = append(out, strip)
	}
	return out
}

func indexSeries(series []Series, label string) map[string][]Point {
	out := map[string][]Point{}
	for _, s := range series {
		out[s.Labels[label]] = s.Points
	}
	return out
}

func fillHost(strip *Strip, now time.Time, slots map[string][]Series) {
	cpu := firstPoints(slots["cpu"])
	mem := firstPoints(slots["memory"])
	disk := firstPoints(slots["disk"])
	probes := minPoints(slots["instance"])
	for i := range strip.Today {
		if strip.Today[i].At.After(now) {
			continue
		}
		end := strip.Today[i].At.Add(slotStep)
		c, m, d := pointAt(cpu, end), pointAt(mem, end), pointAt(disk, end)
		probe := pointAt(probes, end)
		if c == nil && m == nil && d == nil && probe == nil {
			continue
		}
		tone, uptime := hostTone(c, m, d, probe)
		strip.Today[i].Tone = tone
		strip.Today[i].Uptime = uptime
	}
	strip.TodayUptime = meanUptime(strip.Today)
}

func fillUptime(strip *Strip, now time.Time, points []Point) {
	for i := range strip.Today {
		if strip.Today[i].At.After(now) {
			continue
		}
		end := strip.Today[i].At.Add(slotStep)
		uptime := pointAt(points, end)
		if uptime == nil {
			continue
		}
		strip.Today[i].Uptime = uptime
		strip.Today[i].Tone = uptimeTone(*uptime, false)
	}
	strip.TodayUptime = meanUptime(strip.Today)
}

func firstPoints(series []Series) []Point {
	if len(series) == 0 {
		return nil
	}
	return series[0].Points
}

// minPoints keeps, at each timestamp, the lowest probe success across instances.
func minPoints(series []Series) []Point {
	by := map[int64]float64{}
	var order []int64
	seen := map[int64]bool{}
	at := map[int64]time.Time{}
	for _, s := range series {
		if s.Labels["component"] != "" {
			continue
		}
		for _, point := range s.Points {
			key := point.At.UTC().UnixNano()
			if !seen[key] {
				seen[key] = true
				order = append(order, key)
				at[key] = point.At
				by[key] = point.Value
				continue
			}
			if point.Value < by[key] {
				by[key] = point.Value
			}
		}
	}
	// Also fold component-labeled probes: a failed public probe downs the host.
	for _, s := range series {
		if s.Labels["component"] == "" {
			continue
		}
		for _, point := range s.Points {
			key := point.At.UTC().UnixNano()
			if !seen[key] {
				seen[key] = true
				order = append(order, key)
				at[key] = point.At
				by[key] = point.Value
				continue
			}
			if point.Value < by[key] {
				by[key] = point.Value
			}
		}
	}
	out := make([]Point, 0, len(order))
	for _, key := range order {
		out = append(out, Point{At: at[key], Value: by[key]})
	}
	return out
}

func pointAt(points []Point, end time.Time) *float64 {
	for _, point := range points {
		delta := point.At.Sub(end)
		if delta < 0 {
			delta = -delta
		}
		if delta <= slotStep/2 {
			value := point.Value
			return &value
		}
	}
	return nil
}

func hostTone(cpu, mem, disk, probe *float64) (string, *float64) {
	hot := over(cpu) || over(mem) || over(disk)
	if probe == nil {
		if hot {
			return "degraded", nil
		}
		return "up", nil
	}
	return uptimeTone(*probe, hot), probe
}

func over(percent *float64) bool {
	return percent != nil && *percent >= SaturationPercent
}

func uptimeTone(uptime float64, hot bool) string {
	if uptime <= downBelow {
		return "down"
	}
	if hot || uptime < degradedBelow {
		return "degraded"
	}
	return "up"
}

func meanUptime(slots []Slot) *float64 {
	var sum float64
	var n int
	for _, slot := range slots {
		if slot.Uptime == nil {
			continue
		}
		sum += *slot.Uptime
		n++
	}
	if n == 0 {
		return nil
	}
	avg := sum / float64(n)
	return &avg
}

// AttachDays fills each strip's 90-day history from recorded uptime.
// uptime is component id, then UTC day, then the 0–1 share.
func (s *System) AttachDays(now time.Time, uptime map[string]map[string]float64) {
	if s == nil {
		return
	}
	for i := range s.Strips {
		var days map[string]float64
		if uptime != nil {
			days = uptime[s.Strips[i].ID]
		}
		s.Strips[i].Days = daysFor(now, days)
	}
}

func daysFor(now time.Time, values map[string]float64) []Day {
	today := startOfDay(now)
	out := make([]Day, 0, HistoryDays)
	for offset := HistoryDays - 1; offset >= 0; offset-- {
		day := today.AddDate(0, 0, -offset)
		key := day.Format(dayLayout)
		var up *float64
		if values != nil {
			if value, ok := values[key]; ok {
				value := value
				up = &value
			}
		}
		tone := ToneNone
		if up != nil {
			tone = uptimeTone(*up, false)
		}
		out = append(out, Day{Date: key, Uptime: up, Tone: tone})
	}
	return out
}

// HostUptimeQuery is the share of minutes in the window that the VPS was healthy:
// CPU, memory, and disk under SaturationPercent, and every labeled probe up.
func HostUptimeQuery(windowSeconds int) string {
	return "avg_over_time(((" +
		"(100 * (1 - avg(rate(node_cpu_seconds_total{mode=\"idle\"}[5m])))) < bool 80" +
		") * (" +
		"(100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) < bool 80" +
		") * (" +
		"(100 * (1 - node_filesystem_avail_bytes{mountpoint=\"/\"} / node_filesystem_size_bytes{mountpoint=\"/\"})) < bool 80" +
		") * (min(probe_success{component!=\"\"}) == bool 1)" +
		")[" + itoa(windowSeconds) + "s:1m])"
}

// ProbeUptimeQuery is each probe target's success share over the window.
func ProbeUptimeQuery(windowSeconds int) string {
	return "avg_over_time(probe_success[" + itoa(windowSeconds) + "s:1m])"
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
