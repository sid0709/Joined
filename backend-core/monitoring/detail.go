package monitoring

import (
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/sid0709/Joined/backend-core/metrics"
)

// SaturationPercent is the host line between fine and worth a look.
const SaturationPercent = 80

// Service-level targets. Levels are met or missed against these.
const (
	probeTarget   = 0.999
	apiP95Target  = 500.0
	errorTarget   = 0.01
	fallbackShare = 0.05
	diskFullDays  = 14.0
)

// Memory groups. A container's compose service lands in one of them; Available
// is host MemAvailable, not a container.
const (
	GroupJoined     = "Joined"
	GroupData       = "Data"
	GroupMonitoring = "Monitoring"
	GroupOther      = "Other"
	GroupAvailable  = "Available"
)

// HostID is the daily-uptime id for the VPS itself. It is not a public status component.
const HostID = "host"

const deviceFilter = `device!~"lo|veth.*|docker.*|br-.*"`

// detailQueries are the extra instant queries the overview, host, traffic, data,
// and product pages read. $range is the selected window, $rate the instant rate.
var detailQueries = map[string]string{
	"uptime":    `node_time_seconds - node_boot_time_seconds`,
	"load5":     `node_load5`,
	"load15":    `node_load15`,
	"iowait":    `100 * avg(rate(node_cpu_seconds_total{mode="iowait"}[$rate]))`,
	"steal":     `100 * avg(rate(node_cpu_seconds_total{mode="steal"}[$rate]))`,
	"softirq":   `100 * avg(rate(node_cpu_seconds_total{mode="softirq"}[$rate]))`,
	"cpuCore":   `100 * (1 - rate(node_cpu_seconds_total{mode="idle"}[$rate]))`,
	"memAvail":  `node_memory_MemAvailable_bytes`,
	"swap":      `100 * (1 - node_memory_SwapFree_bytes / node_memory_SwapTotal_bytes)`,
	"inodes":    `100 * (1 - node_filesystem_files_free{mountpoint="/"} / node_filesystem_files{mountpoint="/"})`,
	"diskRead":  `sum(rate(node_disk_read_bytes_total[$rate]))`,
	"diskWrite": `sum(rate(node_disk_written_bytes_total[$rate]))`,
	"netRxPkt":  `sum(rate(node_network_receive_packets_total{` + deviceFilter + `}[$rate]))`,
	"netTxPkt":  `sum(rate(node_network_transmit_packets_total{` + deviceFilter + `}[$rate]))`,
	"netDrop":   `sum(rate(node_network_receive_drop_total{` + deviceFilter + `}[$rate])) + sum(rate(node_network_transmit_drop_total{` + deviceFilter + `}[$rate]))`,
	"netErr":    `sum(rate(node_network_receive_errs_total{` + deviceFilter + `}[$rate])) + sum(rate(node_network_transmit_errs_total{` + deviceFilter + `}[$rate]))`,
	"tcpEst":    `node_netstat_Tcp_CurrEstab`,
	"tcpTw":     `node_sockstat_TCP_tw`,
	"fdUsed":    `node_filefd_allocated`,
	"fdMax":     `node_filefd_maximum`,
	"ctx":       `sum(rate(node_context_switches_total[$rate]))`,
	"oom":       `sum by (` + serviceLabel + `) (increase(container_oom_events_total{` + serviceLabel + `!=""}[$range]))`,

	"apiP90":   `1000 * histogram_quantile(0.90, sum by (job, le) (rate(http_request_duration_seconds_bucket[$range])))`,
	"api4xx":   `sum by (job) (rate(http_request_duration_seconds_count{status=~"4.."}[$range])) / sum by (job) (rate(http_request_duration_seconds_count[$range]))`,
	"apiCount": `sum by (job) (increase(http_request_duration_seconds_count[$range]))`,

	"routeP50":   `1000 * histogram_quantile(0.50, sum by (job, route, le) (rate(http_request_duration_seconds_bucket[$range])))`,
	"routeP99":   `1000 * histogram_quantile(0.99, sum by (job, route, le) (rate(http_request_duration_seconds_bucket[$range])))`,
	"route4xx":   `sum by (job, route) (rate(http_request_duration_seconds_count{status=~"4.."}[$range])) / sum by (job, route) (rate(http_request_duration_seconds_count[$range]))`,
	"routeCount": `sum by (job, route) (increase(http_request_duration_seconds_count[$range]))`,

	"methodRPS":    `sum by (method) (rate(http_request_duration_seconds_count[$range]))`,
	"methodP50":    `1000 * histogram_quantile(0.50, sum by (method, le) (rate(http_request_duration_seconds_bucket[$range])))`,
	"methodP95":    `1000 * histogram_quantile(0.95, sum by (method, le) (rate(http_request_duration_seconds_bucket[$range])))`,
	"methodP99":    `1000 * histogram_quantile(0.99, sum by (method, le) (rate(http_request_duration_seconds_bucket[$range])))`,
	"methodErrors": `sum by (method) (rate(http_request_duration_seconds_count{status=~"5.."}[$range])) / sum by (method) (rate(http_request_duration_seconds_count[$range]))`,
	"method4xx":    `sum by (method) (rate(http_request_duration_seconds_count{status=~"4.."}[$range])) / sum by (method) (rate(http_request_duration_seconds_count[$range]))`,
	"methodCount":  `sum by (method) (increase(http_request_duration_seconds_count[$range]))`,

	"rangeRPS":   `sum(rate(http_request_duration_seconds_count[$range]))`,
	"rangeCount": `sum(increase(http_request_duration_seconds_count[$range]))`,
	"rangeP50":   `1000 * histogram_quantile(0.50, sum by (le) (rate(http_request_duration_seconds_bucket[$range])))`,
	"rangeP90":   `1000 * histogram_quantile(0.90, sum by (le) (rate(http_request_duration_seconds_bucket[$range])))`,
	"rangeP95":   `1000 * histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[$range])))`,
	"rangeP99":   `1000 * histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[$range])))`,
	"rangeError": `sum(rate(http_request_duration_seconds_count{status=~"5.."}[$range])) / sum(rate(http_request_duration_seconds_count[$range]))`,
	"prevError":  `sum(rate(http_request_duration_seconds_count{status=~"5.."}[$range] offset $range)) / sum(rate(http_request_duration_seconds_count[$range] offset $range))`,
	"range4xx":   `sum(rate(http_request_duration_seconds_count{status=~"4.."}[$range])) / sum(rate(http_request_duration_seconds_count[$range]))`,
	"unmatched":  `sum(rate(http_request_duration_seconds_count{route="unmatched"}[$range])) / sum(rate(http_request_duration_seconds_count[$range]))`,
	"statuses":   `sum by (status) (increase(http_request_duration_seconds_count[$range]))`,
	"slow5xx":    `sum(increase(http_request_duration_seconds_count{status=~"5.."}[$range])) - sum(increase(http_request_duration_seconds_bucket{status=~"5..",le="30"}[$range]))`,

	"mongoAvailable": `sum(mongodb_ss_connections{conn_type="available"})`,
	"mongoOpsType":   `sum by (legacy_op_type) (rate(mongodb_ss_opcounters[$rate]))`,
	"mongoLag":       `max(mongodb_mongod_replset_member_replication_lag)`,
	"mongoCache":     `sum(mongodb_ss_wt_cache_bytes_currently_in_cache)`,
	"mongoReaders":   `sum(mongodb_ss_globalLock_currentQueue_readers)`,
	"mongoWriters":   `sum(mongodb_ss_globalLock_currentQueue_writers)`,
	"mongoAsserts":   `sum(rate(mongodb_ss_asserts[$rate]))`,
	"redisMax":       `redis_memory_max_bytes`,
	"redisEvict":     `sum(rate(redis_evicted_keys_total[$rate]))`,
	"redisClients":   `redis_connected_clients`,
	"redisBlocked":   `redis_blocked_clients`,
	"redisHits":      `sum(rate(redis_keyspace_hits_total[$rate]))`,
	"redisMisses":    `sum(rate(redis_keyspace_misses_total[$rate]))`,
	"qdrantCols":     `count(collections_vector_total)`,

	"modelCalls":  fmt.Sprintf(`sum by (feature, model, outcome) (increase(%s[$range]))`, metrics.ModelCalls),
	"modelP50":    fmt.Sprintf(`1000 * histogram_quantile(0.50, sum by (feature, model, le) (rate(%s_bucket[$range])))`, metrics.ModelLatency),
	"modelP95":    fmt.Sprintf(`1000 * histogram_quantile(0.95, sum by (feature, model, le) (rate(%s_bucket[$range])))`, metrics.ModelLatency),
	"modelTokens": fmt.Sprintf(`sum by (feature, model, kind) (increase(%s[$range]))`, metrics.ModelTokens),
	"workerOK":    metrics.WorkerLastSuccess,
	"workerDur":   metrics.WorkerLastDuration,
	"workerErr":   metrics.WorkerLastError,
	"workerItems": fmt.Sprintf(`sum by (worker) (increase(%s[$range]))`, metrics.WorkerItems),
}

// detailCharts are the extra lines: RAM by container, host used, disk, and the
// request and success sparklines.
var detailCharts = []chartQuery{
	{chart: "ram", nameBy: serviceLabel, query: `sum by (` + serviceLabel + `) (avg_over_time(container_memory_working_set_bytes{` + serviceLabel + `!=""}[$rate]))`},
	{chart: "ramHost", name: "Host used", query: `node_memory_MemTotal_bytes - avg_over_time(node_memory_MemAvailable_bytes[$rate])`},
	{chart: "disk", name: "Disk %", query: `100 * (1 - avg_over_time(node_filesystem_avail_bytes{mountpoint="/"}[$rate]) / node_filesystem_size_bytes{mountpoint="/"})`},
	{chart: "requests", name: "Requests/s", query: `sum(rate(http_request_duration_seconds_count[$rate]))`},
	{chart: "success", name: "Success", query: `1 - (sum(rate(http_request_duration_seconds_count{status=~"5.."}[$rate])) / sum(rate(http_request_duration_seconds_count[$rate])))`},
}

// CPUCore is one core's utilization right now.
type CPUCore struct {
	CPU     string  `json:"cpu"`
	Percent float64 `json:"percent"`
}

// MemoryGroup is one slice of the whole VPS.
type MemoryGroup struct {
	Name    string  `json:"name"`
	Bytes   float64 `json:"bytes"`
	Percent float64 `json:"percent"`
}

// Failure is one status class in the selected window.
type Failure struct {
	Status string  `json:"status"`
	Count  float64 `json:"count"`
}

// TrafficSummary is HTTP across every API for the selected window.
type TrafficSummary struct {
	Requests          float64   `json:"requests"`
	RequestsPerSecond float64   `json:"requestsPerSecond"`
	SuccessRate       *float64  `json:"successRate"`
	SuccessDelta      *float64  `json:"successDelta"`
	P50MS             *float64  `json:"p50Ms"`
	P90MS             *float64  `json:"p90Ms"`
	P95MS             *float64  `json:"p95Ms"`
	P99MS             *float64  `json:"p99Ms"`
	ClientErrorRate   *float64  `json:"clientErrorRate"`
	ErrorRate         *float64  `json:"errorRate"`
	UnmatchedRate     *float64  `json:"unmatchedRate"`
	Failures          []Failure `json:"failures"`
	SlowErrors        float64   `json:"slowErrors"`
}

// Banner is the line at the top of Overview.
type Banner struct {
	Status        string   `json:"status"`
	UptimeSeconds *float64 `json:"uptimeSeconds"`
	LoadPerCore   *float64 `json:"loadPerCore"`
}

// Level is one service-level target.
type Level struct {
	Name   string `json:"name"`
	Target string `json:"target"`
	Now    string `json:"now"`
	Met    bool   `json:"met"`
}

// ModelStat is one feature and model over the selected window.
type ModelStat struct {
	Feature          string   `json:"feature"`
	Model            string   `json:"model"`
	Calls            float64  `json:"calls"`
	SuccessRate      *float64 `json:"successRate"`
	P50MS            *float64 `json:"p50Ms"`
	P95MS            *float64 `json:"p95Ms"`
	Retries          float64  `json:"retries"`
	MissingKey       float64  `json:"missingKey"`
	Timeouts         float64  `json:"timeouts"`
	Empty            float64  `json:"empty"`
	PromptTokens     float64  `json:"promptTokens"`
	CompletionTokens float64  `json:"completionTokens"`
}

// WorkerStat is the last run of one background worker.
type WorkerStat struct {
	Name                string     `json:"name"`
	LastSuccess         *time.Time `json:"lastSuccess"`
	LastDurationSeconds *float64   `json:"lastDurationSeconds"`
	LastError           bool       `json:"lastError"`
	Items               float64    `json:"items"`
}

// QueueStat is a point-in-time count of work waiting on staff.
type QueueStat struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

// Product is model calls, workers, and staff queues.
type Product struct {
	Models  []ModelStat  `json:"models"`
	Workers []WorkerStat `json:"workers"`
	Queues  []QueueStat  `json:"queues"`
}

// applyDetail fills the fields the original assemblers do not.
func applyDetail(sys *System, q map[string][]Sample) {
	h := &sys.Host
	h.UptimeSeconds = single(q["uptime"])
	h.Load5 = single(q["load5"])
	h.Load15 = single(q["load15"])
	h.IOWaitPercent = single(q["iowait"])
	h.StealPercent = single(q["steal"])
	h.SoftIRQPercent = single(q["softirq"])
	h.MemoryAvailableBytes = single(q["memAvail"])
	h.SwapPercent = single(q["swap"])
	h.InodePercent = single(q["inodes"])
	h.DiskReadBytesPS = single(q["diskRead"])
	h.DiskWriteBytesPS = single(q["diskWrite"])
	h.NetworkRxPacketsPS = single(q["netRxPkt"])
	h.NetworkTxPacketsPS = single(q["netTxPkt"])
	h.NetworkDropPS = single(q["netDrop"])
	h.NetworkErrorPS = single(q["netErr"])
	h.TCPEstablished = single(q["tcpEst"])
	h.TCPTimeWait = single(q["tcpTw"])
	h.FileDescriptors = single(q["fdUsed"])
	h.FileDescriptorMax = single(q["fdMax"])
	h.ContextSwitchesPS = single(q["ctx"])
	if h.Load1 != nil && h.Cores != nil && *h.Cores > 0 {
		per := *h.Load1 / *h.Cores
		h.LoadPerCore = &per
	}
	h.CPUCores = cpuCores(q["cpuCore"])

	oom := byLabel(q["oom"], serviceLabel)
	total := 0.0
	if h.MemoryTotalBytes != nil {
		total = *h.MemoryTotalBytes
	}
	grouped := map[string]float64{}
	for i := range sys.Containers {
		c := &sys.Containers[i]
		c.Group = groupOf(c.Name)
		c.OOMKills = oom[c.Name]
		grouped[c.Group] += c.MemoryBytes
		if total > 0 {
			c.HostShare = c.MemoryBytes / total
		}
	}
	sys.Memory = memoryGroups(total, h.MemoryAvailableBytes, grouped)

	p90 := byLabel(q["apiP90"], "job")
	client := byLabel(q["api4xx"], "job")
	counts := byLabel(q["apiCount"], "job")
	for i := range sys.APIs {
		name := sys.APIs[i].Name
		sys.APIs[i].P90MS = optional(p90, name)
		sys.APIs[i].ClientErrorRate = client[name]
		sys.APIs[i].Count = counts[name]
	}
	fillRoutes(sys.Routes, q)
	sys.Methods = methods(q)
	sys.Traffic = trafficSummary(q)
	fillData(&sys.Data, q)
	sys.Product = product(q)
}

func cpuCores(samples []Sample) []CPUCore {
	out := make([]CPUCore, 0, len(samples))
	for _, s := range samples {
		out = append(out, CPUCore{CPU: s.Labels["cpu"], Percent: s.Value})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CPU < out[j].CPU })
	return out
}

func groupOf(service string) string {
	switch service {
	case "joined-frontend", "joined-backend", "admin-frontend", "admin-backend",
		"connected-frontend", "scoutwell-frontend", "scoutwell-backend":
		return GroupJoined
	case "mongodb", "mongo", "redis", "qdrant", "embedder":
		return GroupData
	case "prometheus", "cadvisor", "node-exporter", "blackbox-exporter", "mongodb-exporter", "redis-exporter":
		return GroupMonitoring
	default:
		return GroupOther
	}
}

func memoryGroups(total float64, available *float64, grouped map[string]float64) []MemoryGroup {
	if total <= 0 {
		return nil
	}
	avail := 0.0
	if available != nil {
		avail = *available
	}
	used := total - avail
	other := used - grouped[GroupJoined] - grouped[GroupData] - grouped[GroupMonitoring]
	if other < 0 {
		other = 0
	}
	order := []MemoryGroup{
		{Name: GroupJoined, Bytes: grouped[GroupJoined]},
		{Name: GroupData, Bytes: grouped[GroupData]},
		{Name: GroupMonitoring, Bytes: grouped[GroupMonitoring]},
		{Name: GroupOther, Bytes: other},
		{Name: GroupAvailable, Bytes: avail},
	}
	for i := range order {
		order[i].Percent = 100 * order[i].Bytes / total
	}
	return order
}

func routeKey(job, route string) string { return job + " " + route }

func fillRoutes(routes []Route, q map[string][]Sample) {
	p50 := map[string]float64{}
	for _, s := range q["routeP50"] {
		p50[routeKey(s.Labels["job"], s.Labels["route"])] = s.Value
	}
	p99 := map[string]float64{}
	for _, s := range q["routeP99"] {
		p99[routeKey(s.Labels["job"], s.Labels["route"])] = s.Value
	}
	client := map[string]float64{}
	for _, s := range q["route4xx"] {
		client[routeKey(s.Labels["job"], s.Labels["route"])] = s.Value
	}
	counts := map[string]float64{}
	for _, s := range q["routeCount"] {
		counts[routeKey(s.Labels["job"], s.Labels["route"])] = s.Value
	}
	for i := range routes {
		key := routeKey(routes[i].API, routes[i].Route)
		routes[i].P50MS = optional(p50, key)
		routes[i].P99MS = optional(p99, key)
		routes[i].ClientErrorRate = client[key]
		routes[i].Count = counts[key]
	}
}

func methods(q map[string][]Sample) []Route {
	p50 := byLabel(q["methodP50"], "method")
	p95 := byLabel(q["methodP95"], "method")
	p99 := byLabel(q["methodP99"], "method")
	errors := byLabel(q["methodErrors"], "method")
	client := byLabel(q["method4xx"], "method")
	counts := byLabel(q["methodCount"], "method")
	out := make([]Route, 0, len(q["methodRPS"]))
	for _, s := range q["methodRPS"] {
		if s.Value == 0 {
			continue
		}
		method := s.Labels["method"]
		out = append(out, Route{
			Method: method, RequestsPerSecond: s.Value,
			P50MS: optional(p50, method), P95MS: optional(p95, method), P99MS: optional(p99, method),
			ErrorRate: errors[method], ClientErrorRate: client[method], Count: counts[method],
		})
	}
	sort.Slice(out, func(i, j int) bool {
		ai, aj := 0.0, 0.0
		if out[i].P95MS != nil {
			ai = *out[i].P95MS
		}
		if out[j].P95MS != nil {
			aj = *out[j].P95MS
		}
		return ai > aj
	})
	if len(out) > maxRoutes {
		out = out[:maxRoutes]
	}
	return out
}

func trafficSummary(q map[string][]Sample) TrafficSummary {
	out := TrafficSummary{
		RequestsPerSecond: valueOr(q["rangeRPS"]),
		Requests:          valueOr(q["rangeCount"]),
		P50MS:             single(q["rangeP50"]),
		P90MS:             single(q["rangeP90"]),
		P95MS:             single(q["rangeP95"]),
		P99MS:             single(q["rangeP99"]),
		ClientErrorRate:   single(q["range4xx"]),
		ErrorRate:         single(q["rangeError"]),
		UnmatchedRate:     single(q["unmatched"]),
		SlowErrors:        valueOr(q["slow5xx"]),
	}
	if out.SlowErrors < 0 {
		out.SlowErrors = 0
	}
	if out.ErrorRate != nil {
		success := 1 - *out.ErrorRate
		out.SuccessRate = &success
		if prev := single(q["prevError"]); prev != nil {
			delta := *prev - *out.ErrorRate
			out.SuccessDelta = &delta
		}
	}
	out.Failures = failures(q["statuses"])
	return out
}

func valueOr(samples []Sample) float64 {
	if v := single(samples); v != nil {
		return *v
	}
	return 0
}

func failures(samples []Sample) []Failure {
	out := make([]Failure, 0, len(samples))
	for _, s := range samples {
		if s.Value == 0 {
			continue
		}
		out = append(out, Failure{Status: s.Labels["status"], Count: s.Value})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Count > out[j].Count })
	return out
}

func fillData(data *DataServices, q map[string][]Sample) {
	data.MongoAvailable = single(q["mongoAvailable"])
	if ops := byLabel(q["mongoOpsType"], "legacy_op_type"); len(ops) > 0 {
		data.MongoOpsByType = ops
	}
	data.MongoReplicationLag = single(q["mongoLag"])
	data.MongoCacheBytes = single(q["mongoCache"])
	data.MongoQueuedReaders = single(q["mongoReaders"])
	data.MongoQueuedWriters = single(q["mongoWriters"])
	data.MongoAssertsPS = single(q["mongoAsserts"])
	data.RedisMaxBytes = single(q["redisMax"])
	data.RedisEvictionsPS = single(q["redisEvict"])
	data.RedisClients = single(q["redisClients"])
	data.RedisBlockedClients = single(q["redisBlocked"])
	data.RedisHitsPS = single(q["redisHits"])
	data.RedisMissesPS = single(q["redisMisses"])
	data.QdrantCollections = single(q["qdrantCols"])
	var total float64
	for _, n := range data.SearchesPerSec {
		total += n
	}
	if total > 0 {
		share := data.SearchesPerSec["fallback"] / total
		data.FallbackShare = &share
	}
}

func product(q map[string][]Sample) Product {
	return Product{Models: modelStats(q), Workers: workerStats(q)}
}

func modelStats(q map[string][]Sample) []ModelStat {
	type key struct{ feature, model string }
	by := map[key]*ModelStat{}
	get := func(feature, model string) *ModelStat {
		k := key{feature, model}
		if by[k] == nil {
			by[k] = &ModelStat{Feature: feature, Model: model}
		}
		return by[k]
	}
	for _, s := range q["modelCalls"] {
		stat := get(s.Labels["feature"], s.Labels["model"])
		switch s.Labels["outcome"] {
		case metrics.OutcomeRetry:
			stat.Retries += s.Value
		case metrics.OutcomeMissingKey:
			stat.MissingKey += s.Value
		case metrics.OutcomeTimeout:
			stat.Timeouts += s.Value
			stat.Calls += s.Value
		case metrics.OutcomeEmpty:
			stat.Empty += s.Value
			stat.Calls += s.Value
		default:
			stat.Calls += s.Value
		}
	}
	for _, s := range q["modelTokens"] {
		stat := get(s.Labels["feature"], s.Labels["model"])
		switch s.Labels["kind"] {
		case "prompt":
			stat.PromptTokens += s.Value
		case "completion":
			stat.CompletionTokens += s.Value
		}
	}
	p50 := map[key]float64{}
	for _, s := range q["modelP50"] {
		p50[key{s.Labels["feature"], s.Labels["model"]}] = s.Value
	}
	p95 := map[key]float64{}
	for _, s := range q["modelP95"] {
		p95[key{s.Labels["feature"], s.Labels["model"]}] = s.Value
	}
	out := make([]ModelStat, 0, len(by))
	for k, stat := range by {
		if v, ok := p50[k]; ok {
			value := v
			stat.P50MS = &value
		}
		if v, ok := p95[k]; ok {
			value := v
			stat.P95MS = &value
		}
		ok := 0.0
		for _, s := range q["modelCalls"] {
			if s.Labels["feature"] == k.feature && s.Labels["model"] == k.model && s.Labels["outcome"] == metrics.OutcomeOK {
				ok += s.Value
			}
		}
		if stat.Calls > 0 {
			share := ok / stat.Calls
			stat.SuccessRate = &share
		}
		out = append(out, *stat)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Calls == out[j].Calls {
			return out[i].Feature < out[j].Feature
		}
		return out[i].Calls > out[j].Calls
	})
	return out
}

func workerStats(q map[string][]Sample) []WorkerStat {
	by := map[string]*WorkerStat{}
	get := func(name string) *WorkerStat {
		if name == "" {
			return nil
		}
		if by[name] == nil {
			by[name] = &WorkerStat{Name: name}
		}
		return by[name]
	}
	for _, s := range q["workerOK"] {
		if stat := get(s.Labels["worker"]); stat != nil {
			at := time.Unix(int64(s.Value), 0).UTC()
			stat.LastSuccess = &at
		}
	}
	for _, s := range q["workerDur"] {
		if stat := get(s.Labels["worker"]); stat != nil {
			v := s.Value
			stat.LastDurationSeconds = &v
		}
	}
	for _, s := range q["workerErr"] {
		if stat := get(s.Labels["worker"]); stat != nil {
			stat.LastError = s.Value > 0
		}
	}
	for _, s := range q["workerItems"] {
		if stat := get(s.Labels["worker"]); stat != nil {
			stat.Items = s.Value
		}
	}
	out := make([]WorkerStat, 0, len(by))
	for _, stat := range by {
		out = append(out, *stat)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// foldRAM sums container RSS into the four groups. Host used stays a separate series.
func foldRAM(series []NamedSeries) []NamedSeries {
	if len(series) == 0 {
		return nil
	}
	times := map[int64]time.Time{}
	grouped := map[string]map[int64]float64{}
	for _, line := range series {
		if line.Name == "Host used" {
			continue
		}
		group := groupOf(line.Name)
		if grouped[group] == nil {
			grouped[group] = map[int64]float64{}
		}
		for _, point := range line.Points {
			key := point.At.UTC().UnixNano()
			times[key] = point.At.UTC()
			grouped[group][key] += point.Value
		}
	}
	order := make([]int64, 0, len(times))
	for key := range times {
		order = append(order, key)
	}
	sort.Slice(order, func(i, j int) bool { return order[i] < order[j] })
	var out []NamedSeries
	for _, name := range []string{GroupJoined, GroupData, GroupMonitoring, GroupOther} {
		if grouped[name] == nil {
			continue
		}
		points := make([]Point, 0, len(order))
		for _, key := range order {
			points = append(points, Point{At: times[key], Value: grouped[name][key]})
		}
		out = append(out, NamedSeries{Name: name, Points: points})
	}
	return out
}

func applyLevels(sys *System) {
	sys.Levels = []Level{
		probeLevel(sys.Services),
		latencyLevel(sys.APIs),
		errorLevel(sys.Traffic.ErrorRate),
		fallbackLevel(sys.Data.FallbackShare),
		saturationLevel("CPU", sys.Host.CPUPercent),
		saturationLevel("Memory", sys.Host.MemoryPercent),
		saturationLevel("Disk", sys.Host.DiskPercent),
		diskFullLevel(sys.Host.DiskFullDays),
	}
	sys.Banner = Banner{
		Status:        bannerStatus(sys),
		UptimeSeconds: sys.Host.UptimeSeconds,
		LoadPerCore:   sys.Host.LoadPerCore,
	}
}

func probeLevel(services []ServiceStatus) Level {
	level := Level{Name: "Probe success", Target: "≥ 99.9%", Now: "—"}
	var worst *float64
	for _, service := range services {
		if service.Kind != "probe" {
			continue
		}
		value := service.Uptime
		if worst == nil || value < *worst {
			worst = &value
		}
	}
	if worst == nil {
		return level
	}
	level.Now = formatShare(*worst)
	level.Met = *worst >= probeTarget
	return level
}

func latencyLevel(apis []API) Level {
	level := Level{Name: "API p95", Target: "≤ 500 ms", Now: "—"}
	var worst *float64
	for _, api := range apis {
		if api.P95MS == nil {
			continue
		}
		if worst == nil || *api.P95MS > *worst {
			v := *api.P95MS
			worst = &v
		}
	}
	if worst == nil {
		return level
	}
	level.Now = formatMS(*worst)
	level.Met = *worst <= apiP95Target
	return level
}

func errorLevel(rate *float64) Level {
	level := Level{Name: "Server errors", Target: "≤ 1%", Now: "—"}
	if rate == nil {
		return level
	}
	level.Now = formatShare(*rate)
	level.Met = *rate <= errorTarget
	return level
}

func fallbackLevel(share *float64) Level {
	level := Level{Name: "Search fallback", Target: "≤ 5% of searches", Now: "—"}
	if share == nil {
		level.Now = "no searches"
		level.Met = true
		return level
	}
	level.Now = formatShare(*share)
	level.Met = *share <= fallbackShare
	return level
}

func saturationLevel(name string, percent *float64) Level {
	level := Level{Name: name, Target: "< 80%", Now: "—"}
	if percent == nil {
		return level
	}
	level.Now = formatPercent(*percent)
	level.Met = *percent < SaturationPercent
	return level
}

func diskFullLevel(days *float64) Level {
	level := Level{Name: "Disk fill", Target: "> 14 days", Now: "not filling", Met: true}
	if days == nil {
		return level
	}
	level.Now = strconv.FormatFloat(*days, 'f', 0, 64) + " days"
	level.Met = *days > diskFullDays
	return level
}

func bannerStatus(sys *System) string {
	for _, service := range sys.Services {
		if service.Kind == "probe" && !service.Up {
			return "major_outage"
		}
	}
	for _, level := range sys.Levels {
		if !level.Met && level.Now != "—" && level.Now != "no searches" {
			return "degraded"
		}
	}
	if saturated(sys.Host.CPUPercent) || saturated(sys.Host.MemoryPercent) || saturated(sys.Host.DiskPercent) {
		return "degraded"
	}
	return "operational"
}

func saturated(percent *float64) bool {
	return percent != nil && *percent >= SaturationPercent
}

func formatShare(value float64) string {
	percent := value * 100
	digits := 1
	if percent >= 99 || (percent > 0 && percent < 1) {
		digits = 2
	}
	return strconv.FormatFloat(percent, 'f', digits, 64) + "%"
}

func formatPercent(value float64) string {
	digits := 0
	if value < 10 && value > 0 {
		digits = 1
	}
	return strconv.FormatFloat(value, 'f', digits, 64) + "%"
}

func formatMS(value float64) string {
	if value >= 1000 {
		return strconv.FormatFloat(value/1000, 'f', 1, 64) + " s"
	}
	return strconv.FormatFloat(value, 'f', 0, 64) + " ms"
}
