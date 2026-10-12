package httpapi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sid0709/Joined/backend-core/config"
	"github.com/sid0709/Joined/backend-core/ranking"
)

func TestParseSearchQueryListAndRegion(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/search/jobs?list=recommended&region=us,ca&sort=recommended&limit=25", nil)
	got := parseSearchQuery(req)
	if got.List != "recommended" || got.Region != "us,ca" || got.SortBy != "recommended" {
		t.Fatalf("list/region/sort = %q/%q/%q", got.List, got.Region, got.SortBy)
	}
}

func TestSearchViewerIsVisitorWithoutAValidToken(t *testing.T) {
	s := &Server{sessions: testSessions()}
	type viewer struct {
		userID   string
		signedIn bool
	}
	cases := map[string]viewer{
		"":                {"", false},
		"nope":            {"", false},
		"employee-token":  {"", true},
		"candidate-token": {"c1", true},
	}
	for token, want := range cases {
		req := httptest.NewRequest(http.MethodGet, "/v1/search/jobs", nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		userID, signedIn := s.searchViewer(req)
		if got := (viewer{userID, signedIn}); got != want {
			t.Errorf("token %q: searchViewer = %+v, want %+v", token, got, want)
		}
	}
}

func rankingHandler(t *testing.T) http.Handler {
	t.Helper()
	cfg := config.LoadRanking()
	cfg.QdrantURL, cfg.EmbedderURL, cfg.RedisURL, cfg.ModelPath = "", "", "", ""
	svc, err := ranking.NewService(ranking.Options{Config: cfg})
	if err != nil {
		t.Fatal(err)
	}
	return New(nil, nil, nil, nil, nil, nil, Options{Sessions: testSessions(), Ranking: svc})
}

func TestPostRankingEvent(t *testing.T) {
	handler := rankingHandler(t)
	post := func(token, body string) int {
		req := httptest.NewRequest(http.MethodPost, "/v1/me/ranking/events", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec.Code
	}
	if code := post("", `{"rankingId":"r","jobId":"j","type":"click"}`); code != http.StatusUnauthorized {
		t.Fatalf("visitor: %d", code)
	}
	if code := post("candidate-token", `{"rankingId":"r","jobId":"j","type":"click","position":3}`); code != http.StatusNoContent {
		t.Fatalf("click: %d", code)
	}
	if code := post("candidate-token", `{"rankingId":"r","jobId":"j","type":"stare"}`); code != http.StatusBadRequest {
		t.Fatalf("unknown type: %d", code)
	}
	if code := post("candidate-token", `{"jobId":"j","type":"save"}`); code != http.StatusBadRequest {
		t.Fatalf("missing ranking id: %d", code)
	}
}
