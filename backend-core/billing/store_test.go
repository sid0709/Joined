package billing

import (
	"context"
	"testing"
	"time"
)

func TestMemoryStoreUpsertMergesPartialSubscription(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	periodEnd := time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)
	if err := store.UpsertSubscription(ctx, Subscription{
		UserID:               "user_m",
		StripeCustomerID:     "cus_m",
		StripeSubscriptionID: "sub_m",
		Status:               string(StatusActive),
		Plan:                 PlanMonthly,
		CurrentPeriodEnd:     periodEnd,
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertSubscription(ctx, Subscription{
		UserID:               "user_m",
		StripeSubscriptionID: "sub_m",
		Status:               string(StatusCanceled),
	}); err != nil {
		t.Fatal(err)
	}
	sub, err := store.SubscriptionByUser(ctx, "user_m")
	if err != nil {
		t.Fatal(err)
	}
	if sub.Status != string(StatusCanceled) {
		t.Fatalf("status: %s", sub.Status)
	}
	if sub.Plan != PlanMonthly || !sub.CurrentPeriodEnd.Equal(periodEnd) || sub.StripeCustomerID != "cus_m" {
		t.Fatalf("merge lost fields: %+v", sub)
	}
}
