package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/monitoring"
)

type downPrometheus struct{}

func (downPrometheus) Query(context.Context, string, time.Time) ([]monitoring.Sample, error) {
	return nil, monitoring.ErrUnavailable
}

func (downPrometheus) QueryRange(context.Context, string, time.Time, time.Time, time.Duration) ([]monitoring.Series, error) {
	return nil, monitoring.ErrUnavailable
}

type emptyPrometheus struct{}

func (emptyPrometheus) Query(context.Context, string, time.Time) ([]monitoring.Sample, error) {
	return nil, nil
}

func (emptyPrometheus) QueryRange(context.Context, string, time.Time, time.Time, time.Duration) ([]monitoring.Series, error) {
	return nil, nil
}

func TestSystemMonitoring(t *testing.T) {
	get := func(prom monitoring.Querier) *httptest.ResponseRecorder {
		handler := New(nil, nil, nil, nil, Options{Prometheus: prom})
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/admin/monitoring/system?range=7d", nil))
		return rec
	}
	if code := get(nil).Code; code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured: %d", code)
	}
	if code := get(downPrometheus{}).Code; code != http.StatusBadGateway {
		t.Fatalf("prometheus down: %d", code)
	}
	rec := get(emptyPrometheus{})
	if rec.Code != http.StatusOK {
		t.Fatalf("ok: %d %s", rec.Code, rec.Body)
	}
	var body monitoring.System
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body.Range != "7d" {
		t.Fatalf("body: %v %+v", err, body)
	}
}
