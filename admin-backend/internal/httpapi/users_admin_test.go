package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/auth/authtest"
	"github.com/sid0709/OpenSeat/backend-core/billing"
	"github.com/sid0709/OpenSeat/backend-core/staff"
)

func TestAdminUsersRequireToken(t *testing.T) {
	handler := New(nil, nil, staff.NewMem(), nil, Options{AdminToken: "secret", Accounts: authtest.NewStore()})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/admin/users?email=a@example.com", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestAdminUserLookupSuspendRefund(t *testing.T) {
	accounts := authtest.NewStore()
	ctx := context.Background()
	now := time.Now().UTC()
	userID, _, err := accounts.EmailSignup(ctx, "hunter@example.com", "password123", "Hunter", auth.RoleCandidate, now)
	if err != nil {
		t.Fatal(err)
	}
	verify, err := accounts.CreateVerificationToken(ctx, userID, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := accounts.VerifyEmail(ctx, verify, now); err != nil {
		t.Fatal(err)
	}
	store := billing.NewMemoryStore()
	if err := store.UpsertSubscription(ctx, billing.Subscription{
		UserID: userID, StripeSubscriptionID: "sub_h", Status: string(billing.StatusActive), Plan: billing.PlanMonthly,
	}); err != nil {
		t.Fatal(err)
	}
	premium := billing.NewService(billing.NewFakeClient(), store, billing.Config{})
	mem := staff.NewMem()
	handler := New(nil, nil, mem, nil, Options{
		AdminToken: "secret",
		Accounts:   accounts,
		Premium:    premium,
	})

	rec := callAdmin(handler, http.MethodGet, "/v1/admin/users?email=hunter@example.com", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("lookup = %d %s", rec.Code, rec.Body.String())
	}
	var view adminUserView
	if err := json.Unmarshal(rec.Body.Bytes(), &view); err != nil {
		t.Fatal(err)
	}
	if view.Email != "h*****@example.com" || strings.Contains(rec.Body.String(), "hunter@example.com") {
		t.Fatalf("email leaked: %s", rec.Body.String())
	}

	rec = callAdmin(handler, http.MethodPost, "/v1/admin/users/"+userID+"/suspend", `{"reason":"abuse"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("suspend = %d %s", rec.Code, rec.Body.String())
	}
	var action userActionResult
	if err := json.Unmarshal(rec.Body.Bytes(), &action); err != nil || action.AuditID == "" || !action.User.Suspended {
		t.Fatalf("suspend body = %s", rec.Body.String())
	}
	if _, _, err := accounts.EmailSignin(ctx, "hunter@example.com", "password123", auth.AudienceJoined, now); err == nil {
		t.Fatal("suspended account signed in")
	}

	rec = callAdmin(handler, http.MethodPost, "/v1/admin/users/"+userID+"/premium/refund", `{"reason":"goodwill","amount_cents":500}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("refund = %d %s", rec.Code, rec.Body.String())
	}
	sub, err := store.SubscriptionByUser(ctx, userID)
	if err != nil || sub.RefundedCents != 500 {
		t.Fatalf("refunded = %#v err=%v", sub, err)
	}
	rec = callAdmin(handler, http.MethodPost, "/v1/admin/users/"+userID+"/premium/cancel", `{"reason":"stop"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("cancel = %d %s", rec.Code, rec.Body.String())
	}
	premiumOn, err := premium.IsPremium(ctx, userID)
	if err != nil || premiumOn {
		t.Fatalf("still premium %v %v", premiumOn, err)
	}
	if len(mem.Audits()) < 3 {
		t.Fatalf("audits = %+v", mem.Audits())
	}

	rec = callAdmin(handler, http.MethodPost, "/v1/admin/users/"+userID+"/reveal", `{}`)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("reveal without reason = %d", rec.Code)
	}
}

func callAdmin(handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}
