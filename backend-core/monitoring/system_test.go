package monitoring

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// fakeQuerier answers by the metric a query starts with.
type fakeQuerier struct {
	instant map[string][]Sample
}

func (f fakeQuerier) Query(_ context.Context, query string, _ time.Time) ([]Sample, error) {
	for prefix, samples := range f.instant {
		if strings.HasPrefix(query, prefix) {
			return samples, nil
		}
	}
	return nil, nil
}

func (f fakeQuerier) QueryRange(_ context.Context, query string, start, _ time.Time, step time.Duration) ([]Series, error) {
	if strings.Contains(query, "by (job)") {
		return []Series{
			{Labels: map[string]string{"job": "joined-backend"}, Points: []Point{{At: start, Value: 3}}},
			{Labels: map[string]string{"job": "admin-backend"}, Points: []Point{{At: start.Add(step), Value: 1}}},
		}, nil
	}
	return nil, nil
}

func TestLoadSystemAssemblesThePage(t *testing.T) {
	q := fakeQuerier{instant: map[string][]Sample{
		"probe_success": {
			{Labels: map[string]string{"instance": "http://joined-backend:8080/health"}, Value: 1},
			{Labels: map[string]string{"instance": "http://admin-frontend:3000/sign-in"}, Value: 0},
		},
		"avg_over_time(probe_success": {{Labels: map[string]string{"instance": "http://joined-backend:8080/health"}, Value: 0.99}},
		"up{":                         {{Labels: map[string]string{"job": "node", "instance": "node-exporter:9100"}, Value: 1}},
		"node_load1":                  {{Value: 0.5}},
		"sum by (" + serviceLabel:     {{Labels: map[string]string{serviceLabel: "redis"}, Value: 2}},
		"sum by (job, route) (rate(http_request_duration_seconds_count[24h]))": {
			{Labels: map[string]string{"job": "joined-backend", "route": "GET /v1/search/jobs"}, Value: 4},
			{Labels: map[string]string{"job": "joined-backend", "route": "GET /idle"}, Value: 0},
		},
		"sum by (path)": {{Labels: map[string]string{"path": "ranked"}, Value: 2}},
	}}
	sys, err := LoadSystem(context.Background(), q, ParseRange("24h"), time.Unix(1_700_000_000, 0))
	if err != nil {
		t.Fatal(err)
	}
	if len(sys.Services) != 3 || sys.Services[0].Name != "admin-frontend/sign-in" || sys.Services[0].Up {
		t.Fatalf("down services sort first: %+v", sys.Services)
	}
	if sys.Services[1].Name != "joined-backend" || sys.Services[1].Uptime != 0.99 {
		t.Fatalf("probe: %+v", sys.Services[1])
	}
	if sys.Host.Load1 == nil || *sys.Host.Load1 != 0.5 || sys.Host.CPUPercent != nil {
		t.Fatalf("host: %+v", sys.Host)
	}
	if len(sys.Routes) != 1 || sys.Routes[0].Route != "GET /v1/search/jobs" {
		t.Fatalf("idle routes are dropped: %+v", sys.Routes)
	}
	if sys.Data.SearchesPerSec["ranked"] != 2 {
		t.Fatalf("searches: %+v", sys.Data.SearchesPerSec)
	}
	traffic := sys.Charts["traffic"]
	if len(traffic) != 2 || traffic[0].Name != "admin-backend" {
		t.Fatalf("traffic lines are named by job and sorted: %+v", traffic)
	}
}

func TestParseRangeFallsBackToTheDefault(t *testing.T) {
	if got := ParseRange("1y").Key; got != DefaultRange {
		t.Fatalf("range = %q", got)
	}
	if got := ParseRange("7d"); got.Window != 7*24*time.Hour {
		t.Fatalf("7d window = %s", got.Window)
	}
}

func TestPrometheusReadsTheHTTPAPI(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case queryPath:
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "success", "data": map[string]any{
				"resultType": "vector",
				"result": []any{
					map[string]any{"metric": map[string]string{"job": "node"}, "value": []any{1.7e9, "1"}},
					map[string]any{"metric": map[string]string{"job": "nan"}, "value": []any{1.7e9, "NaN"}},
				},
			}})
		case queryRangePath:
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "error", "error": "bad query"})
		}
	}))
	defer srv.Close()
	prom := NewPrometheus(srv.URL)

	samples, err := prom.Query(context.Background(), "up", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if len(samples) != 1 || samples[0].Labels["job"] != "node" || samples[0].Value != 1 {
		t.Fatalf("NaN is dropped: %+v", samples)
	}
	if _, err := prom.QueryRange(context.Background(), "up", time.Now(), time.Now(), time.Minute); err == nil {
		t.Fatal("an error status must fail the query")
	}
	if NewPrometheus("") != nil {
		t.Fatal("a blank URL means no client")
	}
}
