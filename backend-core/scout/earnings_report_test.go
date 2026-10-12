package scout

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestEarningsReportAndClawback(t *testing.T) {
	store := NewMemoryStore(nil, func() time.Time { return time.Date(2026, 10, 6, 0, 0, 0, 0, time.UTC) })
	mem := store.docs.(*memDocs)
	now := time.Date(2026, 10, 6, 0, 0, 0, 0, time.UTC)
	held := bson.NewObjectID()
	paid := bson.NewObjectID()
	mem.insertEarning(Earning{ObjectID: held, ScoutUserID: "s1", Status: EarningHeld, Amount: cents(400), CreatedAt: now})
	mem.insertEarning(Earning{ObjectID: paid, ScoutUserID: "s1", Status: EarningPaid, Amount: cents(900), CreatedAt: now})
	report, err := store.EarningsReport(context.Background(), now.Add(-time.Hour), now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if report.Totals[EarningHeld] != 400 || report.Totals[EarningPaid] != 900 {
		t.Fatalf("totals = %#v", report.Totals)
	}
	clawed, err := store.ClawbackUnsettled(context.Background(), held.Hex())
	if err != nil || clawed.Status != EarningClawedBack {
		t.Fatalf("clawback = %#v err=%v", clawed, err)
	}
	if _, err := store.ClawbackUnsettled(context.Background(), paid.Hex()); !errors.Is(err, ErrEarningSettled) {
		t.Fatalf("paid clawback = %v", err)
	}
}
