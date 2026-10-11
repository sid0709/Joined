package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

func TestParseSearchQuerySourceHidden(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/search/jobs?source=hidden&sort=newest&limit=20", nil)
	got := parseSearchQuery(req)
	if got.Source != jobs.SearchSourceHidden {
		t.Fatalf("source = %q, want %q", got.Source, jobs.SearchSourceHidden)
	}
	if !got.HasCriteria() {
		t.Fatal("source=hidden should use the paged search path")
	}
	if got.SortBy != "newest" || got.Limit != 20 {
		t.Fatalf("paging = sort %q limit %d", got.SortBy, got.Limit)
	}
}

func TestParseSearchQueryEmptyStaysOnCatalog(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/search/jobs", nil)
	got := parseSearchQuery(req)
	if got.HasCriteria() {
		t.Fatalf("empty query should keep the catalog path, got %+v", got)
	}
}

func TestParseSearchQueryHiddenAloneIsCriteria(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/search/jobs?source=hidden", nil)
	got := parseSearchQuery(req)
	if !got.HasCriteria() {
		t.Fatal("source=hidden with no other params must not fall back to ListCatalog")
	}
}

func TestParseSearchQueryGuestView(t *testing.T) {
	cases := map[string]bool{
		"":                           true,
		"?limit=25&sort=newest":      true,
		"?limit=25&list=all":         true,
		"?limit=25&sort=relevance":   false,
		"?limit=25&sort=newest&q=go": false,
		"?location=Austin":           false,
		"?page=2":                    false,
		"?list=recommended":          false,
		"?source=hidden":             false,
		"?region=us":                 false,
		"?visa=1":                    false,
	}
	for raw, want := range cases {
		req := httptest.NewRequest(http.MethodGet, "/v1/search/jobs"+raw, nil)
		if got := parseSearchQuery(req).GuestView(); got != want {
			t.Errorf("%q: GuestView = %v, want %v", raw, got, want)
		}
	}
}

func TestVisitorSearchNeedsAnAccount(t *testing.T) {
	handler := rankingHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/search/jobs?limit=25&q=designer", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("visitor typed search: %d", rec.Code)
	}
}
