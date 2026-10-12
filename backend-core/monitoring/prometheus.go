// Package monitoring reads system health from Prometheus for the admin console.
// The console never sends PromQL: this package owns every query it runs.
package monitoring

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

const (
	queryPath      = "/api/v1/query"
	queryRangePath = "/api/v1/query_range"
	// requestTimeout bounds one Prometheus query.
	requestTimeout = 10 * time.Second
)

// ErrUnavailable means Prometheus did not answer or refused a query.
var ErrUnavailable = errors.New("prometheus unavailable")

// Sample is one labeled value from an instant query.
type Sample struct {
	Labels map[string]string
	Value  float64
}

// Series is one labeled run of values from a range query, one per step.
type Series struct {
	Labels map[string]string
	Points []Point
}

// Point is one value at one time.
type Point struct {
	At    time.Time `json:"at"`
	Value float64   `json:"value"`
}

// Prometheus queries one Prometheus server over its HTTP API.
type Prometheus struct {
	baseURL string
	client  *http.Client
}

// NewPrometheus returns a client for baseURL (e.g. http://prometheus:9090), or
// nil when baseURL is blank.
func NewPrometheus(baseURL string) *Prometheus {
	if baseURL == "" {
		return nil
	}
	return &Prometheus{baseURL: baseURL, client: &http.Client{Timeout: requestTimeout}}
}

type apiResponse struct {
	Status string `json:"status"`
	Error  string `json:"error"`
	Data   struct {
		ResultType string `json:"resultType"`
		Result     []struct {
			Metric map[string]string `json:"metric"`
			Value  []any             `json:"value"`
			Values [][]any           `json:"values"`
		} `json:"result"`
	} `json:"data"`
}

// Query runs an instant query at now.
func (p *Prometheus) Query(ctx context.Context, query string, now time.Time) ([]Sample, error) {
	params := url.Values{"query": {query}, "time": {unixString(now)}}
	body, err := p.get(ctx, queryPath, params)
	if err != nil {
		return nil, err
	}
	out := make([]Sample, 0, len(body.Data.Result))
	for _, row := range body.Data.Result {
		value, ok := parsePair(row.Value)
		if !ok {
			continue
		}
		out = append(out, Sample{Labels: row.Metric, Value: value.Value})
	}
	return out, nil
}

// QueryRange runs a range query from start to end, one point per step.
func (p *Prometheus) QueryRange(ctx context.Context, query string, start, end time.Time, step time.Duration) ([]Series, error) {
	params := url.Values{
		"query": {query},
		"start": {unixString(start)},
		"end":   {unixString(end)},
		"step":  {strconv.FormatFloat(step.Seconds(), 'f', -1, 64)},
	}
	body, err := p.get(ctx, queryRangePath, params)
	if err != nil {
		return nil, err
	}
	out := make([]Series, 0, len(body.Data.Result))
	for _, row := range body.Data.Result {
		series := Series{Labels: row.Metric, Points: make([]Point, 0, len(row.Values))}
		for _, pair := range row.Values {
			if point, ok := parsePair(pair); ok {
				series.Points = append(series.Points, point)
			}
		}
		out = append(out, series)
	}
	return out, nil
}

func (p *Prometheus) get(ctx context.Context, path string, params url.Values) (apiResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+path+"?"+params.Encode(), nil)
	if err != nil {
		return apiResponse{}, fmt.Errorf("build prometheus request: %w", err)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return apiResponse{}, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()
	var body apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return apiResponse{}, fmt.Errorf("%w: decode %s: %v", ErrUnavailable, path, err)
	}
	if body.Status != "success" {
		return apiResponse{}, fmt.Errorf("%w: %s", ErrUnavailable, body.Error)
	}
	return body, nil
}

// parsePair reads Prometheus' [unixSeconds, "value"] pair. NaN and Inf are dropped.
func parsePair(pair []any) (Point, bool) {
	if len(pair) != 2 {
		return Point{}, false
	}
	at, ok := pair[0].(float64)
	if !ok {
		return Point{}, false
	}
	raw, ok := pair[1].(string)
	if !ok {
		return Point{}, false
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
		return Point{}, false
	}
	sec, frac := math.Modf(at)
	return Point{At: time.Unix(int64(sec), int64(frac*float64(time.Second))).UTC(), Value: value}, true
}

func unixString(t time.Time) string {
	return strconv.FormatInt(t.Unix(), 10)
}
