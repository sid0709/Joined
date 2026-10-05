package billing

import (
	"context"
	"fmt"
)

const (
	premiumProductLookupKey = "joined_premium"
	monthlyPriceLookupKey   = "joined_premium_monthly"
	yearlyPriceLookupKey    = "joined_premium_yearly"
)

// SyncProducts creates or updates the Joined Premium product and prices in Stripe.
// Idempotent: uses metadata to identify existing products and prices.
func SyncProducts(ctx context.Context, client Client, cfg Config) error {
	product, err := syncPremiumProduct(ctx, client)
	if err != nil {
		return fmt.Errorf("sync premium product: %w", err)
	}
	if err := syncPremiumPrices(ctx, client, product.ID, cfg); err != nil {
		return fmt.Errorf("sync premium prices: %w", err)
	}
	return nil
}

func syncPremiumProduct(ctx context.Context, client Client) (*Product, error) {
	existing, err := client.ListProducts(ctx, premiumProductLookupKey)
	if err != nil {
		return nil, fmt.Errorf("list products: %w", err)
	}
	for _, p := range existing {
		if p.Metadata != nil && p.Metadata["lookup_key"] == premiumProductLookupKey {
			updated, err := client.UpdateProduct(ctx, p.ID, UpdateProductRequest{
				Name:        "Joined Premium",
				Description: "Premium subscription for Joined",
				Metadata: map[string]string{
					"lookup_key": premiumProductLookupKey,
				},
			})
			if err != nil {
				return nil, fmt.Errorf("update product: %w", err)
			}
			return updated, nil
		}
	}
	created, err := client.CreateProduct(ctx, CreateProductRequest{
		Name:        "Joined Premium",
		Description: "Premium subscription for Joined",
		Metadata: map[string]string{
			"lookup_key": premiumProductLookupKey,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("create product: %w", err)
	}
	return created, nil
}

func syncPremiumPrices(ctx context.Context, client Client, productID string, cfg Config) error {
	prices, err := client.ListPrices(ctx, productID)
	if err != nil {
		return fmt.Errorf("list prices: %w", err)
	}
	pricesByLookup := make(map[string]*Price)
	for _, p := range prices {
		if p.LookupKey != "" {
			pricesByLookup[p.LookupKey] = p
		}
	}
	if err := syncPrice(ctx, client, productID, monthlyPriceLookupKey, cfg.PremiumMonthlyPriceCents, "month", pricesByLookup); err != nil {
		return fmt.Errorf("sync monthly price: %w", err)
	}
	if err := syncPrice(ctx, client, productID, yearlyPriceLookupKey, cfg.PremiumYearlyPriceCents, "year", pricesByLookup); err != nil {
		return fmt.Errorf("sync yearly price: %w", err)
	}
	return nil
}

func syncPrice(ctx context.Context, client Client, productID, lookupKey string, amountCents int, interval string, existing map[string]*Price) error {
	var replacedPriceID string
	if price, ok := existing[lookupKey]; ok {
		if price.UnitAmount != amountCents {
			replacedPriceID = price.ID
			deactivate := false
			if _, err := client.UpdatePrice(ctx, price.ID, UpdatePriceRequest{Active: &deactivate}); err != nil {
				return fmt.Errorf("deactivate old price: %w", err)
			}
			created, err := client.CreatePrice(ctx, CreatePriceRequest{
				Product:    productID,
				Currency:   "usd",
				UnitAmount: amountCents,
				Recurring: &Recurring{
					Interval:      interval,
					IntervalCount: 1,
				},
				LookupKey:       lookupKey,
				ReplacedPriceID: replacedPriceID,
				Metadata: map[string]string{
					"lookup_key": lookupKey,
				},
				TransferLookupKey: true,
			})
			if err != nil {
				return fmt.Errorf("create new price: %w", err)
			}
			if !created.Active {
				return fmt.Errorf("created price %s is inactive (idempotency replay returned stale price)", created.ID)
			}
		}
		return nil
	}
	created, err := client.CreatePrice(ctx, CreatePriceRequest{
		Product:    productID,
		Currency:   "usd",
		UnitAmount: amountCents,
		Recurring: &Recurring{
			Interval:      interval,
			IntervalCount: 1,
		},
		LookupKey:       lookupKey,
		ReplacedPriceID: "_new",
		Metadata: map[string]string{
			"lookup_key": lookupKey,
		},
	})
	if err != nil {
		return fmt.Errorf("create price: %w", err)
	}
	if !created.Active {
		return fmt.Errorf("created price %s is inactive (idempotency replay returned stale price)", created.ID)
	}
	return nil
}
