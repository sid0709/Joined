package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/employer"
)

func TestHiringAuthzStatusCodes(t *testing.T) {
	cases := []struct {
		name string
		err  error
		code int
	}{
		{"interviewer hire", employer.AuthorizeCompany(employer.RoleInterviewer, employer.PermOffersHire), http.StatusForbidden},
		{"interviewer pipeline edit", employer.AuthorizeCompany(employer.RoleInterviewer, employer.PermJobsEdit), http.StatusForbidden},
		{"finance pipeline edit", employer.AuthorizeCompany(employer.RoleFinance, employer.PermJobsEdit), http.StatusForbidden},
		{"finance move", employer.AuthorizeCompany(employer.RoleFinance, employer.PermApplicantsMove), http.StatusForbidden},
		{"recruiter approve", employer.AuthorizeCompany(employer.RoleRecruiter, employer.PermOffersApprove), http.StatusForbidden},
		{"hiring manager send", employer.AuthorizeCompany(employer.RoleHiringManager, employer.PermOffersSend), http.StatusForbidden},
		{"hiring manager hire", employer.AuthorizeCompany(employer.RoleHiringManager, employer.PermOffersHire), http.StatusForbidden},
		{"admin purchase", employer.AuthorizeCompany(employer.RoleAdmin, employer.PermBillingPurchase), http.StatusForbidden},
		{"interviewer audit", employer.AuthorizeCompany(employer.RoleInterviewer, employer.PermAuditView), http.StatusForbidden},
		{"recruiter analytics denied", employer.AuthorizeCompany(employer.RoleInterviewer, employer.PermAnalyticsView), http.StatusForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			if writeEmployer(rec, tc.err) {
				t.Fatal("expected the error to be written")
			}
			if rec.Code != tc.code {
				t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
			}
		})
	}

	allows := []struct {
		role, perm string
	}{
		{employer.RoleOwner, employer.PermOffersHire},
		{employer.RoleRecruiter, employer.PermOffersSend},
		{employer.RoleRecruiter, employer.PermJobsEdit},
		{employer.RoleHiringManager, employer.PermOffersApprove},
		{employer.RoleHiringManager, employer.PermJobsEdit},
		{employer.RoleFinance, employer.PermOffersApprove},
		{employer.RoleFinance, employer.PermBillingPurchase},
		{employer.RoleFinance, employer.PermAnalyticsView},
		{employer.RoleAdmin, employer.PermBillingView},
		{employer.RoleInterviewer, employer.PermInterviewsScore},
	}
	for _, allow := range allows {
		if err := employer.AuthorizeCompany(allow.role, allow.perm); err != nil {
			t.Fatalf("%s %s: %v", allow.role, allow.perm, err)
		}
	}

	rec := httptest.NewRecorder()
	_, err := employer.NormalizeInviteRole(employer.RoleOwner, employer.RoleOwner)
	if writeEmployer(rec, err) {
		t.Fatal("owner invite should be rejected")
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("owner invite status = %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	_, err = employer.NormalizeInviteRole(employer.RoleAdmin, employer.RoleAdmin)
	if writeEmployer(rec, err) {
		t.Fatal("admin invite should be rejected")
	}
	if rec.Code != http.StatusForbidden {
		t.Fatalf("admin invite status = %d body = %s", rec.Code, rec.Body.String())
	}
}
