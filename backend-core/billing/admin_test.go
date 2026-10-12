package billing

import (
	"context"
	"testing"
	"time"
)

func TestAdminCancelAndRefundStayOffStripe(t *testing.T) {
	svc, _, store := testService(t)
	ctx := context.Background()
	now := time.Date(2026, 10, 6, 12, 0, 0, 0, time.UTC)
	svc.Now = func() time.Time { return now }
	if err := store.UpsertSubscription(ctx, Subscription{
		UserID:               "user_bill",
		StripeSubscriptionID: "sub_bill",
		Status:               string(StatusActive),
		Plan:                 PlanMonthly,
		Product:              premiumProductLookupKey,
	}); err != nil {
		t.Fatal(err)
	}
	if err := svc.AdminCancel(ctx, "user_bill", "requested", now); err != nil {
		t.Fatal(err)
	}
	premium, err := svc.IsPremium(ctx, "user_bill")
	if err != nil || premium {
		t.Fatalf("premium after cancel = %v %v", premium, err)
	}
	if err := svc.AdminRefund(ctx, "user_bill", "goodwill", 500, now); err != nil {
		t.Fatal(err)
	}
	sub, err := store.SubscriptionByUser(ctx, "user_bill")
	if err != nil || sub.RefundedCents != 500 {
		t.Fatalf("refund = %#v err=%v", sub, err)
	}
}
