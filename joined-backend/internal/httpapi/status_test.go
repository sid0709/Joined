package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/statuspage"
)

func TestGetStatus(t *testing.T) {
	get := func(status *statuspage.Service) *httptest.ResponseRecorder {
		handler := New(nil, nil, nil, nil, nil, nil, Options{Status: status})
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/status", nil))
		return rec
	}
	if code := get(nil).Code; code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured: %d", code)
	}
	rec := get(statuspage.NewService(nil, &statuspage.Memory{}, slog.New(slog.NewTextHandler(io.Discard, nil))))
	if rec.Code != http.StatusOK || rec.Header().Get("Cache-Control") != statusCacheControl {
		t.Fatalf("status: %d %q", rec.Code, rec.Header().Get("Cache-Control"))
	}
	var page statuspage.Page
	if err := json.Unmarshal(rec.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if page.Live || len(page.Components) != len(statuspage.Components) || page.Status != statuspage.Unknown {
		t.Fatalf("page: %+v", page)
	}
}
