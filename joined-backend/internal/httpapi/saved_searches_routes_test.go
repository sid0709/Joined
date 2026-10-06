package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/savedsearch"
)

func TestSavedSearchRoutesStayUnmountedWithoutStore(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, Options{Sessions: testSessions()})
	req := httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches", nil)
	req.Header.Set("Authorization", "Bearer candidate-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("unmounted status = %d, want 404, body=%s", rec.Code, rec.Body.String())
	}
}

func TestSavedSearchRoutesAreScopedToTheCaller(t *testing.T) {
	store := savedsearch.NewMemory()
	handler := New(nil, nil, nil, nil, nil, nil, Options{
		Sessions:      testSessions(),
		SavedSearches: store,
	})

	t.Run("signed out is 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("employee cannot use hunter saved searches", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches", nil)
		req.Header.Set("Authorization", "Bearer employee-token")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("candidate can create list get patch and delete", func(t *testing.T) {
		create := httptest.NewRequest(http.MethodPost, "/v1/me/saved-searches", strings.NewReader(
			`{"name":"Remote Go","query":"golang","filters":{"location":"Remote","remote":true},"alertFrequency":"daily"}`,
		))
		create.Header.Set("Authorization", "Bearer candidate-token")
		createRec := httptest.NewRecorder()
		handler.ServeHTTP(createRec, create)
		if createRec.Code != http.StatusCreated {
			t.Fatalf("create status = %d body = %s", createRec.Code, createRec.Body.String())
		}
		var created savedsearch.SavedSearch
		if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
			t.Fatalf("decode create: %v", err)
		}
		if created.UserID != "c1" || created.Query != "golang" || created.AlertFrequency != savedsearch.AlertDaily {
			t.Fatalf("created = %+v", created)
		}

		list := httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches", nil)
		list.Header.Set("Authorization", "Bearer candidate-token")
		listRec := httptest.NewRecorder()
		handler.ServeHTTP(listRec, list)
		if listRec.Code != http.StatusOK {
			t.Fatalf("list status = %d body = %s", listRec.Code, listRec.Body.String())
		}

		get := httptest.NewRequest(http.MethodGet, "/v1/me/saved-searches/"+created.ID, nil)
		get.Header.Set("Authorization", "Bearer candidate-token")
		getRec := httptest.NewRecorder()
		handler.ServeHTTP(getRec, get)
		if getRec.Code != http.StatusOK {
			t.Fatalf("get status = %d body = %s", getRec.Code, getRec.Body.String())
		}

		patch := httptest.NewRequest(http.MethodPatch, "/v1/me/saved-searches/"+created.ID, strings.NewReader(
			`{"alertFrequency":"weekly"}`,
		))
		patch.Header.Set("Authorization", "Bearer candidate-token")
		patchRec := httptest.NewRecorder()
		handler.ServeHTTP(patchRec, patch)
		if patchRec.Code != http.StatusOK {
			t.Fatalf("patch status = %d body = %s", patchRec.Code, patchRec.Body.String())
		}

		del := httptest.NewRequest(http.MethodDelete, "/v1/me/saved-searches/"+created.ID, nil)
		del.Header.Set("Authorization", "Bearer candidate-token")
		delRec := httptest.NewRecorder()
		handler.ServeHTTP(delRec, del)
		if delRec.Code != http.StatusNoContent {
			t.Fatalf("delete status = %d body = %s", delRec.Code, delRec.Body.String())
		}
	})
}
