package billing

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHTTPClientSendsIdempotencyKeyOnCreate(t *testing.T) {
	var capturedHeaders http.Header
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedHeaders = r.Header.Clone()
		w.Header().Set("Content-Type", "application/json")
		if strings.Contains(r.URL.Path, "/products") {
			json.NewEncoder(w).Encode(Product{ID: "prod_123", Name: "Test Product"})
		} else if strings.Contains(r.URL.Path, "/prices") {
			json.NewEncoder(w).Encode(Price{ID: "price_123", ProductID: "prod_123", UnitAmount: 2900})
		}
	}))
	defer server.Close()

	client := &HTTPClient{
		SecretKey: "sk_test_123",
		BaseURL:   server.URL,
	}

	product, err := client.CreateProduct(context.Background(), CreateProductRequest{
		Name:        "Test Product",
		Description: "Test",
		Metadata: map[string]string{
			"lookup_key": "test_product",
		},
	})
	if err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}
	if product.ID != "prod_123" {
		t.Fatalf("expected prod_123, got %s", product.ID)
	}

	productIdempotencyKey := capturedHeaders.Get("Idempotency-Key")
	if productIdempotencyKey != "product_test_product" {
		t.Fatalf("expected product idempotency key 'product_test_product', got %q", productIdempotencyKey)
	}

	price, err := client.CreatePrice(context.Background(), CreatePriceRequest{
		Product:    "prod_123",
		Currency:   "usd",
		UnitAmount: 2900,
		LookupKey:  "test_monthly",
		Recurring: &Recurring{
			Interval:      "month",
			IntervalCount: 1,
		},
	})
	if err != nil {
		t.Fatalf("CreatePrice failed: %v", err)
	}
	if price.ID != "price_123" {
		t.Fatalf("expected price_123, got %s", price.ID)
	}

	priceIdempotencyKey := capturedHeaders.Get("Idempotency-Key")
	if priceIdempotencyKey != "price_test_monthly_2900" {
		t.Fatalf("expected price idempotency key 'price_test_monthly_2900', got %q", priceIdempotencyKey)
	}

	secondPrice, err := client.CreatePrice(context.Background(), CreatePriceRequest{
		Product:    "prod_123",
		Currency:   "usd",
		UnitAmount: 2900,
		LookupKey:  "test_monthly",
		Recurring: &Recurring{
			Interval:      "month",
			IntervalCount: 1,
		},
	})
	if err != nil {
		t.Fatalf("second CreatePrice failed: %v", err)
	}

	secondIdempotencyKey := capturedHeaders.Get("Idempotency-Key")
	if secondIdempotencyKey != priceIdempotencyKey {
		t.Fatalf("idempotency key should be stable for same inputs, got %q then %q", priceIdempotencyKey, secondIdempotencyKey)
	}
	if secondPrice.ID != price.ID {
		t.Fatalf("expected same price ID with same idempotency key")
	}
}

func TestEncodeFormURLEscapesValues(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("ParseForm failed: %v", err)
		}
		name := r.FormValue("name")
		if name != "Test & Co. = 100% 🎉" {
			t.Errorf("expected special chars preserved, got %q", name)
		}
		desc := r.FormValue("description")
		if desc != "key=value&other=data with spaces" {
			t.Errorf("expected special chars in description, got %q", desc)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Product{ID: "prod_456", Name: name, Description: desc})
	}))
	defer server.Close()

	client := &HTTPClient{
		SecretKey: "sk_test_123",
		BaseURL:   server.URL,
	}

	product, err := client.CreateProduct(context.Background(), CreateProductRequest{
		Name:        "Test & Co. = 100% 🎉",
		Description: "key=value&other=data with spaces",
		Metadata: map[string]string{
			"key": "value&more=stuff",
		},
	})
	if err != nil {
		t.Fatalf("CreateProduct with special chars failed: %v", err)
	}
	if product.Name != "Test & Co. = 100% 🎉" {
		t.Errorf("name not preserved: %q", product.Name)
	}
	if product.Description != "key=value&other=data with spaces" {
		t.Errorf("description not preserved: %q", product.Description)
	}
}
