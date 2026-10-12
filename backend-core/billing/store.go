package billing

import (
	"context"
	"sync"
	"time"
)

// Store persists Stripe customer mappings and Premium subscriptions.
type Store interface {
	UpsertCustomer(ctx context.Context, userID, customerID string) error
	CustomerID(ctx context.Context, userID string) (string, error)
	UserIDByCustomer(ctx context.Context, customerID string) (string, error)
	UpsertSubscription(ctx context.Context, sub Subscription) error
	SubscriptionByUser(ctx context.Context, userID string) (Subscription, error)
}

// MemoryStore is an in-memory Store for tests and local seams.
type MemoryStore struct {
	mu        sync.Mutex
	customers map[string]string
	users     map[string]string
	byUser    map[string]Subscription
	bySub     map[string]Subscription
	upserts   int
	now       func() time.Time
}

// NewMemoryStore creates an empty in-memory billing store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		customers: make(map[string]string),
		users:     make(map[string]string),
		byUser:    make(map[string]Subscription),
		bySub:     make(map[string]Subscription),
		now:       time.Now,
	}
}

func (m *MemoryStore) UpsertCustomer(_ context.Context, userID, customerID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if userID == "" || customerID == "" {
		return ErrMissingUserID
	}
	if previous, ok := m.customers[userID]; ok && previous != customerID {
		delete(m.users, previous)
	}
	m.customers[userID] = customerID
	m.users[customerID] = userID
	return nil
}

func (m *MemoryStore) CustomerID(_ context.Context, userID string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.customers[userID]
	if !ok {
		return "", ErrNotFound
	}
	return id, nil
}

func (m *MemoryStore) UserIDByCustomer(_ context.Context, customerID string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.users[customerID]
	if !ok {
		return "", ErrNotFound
	}
	return id, nil
}

func (m *MemoryStore) UpsertSubscription(_ context.Context, sub Subscription) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if sub.StripeSubscriptionID != "" {
		sub = mergeSubscription(m.bySub[sub.StripeSubscriptionID], sub)
	} else if sub.UserID != "" {
		sub = mergeSubscription(m.byUser[sub.UserID], sub)
	}
	if sub.UpdatedAt.IsZero() {
		sub.UpdatedAt = m.now().UTC()
	}
	if sub.StripeSubscriptionID != "" {
		m.bySub[sub.StripeSubscriptionID] = sub
	}
	if sub.UserID != "" {
		m.byUser[sub.UserID] = sub
	}
	m.upserts++
	return nil
}

func (m *MemoryStore) SubscriptionByUser(_ context.Context, userID string) (Subscription, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	sub, ok := m.byUser[userID]
	if !ok {
		return Subscription{}, ErrNotFound
	}
	return sub, nil
}

// UpsertCount is the number of subscription writes. Tests use it to prove replay is a no-op.
func (m *MemoryStore) UpsertCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.upserts
}

func mergeSubscription(existing, incoming Subscription) Subscription {
	if incoming.UserID == "" {
		incoming.UserID = existing.UserID
	}
	if incoming.StripeCustomerID == "" {
		incoming.StripeCustomerID = existing.StripeCustomerID
	}
	if incoming.StripeSubscriptionID == "" {
		incoming.StripeSubscriptionID = existing.StripeSubscriptionID
	}
	if incoming.Status == "" {
		incoming.Status = existing.Status
	}
	if incoming.Plan == "" {
		incoming.Plan = existing.Plan
	}
	if incoming.Product == "" {
		incoming.Product = existing.Product
	}
	if incoming.RefundedCents == 0 {
		incoming.RefundedCents = existing.RefundedCents
	}
	if incoming.CurrentPeriodEnd.IsZero() {
		incoming.CurrentPeriodEnd = existing.CurrentPeriodEnd
	}
	if incoming.UpdatedAt.IsZero() {
		incoming.UpdatedAt = existing.UpdatedAt
	}
	return incoming
}
