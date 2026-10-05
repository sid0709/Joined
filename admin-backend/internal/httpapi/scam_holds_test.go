package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobscam"
)

func TestScamHoldRoutesRequireAdminToken(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{AdminToken: "secret", ScamHolds: jobscam.NewService(jobscam.NewMemory(), jobscam.NewMemory(), jobscam.Config{HoldThreshold: 40})})
	for _, path := range []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/v1/admin/scam-jobs", ""},
		{http.MethodPost, "/v1/admin/scam-jobs/job-1/review", `{"decision":"approve","reason":"ok"}`},
	} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(path.method, path.path, strings.NewReader(path.body)))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s status = %d body = %s", path.method, path.path, rec.Code, rec.Body.String())
		}
	}
}

func TestScamHoldListAndReview(t *testing.T) {
	mem := jobscam.NewMemory()
	svc := jobscam.NewService(mem, mem, jobscam.Config{HoldThreshold: jobscam.DefaultHoldThreshold})
	now := time.Date(2026, 10, 5, 18, 0, 0, 0, time.UTC)
	if _, err := svc.Inspect(context.Background(), jobscam.Input{
		JobID:       "job-1",
		Title:       "Clerk",
		Company:     "Quick Hire",
		Description: "Pay to apply with a $40 registration fee.",
		ApplyURL:    "https://quick.example/jobs/1",
		CompanyURL:  "https://quick.example",
	}, now); err != nil {
		t.Fatalf("inspect: %v", err)
	}
	handler := New(nil, nil, nil, nil, Options{AdminToken: "secret", ScamHolds: svc})

	listRec := staffCall(t, handler, http.MethodGet, "/v1/admin/scam-jobs", "", "secret", "roosebelt", "")
	if listRec.Code != http.StatusOK {
		t.Fatalf("list status = %d body = %s", listRec.Code, listRec.Body.String())
	}
	var list jobscam.List
	decodeStaff(t, listRec, &list)
	if list.Total != 1 || list.Jobs[0].ID != "job-1" || list.Jobs[0].Status != jobscam.StatusHeld {
		t.Fatalf("list = %+v", list)
	}

	rejectRec := staffCall(t, handler, http.MethodPost, "/v1/admin/scam-jobs/job-1/review", `{"decision":"reject"}`, "secret", "roosebelt", "")
	if rejectRec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("reject without reason status = %d body = %s", rejectRec.Code, rejectRec.Body.String())
	}

	okRec := staffCall(t, handler, http.MethodPost, "/v1/admin/scam-jobs/job-1/review", `{"decision":"approve","reason":"known company"}`, "secret", "roosebelt", "")
	if okRec.Code != http.StatusOK {
		t.Fatalf("approve status = %d body = %s", okRec.Code, okRec.Body.String())
	}
	var body struct {
		Job jobscam.Hold `json:"job"`
	}
	if err := json.Unmarshal(okRec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Job.Status != jobscam.StatusApproved || mem.ListingStatus("job-1") != jobscam.ListingActive {
		t.Fatalf("body = %+v listing = %q", body, mem.ListingStatus("job-1"))
	}
}

func TestScamHoldUnavailableWithoutStore(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{AdminToken: "secret"})
	rec := staffCall(t, handler, http.MethodGet, "/v1/admin/scam-jobs", "", "secret", "roosebelt", "")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}
