package billing

import (
	"context"
	"testing"
	"time"
)

func TestIsPremiumStatuses(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	periodEnd := now.Add(24 * time.Hour)
	cases := []struct {
		name   string
		sub    Subscription
		want   bool
	}{
		{name: "active", sub: Subscription{Status: string(StatusActive)}, want: true},
		{name: "trialing", sub: Subscription{Status: string(StatusTrialing)}, want: true},
		{name: "past_due", sub: Subscription{Status: string(StatusPastDue)}, want: true},
		{name: "canceled future period", sub: Subscription{Status: string(StatusCanceled), CurrentPeriodEnd: periodEnd}, want: true},
		{name: "canceled ended", sub: Subscription{Status: string(StatusCanceled), CurrentPeriodEnd: now.Add(-time.Hour)}, want: false},
		{name: "unpaid", sub: Subscription{Status: string(StatusUnpaid)}, want: false},
		{name: "incomplete", sub: Subscription{Status: string(StatusIncomplete)}, want: false},
		{name: "unknown", sub: Subscription{Status: "paused"}, want: false},
	}
	for _, tc := range cases {
		if got := tc.sub.IsPremium(now); got != tc.want {
			t.Errorf("%s: IsPremium=%v want %v", tc.name, got, tc.want)
		}
	}
}

func TestServiceIsPremium(t *testing.T) {
	svc, _, store := testService(t)
	ctx := context.Background()
	premium, err := svc.IsPremium(ctx, "user_none")
	if err != nil || premium {
		t.Fatalf("expected false for unknown user, got %v %v", premium, err)
	}
	if err := store.UpsertSubscription(ctx, Subscription{
		UserID:               "user_p",
		StripeSubscriptionID: "sub_p",
		Status:               string(StatusActive),
		Plan:                 PlanMonthly,
	}); err != nil {
		t.Fatal(err)
	}
	premium, err = svc.IsPremium(ctx, "user_p")
	if err != nil || !premium {
		t.Fatalf("expected premium, got %v %v", premium, err)
	}
}
