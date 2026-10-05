package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

var (
	_ Client = (*HTTPClient)(nil)
	_ Client = (*FakeClient)(nil)
	_ Store  = (*MemoryStore)(nil)
	_ Store  = (*MongoStore)(nil)
)

// Client is a thin interface to the Stripe API. Tests use a fake.
type Client interface {
	// CreateProduct creates a product with metadata for idempotent sync.
	CreateProduct(ctx context.Context, req CreateProductRequest) (*Product, error)
	// UpdateProduct updates a product by ID.
	UpdateProduct(ctx context.Context, id string, req UpdateProductRequest) (*Product, error)
	// ListProducts lists all products with optional lookup key.
	ListProducts(ctx context.Context, lookupKey string) ([]*Product, error)
	// CreatePrice creates a recurring price attached to a product.
	CreatePrice(ctx context.Context, req CreatePriceRequest) (*Price, error)
	// UpdatePrice updates a price by ID (metadata only; amount is immutable).
	UpdatePrice(ctx context.Context, id string, req UpdatePriceRequest) (*Price, error)
	// ListPrices lists prices for a product.
	ListPrices(ctx context.Context, productID string) ([]*Price, error)
	// PriceByLookupKey returns the active price for a Stripe lookup key.
	PriceByLookupKey(ctx context.Context, lookupKey string) (*Price, error)
	// CreateCustomer creates a Stripe customer with metadata for Joined user mapping.
	CreateCustomer(ctx context.Context, req CreateCustomerRequest) (*Customer, error)
	// CreateCheckoutSession starts a Stripe Checkout session for a Premium price.
	CreateCheckoutSession(ctx context.Context, req CreateCheckoutSessionRequest) (*CheckoutSession, error)
	// CreateBillingPortalSession starts a Stripe customer-portal session.
	CreateBillingPortalSession(ctx context.Context, req CreatePortalSessionRequest) (*PortalSession, error)
}

// Customer is a Stripe customer mapped to a Joined user via metadata.
type Customer struct {
	ID       string            `json:"id"`
	Email    string            `json:"email"`
	Metadata map[string]string `json:"metadata"`
}

// CheckoutSession is a Stripe Checkout session.
type CheckoutSession struct {
	ID             string            `json:"id"`
	URL            string            `json:"url"`
	CustomerID     string            `json:"customer"`
	SubscriptionID string            `json:"subscription"`
	ClientRef      string            `json:"client_reference_id"`
	Metadata       map[string]string `json:"metadata"`
}

// PortalSession is a Stripe billing-portal session.
type PortalSession struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

// CreateCustomerRequest creates a Stripe customer.
type CreateCustomerRequest struct {
	Email    string            `json:"email"`
	Metadata map[string]string `json:"metadata"`
}

// CreateCheckoutSessionRequest starts Checkout for a recurring price.
type CreateCheckoutSessionRequest struct {
	CustomerID        string
	PriceID           string
	SuccessURL        string
	CancelURL         string
	ClientReferenceID string
	Metadata          map[string]string
	SubscriptionMeta  map[string]string
}

// CreatePortalSessionRequest starts the customer portal.
type CreatePortalSessionRequest struct {
	CustomerID string
	ReturnURL  string
}

// Product is a Stripe product.
type Product struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Active      bool              `json:"active"`
	Metadata    map[string]string `json:"metadata"`
}

// Price is a Stripe price.
type Price struct {
	ID         string            `json:"id"`
	ProductID  string            `json:"product"`
	Active     bool              `json:"active"`
	Currency   string            `json:"currency"`
	UnitAmount int               `json:"unit_amount"`
	Recurring  *Recurring        `json:"recurring"`
	LookupKey  string            `json:"lookup_key"`
	Metadata   map[string]string `json:"metadata"`
}

// Recurring describes a price's recurring interval.
type Recurring struct {
	Interval      string `json:"interval"`
	IntervalCount int    `json:"interval_count"`
}

// CreateProductRequest creates a product.
type CreateProductRequest struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Metadata    map[string]string `json:"metadata"`
}

// UpdateProductRequest updates a product.
type UpdateProductRequest struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Metadata    map[string]string `json:"metadata"`
}

// CreatePriceRequest creates a price.
type CreatePriceRequest struct {
	Product           string            `json:"product"`
	Currency          string            `json:"currency"`
	UnitAmount        int               `json:"unit_amount"`
	Recurring         *Recurring        `json:"recurring"`
	LookupKey         string            `json:"lookup_key"`
	Metadata          map[string]string `json:"metadata"`
	TransferLookupKey bool              `json:"transfer_lookup_key,omitempty"`
	ReplacedPriceID   string            `json:"-"`
}

// UpdatePriceRequest updates a price.
type UpdatePriceRequest struct {
	Metadata map[string]string `json:"metadata"`
	Active   *bool             `json:"active,omitempty"`
}

// HTTPClient is a minimal HTTP client to the Stripe API.
type HTTPClient struct {
	SecretKey string
	BaseURL   string
}

// NewHTTPClient creates a Stripe HTTP client.
func NewHTTPClient(secretKey string) *HTTPClient {
	return &HTTPClient{
		SecretKey: secretKey,
		BaseURL:   "https://api.stripe.com/v1",
	}
}

func (c *HTTPClient) CreateProduct(ctx context.Context, req CreateProductRequest) (*Product, error) {
	body, err := encodeForm(map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"metadata":    req.Metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("encode product form: %w", err)
	}
	idempotencyKey := ""
	if req.Metadata != nil && req.Metadata["lookup_key"] != "" {
		idempotencyKey = "product_" + req.Metadata["lookup_key"]
	}
	var product Product
	if err := c.postWithIdempotency(ctx, "/products", body, idempotencyKey, &product); err != nil {
		return nil, err
	}
	return &product, nil
}

func (c *HTTPClient) UpdateProduct(ctx context.Context, id string, req UpdateProductRequest) (*Product, error) {
	body, err := encodeForm(map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"metadata":    req.Metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("encode product form: %w", err)
	}
	var product Product
	if err := c.post(ctx, "/products/"+id, body, &product); err != nil {
		return nil, err
	}
	return &product, nil
}

func (c *HTTPClient) ListProducts(ctx context.Context, lookupKey string) ([]*Product, error) {
	path := "/products?limit=100"
	if lookupKey != "" {
		path += "&lookup_keys[]=" + lookupKey
	}
	var resp struct {
		Data []*Product `json:"data"`
	}
	if err := c.get(ctx, path, &resp); err != nil {
		return nil, err
	}
	return resp.Data, nil
}

func (c *HTTPClient) CreatePrice(ctx context.Context, req CreatePriceRequest) (*Price, error) {
	formData := map[string]interface{}{
		"product":     req.Product,
		"currency":    req.Currency,
		"unit_amount": req.UnitAmount,
		"recurring":   req.Recurring,
		"lookup_key":  req.LookupKey,
		"metadata":    req.Metadata,
	}
	if req.TransferLookupKey {
		formData["transfer_lookup_key"] = true
	}
	body, err := encodeForm(formData)
	if err != nil {
		return nil, fmt.Errorf("encode price form: %w", err)
	}
	idempotencyKey := ""
	if req.LookupKey != "" {
		replacedID := req.ReplacedPriceID
		if replacedID == "" {
			replacedID = "_new"
		}
		idempotencyKey = fmt.Sprintf("price_%s_%d_%s", req.LookupKey, req.UnitAmount, replacedID)
	}
	var price Price
	if err := c.postWithIdempotency(ctx, "/prices", body, idempotencyKey, &price); err != nil {
		return nil, err
	}
	return &price, nil
}

func (c *HTTPClient) UpdatePrice(ctx context.Context, id string, req UpdatePriceRequest) (*Price, error) {
	body, err := encodeForm(map[string]interface{}{
		"metadata": req.Metadata,
		"active":   req.Active,
	})
	if err != nil {
		return nil, fmt.Errorf("encode price form: %w", err)
	}
	var price Price
	if err := c.post(ctx, "/prices/"+id, body, &price); err != nil {
		return nil, err
	}
	return &price, nil
}

func (c *HTTPClient) ListPrices(ctx context.Context, productID string) ([]*Price, error) {
	path := "/prices?limit=100&product=" + productID
	var resp struct {
		Data []*Price `json:"data"`
	}
	if err := c.get(ctx, path, &resp); err != nil {
		return nil, err
	}
	return resp.Data, nil
}

func (c *HTTPClient) PriceByLookupKey(ctx context.Context, lookupKey string) (*Price, error) {
	path := "/prices?limit=1&active=true&lookup_keys[]=" + url.QueryEscape(lookupKey)
	var resp struct {
		Data []*Price `json:"data"`
	}
	if err := c.get(ctx, path, &resp); err != nil {
		return nil, err
	}
	if len(resp.Data) == 0 {
		return nil, fmt.Errorf("price not found for lookup key %q", lookupKey)
	}
	return resp.Data[0], nil
}

func (c *HTTPClient) CreateCustomer(ctx context.Context, req CreateCustomerRequest) (*Customer, error) {
	body, err := encodeForm(map[string]interface{}{
		"email":    req.Email,
		"metadata": req.Metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("encode customer form: %w", err)
	}
	idempotencyKey := ""
	if req.Metadata != nil && req.Metadata[metadataUserIDKey] != "" {
		idempotencyKey = customerIdempotencyPrefix + req.Metadata[metadataUserIDKey]
	}
	var customer Customer
	if err := c.postWithIdempotency(ctx, "/customers", body, idempotencyKey, &customer); err != nil {
		return nil, err
	}
	return &customer, nil
}

func (c *HTTPClient) CreateCheckoutSession(ctx context.Context, req CreateCheckoutSessionRequest) (*CheckoutSession, error) {
	body := strings.NewReader(checkoutForm(req).Encode())
	var session stripeCheckoutSession
	if err := c.post(ctx, "/checkout/sessions", body, &session); err != nil {
		return nil, err
	}
	return session.toCheckoutSession(), nil
}

func (c *HTTPClient) CreateBillingPortalSession(ctx context.Context, req CreatePortalSessionRequest) (*PortalSession, error) {
	body, err := encodeForm(map[string]interface{}{
		"customer":   req.CustomerID,
		"return_url": req.ReturnURL,
	})
	if err != nil {
		return nil, fmt.Errorf("encode portal form: %w", err)
	}
	var session PortalSession
	if err := c.post(ctx, "/billing_portal/sessions", body, &session); err != nil {
		return nil, err
	}
	return &session, nil
}

func (c *HTTPClient) get(ctx context.Context, path string, result interface{}) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.BaseURL+path, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.SetBasicAuth(c.SecretKey, "")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("stripe error %d: %s", resp.StatusCode, string(body))
	}
	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

func (c *HTTPClient) post(ctx context.Context, path string, body io.Reader, result interface{}) error {
	return c.postWithIdempotency(ctx, path, body, "", result)
}

func (c *HTTPClient) postWithIdempotency(ctx context.Context, path string, body io.Reader, idempotencyKey string, result interface{}) error {
	req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+path, body)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.SetBasicAuth(c.SecretKey, "")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("stripe error %d: %s", resp.StatusCode, string(body))
	}
	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

type stripeCheckoutSession struct {
	ID                 string            `json:"id"`
	URL                string            `json:"url"`
	Customer           string            `json:"customer"`
	Subscription       string            `json:"subscription"`
	ClientReferenceID  string            `json:"client_reference_id"`
	Metadata           map[string]string `json:"metadata"`
}

func (s stripeCheckoutSession) toCheckoutSession() *CheckoutSession {
	return &CheckoutSession{
		ID:             s.ID,
		URL:            s.URL,
		CustomerID:     s.Customer,
		SubscriptionID: s.Subscription,
		ClientRef:      s.ClientReferenceID,
		Metadata:       s.Metadata,
	}
}

func checkoutForm(req CreateCheckoutSessionRequest) url.Values {
	values := url.Values{}
	values.Set("mode", checkoutModeSubscription)
	values.Set("success_url", req.SuccessURL)
	values.Set("cancel_url", req.CancelURL)
	if req.CustomerID != "" {
		values.Set("customer", req.CustomerID)
	}
	if req.ClientReferenceID != "" {
		values.Set("client_reference_id", req.ClientReferenceID)
	}
	values.Set("line_items[0][price]", req.PriceID)
	values.Set("line_items[0][quantity]", strconv.Itoa(checkoutLineQuantity))
	for key, value := range req.Metadata {
		values.Set(fmt.Sprintf("metadata[%s]", key), value)
	}
	for key, value := range req.SubscriptionMeta {
		values.Set(fmt.Sprintf("subscription_data[metadata][%s]", key), value)
	}
	return values
}

func encodeForm(data map[string]interface{}) (io.Reader, error) {
	values := url.Values{}
	for key, value := range data {
		if value == nil {
			continue
		}
		switch v := value.(type) {
		case string:
			if v != "" {
				values.Add(key, v)
			}
		case int:
			values.Add(key, strconv.Itoa(v))
		case bool:
			values.Add(key, strconv.FormatBool(v))
		case map[string]string:
			for mk, mv := range v {
				values.Add(fmt.Sprintf("%s[%s]", key, mk), mv)
			}
		case *Recurring:
			if v != nil {
				values.Add(fmt.Sprintf("%s[interval]", key), v.Interval)
				values.Add(fmt.Sprintf("%s[interval_count]", key), strconv.Itoa(v.IntervalCount))
			}
		case *bool:
			if v != nil {
				values.Add(key, strconv.FormatBool(*v))
			}
		}
	}
	return strings.NewReader(values.Encode()), nil
}
