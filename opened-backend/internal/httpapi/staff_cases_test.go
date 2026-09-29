package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/opened-backend/internal/staff"
)

func TestStaffCasesRejectMissingToken(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, staff.NewMem(), nil, Options{AdminToken: "secret"})
	paths := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/v1/admin/cases?queue=reports&status=open", ""},
		{http.MethodPost, "/v1/admin/cases", `{"queue":"reports","reasonCode":"scam_job","subjectType":"job","subjectId":"job-1"}`},
		{http.MethodPost, "/v1/admin/cases/case-1/decision", `{"decision":"uphold","reason":"Screenshot matches"}`},
		{http.MethodGet, "/v1/reports", ""},
		{http.MethodPost, "/v1/reports", `{"subjectType":"job","subjectId":"job-1","reasonCode":"scam_job"}`},
		{http.MethodPost, "/v1/reports/rep-1/appeal", `{"statement":"Not this"}`},
	}
	for _, path := range paths {
		req := httptest.NewRequest(path.method, path.path, strings.NewReader(path.body))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s status = %d body = %s", path.method, path.path, rec.Code, rec.Body.String())
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/cases", nil)
	req.Header.Set("Authorization", "Bearer nope")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong token status = %d", rec.Code)
	}
}

func TestStaffReportRejectsNotAGoodFit(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, nil, Options{AdminToken: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/v1/reports", strings.NewReader(`{"subjectType":"job","subjectId":"job-1","reasonCode":"not_a_good_fit"}`))
	req.Header.Set("Authorization", "Bearer secret")
	req.Header.Set(idempotencyHeader, "key-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity || !strings.Contains(rec.Body.String(), "reasonCode") {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestStaffCasesAndReportsHappyPath(t *testing.T) {
	mem := staff.NewMem()
	handler := New(nil, nil, nil, nil, nil, mem, nil, Options{AdminToken: "secret"})
	body := `{"subjectType":" job ","subjectId":" job-1 ","reasonCode":"scam_job","details":" Asks for a fee ","evidenceKeys":[" shot ","","shot"]}`
	rec := staffCall(t, handler, http.MethodPost, "/v1/reports", body, "secret", "  roosebelt\n", "key-1")
	if rec.Code != http.StatusCreated {
		t.Fatalf("file status = %d body = %s", rec.Code, rec.Body.String())
	}
	var filed struct {
		Report struct {
			ID         string   `json:"id"`
			CaseID     string   `json:"caseId"`
			ReasonCode string   `json:"reasonCode"`
			SubjectID  string   `json:"subjectId"`
			Status     string   `json:"status"`
			Evidence   []string `json:"evidenceKeys"`
		} `json:"report"`
		AuditID string `json:"auditId"`
	}
	decodeStaff(t, rec, &filed)
	if filed.Report.ID == "" || filed.Report.CaseID == "" || filed.AuditID == "" || filed.Report.ReasonCode != "scam_job" || filed.Report.SubjectID != "job-1" {
		t.Fatalf("filed = %+v", filed)
	}
	if len(filed.Report.Evidence) != 1 || filed.Report.Evidence[0] != "shot" {
		t.Fatalf("evidence = %+v", filed.Report.Evidence)
	}

	replay := staffCall(t, handler, http.MethodPost, "/v1/reports", body, "secret", "roosebelt", "key-1")
	if replay.Code != http.StatusCreated || replay.Header().Get("Idempotent-Replayed") != "true" {
		t.Fatalf("replay status = %d header = %s body = %s", replay.Code, replay.Header().Get("Idempotent-Replayed"), replay.Body.String())
	}
	clash := staffCall(t, handler, http.MethodPost, "/v1/reports", `{"subjectType":"job","subjectId":"job-2","reasonCode":"fake_company"}`, "secret", "roosebelt", "key-1")
	if clash.Code != http.StatusConflict || !strings.Contains(clash.Body.String(), "idempotency_key_reused") {
		t.Fatalf("clash status = %d body = %s", clash.Code, clash.Body.String())
	}

	list := staffCall(t, handler, http.MethodGet, "/v1/admin/cases?queue=reports&status=open&page=1&pageSize=25", "", "secret", "roosebelt", "")
	if list.Code != http.StatusOK {
		t.Fatalf("list status = %d body = %s", list.Code, list.Body.String())
	}
	var cases struct {
		Cases []struct {
			ID          string   `json:"id"`
			Queue       string   `json:"queue"`
			Status      string   `json:"status"`
			ReasonCode  string   `json:"reasonCode"`
			SubjectType string   `json:"subjectType"`
			SubjectID   string   `json:"subjectId"`
			Evidence    []string `json:"evidenceKeys"`
			CreatedAt   string   `json:"createdAt"`
			SLAAt       string   `json:"slaAt"`
			Decision    string   `json:"decision"`
		} `json:"cases"`
		Total int64  `json:"total"`
		Next  *int64 `json:"next"`
	}
	decodeStaff(t, list, &cases)
	if cases.Total != 1 || cases.Next != nil || cases.Cases[0].ID != filed.Report.CaseID || cases.Cases[0].ReasonCode != "scam_job" || cases.Cases[0].Decision != "" || cases.Cases[0].SLAAt == "" {
		t.Fatalf("cases = %+v", cases)
	}

	appeal := staffCall(t, handler, http.MethodPost, "/v1/reports/"+filed.Report.ID+"/appeal", `{"statement":"It was a real job","evidenceKeys":["note"]}`, "secret", "roosebelt", "")
	if appeal.Code != http.StatusOK || !strings.Contains(appeal.Body.String(), `"status":"pending"`) {
		t.Fatalf("appeal status = %d body = %s", appeal.Code, appeal.Body.String())
	}

	decision := staffCall(t, handler, http.MethodPost, "/v1/admin/cases/"+filed.Report.CaseID+"/decision", `{"decision":"uphold","reason":" Screenshot matches ","actions":["warning"," warning "]}`, "secret", "roosebelt", "")
	if decision.Code != http.StatusOK {
		t.Fatalf("decision status = %d body = %s", decision.Code, decision.Body.String())
	}
	var decided struct {
		Case struct {
			Status    string   `json:"status"`
			Decision  string   `json:"decision"`
			DecidedBy string   `json:"decidedBy"`
			Actions   []string `json:"actions"`
			Evidence  []string `json:"decisionEvidenceKeys"`
		} `json:"case"`
		AuditID string `json:"auditId"`
	}
	decodeStaff(t, decision, &decided)
	if decided.Case.Status != "resolved" || decided.Case.Decision != "uphold" || decided.Case.DecidedBy != "roosebelt" || decided.AuditID == "" {
		t.Fatalf("decided = %+v", decided)
	}
	if len(decided.Case.Actions) != 1 || decided.Case.Actions[0] != "warning" || len(decided.Case.Evidence) != 2 {
		t.Fatalf("actions = %+v", decided.Case)
	}

	again := staffCall(t, handler, http.MethodPost, "/v1/admin/cases/"+filed.Report.CaseID+"/decision", `{"decision":"dismiss","reason":"Duplicate"}`, "secret", "roosebelt", "")
	if again.Code != http.StatusConflict {
		t.Fatalf("second decision status = %d body = %s", again.Code, again.Body.String())
	}

	opened := staffCall(t, handler, http.MethodPost, "/v1/admin/cases", `{"queue":"disputes","reasonCode":"no_show","subjectType":"interview","subjectId":"iv-1","details":"Candidate did not attend"}`, "secret", "roosebelt", "")
	if opened.Code != http.StatusCreated || !strings.Contains(opened.Body.String(), `"queue":"disputes"`) {
		t.Fatalf("open status = %d body = %s", opened.Code, opened.Body.String())
	}

	missing := staffCall(t, handler, http.MethodPost, "/v1/reports", body, "secret", "", "")
	if missing.Code != http.StatusBadRequest {
		t.Fatalf("missing key status = %d body = %s", missing.Code, missing.Body.String())
	}

	var sawFile, sawDecision bool
	for _, entry := range mem.Audits() {
		if entry.Actor != "roosebelt" {
			t.Fatalf("actor = %+v", entry)
		}
		if entry.Action == "report.file" && entry.SubjectType == "report" {
			sawFile = true
		}
		if entry.Action == "case.decision.uphold" && entry.SubjectType == "case" && entry.Note == "Screenshot matches" {
			sawDecision = true
		}
	}
	if !sawFile || !sawDecision {
		t.Fatalf("audits = %+v", mem.Audits())
	}
}

func staffCall(t *testing.T, handler http.Handler, method, path, body, token, actor, idempotencyKey string) *httptest.ResponseRecorder {
	t.Helper()
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if actor != "" {
		req.Header.Set(adminActorHeader, actor)
	}
	if idempotencyKey != "" {
		req.Header.Set(idempotencyHeader, idempotencyKey)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func decodeStaff(t *testing.T, rec *httptest.ResponseRecorder, dest any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), dest); err != nil {
		t.Fatalf("decode %s: %v", rec.Body.String(), err)
	}
}
