package billing

import (
	"context"
	"fmt"
	"sync"
)

// FakeClient is an in-memory Stripe client for tests.
type FakeClient struct {
	mu             sync.Mutex
	products       map[string]*Product
	prices         map[string]*Price
	lookupKeyIndex map[string]string
	nextID         int
}

// NewFakeClient creates a fake Stripe client.
func NewFakeClient() *FakeClient {
	return &FakeClient{
		products:       make(map[string]*Product),
		prices:         make(map[string]*Price),
		lookupKeyIndex: make(map[string]string),
		nextID:         1,
	}
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

	if req.LookupKey != "" {
		if existingPriceID, exists := f.lookupKeyIndex[req.LookupKey]; exists {
			if !req.TransferLookupKey {
				return nil, fmt.Errorf("price with lookup_key %q already exists (price %s)", req.LookupKey, existingPriceID)
			}
			if existingPrice, ok := f.prices[existingPriceID]; ok {
				existingPrice.LookupKey = ""
			}
			delete(f.lookupKeyIndex, req.LookupKey)
		} else {
			for _, price := range f.prices {
				if price.LookupKey == req.LookupKey {
					if !req.TransferLookupKey {
						return nil, fmt.Errorf("price with lookup_key %q already exists (price %s, inactive)", req.LookupKey, price.ID)
					}
					price.LookupKey = ""
					break
				}
			}
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

	return price, nil
}

func (f *FakeClient) UpdatePrice(ctx context.Context, id string, req UpdatePriceRequest) (*Price, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	price, ok := f.prices[id]
	if !ok {
		return nil, fmt.Errorf("price not found: %s", id)
	}
	price.Metadata = req.Metadata
	if req.Active != nil {
		wasActive := price.Active
		price.Active = *req.Active
		if wasActive && !price.Active && price.LookupKey != "" {
			delete(f.lookupKeyIndex, price.LookupKey)
		}
	}
	return price, nil
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
