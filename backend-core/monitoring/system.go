package monitoring

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
)

// Range is a time window the system page can show.
type Range struct {
	Key string
	// Window is how far back the charts and the uptime figures reach.
	Window time.Duration
	// Step is the spacing of chart points (about 60 per chart).
	Step time.Duration
	// rate is the PromQL window for rates on the charts: at least a few scrapes,
	// and at least one step so no movement between points is lost.
	rate string
}

// DefaultRange is shown when the console does not ask for one.
const DefaultRange = "24h"

var ranges = map[string]Range{
	"1h":  {Key: "1h", Window: time.Hour, Step: time.Minute, rate: "5m"},
	"24h": {Key: "24h", Window: 24 * time.Hour, Step: 30 * time.Minute, rate: "30m"},
	"7d":  {Key: "7d", Window: 7 * 24 * time.Hour, Step: 3 * time.Hour, rate: "3h"},
}

// ParseRange reads a range key ("1h", "24h", "7d"); anything else is the default.
func ParseRange(key string) Range {
	if r, ok := ranges[key]; ok {
		return r
	}
	return ranges[DefaultRange]
}

// window is the range as a PromQL duration.
func (r Range) window() string {
	return r.Key
}

// instantRate is the window for "right now" rates and gauges derived from counters.
const instantRate = "5m"

// maxRoutes is how many routes the slowest-routes table lists.
const maxRoutes = 15

// System is the system page: what is up, how loaded the VPS and containers are,
// how the APIs are serving, and the data services behind them.
type System struct {
	Range      string                   `json:"range"`
	At         time.Time                `json:"at"`
	Services   []ServiceStatus          `json:"services"`
	Host       Host                     `json:"host"`
	Containers []Container              `json:"containers"`
	APIs       []API                    `json:"apis"`
	Routes     []Route                  `json:"routes"`
	Data       DataServices             `json:"data"`
	Charts     map[string][]NamedSeries `json:"charts"`
}

// ServiceStatus is one probe or scrape target.
type ServiceStatus struct {
	Name   string `json:"name"`
	Target string `json:"target"`
	// Kind is "probe" (an HTTP check) or "scrape" (Prometheus reading its metrics).
	Kind string `json:"kind"`
	Up   bool   `json:"up"`
	// Uptime is the share of checks over the range that passed, 0–1.
	Uptime    float64  `json:"uptime"`
	LatencyMS *float64 `json:"latencyMs,omitempty"`
}

// Host is the VPS.
type Host struct {
	CPUPercent       *float64 `json:"cpuPercent"`
	Cores            *float64 `json:"cores"`
	Load1            *float64 `json:"load1"`
	MemoryPercent    *float64 `json:"memoryPercent"`
	MemoryTotalBytes *float64 `json:"memoryTotalBytes"`
	DiskPercent      *float64 `json:"diskPercent"`
	DiskTotalBytes   *float64 `json:"diskTotalBytes"`
	// DiskFullDays is when the root disk fills at the last 6 hours' pace; nil
	// when it is not filling.
	DiskFullDays     *float64 `json:"diskFullDays"`
	NetworkRxBytesPS *float64 `json:"networkRxBytesPerSecond"`
	NetworkTxBytesPS *float64 `json:"networkTxBytesPerSecond"`
}

// Container is one compose service's container.
type Container struct {
	Name        string  `json:"name"`
	CPUPercent  float64 `json:"cpuPercent"`
	MemoryBytes float64 `json:"memoryBytes"`
	// Restarts over the range.
	Restarts float64 `json:"restarts"`
}

// API is one Go service's traffic right now.
type API struct {
	Name              string   `json:"name"`
	RequestsPerSecond float64  `json:"requestsPerSecond"`
	P50MS             *float64 `json:"p50Ms"`
	P95MS             *float64 `json:"p95Ms"`
	P99MS             *float64 `json:"p99Ms"`
	// ErrorRate is the share of 5xx answers, 0–1.
	ErrorRate float64 `json:"errorRate"`
}

// Route is one mux route over the range.
type Route struct {
	API               string   `json:"api"`
	Route             string   `json:"route"`
	RequestsPerSecond float64  `json:"requestsPerSecond"`
	P95MS             *float64 `json:"p95Ms"`
	ErrorRate         float64  `json:"errorRate"`
}

// DataServices are MongoDB, Redis, Qdrant, and search.
type DataServices struct {
	MongoConnections *float64 `json:"mongoConnections"`
	MongoOpsPerSec   *float64 `json:"mongoOpsPerSecond"`
	RedisMemoryBytes *float64 `json:"redisMemoryBytes"`
	// RedisHitRate is the cache hit share over the range, 0–1.
	RedisHitRate  *float64 `json:"redisHitRate"`
	QdrantVectors *float64 `json:"qdrantVectors"`
	// SearchesPerSec is job searches per second over the range, by the path
	// that answered: ranked, fallback (Mongo), or catalog.
	SearchesPerSec       map[string]float64 `json:"searchesPerSecond"`
	RankingEventsDropped *float64           `json:"rankingEventsDropped"`
}

// NamedSeries is one line on a chart.
type NamedSeries struct {
	Name   string  `json:"name"`
	Points []Point `json:"points"`
}

// The label cadvisor gives each container's compose service (see deploy/compose.yml).
const serviceLabel = "container_label_com_docker_compose_service"

// Instant queries. %[1]s is the range window, %[2]s the instant rate window.
var instantQueries = map[string]string{
	"probeUp":      `probe_success`,
	"probeUptime":  `avg_over_time(probe_success[%[1]s])`,
	"probeMS":      `probe_duration_seconds * 1000`,
	"scrapeUp":     `up{job!="probe"}`,
	"scrapeUptime": `avg_over_time(up{job!="probe"}[%[1]s])`,

	"cpu":         `100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[%[2]s])))`,
	"cores":       `count(node_cpu_seconds_total{mode="idle"})`,
	"load1":       `node_load1`,
	"memory":      `100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)`,
	"memoryTotal": `node_memory_MemTotal_bytes`,
	"disk":        `100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})`,
	"diskTotal":   `node_filesystem_size_bytes{mountpoint="/"}`,
	"diskFull":    `(node_filesystem_avail_bytes{mountpoint="/"} / -deriv(node_filesystem_avail_bytes{mountpoint="/"}[6h])) / 86400 > 0`,
	"netRx":       `sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[%[2]s]))`,
	"netTx":       `sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[%[2]s]))`,

	"containerCPU":      `100 * sum by (` + serviceLabel + `) (rate(container_cpu_usage_seconds_total{` + serviceLabel + `!=""}[%[2]s]))`,
	"containerMemory":   `sum by (` + serviceLabel + `) (container_memory_working_set_bytes{` + serviceLabel + `!=""})`,
	"containerRestarts": `sum by (` + serviceLabel + `) (changes(container_start_time_seconds{` + serviceLabel + `!=""}[%[1]s]))`,

	"apiRPS":    `sum by (job) (rate(http_request_duration_seconds_count[%[2]s]))`,
	"apiP50":    `1000 * histogram_quantile(0.50, sum by (job, le) (rate(http_request_duration_seconds_bucket[%[2]s])))`,
	"apiP95":    `1000 * histogram_quantile(0.95, sum by (job, le) (rate(http_request_duration_seconds_bucket[%[2]s])))`,
	"apiP99":    `1000 * histogram_quantile(0.99, sum by (job, le) (rate(http_request_duration_seconds_bucket[%[2]s])))`,
	"apiErrors": `sum by (job) (rate(http_request_duration_seconds_count{status=~"5.."}[%[2]s])) / sum by (job) (rate(http_request_duration_seconds_count[%[2]s]))`,

	"routeRPS":    `sum by (job, route) (rate(http_request_duration_seconds_count[%[1]s]))`,
	"routeP95":    `1000 * histogram_quantile(0.95, sum by (job, route, le) (rate(http_request_duration_seconds_bucket[%[1]s])))`,
	"routeErrors": `sum by (job, route) (rate(http_request_duration_seconds_count{status=~"5.."}[%[1]s])) / sum by (job, route) (rate(http_request_duration_seconds_count[%[1]s]))`,

	"mongoConnections": `sum(mongodb_ss_connections{conn_type="current"})`,
	"mongoOps":         `sum(rate(mongodb_ss_opcounters[%[2]s]))`,
	"redisMemory":      `redis_memory_used_bytes`,
	"redisHitRate":     `sum(rate(redis_keyspace_hits_total[%[1]s])) / (sum(rate(redis_keyspace_hits_total[%[1]s])) + sum(rate(redis_keyspace_misses_total[%[1]s])))`,
	"qdrantVectors":    `sum(collections_vector_total)`,
	"searches":         `sum by (path) (rate(joined_search_served_total[%[1]s]))`,
	"eventsDropped":    `sum(increase(joined_ranking_events_dropped_total[%[1]s]))`,
}

// chartQuery is one line on a chart. %[1]s is the chart's rate window. nameBy
// names each resulting series by that label; otherwise it is called name.
type chartQuery struct {
	chart  string
	name   string
	nameBy string
	query  string
}

var chartQueries = []chartQuery{
	{chart: "host", name: "CPU %", query: `100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[%[1]s])))`},
	{chart: "host", name: "Memory %", query: `100 * (1 - avg_over_time(node_memory_MemAvailable_bytes[%[1]s]) / node_memory_MemTotal_bytes)`},
	{chart: "traffic", nameBy: "job", query: `sum by (job) (rate(http_request_duration_seconds_count[%[1]s]))`},
	{chart: "latency", name: "p50", query: `1000 * histogram_quantile(0.50, sum by (le) (rate(http_request_duration_seconds_bucket[%[1]s])))`},
	{chart: "latency", name: "p95", query: `1000 * histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[%[1]s])))`},
	{chart: "latency", name: "p99", query: `1000 * histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[%[1]s])))`},
	{chart: "errors", name: "5xx share", query: `sum(rate(http_request_duration_seconds_count{status=~"5.."}[%[1]s])) / sum(rate(http_request_duration_seconds_count[%[1]s]))`},
}

// Querier is the part of Prometheus the system page needs.
type Querier interface {
	Query(ctx context.Context, query string, now time.Time) ([]Sample, error)
	QueryRange(ctx context.Context, query string, start, end time.Time, step time.Duration) ([]Series, error)
}

// LoadSystem runs every system query for r at now and assembles the page.
func LoadSystem(ctx context.Context, prom Querier, r Range, now time.Time) (System, error) {
	var (
		mu      sync.Mutex
		instant = make(map[string][]Sample, len(instantQueries))
		charts  = make(map[string][]NamedSeries)
	)
	group, ctx := errgroup.WithContext(ctx)
	for name, query := range instantQueries {
		group.Go(func() error {
			samples, err := prom.Query(ctx, fmt.Sprintf(query, r.window(), instantRate), now)
			if err != nil {
				return fmt.Errorf("query %s: %w", name, err)
			}
			mu.Lock()
			instant[name] = samples
			mu.Unlock()
			return nil
		})
	}
	for _, chart := range chartQueries {
		group.Go(func() error {
			series, err := prom.QueryRange(ctx, fmt.Sprintf(chart.query, r.rate), now.Add(-r.Window), now, r.Step)
			if err != nil {
				return fmt.Errorf("chart %s/%s: %w", chart.chart, chart.name, err)
			}
			mu.Lock()
			for _, s := range series {
				name := chart.name
				if chart.nameBy != "" {
					name = s.Labels[chart.nameBy]
				}
				charts[chart.chart] = append(charts[chart.chart], NamedSeries{Name: name, Points: s.Points})
			}
			mu.Unlock()
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return System{}, err
	}
	for _, lines := range charts {
		sort.SliceStable(lines, func(i, j int) bool { return lines[i].Name < lines[j].Name })
	}
	return System{
		Range:      r.Key,
		At:         now,
		Services:   services(instant),
		Host:       host(instant),
		Containers: containers(instant),
		APIs:       apis(instant),
		Routes:     routes(instant),
		Data:       data(instant),
		Charts:     charts,
	}, nil
}

// single is the value of a query that returns one sample, or nil.
func single(samples []Sample) *float64 {
	if len(samples) == 0 {
		return nil
	}
	value := samples[0].Value
	return &value
}

// byLabel indexes samples by one label.
func byLabel(samples []Sample, label string) map[string]float64 {
	out := make(map[string]float64, len(samples))
	for _, s := range samples {
		out[s.Labels[label]] = s.Value
	}
	return out
}

func services(q map[string][]Sample) []ServiceStatus {
	var out []ServiceStatus
	probeUptime := byLabel(q["probeUptime"], "instance")
	probeMS := byLabel(q["probeMS"], "instance")
	for _, s := range q["probeUp"] {
		target := s.Labels["instance"]
		status := ServiceStatus{Name: probeName(target), Target: target, Kind: "probe", Up: s.Value == 1, Uptime: probeUptime[target]}
		if ms, ok := probeMS[target]; ok {
			status.LatencyMS = &ms
		}
		out = append(out, status)
	}
	scrapeUptime := byLabel(q["scrapeUptime"], "job")
	for _, s := range q["scrapeUp"] {
		job := s.Labels["job"]
		out = append(out, ServiceStatus{Name: job, Target: s.Labels["instance"], Kind: "scrape", Up: s.Value == 1, Uptime: scrapeUptime[job]})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Up != out[j].Up {
			return !out[i].Up
		}
		if out[i].Kind != out[j].Kind {
			return out[i].Kind < out[j].Kind
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// probeName is a probe's host without its port: "joined-backend", "joinedhq.com".
func probeName(target string) string {
	parsed, err := url.Parse(target)
	if err != nil || parsed.Hostname() == "" {
		return target
	}
	name := parsed.Hostname()
	if path := strings.Trim(parsed.Path, "/"); path != "" && path != "health" && path != "readyz" {
		name += "/" + path
	}
	return name
}

func host(q map[string][]Sample) Host {
	return Host{
		CPUPercent:       single(q["cpu"]),
		Cores:            single(q["cores"]),
		Load1:            single(q["load1"]),
		MemoryPercent:    single(q["memory"]),
		MemoryTotalBytes: single(q["memoryTotal"]),
		DiskPercent:      single(q["disk"]),
		DiskTotalBytes:   single(q["diskTotal"]),
		DiskFullDays:     single(q["diskFull"]),
		NetworkRxBytesPS: single(q["netRx"]),
		NetworkTxBytesPS: single(q["netTx"]),
	}
}

func containers(q map[string][]Sample) []Container {
	cpu := byLabel(q["containerCPU"], serviceLabel)
	restarts := byLabel(q["containerRestarts"], serviceLabel)
	out := make([]Container, 0, len(q["containerMemory"]))
	for _, s := range q["containerMemory"] {
		name := s.Labels[serviceLabel]
		out = append(out, Container{Name: name, CPUPercent: cpu[name], MemoryBytes: s.Value, Restarts: restarts[name]})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].MemoryBytes > out[j].MemoryBytes })
	return out
}

func optional(values map[string]float64, key string) *float64 {
	value, ok := values[key]
	if !ok {
		return nil
	}
	return &value
}

func apis(q map[string][]Sample) []API {
	p50, p95, p99 := byLabel(q["apiP50"], "job"), byLabel(q["apiP95"], "job"), byLabel(q["apiP99"], "job")
	errors := byLabel(q["apiErrors"], "job")
	out := make([]API, 0, len(q["apiRPS"]))
	for _, s := range q["apiRPS"] {
		job := s.Labels["job"]
		out = append(out, API{
			Name: job, RequestsPerSecond: s.Value,
			P50MS: optional(p50, job), P95MS: optional(p95, job), P99MS: optional(p99, job),
			ErrorRate: errors[job],
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func routes(q map[string][]Sample) []Route {
	key := func(s Sample) string { return s.Labels["job"] + " " + s.Labels["route"] }
	p95 := make(map[string]float64)
	for _, s := range q["routeP95"] {
		p95[key(s)] = s.Value
	}
	errors := make(map[string]float64)
	for _, s := range q["routeErrors"] {
		errors[key(s)] = s.Value
	}
	out := make([]Route, 0, len(q["routeRPS"]))
	for _, s := range q["routeRPS"] {
		if s.Value == 0 {
			continue
		}
		k := key(s)
		out = append(out, Route{
			API: s.Labels["job"], Route: s.Labels["route"], RequestsPerSecond: s.Value,
			P95MS: optional(p95, k), ErrorRate: errors[k],
		})
	}
	slowest := func(r Route) float64 {
		if r.P95MS == nil {
			return 0
		}
		return *r.P95MS
	}
	sort.Slice(out, func(i, j int) bool { return slowest(out[i]) > slowest(out[j]) })
	if len(out) > maxRoutes {
		out = out[:maxRoutes]
	}
	return out
}

func data(q map[string][]Sample) DataServices {
	return DataServices{
		MongoConnections:     single(q["mongoConnections"]),
		MongoOpsPerSec:       single(q["mongoOps"]),
		RedisMemoryBytes:     single(q["redisMemory"]),
		RedisHitRate:         single(q["redisHitRate"]),
		QdrantVectors:        single(q["qdrantVectors"]),
		SearchesPerSec:       byLabel(q["searches"], "path"),
		RankingEventsDropped: single(q["eventsDropped"]),
	}
}
