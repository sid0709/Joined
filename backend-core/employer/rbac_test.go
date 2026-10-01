package employer

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
)

func TestRolePermissionMatrix(t *testing.T) {
	owner := []string{
		PermJobsView, PermJobsEdit, PermJobsPublish,
		PermApplicantsView, PermApplicantsMove,
		PermInterviewsSchedule, PermInterviewsScore,
		PermOffersDraft, PermOffersSend, PermOffersApprove, PermOffersHire,
		PermBillingView, PermBillingPurchase,
		PermTeamInvite, PermTeamManageRoles, PermAuditView,
		PermAnalyticsView,
	}
	for _, perm := range owner {
		if !Can(RoleOwner, perm) {
			t.Fatalf("owner missing %s", perm)
		}
	}
	if Can(RoleAdmin, PermBillingPurchase) {
		t.Fatal("admin cannot purchase")
	}
	if !Can(RoleAdmin, PermBillingView) || !Can(RoleAdmin, PermOffersHire) || !Can(RoleAdmin, PermAuditView) {
		t.Fatal("admin should view billing, hire, and audit")
	}
	if Can(RoleRecruiter, PermOffersApprove) || Can(RoleRecruiter, PermBillingView) || Can(RoleRecruiter, PermTeamInvite) {
		t.Fatal("recruiter cannot approve, view billing, or invite")
	}
	if !Can(RoleRecruiter, PermOffersSend) || !Can(RoleRecruiter, PermOffersHire) || !Can(RoleRecruiter, PermJobsPublish) {
		t.Fatal("recruiter should send, hire, and publish")
	}
	if Can(RoleHiringManager, PermOffersSend) || Can(RoleHiringManager, PermOffersHire) || Can(RoleHiringManager, PermJobsPublish) {
		t.Fatal("hiring manager cannot send, hire, or publish")
	}
	if !Can(RoleHiringManager, PermOffersDraft) || !Can(RoleHiringManager, PermOffersApprove) || !Can(RoleHiringManager, PermApplicantsMove) {
		t.Fatal("hiring manager should draft, approve, and move")
	}
	if Can(RoleInterviewer, PermApplicantsMove) || Can(RoleInterviewer, PermOffersDraft) || Can(RoleInterviewer, PermJobsEdit) {
		t.Fatal("interviewer cannot move, draft, or edit jobs")
	}
	if !Can(RoleInterviewer, PermInterviewsScore) || !Can(RoleInterviewer, PermApplicantsView) || !Can(RoleInterviewer, PermJobsView) {
		t.Fatal("interviewer should score and view")
	}
	if !Can(RoleViewer, PermInterviewsScore) || Can(RoleViewer, PermJobsEdit) {
		t.Fatal("legacy viewer should match interviewer")
	}
	if Can(RoleFinance, PermApplicantsMove) || Can(RoleFinance, PermOffersDraft) || Can(RoleFinance, PermJobsEdit) || Can(RoleFinance, PermTeamManageRoles) {
		t.Fatal("finance cannot move, draft, edit jobs, or manage roles")
	}
	if !Can(RoleFinance, PermBillingPurchase) || !Can(RoleFinance, PermOffersApprove) || !Can(RoleFinance, PermAuditView) || !Can(RoleFinance, PermAnalyticsView) {
		t.Fatal("finance should purchase, approve, audit, and view analytics")
	}
	if Can("stranger", PermJobsView) || Can("", PermJobsView) {
		t.Fatal("unknown roles grant nothing")
	}
}

func TestInviteAndRoleStatus(t *testing.T) {
	role, err := NormalizeInviteRole(RoleOwner, "hiring_manager")
	if err != nil || role != RoleHiringManager {
		t.Fatalf("owner invite hm = %q %v", role, err)
	}
	role, err = NormalizeInviteRole(RoleOwner, "hm")
	if err != nil || role != RoleHiringManager {
		t.Fatalf("alias = %q %v", role, err)
	}
	if _, err := NormalizeInviteRole(RoleAdmin, RoleFinance); err != nil {
		t.Fatal(err)
	}
	if _, err := NormalizeInviteRole(RoleAdmin, RoleInterviewer); err != nil {
		t.Fatal(err)
	}
	_, err = NormalizeInviteRole(RoleRecruiter, RoleRecruiter)
	assertForbidden(t, err)
	_, err = NormalizeInviteRole(RoleInterviewer, RoleRecruiter)
	assertForbidden(t, err)
	_, err = NormalizeInviteRole(RoleAdmin, RoleAdmin)
	assertForbidden(t, err)
	_, err = NormalizeInviteRole(RoleOwner, RoleOwner)
	assertInvalid(t, err)
	_, err = NormalizeInviteRole(RoleOwner, RoleViewer)
	assertInvalid(t, err)
	_, err = NormalizeInviteRole(RoleOwner, "nope")
	assertInvalid(t, err)

	if _, err := NormalizeMemberRole(RoleOwner, RoleAdmin, false, RoleRecruiter); err != nil {
		t.Fatal(err)
	}
	if _, err := NormalizeMemberRole(RoleAdmin, RoleRecruiter, false, RoleHiringManager); err != nil {
		t.Fatal(err)
	}
	_, err = NormalizeMemberRole(RoleRecruiter, RoleRecruiter, false, RoleAdmin)
	assertForbidden(t, err)
	_, err = NormalizeMemberRole(RoleAdmin, RoleAdmin, false, RoleRecruiter)
	assertForbidden(t, err)
	_, err = NormalizeMemberRole(RoleAdmin, RoleRecruiter, false, RoleAdmin)
	assertForbidden(t, err)
	_, err = NormalizeMemberRole(RoleOwner, RoleOwner, false, RoleAdmin)
	assertForbidden(t, err)
	_, err = NormalizeMemberRole(RoleOwner, RoleRecruiter, true, RoleInterviewer)
	assertForbidden(t, err)
	_, err = NormalizeMemberRole(RoleOwner, RoleRecruiter, false, RoleOwner)
	assertInvalid(t, err)

	if err := AuthorizeRemove(RoleOwner, RoleRecruiter, false); err != nil {
		t.Fatal(err)
	}
	assertForbidden(t, AuthorizeRemove(RoleInterviewer, RoleRecruiter, false))
	assertForbidden(t, AuthorizeRemove(RoleAdmin, RoleOwner, false))
	assertForbidden(t, AuthorizeRemove(RoleAdmin, RoleAdmin, false))
	assertInvalid(t, AuthorizeRemove(RoleOwner, RoleRecruiter, true))
}

func TestOfferMutationPermissions(t *testing.T) {
	hired, err := MutationPermissions(StageInput{ColumnID: stageHired})
	if err != nil || !containsPerm(hired, PermOffersHire) || containsPerm(hired, PermApplicantsMove) {
		t.Fatalf("hired = %v %v", hired, err)
	}
	moved, err := MutationPermissions(StageInput{ColumnID: stageInterview})
	if err != nil || !containsPerm(moved, PermApplicantsMove) || containsPerm(moved, PermOffersHire) {
		t.Fatalf("move = %v %v", moved, err)
	}
	sent, err := MutationPermissions(StageInput{Offer: json.RawMessage(`{"status":"sent","comp":{"currency":"USD"}}`)})
	if err != nil || !containsPerm(sent, PermOffersSend) || !containsPerm(sent, PermOffersDraft) {
		t.Fatalf("sent = %v %v", sent, err)
	}
	approved, err := MutationPermissions(StageInput{Offer: json.RawMessage(`{"status":"approved"}`)})
	if err != nil || !containsPerm(approved, PermOffersApprove) || containsPerm(approved, PermOffersDraft) {
		t.Fatalf("approved = %v %v", approved, err)
	}
	if _, err := MutationPermissions(StageInput{Offer: json.RawMessage(`{"status":"nope"}`)}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad status = %v", err)
	}
	create := JobCreatePermissions(statusOpen)
	if !containsPerm(create, PermJobsEdit) || !containsPerm(create, PermJobsPublish) {
		t.Fatalf("create open = %v", create)
	}
	draft := JobCreatePermissions(statusDraft)
	if containsPerm(draft, PermJobsPublish) || !containsPerm(draft, PermJobsEdit) {
		t.Fatalf("create draft = %v", draft)
	}
}

func TestJobAccessOverride(t *testing.T) {
	idx := NewAccessIndex(map[string][]JobAccessAssignment{
		"job-1": {{MemberID: "u1", Permissions: []string{PermJobsView}}},
		"job-3": {{MemberID: "u1"}},
	})
	if idx.Allows("u1", RoleInterviewer, "job-1", PermInterviewsScore) {
		t.Fatal("override should replace the interviewer set")
	}
	if !idx.Allows("u1", RoleInterviewer, "job-1", PermJobsView) {
		t.Fatal("override should keep jobs.view")
	}
	if !idx.Allows("u1", RoleInterviewer, "job-2", PermInterviewsScore) {
		t.Fatal("missing assignment inherits the role")
	}
	if !idx.Allows("u1", RoleInterviewer, "job-3", PermInterviewsScore) {
		t.Fatal("empty permissions inherit")
	}
	if !idx.CanEditJobAccess("u1", RoleRecruiter, "job-2") {
		t.Fatal("recruiter can edit access via jobs.edit")
	}
	locked := NewAccessIndex(map[string][]JobAccessAssignment{
		"job-1": {{MemberID: "u1", Permissions: []string{PermJobsView}}},
	})
	if !locked.CanEditJobAccess("u1", RoleRecruiter, "job-1") {
		t.Fatal("company jobs.edit can still repair access")
	}
	hidden := NewAccessIndex(map[string][]JobAccessAssignment{
		"job-1": {{MemberID: "u1", Permissions: []string{PermInterviewsScore}}},
	})
	if hidden.CanViewJobAccess("u1", RoleInterviewer, "job-1") {
		t.Fatal("override that drops jobs.view hides access from an interviewer")
	}
	if !locked.CanViewJobAccess("u1", RoleInterviewer, "job-2") {
		t.Fatal("interviewer can view access when the role inherits jobs.view")
	}
	if idx.CanEditJobAccess("u1", RoleInterviewer, "job-2") || idx.CanEditJobAccess("u1", RoleFinance, "job-2") {
		t.Fatal("interviewer and finance cannot edit job access")
	}
	if !idx.CanEditJobAccess("u1", RoleAdmin, "job-2") {
		t.Fatal("admin can edit job access")
	}
	grant := NewAccessIndex(map[string][]JobAccessAssignment{
		"job-9": {{MemberID: "fin", Permissions: []string{PermApplicantsView, PermApplicantsMove}}},
	})
	if grant.CompanyOrGrant("fin", RoleFinance, PermApplicantsMove) != true {
		t.Fatal("per-job grant should widen finance on that job")
	}
	if grant.Allows("fin", RoleFinance, "job-1", PermApplicantsMove) {
		t.Fatal("grant does not apply to other jobs")
	}

	_, err := NormalizeAssignments(nil)
	assertInvalid(t, err)
	_, err = NormalizeAssignments([]JobAccessAssignment{{MemberID: "u1"}, {MemberID: "u1"}})
	assertInvalid(t, err)
	_, err = NormalizeAssignments([]JobAccessAssignment{{MemberID: "u1", Permissions: []string{"nope"}}})
	assertInvalid(t, err)
	got, err := NormalizeAssignments([]JobAccessAssignment{{
		MemberID: " u1 ", RoleHint: "hm", Permissions: []string{PermJobsView, PermJobsView},
	}})
	if err != nil || got[0].MemberID != "u1" || got[0].RoleHint != RoleHiringManager || len(got[0].Permissions) != 1 {
		t.Fatalf("normalized = %+v %v", got, err)
	}
}

func TestAuditCursorAndLimit(t *testing.T) {
	at := time.Date(2026, 9, 29, 12, 0, 0, 123, time.UTC)
	gotAt, gotID, err := decodeAuditCursor(encodeAuditCursor(at, "evt-1"))
	if err != nil || !gotAt.Equal(at) || gotID != "evt-1" {
		t.Fatalf("cursor = %v %q %v", gotAt, gotID, err)
	}
	if _, _, err := decodeAuditCursor("@@@"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad cursor = %v", err)
	}
	n, err := ParseAuditLimit("")
	if err != nil || n != auditDefaultLimit {
		t.Fatalf("default = %d %v", n, err)
	}
	n, err = ParseAuditLimit("500")
	if err != nil || n != auditMaxLimit {
		t.Fatalf("clamp = %d %v", n, err)
	}
	if _, err := ParseAuditLimit("0"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("zero = %v", err)
	}
	if _, err := ParseAuditLimit("no"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("word = %v", err)
	}
}

func TestActorRole(t *testing.T) {
	if ActorRole(auth.Company{IsCreator: true, HiringRole: RoleRecruiter}) != RoleOwner {
		t.Fatal("creator is owner")
	}
	if ActorRole(auth.Company{HiringRole: RoleFinance}) != RoleFinance {
		t.Fatal("finance role should pass through")
	}
	if ActorRole(auth.Company{}) != RoleRecruiter {
		t.Fatal("blank membership defaults to recruiter")
	}
}

func assertForbidden(t *testing.T, err error) {
	t.Helper()
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("got %v, want forbidden", err)
	}
}

func assertInvalid(t *testing.T, err error) {
	t.Helper()
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("got %v, want invalid", err)
	}
}
