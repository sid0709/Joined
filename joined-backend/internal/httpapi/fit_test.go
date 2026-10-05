package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/fitscore"
	"github.com/sid0709/OpenSeat/backend-core/jobschema"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
)

type rewriteReasoner struct {
	text  string
	err   error
	calls int
}

func (r *rewriteReasoner) Rewrite(context.Context, fitscore.Job, fitscore.Profile, fitscore.Result) (string, error) {
	r.calls++
	return r.text, r.err
}

func fitHandler(t *testing.T, memory *fitscore.Memory, reasoner fitscore.Reasoner, switches killswitch.Switches) http.Handler {
	t.Helper()
	if memory == nil {
		memory = &fitscore.Memory{}
	}
	return New(nil, nil, nil, nil, nil, nil, Options{
		Sessions:     testSessions(),
		FitJobs:      memory,
		FitProfiles:  memory,
		FitReasoner:  reasoner,
		KillSwitches: switches,
	})
}

func fitGet(t *testing.T, handler http.Handler, token, jobID string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/v1/me/fit/"+jobID, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func fitPost(t *testing.T, handler http.Handler, token string, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/v1/me/fit", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestJobFitRequiresCandidate(t *testing.T) {
	handler := fitHandler(t, nil, nil, nil)
	if rec := fitGet(t, handler, "", "job-1"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed out status = %d body=%s", rec.Code, rec.Body.String())
	}
	if rec := fitGet(t, handler, "employee-token", "job-1"); rec.Code != http.StatusForbidden {
		t.Fatalf("employee status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestJobFitMissingJobIs404(t *testing.T) {
	handler := fitHandler(t, &fitscore.Memory{Jobs: map[string]fitscore.Job{}}, nil, nil)
	rec := fitGet(t, handler, "candidate-token", "missing")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestJobFitEmptyProfileIsLowConfidence(t *testing.T) {
	memory := &fitscore.Memory{
		Jobs: map[string]fitscore.Job{
			"job-1": {
				ID:        "job-1",
				Title:     "Product Designer",
				Location:  "Chicago, IL",
				Workplace: jobschema.WorkplaceHybrid,
				Skills:    []string{"Figma"},
				PayMin:    140_000,
				PayMax:    170_000,
				PayPeriod: jobschema.PayYear,
			},
		},
	}
	rec := fitGet(t, fitHandler(t, memory, nil, nil), "candidate-token", "job-1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var got jobFitResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.JobID != "job-1" {
		t.Fatalf("jobId = %q", got.JobID)
	}
	if got.Score != 0 || got.Confidence != fitscore.ConfidenceLow {
		t.Fatalf("empty profile score=%d confidence=%q", got.Score, got.Confidence)
	}
	if got.Reason == "" {
		t.Fatal("expected a low-confidence reason")
	}
}

func TestJobFitScoresAgainstProfile(t *testing.T) {
	memory := &fitscore.Memory{
		Jobs: map[string]fitscore.Job{
			"job-1": {
				ID:        "job-1",
				Title:     "Product Designer",
				Location:  "Chicago, IL",
				Workplace: jobschema.WorkplaceHybrid,
				Seniority: jobschema.SenioritySenior,
				Skills:    []string{"Figma", "Prototyping", "User research", "Design systems"},
				PayMin:    140_000,
				PayMax:    170_000,
				PayPeriod: jobschema.PayYear,
			},
		},
		Profiles: map[string]fitscore.Profile{
			"c1": {
				TargetRoles: []string{"Product designer"},
				Locations:   []string{"Chicago", "Remote (US)"},
				SalaryFloor: 140_000,
				Skills:      []string{"Figma", "Prototyping", "User research"},
			},
		},
	}
	rec := fitGet(t, fitHandler(t, memory, nil, nil), "candidate-token", "job-1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var got jobFitResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Score < 70 {
		t.Fatalf("score = %d", got.Score)
	}
	if got.Confidence != fitscore.ConfidenceHigh {
		t.Fatalf("confidence = %q", got.Confidence)
	}
	if got.ModelVersion != fitscore.ModelVersion {
		t.Fatalf("model = %q", got.ModelVersion)
	}
}

func TestJobFitBatchSkipsUnknownAndCaps(t *testing.T) {
	memory := &fitscore.Memory{
		Jobs: map[string]fitscore.Job{
			"job-1": {ID: "job-1", Title: "Designer", Workplace: jobschema.WorkplaceRemote},
		},
		Profiles: map[string]fitscore.Profile{
			"c1": {Workplace: jobschema.WorkplaceRemote},
		},
	}
	handler := fitHandler(t, memory, nil, nil)
	rec := fitPost(t, handler, "candidate-token", `{"jobIds":["job-1","missing","job-1"]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var got jobFitBatchResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Scores) != 1 || got.Scores[0].JobID != "job-1" {
		t.Fatalf("scores = %+v", got.Scores)
	}

	tooMany := make([]string, maxFitJobIDs+1)
	for i := range tooMany {
		tooMany[i] = "job-" + strconv.Itoa(i)
	}
	body, err := json.Marshal(jobFitBatchRequest{JobIDs: tooMany})
	if err != nil {
		t.Fatal(err)
	}
	rec = fitPost(t, handler, "candidate-token", string(body))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("over-limit status = %d body=%s", rec.Code, rec.Body.String())
	}

	rec = fitPost(t, handler, "candidate-token", `{"jobIds":[]}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("empty status = %d", rec.Code)
	}
}

func TestJobFitReasonerGatedByAcornAI(t *testing.T) {
	memory := &fitscore.Memory{
		Jobs: map[string]fitscore.Job{
			"job-1": {ID: "job-1", Title: "Designer", Workplace: jobschema.WorkplaceRemote},
		},
		Profiles: map[string]fitscore.Profile{
			"c1": {Workplace: jobschema.WorkplaceRemote},
		},
	}
	reasoner := &rewriteReasoner{text: "A rewritten reason from the model."}

	off := fitHandler(t, memory, reasoner, killswitch.NewMemory(killswitch.Defaults{killswitch.AcornAI: false}))
	rec := fitGet(t, off, "candidate-token", "job-1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if reasoner.calls != 0 {
		t.Fatalf("reasoner called %d times while acorn_ai is off", reasoner.calls)
	}

	on := fitHandler(t, memory, reasoner, killswitch.NewMemory(killswitch.Defaults{killswitch.AcornAI: true}))
	rec = fitGet(t, on, "candidate-token", "job-1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	if reasoner.calls != 1 {
		t.Fatalf("reasoner calls = %d", reasoner.calls)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte("A rewritten reason from the model.")) {
		t.Fatalf("body = %s", rec.Body.String())
	}

	failing := &rewriteReasoner{err: errors.New("model down")}
	fallback := fitHandler(t, memory, failing, killswitch.NewMemory(killswitch.Defaults{killswitch.AcornAI: true}))
	rec = fitGet(t, fallback, "candidate-token", "job-1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var got jobFitResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Reason == "" || strings.Contains(got.Reason, "model down") {
		t.Fatalf("should keep deterministic reason, got %q", got.Reason)
	}
}

func TestCandidateToFitProfileUsesExperienceAndHomeCity(t *testing.T) {
	got := candidateToFitProfile(candidate.Profile{
		Headline:    "Senior Designer",
		Locations:   []string{"Remote (US)"},
		HomeAddress: candidate.HomeAddress{City: "Chicago"},
		Experience:  []candidate.ExperienceItem{{Role: "Product Designer"}},
	})
	if got.Headline != "Senior Designer" {
		t.Fatalf("headline = %q", got.Headline)
	}
	if len(got.ExperienceTitles) != 1 || got.ExperienceTitles[0] != "Product Designer" {
		t.Fatalf("experience = %+v", got.ExperienceTitles)
	}
	found := false
	for _, loc := range got.Locations {
		if loc == "Chicago" {
			found = true
		}
	}
	if !found {
		t.Fatalf("locations = %+v", got.Locations)
	}
}
