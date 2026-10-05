package scout

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	payoutHTTPTimeout = 15 * time.Second

	payoutRecipientPath = "/v1/recipients"
	payoutSendPath      = "/v1/payouts"

	wiseIdempotencyHeader     = "Idempotence-Key"
	paypalIdempotencyHeader   = "PayPal-Request-Id"
	defaultIdempotencyHeader  = "Idempotency-Key"
	payoutAuthorizationPrefix = "Bearer "
	payoutJSONContentType     = "application/json"
	maxPayoutResponseBytes    = 64 << 10
)

// HTTPProvider is a sandbox net/http adapter for Wise- or PayPal-style rails.
// It posts JSON to the configured sandbox base URL. Production hosts are refused
// by LoadPayoutConfig unless PAYOUT_ALLOW_LIVE is set.
type HTTPProvider struct {
	Kind    string
	Token   string
	BaseURL string
	HTTP    *http.Client
}

var _ Provider = (*HTTPProvider)(nil)

// NewHTTPProvider builds a sandbox HTTP rail. BaseURL must already be checked.
func NewHTTPProvider(kind, token, baseURL string) *HTTPProvider {
	return &HTTPProvider{
		Kind:    kind,
		Token:   token,
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTP:    &http.Client{Timeout: payoutHTTPTimeout},
	}
}

type httpRecipientRequest struct {
	Country    string `json:"country"`
	Currency   string `json:"currency"`
	Email      string `json:"email,omitempty"`
	AccountRef string `json:"account_ref,omitempty"`
	Label      string `json:"label,omitempty"`
	ScoutUser  string `json:"scout_user_id,omitempty"`
}

type httpIDResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

type httpTransferRequest struct {
	PayoutID    string `json:"payout_id"`
	RecipientID string `json:"recipient_id"`
	AmountCents int64  `json:"amount_cents"`
	Currency    string `json:"currency"`
}

func (p *HTTPProvider) CreateRecipient(ctx context.Context, rec Recipient) (RecipientResult, error) {
	var out httpIDResponse
	if err := p.doJSON(ctx, http.MethodPost, payoutRecipientPath, "", httpRecipientRequest{
		Country:    rec.Country,
		Currency:   rec.Currency,
		Email:      rec.Email,
		AccountRef: rec.AccountRef,
		Label:      rec.Label,
		ScoutUser:  rec.ScoutUserID,
	}, &out); err != nil {
		return RecipientResult{}, err
	}
	if out.ID == "" {
		return RecipientResult{}, fmt.Errorf("payout provider returned no recipient id")
	}
	return RecipientResult{RecipientID: out.ID}, nil
}

func (p *HTTPProvider) SendPayout(ctx context.Context, xfer Transfer) (TransferResult, error) {
	var out httpIDResponse
	if err := p.doJSON(ctx, http.MethodPost, payoutSendPath, xfer.PayoutID, httpTransferRequest{
		PayoutID:    xfer.PayoutID,
		RecipientID: xfer.RecipientID,
		AmountCents: xfer.AmountCents,
		Currency:    xfer.Currency,
	}, &out); err != nil {
		return TransferResult{}, err
	}
	if out.ID == "" {
		return TransferResult{}, fmt.Errorf("payout provider returned no transfer id")
	}
	status := out.Status
	if status == "" {
		status = ProviderStatusSent
	}
	return TransferResult{ProviderRef: out.ID, Status: NormalizeProviderStatus(status)}, nil
}

func (p *HTTPProvider) GetPayout(ctx context.Context, providerRef string) (TransferResult, error) {
	var out httpIDResponse
	path := payoutSendPath + "/" + providerRef
	if err := p.doJSON(ctx, http.MethodGet, path, "", nil, &out); err != nil {
		return TransferResult{}, err
	}
	id := out.ID
	if id == "" {
		id = providerRef
	}
	return TransferResult{ProviderRef: id, Status: NormalizeProviderStatus(out.Status)}, nil
}

func (p *HTTPProvider) doJSON(ctx context.Context, method, path, idempotencyKey string, body, result interface{}) error {
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode payout request: %w", err)
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, p.BaseURL+path, reader)
	if err != nil {
		return fmt.Errorf("create payout request: %w", err)
	}
	if p.Token != "" {
		req.Header.Set("Authorization", payoutAuthorizationPrefix+p.Token)
	}
	if body != nil {
		req.Header.Set("Content-Type", payoutJSONContentType)
	}
	if idempotencyKey != "" {
		req.Header.Set(p.idempotencyHeader(), idempotencyKey)
	}
	client := p.HTTP
	if client == nil {
		client = &http.Client{Timeout: payoutHTTPTimeout}
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("payout request: %w", err)
	}
	defer resp.Body.Close()
	limited := io.LimitReader(resp.Body, maxPayoutResponseBytes)
	raw, err := io.ReadAll(limited)
	if err != nil {
		return fmt.Errorf("read payout response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("payout provider error %d: %s", resp.StatusCode, string(raw))
	}
	if result == nil || len(raw) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, result); err != nil {
		return fmt.Errorf("decode payout response: %w", err)
	}
	return nil
}

func (p *HTTPProvider) idempotencyHeader() string {
	switch p.Kind {
	case PayoutProviderWise:
		return wiseIdempotencyHeader
	case PayoutProviderPayPal:
		return paypalIdempotencyHeader
	default:
		return defaultIdempotencyHeader
	}
}
