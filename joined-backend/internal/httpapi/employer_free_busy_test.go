package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/joined-backend/internal/employer"
)

func TestFreeBusyNotReadyIs503(t *testing.T) {
	_, err := employer.FreeBusy("2026-10-01", "2026-10-14")
	rec := httptest.NewRecorder()
	if writeEmployer(rec, err) {
		t.Fatal("expected free/busy to be not ready")
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.Contains(body, employer.ErrFreeBusyNotReady.Error()) {
		t.Fatalf("body = %s", body)
	}
	if !strings.Contains(body, `"code":"`+employer.FreeBusyNotReadyCode+`"`) {
		t.Fatalf("body = %s", body)
	}
	if strings.Contains(body, "could not complete the request") {
		t.Fatalf("not-ready was written as a crash: %s", body)
	}
}

func TestFreeBusyBadRangeIs400(t *testing.T) {
	_, err := employer.FreeBusy("2026-10-14", "2026-10-01")
	rec := httptest.NewRecorder()
	if writeEmployer(rec, err) {
		t.Fatal("expected a bad range to be rejected")
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), employer.FreeBusyNotReadyCode) {
		t.Fatalf("bad range used the not-ready code: %s", rec.Body.String())
	}
}

func TestFreeBusyRouteIsRegistered(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, nil, Options{})
	req := httptest.NewRequest(http.MethodGet, "/v1/company/interviews/free-busy?from=2026-10-01&to=2026-10-14", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code == http.StatusNotFound {
		t.Fatalf("free-busy route is missing: %s", rec.Body.String())
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "hiring workspace is unavailable") {
		t.Fatalf("body = %s", rec.Body.String())
	}
}
