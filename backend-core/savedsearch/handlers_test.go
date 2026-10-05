package savedsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHandlersCRUD(t *testing.T) {
	mux := http.NewServeMux()
	Handlers{
		Service: NewService(NewMemory()),
		CurrentUser: func(*http.Request) (string, error) {
			return "user-http", nil
		},
	}.Register(mux)

	createBody, _ := json.Marshal(Input{
		Name:           "Backend remote",
		Query:          "golang",
		Filters:        Filters{Location: "Remote", Remote: true},
		AlertFrequency: AlertDaily,
	})
	createReq := httptest.NewRequest(http.MethodPost, "/v1/me/saved-searches", bytes.NewReader(createBody))
	createRec := httptest.NewRecorder()
	mux.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", createRec.Code, createRec.Body.String())
	}
	var created SavedSearch
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("create body: %s", createRec.Body.String())
	}

	listRec := httptest.NewRecorder()
	mux.ServeHTTP(listRec, httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches", nil))
	if listRec.Code != http.StatusOK {
		t.Fatalf("list: %d %s", listRec.Code, listRec.Body.String())
	}
	var listed listResponse
	if err := json.Unmarshal(listRec.Body.Bytes(), &listed); err != nil {
		t.Fatalf("list decode: %v", err)
	}
	if len(listed.Searches) != 1 || listed.Searches[0].ID != created.ID {
		t.Fatalf("list = %+v", listed)
	}

	getRec := httptest.NewRecorder()
	mux.ServeHTTP(getRec, httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches/"+created.ID, nil))
	if getRec.Code != http.StatusOK {
		t.Fatalf("get: %d %s", getRec.Code, getRec.Body.String())
	}

	weekly := AlertWeekly
	patchBody, _ := json.Marshal(Patch{AlertFrequency: &weekly})
	patchRec := httptest.NewRecorder()
	mux.ServeHTTP(patchRec, httptest.NewRequest(http.MethodPatch, "/v1/me/saved-searches/"+created.ID, bytes.NewReader(patchBody)))
	if patchRec.Code != http.StatusOK {
		t.Fatalf("patch: %d %s", patchRec.Code, patchRec.Body.String())
	}
	var patched SavedSearch
	if err := json.Unmarshal(patchRec.Body.Bytes(), &patched); err != nil {
		t.Fatal(err)
	}
	if patched.AlertFrequency != AlertWeekly {
		t.Fatalf("patched frequency = %q", patched.AlertFrequency)
	}

	deleteRec := httptest.NewRecorder()
	mux.ServeHTTP(deleteRec, httptest.NewRequest(http.MethodDelete, "/v1/me/saved-searches/"+created.ID, nil))
	if deleteRec.Code != http.StatusNoContent {
		t.Fatalf("delete: %d %s", deleteRec.Code, deleteRec.Body.String())
	}

	missingRec := httptest.NewRecorder()
	mux.ServeHTTP(missingRec, httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches/"+created.ID, nil))
	if missingRec.Code != http.StatusNotFound {
		t.Fatalf("get deleted: %d %s", missingRec.Code, missingRec.Body.String())
	}
}

func TestHandlersUnauthorized(t *testing.T) {
	mux := http.NewServeMux()
	Handlers{
		Service: NewService(NewMemory()),
		CurrentUser: func(*http.Request) (string, error) {
			return "", ErrUnauthorized
		},
	}.Register(mux)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestHandlersInvalidJSON(t *testing.T) {
	mux := http.NewServeMux()
	Handlers{
		Service: NewService(NewMemory()),
		CurrentUser: func(*http.Request) (string, error) {
			return "user-http", nil
		},
	}.Register(mux)

	bad := httptest.NewRecorder()
	mux.ServeHTTP(bad, httptest.NewRequest(http.MethodPost, "/v1/me/saved-searches", bytes.NewReader([]byte("{"))))
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("invalid json = %d", bad.Code)
	}

	nowBody, _ := json.Marshal(Input{AlertFrequency: "hourly"})
	invalid := httptest.NewRecorder()
	mux.ServeHTTP(invalid, httptest.NewRequest(http.MethodPost, "/v1/me/saved-searches", bytes.NewReader(nowBody)))
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("bad frequency = %d %s", invalid.Code, invalid.Body.String())
	}
}

func TestHandlersScopeToCurrentUser(t *testing.T) {
	svc := NewService(NewMemory())
	created, err := svc.Create(context.Background(), "owner", Input{Query: "secret"}, time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("seed: %v", err)
	}

	mux := http.NewServeMux()
	Handlers{
		Service: svc,
		CurrentUser: func(*http.Request) (string, error) {
			return "intruder", nil
		},
	}.Register(mux)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches/"+created.ID, nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("cross-user get = %d %s", rec.Code, rec.Body.String())
	}

	listRec := httptest.NewRecorder()
	mux.ServeHTTP(listRec, httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches", nil))
	if listRec.Code != http.StatusOK {
		t.Fatalf("list: %d %s", listRec.Code, listRec.Body.String())
	}
	var listed listResponse
	if err := json.Unmarshal(listRec.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Searches) != 0 {
		t.Fatalf("intruder list = %+v", listed)
	}
}

func TestHandlersLimitReached(t *testing.T) {
	svc := NewService(NewMemory())
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	for i := 0; i < MaxPerUser; i++ {
		if _, err := svc.Create(context.Background(), "user-http", Input{Query: "q"}, now); err != nil {
			t.Fatalf("seed %d: %v", i, err)
		}
	}
	mux := http.NewServeMux()
	Handlers{
		Service: svc,
		CurrentUser: func(*http.Request) (string, error) {
			return "user-http", nil
		},
	}.Register(mux)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/me/saved-searches", bytes.NewReader([]byte(`{"query":"overflow"}`))))
	if rec.Code != http.StatusConflict {
		t.Fatalf("over cap = %d %s, want 409", rec.Code, rec.Body.String())
	}
}
