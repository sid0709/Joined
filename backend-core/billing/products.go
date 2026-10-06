package billing

import (
	"context"
	"fmt"
)

const (
	premiumProductLookupKey = "joined_premium"
	monthlyPriceLookupKey   = "joined_premium_monthly"
	yearlyPriceLookupKey    = "joined_premium_yearly"

	// Acorn Pro is a separate Stripe product. Free and Unlimited are not synced:
	// Free has no price, and Unlimited is still a sample tier on the website.
	acornProductLookupKey      = "acorn_pro"
	acornMonthlyPriceLookupKey = "acorn_pro_monthly"
	acornYearlyPriceLookupKey  = "acorn_pro_yearly"
	acornProductName           = "Acorn Pro"
)

// ProductPremium is Joined Premium checkout. Empty CheckoutParams.Product means this.
const ProductPremium = "premium"

// ProductAcorn is Acorn Pro checkout. It must not grant Joined Premium.
const ProductAcorn = "acorn"

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
	if err := syncAcornCatalog(ctx, client, cfg); err != nil {
		return err
	}
	return nil
}

func syncAcornCatalog(ctx context.Context, client Client, cfg Config) error {
	monthly, yearly, ok := acornPriceCents(cfg)
	if !ok {
		return nil
	}
	product, err := syncNamedProduct(ctx, client, acornProductLookupKey, acornProductName, "Acorn Pro subscription")
	if err != nil {
		return fmt.Errorf("sync acorn product: %w", err)
	}
	prices, err := client.ListPrices(ctx, product.ID)
	if err != nil {
		return fmt.Errorf("list acorn prices: %w", err)
	}
	if err := deactivateOrphanedActivePrices(ctx, client, prices, acornPriceLookupKeys()); err != nil {
		return err
	}
	prices, err = client.ListPrices(ctx, product.ID)
	if err != nil {
		return fmt.Errorf("list acorn prices after orphan cleanup: %w", err)
	}
	pricesByLookup := indexPrices(prices)
	if err := syncPrice(ctx, client, product.ID, acornMonthlyPriceLookupKey, monthly, "month", pricesByLookup); err != nil {
		return fmt.Errorf("sync acorn monthly price: %w", err)
	}
	if err := syncPrice(ctx, client, product.ID, acornYearlyPriceLookupKey, yearly, "year", pricesByLookup); err != nil {
		return fmt.Errorf("sync acorn yearly price: %w", err)
	}
	return nil
}

func acornPriceCents(cfg Config) (int, int, bool) {
	if cfg.AcornMonthlyPriceCents == 0 && cfg.AcornYearlyPriceCents == 0 {
		return 0, 0, false
	}
	monthly := cfg.AcornMonthlyPriceCents
	yearly := cfg.AcornYearlyPriceCents
	if monthly == 0 {
		monthly = defaultAcornMonthlyPriceCents
	}
	if yearly == 0 {
		yearly = defaultAcornYearlyPriceCents
	}
	return monthly, yearly, true
}

func syncNamedProduct(ctx context.Context, client Client, lookupKey, name, description string) (*Product, error) {
	existing, err := client.ListProducts(ctx, lookupKey)
	if err != nil {
		return nil, fmt.Errorf("list products: %w", err)
	}
	for _, p := range existing {
		if p.Metadata != nil && p.Metadata["lookup_key"] == lookupKey {
			return client.UpdateProduct(ctx, p.ID, UpdateProductRequest{
				Name:        name,
				Description: description,
				Metadata:    map[string]string{"lookup_key": lookupKey},
			})
		}
	}
	return client.CreateProduct(ctx, CreateProductRequest{
		Name:        name,
		Description: description,
		Metadata:    map[string]string{"lookup_key": lookupKey},
	})
}

func indexPrices(prices []*Price) map[string]*Price {
	pricesByLookup := make(map[string]*Price)
	for _, p := range prices {
		if p.LookupKey == "" {
			continue
		}
		if existing, found := pricesByLookup[p.LookupKey]; !found || p.Active || (!existing.Active && p.Active) {
			pricesByLookup[p.LookupKey] = p
		}
	}
	return pricesByLookup
}

func acornPriceLookupKeys() []string {
	return []string{acornMonthlyPriceLookupKey, acornYearlyPriceLookupKey}
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
	// Next-sync recovery: a prior create-before-deactivate can leave the old
	// price active after TransferLookupKey if deactivate failed.
	if err := deactivateOrphanedActivePrices(ctx, client, prices, catalogPriceLookupKeys()); err != nil {
		return err
	}
	prices, err = client.ListPrices(ctx, productID)
	if err != nil {
		return fmt.Errorf("list prices after orphan cleanup: %w", err)
	}
	pricesByLookup := make(map[string]*Price)
	for _, p := range prices {
		if p.LookupKey != "" {
			if existing, found := pricesByLookup[p.LookupKey]; !found || p.Active {
				pricesByLookup[p.LookupKey] = p
			} else if !existing.Active && p.Active {
				pricesByLookup[p.LookupKey] = p
			}
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
	price, hasKeyHolder := existing[lookupKey]
	if hasKeyHolder && price.Active && price.UnitAmount == amountCents {
		return nil
	}
	if hasKeyHolder {
		// Inactive holder or amount change: create the replacement first so a
		// failed create leaves the current catalog intact and retryable.
		created, err := client.CreatePrice(ctx, CreatePriceRequest{
			Product:    productID,
			Currency:   "usd",
			UnitAmount: amountCents,
			Recurring: &Recurring{
				Interval:      interval,
				IntervalCount: 1,
			},
			LookupKey:       lookupKey,
			ReplacedPriceID: price.ID,
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
		if price.Active {
			deactivate := false
			if _, err := client.UpdatePrice(ctx, price.ID, UpdatePriceRequest{Active: &deactivate}); err != nil {
				return fmt.Errorf("deactivate old price: %w", err)
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

func catalogPriceLookupKeys() []string {
	return []string{monthlyPriceLookupKey, yearlyPriceLookupKey}
}

func priceMetadataLookupKey(p *Price) string {
	if p == nil || p.Metadata == nil {
		return ""
	}
	return p.Metadata["lookup_key"]
}

func isCatalogLookupKey(key string, catalog []string) bool {
	for _, item := range catalog {
		if item == key {
			return true
		}
	}
	return false
}

// deactivateOrphanedActivePrices deactivates leftover actives from a failed
// rotation deactivate. Those prices no longer hold the lookup key (it moved
// with TransferLookupKey) but stay Active until a later SyncProducts.
func deactivateOrphanedActivePrices(ctx context.Context, client Client, prices []*Price, catalog []string) error {
	holders := make(map[string]bool, len(catalog))
	for _, p := range prices {
		if p != nil && p.LookupKey != "" {
			holders[p.LookupKey] = true
		}
	}
	inactive := false
	for _, p := range prices {
		if p == nil || !p.Active || p.LookupKey != "" {
			continue
		}
		metaKey := priceMetadataLookupKey(p)
		if !isCatalogLookupKey(metaKey, catalog) || !holders[metaKey] {
			continue
		}
		if _, err := client.UpdatePrice(ctx, p.ID, UpdatePriceRequest{Active: &inactive}); err != nil {
			return fmt.Errorf("deactivate orphaned price %s: %w", p.ID, err)
		}
	}
	return nil
}
