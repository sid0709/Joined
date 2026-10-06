package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/scout"
	"github.com/sid0709/OpenSeat/backend-core/staff"
)

type staticQuality struct{ snapshot QualitySnapshot }

func (s staticQuality) Quality(context.Context, time.Time) (QualitySnapshot, error) {
	return s.snapshot, nil
}

func TestJobSourceAndQuality(t *testing.T) {
	jobs.ResetSourceOverrides()
	t.Cleanup(jobs.ResetSourceOverrides)
	handler := New(nil, scout.NewMemoryStore(nil, time.Now), staff.NewMem(), nil, Options{
		AdminToken: "secret",
		Quality: staticQuality{snapshot: QualitySnapshot{
			Held: 2, DeadLink: 1, Duplicate: 3, Published: 9,
		}},
	})
	rec := callAdmin(handler, http.MethodPut, "/v1/admin/job-sources/athens", `{"enabled":false,"reason":"bad feed"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("source = %d %s", rec.Code, rec.Body.String())
	}
	rec = callAdmin(handler, http.MethodGet, "/v1/admin/job-sources", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("list = %d %s", rec.Code, rec.Body.String())
	}
	rec = callAdmin(handler, http.MethodGet, "/v1/admin/jobs/quality", "")
	var quality QualitySnapshot
	if err := json.Unmarshal(rec.Body.Bytes(), &quality); err != nil || quality.Held != 2 || quality.DeadLink != 1 || quality.Published != 9 {
		t.Fatalf("quality = %s err=%v", rec.Body.String(), err)
	}
	rec = callAdmin(handler, http.MethodGet, "/v1/admin/scout/earnings/report", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("report = %d %s", rec.Code, rec.Body.String())
	}
}
