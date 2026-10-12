package scout

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// Screening runs before a payout is requested or staff send it.
//
// A stored "clear" is reused for later payouts and for a repeat attempt on the
// same certification. pending and hit are sent to the provider again. Staff
// revoke a clear by setting the status back to pending. There is no re-screen
// environment flag. The HTTP provider is optional and is not used when
// PAYOUT_SCREENING_PROVIDER is unset (the default is fake, which returns clear).
//
// The provider receives user id, country, and form type. It never receives a
// tax id, and errors are not logged with a request body.
const (
	CodeTaxFormRequired  = "tax_form_required"
	CodeScreeningBlocked = "screening_blocked"

	ScreeningProviderFake = "fake"
	ScreeningProviderHTTP = "http"

	envPayoutScreeningProvider = "PAYOUT_SCREENING_PROVIDER"
	envPayoutScreeningURL      = "PAYOUT_SCREENING_URL"
	envPayoutScreeningToken    = "PAYOUT_SCREENING_TOKEN"

	screeningHTTPTimeout = 5 * time.Second
)

var (
	ErrTaxFormRequired  = errors.New("a W-9 or W-8BEN is required before payout")
	ErrScreeningBlocked = errors.New("sanction screening blocked this payout")
)

// ScreeningSubject is the only payload a screening provider may see.
type ScreeningSubject struct {
	UserID   string `json:"user_id"`
	Country  string `json:"country"`
	FormType string `json:"form_type"`
}

// ScreeningResult is a provider decision.
type ScreeningResult struct {
	Status string `json:"status"`
}

// Screener is the sanction-screening hook. Implementations must not log a tax id.
type Screener interface {
	Screen(ctx context.Context, subject ScreeningSubject) (ScreeningResult, error)
}

// ScreeningConfig selects the fake or HTTP screening provider.
type ScreeningConfig struct {
	Provider string
	URL      string
	Token    string
}

// LoadScreeningConfig reads PAYOUT_SCREENING_PROVIDER. Empty means fake.
func LoadScreeningConfig() (ScreeningConfig, error) {
	provider := strings.ToLower(strings.TrimSpace(os.Getenv(envPayoutScreeningProvider)))
	if provider == "" {
		provider = ScreeningProviderFake
	}
	switch provider {
	case ScreeningProviderFake:
		return ScreeningConfig{Provider: ScreeningProviderFake}, nil
	case ScreeningProviderHTTP:
		raw := strings.TrimSpace(os.Getenv(envPayoutScreeningURL))
		if raw == "" {
			return ScreeningConfig{}, errors.New("PAYOUT_SCREENING_URL is required when PAYOUT_SCREENING_PROVIDER=http")
		}
		parsed, err := url.Parse(raw)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return ScreeningConfig{}, errors.New("PAYOUT_SCREENING_URL must be an absolute URL")
		}
		return ScreeningConfig{
			Provider: ScreeningProviderHTTP,
			URL:      raw,
			Token:    os.Getenv(envPayoutScreeningToken),
		}, nil
	default:
		return ScreeningConfig{}, errors.New("PAYOUT_SCREENING_PROVIDER must be fake or http")
	}
}

// NewScreener builds the provider named by cfg. An empty provider is fake.
func NewScreener(cfg ScreeningConfig) (Screener, error) {
	switch cfg.Provider {
	case "", ScreeningProviderFake:
		return NewFakeScreener(ScreeningClear), nil
	case ScreeningProviderHTTP:
		if strings.TrimSpace(cfg.URL) == "" {
			return nil, errors.New("PAYOUT_SCREENING_URL is required when PAYOUT_SCREENING_PROVIDER=http")
		}
		return &httpScreener{
			url:    cfg.URL,
			token:  cfg.Token,
			client: &http.Client{Timeout: screeningHTTPTimeout},
		}, nil
	default:
		return nil, errors.New("PAYOUT_SCREENING_PROVIDER must be fake or http")
	}
}

func screenerFromEnv() Screener {
	cfg, err := LoadScreeningConfig()
	if err != nil {
		slog.Warn("payout screening config", "error", err.Error())
		return failingScreener{}
	}
	screen, err := NewScreener(cfg)
	if err != nil {
		slog.Warn("payout screening config", "error", err.Error())
		return failingScreener{}
	}
	return screen
}

// FakeScreener is the default provider. Status defaults to clear.
type FakeScreener struct {
	Status string
	Err    error
}

// NewFakeScreener returns a provider that answers with status.
func NewFakeScreener(status string) *FakeScreener {
	if status == "" {
		status = ScreeningClear
	}
	return &FakeScreener{Status: status}
}

// Screen returns the configured status or Err.
func (f *FakeScreener) Screen(context.Context, ScreeningSubject) (ScreeningResult, error) {
	if f == nil {
		return ScreeningResult{Status: ScreeningClear}, nil
	}
	if f.Err != nil {
		return ScreeningResult{}, f.Err
	}
	status := f.Status
	if status == "" {
		status = ScreeningClear
	}
	return ScreeningResult{Status: status}, nil
}

type failingScreener struct{}

func (failingScreener) Screen(context.Context, ScreeningSubject) (ScreeningResult, error) {
	return ScreeningResult{}, errors.New("screening provider is not configured")
}

type httpScreener struct {
	url    string
	token  string
	client *http.Client
}

func (h *httpScreener) Screen(ctx context.Context, subject ScreeningSubject) (ScreeningResult, error) {
	payload, err := json.Marshal(subject)
	if err != nil {
		return ScreeningResult{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.url, bytes.NewReader(payload))
	if err != nil {
		return ScreeningResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	if h.token != "" {
		req.Header.Set("Authorization", "Bearer "+h.token)
	}
	resp, err := h.client.Do(req)
	if err != nil {
		return ScreeningResult{}, errors.New("screening provider request failed")
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return ScreeningResult{}, errors.New("screening provider request failed")
	}
	if resp.StatusCode != http.StatusOK {
		return ScreeningResult{}, fmt.Errorf("screening provider status %d", resp.StatusCode)
	}
	var result ScreeningResult
	if err := json.Unmarshal(body, &result); err != nil {
		return ScreeningResult{}, errors.New("screening provider request failed")
	}
	return result, nil
}

// SetScreener replaces the sanction hook. Tests use this; production uses env.
func (s *Store) SetScreener(screen Screener) {
	s.screener = screen
}

func (s *Store) screenerOrFake() Screener {
	if s.screener == nil {
		return NewFakeScreener(ScreeningClear)
	}
	return s.screener
}

// TaxFormReady is true when the stored certification matches the country.
func TaxFormReady(info *TaxInfo) bool {
	if info == nil || info.CertifiedAt.IsZero() {
		return false
	}
	switch info.FormType {
	case TaxFormW9:
		return info.Country == countryUnitedStates
	case TaxFormW8BEN, TaxFormW8BENE:
		return info.Country != "" && info.Country != countryUnitedStates
	default:
		return false
	}
}

// RevokeScreening clears a stored pass so the next payout is screened again.
func (s *Store) RevokeScreening(ctx context.Context, userID string) (Profile, error) {
	profile, err := s.EnsureProfile(ctx, userID)
	if err != nil {
		return Profile{}, err
	}
	if profile.TaxInfo == nil || !TaxFormReady(profile.TaxInfo) {
		return Profile{}, fmt.Errorf("%w: %w", ErrPayoutBlocked, ErrTaxFormRequired)
	}
	now := s.now().UTC()
	if err := s.updateProfile(ctx, userID, func(p *Profile) {
		if p.TaxInfo == nil {
			return
		}
		p.TaxInfo.ScreeningStatus = ScreeningPending
		p.TaxInfo.ScreenedAt = &now
		p.UpdatedAt = now
	}); err != nil {
		return Profile{}, err
	}
	return s.Profile(ctx, userID)
}

// gateTaxScreening blocks a payout that lacks a certified form or a clear screen.
// A stored clear is reused for the first payout and for later ones until
// RevokeScreening sets the status back to pending.
func (s *Store) gateTaxScreening(ctx context.Context, userID string, profile *Profile) error {
	if profile.TaxInfo == nil || !TaxFormReady(profile.TaxInfo) {
		return fmt.Errorf("%w: %w", ErrPayoutBlocked, ErrTaxFormRequired)
	}
	if profile.TaxInfo.ScreeningStatus == ScreeningClear {
		return nil
	}
	result, callErr := s.screenerOrFake().Screen(ctx, ScreeningSubject{
		UserID:   userID,
		Country:  profile.TaxInfo.Country,
		FormType: profile.TaxInfo.FormType,
	})
	status := ScreeningPending
	if callErr == nil {
		switch result.Status {
		case ScreeningClear, ScreeningPending, ScreeningHit:
			status = result.Status
		default:
			status = ScreeningPending
		}
	}
	now := s.now().UTC()
	if err := s.updateProfile(ctx, userID, func(p *Profile) {
		if p.TaxInfo == nil {
			return
		}
		p.TaxInfo.ScreeningStatus = status
		p.TaxInfo.ScreenedAt = &now
		p.UpdatedAt = now
	}); err != nil {
		return err
	}
	profile.TaxInfo.ScreeningStatus = status
	profile.TaxInfo.ScreenedAt = &now
	if callErr != nil || status != ScreeningClear {
		slog.Warn("payout screening", "user_id", userID, "status", status)
		return fmt.Errorf("%w: %w", ErrPayoutBlocked, ErrScreeningBlocked)
	}
	return nil
}
