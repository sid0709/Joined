package billing

import (
	"context"
	"testing"
)

func TestSyncProductsCreatesProductAndPrices(t *testing.T) {
	client := NewFakeClient()
	cfg := Config{
		PremiumMonthlyPriceCents: 2900,
		PremiumYearlyPriceCents:  29000,
	}
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("SyncProducts failed: %v", err)
	}
	products, err := client.ListProducts(context.Background(), "")
	if err != nil || len(products) != 1 {
		t.Fatalf("expected 1 product, got %d: %v", len(products), err)
	}
	product := products[0]
	if product.Name != "Joined Premium" {
		t.Fatalf("expected product name 'Joined Premium', got %q", product.Name)
	}
	prices, err := client.ListPrices(context.Background(), product.ID)
	if err != nil || len(prices) != 2 {
		t.Fatalf("expected 2 prices, got %d: %v", len(prices), err)
	}
	var monthly, yearly *Price
	for _, p := range prices {
		if p.LookupKey == monthlyPriceLookupKey {
			monthly = p
		} else if p.LookupKey == yearlyPriceLookupKey {
			yearly = p
		}
	}
	if monthly == nil || monthly.UnitAmount != 2900 || monthly.Recurring.Interval != "month" {
		t.Fatalf("expected monthly price, got %+v", monthly)
	}
	if yearly == nil || yearly.UnitAmount != 29000 || yearly.Recurring.Interval != "year" {
		t.Fatalf("expected yearly price, got %+v", yearly)
	}
}

func TestSyncProductsIsIdempotent(t *testing.T) {
	client := NewFakeClient()
	cfg := Config{
		PremiumMonthlyPriceCents: 2900,
		PremiumYearlyPriceCents:  29000,
	}
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("first sync failed: %v", err)
	}
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("second sync failed: %v", err)
	}
	products, err := client.ListProducts(context.Background(), "")
	if err != nil || len(products) != 1 {
		t.Fatalf("expected 1 product after two syncs, got %d: %v", len(products), err)
	}
}

func TestSyncProductsDeactivatesOldPriceOnChange(t *testing.T) {
	client := NewFakeClient()
	cfg := Config{
		PremiumMonthlyPriceCents: 2900,
		PremiumYearlyPriceCents:  29000,
	}
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("first sync failed: %v", err)
	}
	products, _ := client.ListProducts(context.Background(), "")
	product := products[0]
	pricesBefore, _ := client.ListPrices(context.Background(), product.ID)

	var oldMonthlyID string
	for _, p := range pricesBefore {
		if p.LookupKey == monthlyPriceLookupKey {
			oldMonthlyID = p.ID
			break
		}
	}

	cfg.PremiumMonthlyPriceCents = 3500
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("second sync failed: %v", err)
	}
	pricesAfter, _ := client.ListPrices(context.Background(), product.ID)
	if len(pricesAfter) != 3 {
		t.Fatalf("expected 3 prices after change (1 old deactivated, 1 new, 1 unchanged), got %d", len(pricesAfter))
	}

	var oldMonthly, newMonthly *Price
	for _, p := range pricesAfter {
		if p.LookupKey == monthlyPriceLookupKey {
			newMonthly = p
		} else if p.ID == oldMonthlyID {
			oldMonthly = p
		}
	}

	if oldMonthly == nil {
		t.Fatalf("could not find old monthly price with ID %s", oldMonthlyID)
	}
	if oldMonthly.Active {
		t.Fatalf("expected old monthly price to be deactivated, got Active=%v", oldMonthly.Active)
	}
	if oldMonthly.LookupKey != "" {
		t.Fatalf("expected old monthly price to have lookup key cleared after transfer, got %q", oldMonthly.LookupKey)
	}
	if newMonthly == nil || newMonthly.UnitAmount != 3500 || !newMonthly.Active {
		t.Fatalf("expected new monthly price 3500 active, got %+v", newMonthly)
	}
	if newMonthly.LookupKey != monthlyPriceLookupKey {
		t.Fatalf("expected new monthly price to have lookup key %q, got %q", monthlyPriceLookupKey, newMonthly.LookupKey)
	}
	if oldMonthly.ID == newMonthly.ID {
		t.Fatal("expected old and new monthly prices to have different IDs")
	}
}

func TestSyncProductsPriceRevertUsesDistinctIdempotencyKeys(t *testing.T) {
	client := NewFakeClient()
	cfg := Config{
		PremiumMonthlyPriceCents: 2900,
		PremiumYearlyPriceCents:  29000,
	}

	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("first sync (A=2900) failed: %v", err)
	}
	products, _ := client.ListProducts(context.Background(), "")
	product := products[0]
	pricesAfterA, _ := client.ListPrices(context.Background(), product.ID)
	var priceA *Price
	for _, p := range pricesAfterA {
		if p.LookupKey == monthlyPriceLookupKey {
			priceA = p
			break
		}
	}
	if priceA == nil || priceA.UnitAmount != 2900 {
		t.Fatalf("expected price A with amount 2900, got %+v", priceA)
	}

	cfg.PremiumMonthlyPriceCents = 3500
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("second sync (B=3500) failed: %v", err)
	}
	pricesAfterB, _ := client.ListPrices(context.Background(), product.ID)
	var priceB *Price
	for _, p := range pricesAfterB {
		if p.LookupKey == monthlyPriceLookupKey && p.Active {
			priceB = p
			break
		}
	}
	if priceB == nil || priceB.UnitAmount != 3500 {
		t.Fatalf("expected price B with amount 3500, got %+v", priceB)
	}
	if priceB.ID == priceA.ID {
		t.Fatal("expected price B to have different ID from price A")
	}
	oldPriceA, _ := client.prices[priceA.ID]
	if oldPriceA.Active || oldPriceA.LookupKey != "" {
		t.Fatalf("expected price A to be inactive with no lookup key, got %+v", oldPriceA)
	}

	cfg.PremiumMonthlyPriceCents = 2900
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("third sync (revert to A=2900) failed: %v", err)
	}
	pricesAfterRevert, _ := client.ListPrices(context.Background(), product.ID)
	if len(pricesAfterRevert) != 4 {
		t.Fatalf("expected 4 prices after revert (A inactive, B inactive, new A active, yearly), got %d", len(pricesAfterRevert))
	}

	var newPriceA *Price
	activeMonthlyCount := 0
	for _, p := range pricesAfterRevert {
		if p.LookupKey == monthlyPriceLookupKey && p.Active {
			newPriceA = p
			activeMonthlyCount++
		}
	}
	if activeMonthlyCount != 1 {
		t.Fatalf("expected exactly 1 active monthly price, got %d", activeMonthlyCount)
	}
	if newPriceA == nil || newPriceA.UnitAmount != 2900 {
		t.Fatalf("expected new active price with amount 2900, got %+v", newPriceA)
	}
	if newPriceA.ID == priceA.ID {
		t.Fatalf("expected new price A to have different ID from original price A (idempotency replay would return inactive price)")
	}
	if newPriceA.ID == priceB.ID {
		t.Fatal("expected new price A to have different ID from price B")
	}
	if newPriceA.LookupKey != monthlyPriceLookupKey {
		t.Fatalf("expected new price A to have lookup key, got %q", newPriceA.LookupKey)
	}

	oldPriceB, _ := client.prices[priceB.ID]
	if oldPriceB.Active || oldPriceB.LookupKey != "" {
		t.Fatalf("expected price B to be inactive with no lookup key after revert, got %+v", oldPriceB)
	}

	keyCount := 0
	for key := range client.idempotencyReplays {
		if len(key) > 0 && contains(key, "monthly") {
			keyCount++
		}
	}
	if keyCount != 3 {
		t.Fatalf("expected 3 distinct monthly idempotency keys (initial A, A→B, B→A), got %d monthly keys", keyCount)
	}
}

func TestSyncProductsRecoversAfterFailedPriceRotation(t *testing.T) {
	client := NewFakeClient()
	cfg := Config{
		PremiumMonthlyPriceCents: 2900,
		PremiumYearlyPriceCents:  29000,
	}
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("initial sync failed: %v", err)
	}
	products, _ := client.ListProducts(context.Background(), "")
	product := products[0]
	pricesBefore, _ := client.ListPrices(context.Background(), product.ID)
	var oldMonthly *Price
	for _, p := range pricesBefore {
		if p.LookupKey == monthlyPriceLookupKey {
			oldMonthly = p
			break
		}
	}
	if oldMonthly == nil {
		t.Fatal("expected initial monthly price")
	}

	client.FailNextPriceCreate()
	cfg.PremiumMonthlyPriceCents = 3500
	if err := SyncProducts(context.Background(), client, cfg); err == nil {
		t.Fatal("expected first rotation sync to fail")
	}

	pricesAfterFail, _ := client.ListPrices(context.Background(), product.ID)
	if len(pricesAfterFail) != 2 {
		t.Fatalf("expected catalog unchanged after failed create, got %d prices", len(pricesAfterFail))
	}
	stillOld := client.prices[oldMonthly.ID]
	if !stillOld.Active || stillOld.LookupKey != monthlyPriceLookupKey {
		t.Fatalf("expected old price still active with lookup key after failed create, got %+v", stillOld)
	}

	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("recovery sync failed: %v", err)
	}

	pricesAfter, _ := client.ListPrices(context.Background(), product.ID)
	var activeMonthly, inactiveMonthly *Price
	activeMonthlyCount := 0
	for _, p := range pricesAfter {
		if p.Recurring != nil && p.Recurring.Interval == "month" {
			if p.Active {
				activeMonthly = p
				activeMonthlyCount++
			} else {
				inactiveMonthly = p
			}
		}
	}
	if activeMonthlyCount != 1 {
		t.Fatalf("expected exactly 1 active monthly price after recovery, got %d", activeMonthlyCount)
	}
	if activeMonthly == nil || activeMonthly.UnitAmount != 3500 || activeMonthly.LookupKey != monthlyPriceLookupKey {
		t.Fatalf("expected new active monthly 3500 holding lookup key, got %+v", activeMonthly)
	}
	if inactiveMonthly == nil || inactiveMonthly.ID != oldMonthly.ID || inactiveMonthly.Active {
		t.Fatalf("expected old monthly price deactivated, got %+v", inactiveMonthly)
	}
	if inactiveMonthly.LookupKey != "" {
		t.Fatalf("expected old monthly lookup key transferred away, got %q", inactiveMonthly.LookupKey)
	}
}

func TestSyncProductsErrorsOnInactivePrice(t *testing.T) {
	client := NewFakeClient()

	product, _ := client.CreateProduct(context.Background(), CreateProductRequest{
		Name:        "Test Product",
		Description: "Test",
		Metadata: map[string]string{
			"lookup_key": "test_product",
		},
	})

	price1, _ := client.CreatePrice(context.Background(), CreatePriceRequest{
		Product:         product.ID,
		Currency:        "usd",
		UnitAmount:      2900,
		LookupKey:       "test_monthly",
		ReplacedPriceID: "_new",
		Recurring: &Recurring{
			Interval:      "month",
			IntervalCount: 1,
		},
		Metadata: map[string]string{
			"lookup_key": "test_monthly",
		},
	})

	price1.Active = false

	price2, err := client.CreatePrice(context.Background(), CreatePriceRequest{
		Product:         product.ID,
		Currency:        "usd",
		UnitAmount:      2900,
		LookupKey:       "test_monthly",
		ReplacedPriceID: "_new",
		Recurring: &Recurring{
			Interval:      "month",
			IntervalCount: 1,
		},
		Metadata: map[string]string{
			"lookup_key": "test_monthly",
		},
	})

	if err != nil {
		t.Fatalf("unexpected error from replay: %v", err)
	}

	if price2.Active {
		t.Fatal("expected idempotency replay to return inactive price, but got active price")
	}

	if price2.ID != price1.ID {
		t.Fatalf("expected idempotency replay to return same price, got %s vs %s", price1.ID, price2.ID)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
