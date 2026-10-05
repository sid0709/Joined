package scout

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func (s *Store) insertPayout(ctx context.Context, payout Payout) error {
	if mem, ok := s.docs.(*memDocs); ok {
		mem.insertPayout(payout)
		return nil
	}
	_, err := s.collection(payoutsCollection).InsertOne(ctx, payout)
	return err
}

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

func (s *Store) markEarningsProcessing(ctx context.Context, ids []bson.ObjectID, payoutID string) error {
	if mem, ok := s.docs.(*memDocs); ok {
		mem.markEarningsProcessing(ids, payoutID)
		return nil
	}
	_, err := s.collection(earningsCollection).UpdateMany(ctx,
		bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: ids}}}, {Key: "status", Value: EarningReleased}},
		bson.D{{Key: "$set", Value: bson.D{{Key: "status", Value: EarningProcessing}, {Key: "payoutId", Value: payoutID}}}},
	)
	return err
}

func (s *Store) settlePayoutEarnings(ctx context.Context, payoutID string, now time.Time, paid bool) error {
	if mem, ok := s.docs.(*memDocs); ok {
		mem.settlePayoutEarnings(payoutID, now, paid)
		return nil
	}
	filter := bson.D{{Key: "payoutId", Value: payoutID}, {Key: "status", Value: EarningProcessing}}
	if paid {
		_, err := s.collection(earningsCollection).UpdateMany(ctx, filter,
			bson.D{{Key: "$set", Value: bson.D{{Key: "status", Value: EarningPaid}, {Key: "paidAt", Value: now}}}})
		return err
	}
	_, err := s.collection(earningsCollection).UpdateMany(ctx, filter, bson.D{
		{Key: "$set", Value: bson.D{{Key: "status", Value: EarningReleased}}},
		{Key: "$unset", Value: bson.D{{Key: "payoutId", Value: ""}}},
	})
	return err
}

func (s *Store) savePayoutMethodOnProfile(ctx context.Context, userID string, method PayoutMethod) error {
	now := method.UpdatedAt
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.savePayoutMethod(userID, method, now)
	}
	_, err := s.collection(profilesCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: userID}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "payoutMethod", Value: method}, {Key: "updatedAt", Value: now}}},
	})
	return err
}

func (s *Store) allEarnings(ctx context.Context, filter bson.D) ([]Earning, error) {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.listEarnings(filter), nil
	}
	cursor, err := s.collection(earningsCollection).Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	earnings := []Earning{}
	if err := cursor.All(ctx, &earnings); err != nil {
		return nil, err
	}
	for i := range earnings {
		earnings[i].fill()
	}
	return earnings, nil
}

func (m *memDocs) insertPayout(payout Payout) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.payouts = append(m.payouts, payout)
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

func (m *memDocs) payout(id string) (Payout, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, payout := range m.payouts {
		if payout.ObjectID.Hex() == id {
			copied := payout
			copied.fill()
			return copied, nil
		}
	}
	return Payout{}, ErrNotFound
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

func (m *memDocs) listPayouts(userID, cursorValue string, limit int) (List[Payout], error) {
	if _, err := cursorFilter(bson.D{}, cursorValue); err != nil {
		return List[Payout]{}, err
	}
	limit = listLimit(limit)
	m.mu.Lock()
	owned := []Payout{}
	for i := len(m.payouts) - 1; i >= 0; i-- {
		if m.payouts[i].ScoutUserID == userID {
			copied := m.payouts[i]
			copied.fill()
			owned = append(owned, copied)
		}
	}
	m.mu.Unlock()
	if cursorValue != "" {
		cut := -1
		for i, payout := range owned {
			if payout.ID == cursorValue {
				cut = i
				break
			}
		}
		if cut >= 0 {
			owned = owned[cut+1:]
		}
	}
	next := ""
	if len(owned) > limit {
		owned = owned[:limit]
		next = owned[len(owned)-1].ID
	}
	return List[Payout]{Data: owned, NextCursor: next}, nil
}

func (m *memDocs) insertEarning(earning Earning) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.earnings = append(m.earnings, earning)
}

func earningFilterValue(filter bson.D, key string) string {
	for _, field := range filter {
		if field.Key == key {
			value, _ := field.Value.(string)
			return value
		}
	}
	return ""
}

func (m *memDocs) listEarnings(filter bson.D) []Earning {
	userID := earningFilterValue(filter, "scoutUserId")
	status := earningFilterValue(filter, "status")
	submissionID := earningFilterValue(filter, "submissionId")
	payoutID := earningFilterValue(filter, "payoutId")
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []Earning{}
	for _, earning := range m.earnings {
		if userID != "" && earning.ScoutUserID != userID {
			continue
		}
		if status != "" && earning.Status != status {
			continue
		}
		if submissionID != "" && earning.SubmissionID != submissionID {
			continue
		}
		if payoutID != "" && earning.PayoutID != payoutID {
			continue
		}
		copied := earning
		copied.fill()
		out = append(out, copied)
	}
	return out
}

func (m *memDocs) markEarningsProcessing(ids []bson.ObjectID, payoutID string) {
	want := map[bson.ObjectID]struct{}{}
	for _, id := range ids {
		want[id] = struct{}{}
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.earnings {
		if _, ok := want[m.earnings[i].ObjectID]; !ok {
			continue
		}
		if m.earnings[i].Status != EarningReleased {
			continue
		}
		m.earnings[i].Status = EarningProcessing
		m.earnings[i].PayoutID = payoutID
	}
}

func (m *memDocs) settlePayoutEarnings(payoutID string, now time.Time, paid bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.earnings {
		if m.earnings[i].PayoutID != payoutID || m.earnings[i].Status != EarningProcessing {
			continue
		}
		if paid {
			m.earnings[i].Status = EarningPaid
			paidAt := now
			m.earnings[i].PaidAt = &paidAt
			continue
		}
		m.earnings[i].Status = EarningReleased
		m.earnings[i].PayoutID = ""
	}
}

func (m *memDocs) releaseDue(now time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.earnings {
		if m.earnings[i].Status == EarningHeld && !m.earnings[i].HoldUntil.After(now) {
			m.earnings[i].Status = EarningReleased
			released := now
			m.earnings[i].ReleasedAt = &released
		}
	}
}

func (m *memDocs) savePayoutMethod(userID string, method PayoutMethod, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	profile, ok := m.profiles[userID]
	if !ok {
		return ErrNotFound
	}
	profile.PayoutMethod = &method
	profile.UpdatedAt = now
	m.profiles[userID] = profile
	return nil
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
