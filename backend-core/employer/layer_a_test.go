package employer

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

func readyJob(status string) storedJob {
	return storedJob{
		Title:       "Engineer",
		Team:        "Platform",
		Location:    "NYC",
		Summary:     "Build the product.",
		Description: "Build the product. Full posting text as the company wrote it.",
		PayMin:      100000,
		PayMax:      140000,
		Skills:      []string{"Go", "SQL", "API"},
		Status:      status,
	}
}

func TestCloseStampsReasonAndDefaultsNotify(t *testing.T) {
	now := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	doc := readyJob(statusOpen)
	doc.Team = "Platform"
	next, err := applyJobStatus(doc, JobStatusPatch{
		Status:      statusClosed,
		CloseReason: "  " + strings.Repeat("a", maxCloseReason+5) + "  ",
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	if next.Status != statusClosed || !next.ClosedAt.Equal(now) {
		t.Fatalf("closed = %+v", next)
	}
	if len([]rune(next.CloseReason)) != maxCloseReason {
		t.Fatalf("reason len = %d", len([]rune(next.CloseReason)))
	}
	if next.NotifyOnClose == nil || !*next.NotifyOnClose {
		t.Fatalf("notify = %v", next.NotifyOnClose)
	}
	view := viewJob(next, Pipeline{})
	raw, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["department"] != "Platform" || payload["closeReason"] == "" || payload["notifyOnClose"] != true {
		t.Fatalf("payload = %s", raw)
	}
	if payload["closedAt"] == "" || payload["closedAt"] == nil {
		t.Fatalf("closedAt = %v", payload["closedAt"])
	}
}

func TestCloseWantsNoticeUnlessOptedOut(t *testing.T) {
	now := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	closed, err := applyJobStatus(readyJob(statusOpen), JobStatusPatch{Status: statusClosed}, now)
	if err != nil || !wantsCloseNotice(closed) {
		t.Fatalf("default close = %+v %v", closed.NotifyOnClose, err)
	}
	off := false
	silent, err := applyJobStatus(readyJob(statusPaused), JobStatusPatch{Status: statusClosed, NotifyOnClose: &off}, now)
	if err != nil || wantsCloseNotice(silent) {
		t.Fatalf("opt-out = %+v %v", silent.NotifyOnClose, err)
	}
	reopened, err := applyJobStatus(closed, JobStatusPatch{Status: statusOpen}, now.Add(time.Hour))
	if err != nil || wantsCloseNotice(reopened) {
		t.Fatalf("reopen = %+v %v", reopened.NotifyOnClose, err)
	}
	if wantsCloseNotice(readyJob(statusOpen)) {
		t.Fatal("an open job must not notify")
	}
}

func TestCloseHonorsNotifyFalse(t *testing.T) {
	notify := false
	now := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	next, err := applyJobStatus(readyJob(statusPaused), JobStatusPatch{
		Status:        statusClosed,
		CloseReason:   "role filled",
		NotifyOnClose: &notify,
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	view := viewJob(next, Pipeline{})
	raw, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"notifyOnClose":false`) || !strings.Contains(string(raw), `"closeReason":"role filled"`) {
		t.Fatalf("payload = %s", raw)
	}
}

func TestReopenClearsCloseFields(t *testing.T) {
	notify := true
	closedAt := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	now := closedAt.Add(24 * time.Hour)
	doc := readyJob(statusClosed)
	doc.ClosedAt = closedAt
	doc.CloseReason = "filled"
	doc.NotifyOnClose = &notify
	next, err := applyJobStatus(doc, JobStatusPatch{Status: statusOpen, CloseReason: "ignored"}, now)
	if err != nil {
		t.Fatal(err)
	}
	if next.Status != statusOpen || !next.ClosedAt.IsZero() || next.CloseReason != "" || next.NotifyOnClose != nil {
		t.Fatalf("reopened = %+v", next)
	}
	view := viewJob(next, Pipeline{})
	raw, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	body := string(raw)
	if strings.Contains(body, "closedAt") || strings.Contains(body, "closeReason") || strings.Contains(body, "notifyOnClose") {
		t.Fatalf("open job leaked close fields: %s", body)
	}
	if !strings.Contains(body, `"department":"Platform"`) {
		t.Fatalf("department alias missing: %s", body)
	}
}

func TestClosedJobRejectsNonReopen(t *testing.T) {
	_, err := applyJobStatus(readyJob(statusClosed), JobStatusPatch{Status: statusPaused}, time.Now())
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("err = %v", err)
	}
	_, err = applyJobStatus(storedJob{Status: statusRemoved, Title: "Engineer"}, JobStatusPatch{Status: statusOpen}, time.Now())
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("removed err = %v", err)
	}
}

func TestReopenRequiresPublishableJob(t *testing.T) {
	doc := storedJob{Title: "Engineer", Team: "Design", Status: statusClosed, CloseReason: "paused hiring"}
	_, err := applyJobStatus(doc, JobStatusPatch{Status: statusOpen}, time.Now())
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v", err)
	}
	if doc.CloseReason != "paused hiring" {
		t.Fatal("failed reopen mutated the stored job")
	}
}

func TestSameStatusIsInvalid(t *testing.T) {
	_, err := applyJobStatus(readyJob(statusOpen), JobStatusPatch{Status: statusOpen}, time.Now())
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v", err)
	}
}

func TestNormalizeJobTemplatesMirrorsDepartment(t *testing.T) {
	now := time.Date(2026, 9, 29, 15, 0, 0, 0, time.UTC)
	got, err := normalizeJobTemplates([]JobTemplate{{
		Name:       "  Design posting  ",
		Department: "Design",
		Seniority:  "lead",
		Location:   "Chicago",
		PayMin:     10,
		PayMax:     20,
		Currency:   "eur",
		Visa:       true,
		Skills:     []string{"Figma", "figma", "Research"},
		ScreeningQuestions: []jobs.ScreeningQuestion{{
			ID: "q1", Prompt: " Onsite? ", Kind: jobs.ScreeningYesNo, Required: true,
		}},
	}}, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("len = %d", len(got))
	}
	item := got[0]
	if !strings.HasPrefix(item.ID, "jt-") || item.Name != "Design posting" {
		t.Fatalf("id/name = %s %s", item.ID, item.Name)
	}
	if item.Team != "Design" || item.Department != "Design" {
		t.Fatalf("team = %q department = %q", item.Team, item.Department)
	}
	if item.Seniority != jobschema.SeniorityLeader || item.Workplace != jobschema.WorkplaceHybrid {
		t.Fatalf("level = %s %s", item.Seniority, item.Workplace)
	}
	if item.Currency != jobschema.CurrencyEUR || !item.Visa || len(item.Skills) != 2 {
		t.Fatalf("facts = %+v", item)
	}
	if !item.UpdatedAt.Equal(now) || len(item.ScreeningQuestions) != 1 || item.ScreeningQuestions[0].Prompt != "Onsite?" {
		t.Fatalf("meta = %+v", item)
	}
}

func TestNormalizeJobTemplatesRejectsBadCatalog(t *testing.T) {
	now := time.Now()
	_, err := normalizeJobTemplates([]JobTemplate{{ID: "jt-1", Title: "Designer"}}, now)
	if !errors.Is(err, ErrInvalidInput) || !strings.Contains(err.Error(), "name") {
		t.Fatalf("blank name err = %v", err)
	}
	tooMany := make([]JobTemplate, maxJobTemplates+1)
	for i := range tooMany {
		tooMany[i] = JobTemplate{ID: strings.Repeat("x", i+1), Name: "Template"}
	}
	_, err = normalizeJobTemplates(tooMany, now)
	if !errors.Is(err, ErrInvalidInput) || !strings.Contains(err.Error(), "12") {
		t.Fatalf("cap err = %v", err)
	}
	_, err = normalizeJobTemplates([]JobTemplate{
		{ID: "jt-1", Name: "One"},
		{ID: "jt-1", Name: "Two"},
	}, now)
	if !errors.Is(err, ErrInvalidInput) || !strings.Contains(err.Error(), "duplicated") {
		t.Fatalf("dup err = %v", err)
	}
	_, err = normalizeJobTemplates([]JobTemplate{{
		ID: "jt-1", Name: "Bad", ScreeningQuestions: []jobs.ScreeningQuestion{{ID: "q", Prompt: "Essay", Kind: "essay"}},
	}}, now)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("screening err = %v", err)
	}
	longName := strings.Repeat("n", maxTemplateName+5)
	got, err := normalizeJobTemplates([]JobTemplate{{ID: "jt-9", Name: longName}}, now)
	if err != nil {
		t.Fatal(err)
	}
	if len([]rune(got[0].Name)) != maxTemplateName {
		t.Fatalf("name len = %d", len([]rune(got[0].Name)))
	}
}

func TestDepartmentNamesPreferDepartments(t *testing.T) {
	names, err := departmentNames(DepartmentsWrite{Departments: []string{"Design"}, Teams: []string{"Data"}})
	if err != nil || len(names) != 1 || names[0] != "Design" {
		t.Fatalf("departments = %v %v", names, err)
	}
	names, err = departmentNames(DepartmentsWrite{Teams: []string{"Data"}})
	if err != nil || len(names) != 1 || names[0] != "Data" {
		t.Fatalf("teams alias = %v %v", names, err)
	}
	names, err = departmentNames(DepartmentsWrite{Departments: []string{}})
	if err != nil || len(names) != 0 {
		t.Fatalf("empty = %v %v", names, err)
	}
	if _, err = departmentNames(DepartmentsWrite{}); err == nil {
		t.Fatal("missing list should be rejected")
	}
}

func TestOfficeLocationsRenameCatalogOnly(t *testing.T) {
	got, err := normalizeOfficeLocations(OfficeLocationsWrite{
		Locations: []string{" NYC ", "Austin", "nyc"},
		Rename:    &TeamRename{From: "nyc", To: "New York"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != "New York" || got[1] != "Austin" {
		t.Fatalf("locations = %v", got)
	}
	if _, err = normalizeOfficeLocations(OfficeLocationsWrite{}); err == nil {
		t.Fatal("missing locations should be rejected")
	}
	if _, err = normalizeOfficeLocations(OfficeLocationsWrite{
		Locations: []string{"NYC"},
		Rename:    &TeamRename{From: " ", To: "Boston"},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("rename err = %v", err)
	}
	many := make([]string, maxOfficeLocations+3)
	for i := range many {
		many[i] = strings.Repeat("c", i+1)
	}
	capped, err := normalizeOfficeLocations(OfficeLocationsWrite{Locations: many})
	if err != nil || len(capped) != maxOfficeLocations {
		t.Fatalf("capped = %d %v", len(capped), err)
	}
}

func TestLayerACatalogAndCloseAuthz(t *testing.T) {
	if err := AuthorizeCompany(RoleInterviewer, PermJobsView); err != nil {
		t.Fatal(err)
	}
	if err := AuthorizeCompany(RoleFinance, PermJobsView); err != nil {
		t.Fatal(err)
	}
	if AuthorizeCompany(RoleInterviewer, PermJobsEdit) == nil || AuthorizeCompany(RoleFinance, PermJobsEdit) == nil {
		t.Fatal("interviewer and finance cannot edit templates or catalogs")
	}
	if err := AuthorizeCompany(RoleHiringManager, PermJobsEdit); err != nil {
		t.Fatal(err)
	}
	if err := AuthorizeCompany(RoleRecruiter, PermJobsPublish); err != nil {
		t.Fatal(err)
	}
	if AuthorizeCompany(RoleHiringManager, PermJobsPublish) == nil || AuthorizeCompany(RoleInterviewer, PermJobsPublish) == nil {
		t.Fatal("hiring manager and interviewer cannot close or reopen")
	}
}
