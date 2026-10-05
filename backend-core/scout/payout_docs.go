package scout

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func (s *Store) savePayout(ctx context.Context, payout Payout) error {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.savePayout(payout)
	}
	_, err := s.collection(payoutsCollection).ReplaceOne(ctx, bson.D{{Key: "_id", Value: payout.ObjectID}}, payout)
	return err
}

func (s *Store) payoutByProviderRef(ctx context.Context, providerRef string) (Payout, error) {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.payoutByProviderRef(providerRef)
	}
	var payout Payout
	err := s.collection(payoutsCollection).FindOne(ctx, bson.D{{Key: "providerRef", Value: providerRef}}).Decode(&payout)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Payout{}, ErrNotFound
	}
	if err != nil {
		return Payout{}, err
	}
	payout.fill()
	return payout, nil
}

func (m *memDocs) savePayout(payout Payout) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, existing := range m.payouts {
		if existing.ObjectID == payout.ObjectID {
			m.payouts[i] = payout
			return nil
		}
	}
	return ErrNotFound
}

func (m *memDocs) payoutByProviderRef(providerRef string) (Payout, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, payout := range m.payouts {
		if payout.ProviderRef == providerRef {
			copied := payout
			copied.fill()
			return copied, nil
		}
	}
	return Payout{}, ErrNotFound
}

// MemoryPatchProfile updates an in-memory scout profile. Tests use this.
func MemoryPatchProfile(s *Store, userID string, patch func(*Profile)) {
	mem, ok := s.docs.(*memDocs)
	if !ok {
		return
	}
	mem.mu.Lock()
	defer mem.mu.Unlock()
	profile := mem.profiles[userID]
	patch(&profile)
	mem.profiles[userID] = profile
}

// MemoryInsertEarning stores one earning on an in-memory store.
func MemoryInsertEarning(s *Store, earning Earning) {
	mem, ok := s.docs.(*memDocs)
	if !ok {
		return
	}
	if earning.ObjectID == (bson.ObjectID{}) {
		earning.ObjectID = bson.NewObjectID()
	}
	mem.insertEarning(earning)
}
