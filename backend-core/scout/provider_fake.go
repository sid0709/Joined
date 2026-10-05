package scout

import (
	"context"
	"fmt"
	"sync"
)

const fakeRecipientPrefix = "rcp_"
const fakeTransferPrefix = "po_"

// FakeProvider is a deterministic in-memory rail for tests and local dev.
type FakeProvider struct {
	mu             sync.Mutex
	recipients     map[string]Recipient
	transfers      map[string]TransferResult
	byPayoutID     map[string]string
	failNextSend   bool
	failNextCreate bool
	sends          int
	creates        int
	nextID         int
}

var _ Provider = (*FakeProvider)(nil)

// NewFakeProvider returns an empty fake rail.
func NewFakeProvider() *FakeProvider {
	return &FakeProvider{
		recipients: make(map[string]Recipient),
		transfers:  make(map[string]TransferResult),
		byPayoutID: make(map[string]string),
		nextID:     1,
	}
}

// FailNextSend injects a one-shot SendPayout failure, then clears.
func (f *FakeProvider) FailNextSend() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.failNextSend = true
}

// FailNextCreate injects a one-shot CreateRecipient failure, then clears.
func (f *FakeProvider) FailNextCreate() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.failNextCreate = true
}

// SendCount is how many SendPayout calls actually created a transfer.
func (f *FakeProvider) SendCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.sends
}

// CreateCount is how many CreateRecipient calls assigned a new id.
func (f *FakeProvider) CreateCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.creates
}

// Transfer returns the stored result for a provider reference.
func (f *FakeProvider) Transfer(providerRef string) (TransferResult, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	result, ok := f.transfers[providerRef]
	return result, ok
}

// SetStatus overwrites a transfer's status (tests and poll simulation).
func (f *FakeProvider) SetStatus(providerRef, status string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	result := f.transfers[providerRef]
	result.Status = NormalizeProviderStatus(status)
	f.transfers[providerRef] = result
}

func (f *FakeProvider) CreateRecipient(_ context.Context, rec Recipient) (RecipientResult, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.failNextCreate {
		f.failNextCreate = false
		return RecipientResult{}, fmt.Errorf("injected recipient failure")
	}
	id := fmt.Sprintf("%s%d", fakeRecipientPrefix, f.nextID)
	f.nextID++
	f.creates++
	f.recipients[id] = rec
	return RecipientResult{RecipientID: id}, nil
}

func (f *FakeProvider) SendPayout(_ context.Context, xfer Transfer) (TransferResult, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if xfer.PayoutID != "" {
		if ref, ok := f.byPayoutID[xfer.PayoutID]; ok {
			return f.transfers[ref], nil
		}
	}
	if f.failNextSend {
		f.failNextSend = false
		return TransferResult{}, fmt.Errorf("injected send failure")
	}
	ref := fmt.Sprintf("%s%d", fakeTransferPrefix, f.nextID)
	f.nextID++
	f.sends++
	result := TransferResult{ProviderRef: ref, Status: ProviderStatusSent}
	f.transfers[ref] = result
	if xfer.PayoutID != "" {
		f.byPayoutID[xfer.PayoutID] = ref
	}
	return result, nil
}

func (f *FakeProvider) GetPayout(_ context.Context, providerRef string) (TransferResult, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	result, ok := f.transfers[providerRef]
	if !ok {
		return TransferResult{}, fmt.Errorf("payout not found: %s", providerRef)
	}
	return result, nil
}
