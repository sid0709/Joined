package billing

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
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
		Product:         "prod_123",
		Currency:        "usd",
		UnitAmount:      2900,
		LookupKey:       "test_monthly",
		ReplacedPriceID: "_new",
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
	if priceIdempotencyKey != "price_test_monthly_2900__new" {
		t.Fatalf("expected price idempotency key 'price_test_monthly_2900__new', got %q", priceIdempotencyKey)
	}

	secondPrice, err := client.CreatePrice(context.Background(), CreatePriceRequest{
		Product:         "prod_123",
		Currency:        "usd",
		UnitAmount:      2900,
		LookupKey:       "test_monthly",
		ReplacedPriceID: "_new",
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

func TestHTTPClientCheckoutAndPortalForms(t *testing.T) {
	var checkoutFormValues, portalFormValues, customerFormValues url.Values
	var checkoutPath, portalPath, customerPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("ParseForm: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(r.URL.Path, "/checkout/sessions"):
			checkoutPath = r.URL.Path
			checkoutFormValues = r.Form
			json.NewEncoder(w).Encode(CheckoutSession{ID: "cs_http", URL: "https://checkout.stripe.test/c/pay/cs_http", CustomerID: "cus_http"})
		case strings.Contains(r.URL.Path, "/billing_portal/sessions"):
			portalPath = r.URL.Path
			portalFormValues = r.Form
			json.NewEncoder(w).Encode(PortalSession{ID: "bps_http", URL: "https://billing.stripe.test/session/bps_http"})
		case strings.Contains(r.URL.Path, "/customers"):
			customerPath = r.URL.Path
			customerFormValues = r.Form
			json.NewEncoder(w).Encode(Customer{ID: "cus_http", Email: r.FormValue("email")})
		case strings.Contains(r.URL.Path, "/prices"):
			if r.URL.Query().Get("lookup_keys[]") != monthlyPriceLookupKey {
				t.Errorf("expected monthly lookup key, got %q", r.URL.Query().Get("lookup_keys[]"))
			}
			json.NewEncoder(w).Encode(map[string]any{"data": []Price{{ID: "price_http", LookupKey: monthlyPriceLookupKey, Active: true}}})
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client := &HTTPClient{SecretKey: "sk_test_123", BaseURL: server.URL}
	customer, err := client.CreateCustomer(context.Background(), CreateCustomerRequest{
		Email: "buyer@example.test",
		Metadata: map[string]string{
			metadataUserIDKey: "user_http",
		},
	})
	if err != nil || customer.ID != "cus_http" {
		t.Fatalf("CreateCustomer: %v %+v", err, customer)
	}
	if customerPath != "/customers" || customerFormValues.Get("metadata["+metadataUserIDKey+"]") != "user_http" {
		t.Fatalf("customer form: path=%s values=%v", customerPath, customerFormValues)
	}

	price, err := client.PriceByLookupKey(context.Background(), monthlyPriceLookupKey)
	if err != nil || price.ID != "price_http" {
		t.Fatalf("PriceByLookupKey: %v %+v", err, price)
	}

	session, err := client.CreateCheckoutSession(context.Background(), CreateCheckoutSessionRequest{
		CustomerID:        "cus_http",
		PriceID:           "price_http",
		SuccessURL:        "https://app.example.test/ok",
		CancelURL:         "https://app.example.test/no",
		ClientReferenceID: "user_http",
		Metadata:          map[string]string{metadataUserIDKey: "user_http", metadataPlanKey: string(PlanMonthly)},
		SubscriptionMeta:  map[string]string{metadataUserIDKey: "user_http"},
	})
	if err != nil || session.ID != "cs_http" {
		t.Fatalf("CreateCheckoutSession: %v %+v", err, session)
	}
	if checkoutPath != "/checkout/sessions" {
		t.Fatalf("checkout path %s", checkoutPath)
	}
	if checkoutFormValues.Get("mode") != checkoutModeSubscription || checkoutFormValues.Get("line_items[0][price]") != "price_http" {
		t.Fatalf("checkout form: %v", checkoutFormValues)
	}

	portal, err := client.CreateBillingPortalSession(context.Background(), CreatePortalSessionRequest{
		CustomerID: "cus_http",
		ReturnURL:  "https://app.example.test/billing",
	})
	if err != nil || portal.ID != "bps_http" {
		t.Fatalf("CreateBillingPortalSession: %v %+v", err, portal)
	}
	if portalPath != "/billing_portal/sessions" || portalFormValues.Get("customer") != "cus_http" {
		t.Fatalf("portal form path=%s values=%v", portalPath, portalFormValues)
	}
}
