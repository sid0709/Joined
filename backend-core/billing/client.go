package billing

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
	Product    string            `json:"product"`
	Currency   string            `json:"currency"`
	UnitAmount int               `json:"unit_amount"`
	Recurring  *Recurring        `json:"recurring"`
	LookupKey  string            `json:"lookup_key"`
	Metadata   map[string]string `json:"metadata"`
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
	var product Product
	if err := c.post(ctx, "/products", body, &product); err != nil {
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
	body, err := encodeForm(map[string]interface{}{
		"product":     req.Product,
		"currency":    req.Currency,
		"unit_amount": req.UnitAmount,
		"recurring":   req.Recurring,
		"lookup_key":  req.LookupKey,
		"metadata":    req.Metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("encode price form: %w", err)
	}
	var price Price
	if err := c.post(ctx, "/prices", body, &price); err != nil {
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
	req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+path, body)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.SetBasicAuth(c.SecretKey, "")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
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

func encodeForm(data map[string]interface{}) (io.Reader, error) {
	var buf bytes.Buffer
	for key, value := range data {
		if value == nil {
			continue
		}
		switch v := value.(type) {
		case string:
			if v != "" {
				fmt.Fprintf(&buf, "%s=%s&", key, v)
			}
		case int:
			fmt.Fprintf(&buf, "%s=%d&", key, v)
		case map[string]string:
			for mk, mv := range v {
				fmt.Fprintf(&buf, "%s[%s]=%s&", key, mk, mv)
			}
		case *Recurring:
			if v != nil {
				fmt.Fprintf(&buf, "%s[interval]=%s&", key, v.Interval)
				fmt.Fprintf(&buf, "%s[interval_count]=%d&", key, v.IntervalCount)
			}
		case *bool:
			if v != nil {
				fmt.Fprintf(&buf, "%s=%t&", key, *v)
			}
		}
	}
	return bytes.NewReader(buf.Bytes()), nil
}
