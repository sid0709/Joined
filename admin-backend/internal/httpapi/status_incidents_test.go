package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/statuspage"
)

func TestStatusIncidents(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{StatusPage: &statuspage.Memory{}})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set(adminActorHeader, "staff@joined")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}

	rec := call(http.MethodPost, "/v1/admin/status/incidents",
		`{"title":"Slow search","impact":"minor","components":["search"],"message":"Looking into it."}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body)
	}
	var created statuspage.Incident
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	if created.Phase != statuspage.Investigating || created.Updates[0].By != "staff@joined" {
		t.Fatalf("created: %+v", created)
	}

	if rec := call(http.MethodPost, "/v1/admin/status/incidents", `{"title":"x","impact":"minor","components":["billing"],"message":"m"}`); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("unknown component: %d", rec.Code)
	}
	if rec := call(http.MethodPost, "/v1/admin/status/incidents/nope/updates", `{"status":"resolved","message":"m"}`); rec.Code != http.StatusNotFound {
		t.Fatalf("missing: %d", rec.Code)
	}
	rec = call(http.MethodPost, "/v1/admin/status/incidents/"+created.ID+"/updates", `{"status":"resolved","message":"Fixed."}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("resolve: %d %s", rec.Code, rec.Body)
	}

	rec = call(http.MethodGet, "/v1/admin/status/incidents", "")
	var list struct {
		Incidents  []statuspage.Incident `json:"incidents"`
		Components []statusComponent     `json:"components"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list.Incidents) != 1 || list.Incidents[0].Phase != statuspage.Resolved || len(list.Components) != len(statuspage.Components) {
		t.Fatalf("list: %+v", list)
	}
}
