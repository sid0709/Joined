package billing

import (
	"context"
	"fmt"
	"sync"
)

// FakeClient is an in-memory Stripe client for tests.
type FakeClient struct {
	mu                  sync.Mutex
	products            map[string]*Product
	prices              map[string]*Price
	lookupKeyIndex      map[string]string
	idempotencyReplays  map[string]*Price
	failNextPriceCreate bool
	failNextPriceUpdate bool
	nextID              int
}

// NewFakeClient creates a fake Stripe client.
func NewFakeClient() *FakeClient {
	return &FakeClient{
		products:           make(map[string]*Product),
		prices:             make(map[string]*Price),
		lookupKeyIndex:     make(map[string]string),
		idempotencyReplays: make(map[string]*Price),
		nextID:             1,
	}
}

// FailNextPriceCreate injects a one-shot CreatePrice failure, then clears.
func (f *FakeClient) FailNextPriceCreate() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.failNextPriceCreate = true
}

// FailNextPriceUpdate injects a one-shot UpdatePrice failure, then clears.
func (f *FakeClient) FailNextPriceUpdate() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.failNextPriceUpdate = true
}

func (f *FakeClient) CreateProduct(ctx context.Context, req CreateProductRequest) (*Product, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	id := fmt.Sprintf("prod_%d", f.nextID)
	f.nextID++
	product := &Product{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		Active:      true,
		Metadata:    req.Metadata,
	}
	f.products[id] = product
	return product, nil
}

func (f *FakeClient) UpdateProduct(ctx context.Context, id string, req UpdateProductRequest) (*Product, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	product, ok := f.products[id]
	if !ok {
		return nil, fmt.Errorf("product not found: %s", id)
	}
	product.Name = req.Name
	product.Description = req.Description
	product.Metadata = req.Metadata
	return product, nil
}

func (f *FakeClient) ListProducts(ctx context.Context, lookupKey string) ([]*Product, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var result []*Product
	for _, p := range f.products {
		if lookupKey == "" {
			result = append(result, p)
		} else if p.Metadata != nil && p.Metadata["lookup_key"] == lookupKey {
			result = append(result, p)
		}
	}
	return result, nil
}

func (f *FakeClient) CreatePrice(ctx context.Context, req CreatePriceRequest) (*Price, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	idempotencyKey := ""
	if req.LookupKey != "" {
		replacedID := req.ReplacedPriceID
		if replacedID == "" {
			replacedID = "_new"
		}
		idempotencyKey = fmt.Sprintf("price_%s_%d_%s", req.LookupKey, req.UnitAmount, replacedID)
	}

	if idempotencyKey != "" {
		if existing, ok := f.idempotencyReplays[idempotencyKey]; ok {
			return existing, nil
		}
	}

	if f.failNextPriceCreate {
		f.failNextPriceCreate = false
		return nil, fmt.Errorf("injected create failure")
	}

	if req.LookupKey != "" {
		if holderID, ok := f.holderOfLookupKey(req.LookupKey); ok {
			if !req.TransferLookupKey {
				return nil, fmt.Errorf("price with lookup_key %q already exists (price %s)", req.LookupKey, holderID)
			}
			if holder, exists := f.prices[holderID]; exists {
				holder.LookupKey = ""
			}
			delete(f.lookupKeyIndex, req.LookupKey)
		}
	}

	id := fmt.Sprintf("price_%d", f.nextID)
	f.nextID++
	price := &Price{
		ID:         id,
		ProductID:  req.Product,
		Active:     true,
		Currency:   req.Currency,
		UnitAmount: req.UnitAmount,
		Recurring:  req.Recurring,
		LookupKey:  req.LookupKey,
		Metadata:   req.Metadata,
	}
	f.prices[id] = price

	if req.LookupKey != "" {
		f.lookupKeyIndex[req.LookupKey] = id
	}

	if idempotencyKey != "" {
		f.idempotencyReplays[idempotencyKey] = price
	}

	return price, nil
}

func (f *FakeClient) UpdatePrice(ctx context.Context, id string, req UpdatePriceRequest) (*Price, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.failNextPriceUpdate {
		f.failNextPriceUpdate = false
		return nil, fmt.Errorf("injected update failure")
	}
	price, ok := f.prices[id]
	if !ok {
		return nil, fmt.Errorf("price not found: %s", id)
	}
	price.Metadata = req.Metadata
	if req.Active != nil {
		price.Active = *req.Active
	}
	return price, nil
}

func (f *FakeClient) holderOfLookupKey(lookupKey string) (string, bool) {
	if id, ok := f.lookupKeyIndex[lookupKey]; ok {
		if price, exists := f.prices[id]; exists && price.LookupKey == lookupKey {
			return id, true
		}
	}
	for _, price := range f.prices {
		if price.LookupKey == lookupKey {
			return price.ID, true
		}
	}
	return "", false
}

func (f *FakeClient) ListPrices(ctx context.Context, productID string) ([]*Price, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var result []*Price
	for _, p := range f.prices {
		if p.ProductID == productID {
			result = append(result, p)
		}
	}
	return result, nil
}
