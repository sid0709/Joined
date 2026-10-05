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
			if p.ID == pricesBefore[0].ID || p.ID == pricesBefore[1].ID {
				oldMonthly = p
			} else {
				newMonthly = p
			}
		}
	}
	if oldMonthly == nil || oldMonthly.Active {
		t.Fatalf("expected old monthly price to be deactivated, got %+v", oldMonthly)
	}
	if newMonthly == nil || newMonthly.UnitAmount != 3500 || !newMonthly.Active {
		t.Fatalf("expected new monthly price 3500 active, got %+v", newMonthly)
	}
}
