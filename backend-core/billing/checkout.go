package billing

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// CheckoutParams starts a Checkout session.
// Product is ProductPremium (or empty) or ProductAcorn. Acorn does not grant Joined Premium.
type CheckoutParams struct {
	UserID     string
	Email      string
	Plan       string
	Product    string
	SuccessURL string
	CancelURL  string
}

// PortalParams starts a customer-portal session for a Joined user.
type PortalParams struct {
	UserID    string
	ReturnURL string
}

// Service is the Premium billing entry point for other packages.
type Service struct {
	Client Client
	Store  Store
	Config Config
	Now    func() time.Time
}

// NewService constructs the billing service. Tests inject FakeClient and MemoryStore.
func NewService(client Client, store Store, cfg Config) *Service {
	return &Service{Client: client, Store: store, Config: cfg, Now: time.Now}
}

func (s *Service) now() time.Time {
	if s.Now == nil {
		return time.Now().UTC()
	}
	return s.Now().UTC()
}

// CreateCheckoutSession creates a Stripe Checkout session for monthly or yearly Premium.
func (s *Service) CreateCheckoutSession(ctx context.Context, params CheckoutParams) (*CheckoutSession, error) {
	if strings.TrimSpace(params.UserID) == "" {
		return nil, ErrMissingUserID
	}
	plan, err := ParsePlan(params.Plan)
	if err != nil {
		return nil, err
	}
	successURL, err := resolveRedirectURL(params.SuccessURL, s.Config.CheckoutSuccessURL)
	if err != nil {
		return nil, err
	}
	cancelURL, err := resolveRedirectURL(params.CancelURL, s.Config.CheckoutCancelURL)
	if err != nil {
		return nil, err
	}
	product, lookupKey, err := checkoutLookupKey(params.Product, plan)
	if err != nil {
		return nil, err
	}
	price, err := s.Client.PriceByLookupKey(ctx, lookupKey)
	if err != nil {
		return nil, fmt.Errorf("lookup %s price: %w", plan, err)
	}
	customerID, err := s.EnsureCustomer(ctx, params.UserID, params.Email)
	if err != nil {
		return nil, err
	}
	meta := map[string]string{
		metadataUserIDKey:  params.UserID,
		metadataPlanKey:    string(plan),
		metadataProductKey: product,
	}
	session, err := s.Client.CreateCheckoutSession(ctx, CreateCheckoutSessionRequest{
		CustomerID:        customerID,
		PriceID:           price.ID,
		SuccessURL:        successURL,
		CancelURL:         cancelURL,
		ClientReferenceID: params.UserID,
		Metadata:          meta,
		SubscriptionMeta:  meta,
	})
	if err != nil {
		return nil, fmt.Errorf("create checkout session: %w", err)
	}
	return session, nil
}

// CreatePortalSession creates a Stripe customer-portal session for an existing customer.
func (s *Service) CreatePortalSession(ctx context.Context, params PortalParams) (*PortalSession, error) {
	if strings.TrimSpace(params.UserID) == "" {
		return nil, ErrMissingUserID
	}
	returnURL, err := resolveRedirectURL(params.ReturnURL, s.Config.PortalReturnURL)
	if err != nil {
		return nil, err
	}
	customerID, err := s.Store.CustomerID(ctx, params.UserID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrNoCustomer
		}
		return nil, fmt.Errorf("load customer: %w", err)
	}
	session, err := s.Client.CreateBillingPortalSession(ctx, CreatePortalSessionRequest{
		CustomerID: customerID,
		ReturnURL:  returnURL,
	})
	if err != nil {
		return nil, fmt.Errorf("create portal session: %w", err)
	}
	return session, nil
}

// EnsureCustomer returns the Stripe customer id for a Joined user, creating one if needed.
func (s *Service) EnsureCustomer(ctx context.Context, userID, email string) (string, error) {
	if strings.TrimSpace(userID) == "" {
		return "", ErrMissingUserID
	}
	existing, err := s.Store.CustomerID(ctx, userID)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return "", fmt.Errorf("load customer: %w", err)
	}
	customer, err := s.Client.CreateCustomer(ctx, CreateCustomerRequest{
		Email: email,
		Metadata: map[string]string{
			metadataUserIDKey: userID,
		},
	})
	if err != nil {
		return "", fmt.Errorf("create customer: %w", err)
	}
	if err := s.Store.UpsertCustomer(ctx, userID, customer.ID); err != nil {
		return "", fmt.Errorf("map customer: %w", err)
	}
	return customer.ID, nil
}

// IsPremium reports whether userID currently has Joined Premium.
func (s *Service) IsPremium(ctx context.Context, userID string) (bool, error) {
	if strings.TrimSpace(userID) == "" {
		return false, ErrMissingUserID
	}
	sub, err := s.Store.SubscriptionByUser(ctx, userID)
	if errors.Is(err, ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("load subscription: %w", err)
	}
	return sub.IsPremium(s.now()), nil
}

func resolveRedirectURL(explicit, fallback string) (string, error) {
	raw := strings.TrimSpace(explicit)
	if raw == "" {
		raw = strings.TrimSpace(fallback)
	}
	if raw == "" {
		return "", ErrInvalidURL
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return "", ErrInvalidURL
	}
	switch parsed.Scheme {
	case redirectSchemeHTTP, redirectSchemeHTTPS:
		return raw, nil
	default:
		return "", ErrInvalidURL
	}
}
