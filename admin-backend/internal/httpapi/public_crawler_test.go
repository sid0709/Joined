package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

func TestPublicCrawlerRouteSkipsAdminAndStaffAuth(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{AdminToken: "admin-secret", CrawlerToken: "crawler-secret"})
	rec := analyzerCall(t, handler, http.MethodPost, "/v1/public/crawler/jobs", `{"jobs":[]}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("missing crawler token: %d %s", rec.Code, rec.Body.String())
	}
	rec = analyzerCall(t, handler, http.MethodPost, "/v1/public/crawler/jobs", `{"jobs":[]}`, "admin-secret")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("admin token must not open the crawler route: %d", rec.Code)
	}
	rec = analyzerCall(t, handler, http.MethodPost, "/v1/public/crawler/jobs", `{"jobs":[]}`, "crawler-secret")
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "jobs is empty") {
		t.Fatalf("crawler token should reach the handler: %d %s", rec.Code, rec.Body.String())
	}
}

func TestPublicCrawlerRejectsInvalidBatches(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{CrawlerToken: "crawler-secret"})
	for _, body := range []string{`{`, `{"jobs":[]}`, `{"jobs":"nope"}`} {
		rec := analyzerCall(t, handler, http.MethodPost, "/v1/public/crawler/jobs", body, "crawler-secret")
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("body %s: %d %s", body, rec.Code, rec.Body.String())
		}
	}
}

func TestPublicCrawlerDisabledWithoutTokenConfig(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{})
	rec := analyzerCall(t, handler, http.MethodPost, "/v1/public/crawler/jobs", `{"jobs":[{}]}`, "anything")
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "CRAWLER_INGEST_TOKEN") {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}
