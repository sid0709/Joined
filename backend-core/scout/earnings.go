package scout

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// EarningProcessing marks released earnings locked into a requested payout.
const EarningProcessing = "processing"

func (s *Store) addEarning(ctx context.Context, sub Submission, kind string, amount Money, status, description string) error {
	now := s.now().UTC()
	earning := Earning{
		ObjectID:     bson.NewObjectID(),
		ScoutUserID:  sub.ScoutUserID,
		SubmissionID: sub.ID,
		JobTitle:     sub.Title,
		CompanyName:  sub.CompanyName,
		Type:         kind,
		Amount:       amount,
		Status:       status,
		Description:  description,
		HoldUntil:    HoldUntil(now),
		CreatedAt:    now,
	}
	if status == EarningReleased {
		earning.HoldUntil = now
		earning.ReleasedAt = &now
	}
	if _, err := s.collection(earningsCollection).InsertOne(ctx, earning); err != nil {
		return err
	}
	s.notifyRewardImpl(ctx, sub.ScoutUserID, earning)
	return nil
}

// releaseDue moves held rewards whose hold window ended to released.
func (s *Store) releaseDue(ctx context.Context) error {
	now := s.now().UTC()
	if mem, ok := s.docs.(*memDocs); ok {
		mem.releaseDue(now)
		return nil
	}
	_, err := s.collection(earningsCollection).UpdateMany(ctx,
		bson.D{{Key: "status", Value: EarningHeld}, {Key: "holdUntil", Value: bson.D{{Key: "$lte", Value: now}}}},
		bson.D{{Key: "$set", Value: bson.D{{Key: "status", Value: EarningReleased}, {Key: "releasedAt", Value: now}}}},
	)
	return err
}

// EarningQuery filters a scout's earnings.
type EarningQuery struct {
	Status       string
	SubmissionID string
	Cursor       string
	Limit        int
}

// ListEarnings pages a scout's reward lines newest first.
func (s *Store) ListEarnings(ctx context.Context, userID string, query EarningQuery) (List[Earning], error) {
	if err := s.releaseDue(ctx); err != nil {
		return List[Earning]{}, err
	}
	filter := bson.D{{Key: "scoutUserId", Value: userID}}
	if query.Status != "" {
		filter = append(filter, bson.E{Key: "status", Value: query.Status})
	}
	if query.SubmissionID != "" {
		filter = append(filter, bson.E{Key: "submissionId", Value: query.SubmissionID})
	}
	filter, err := cursorFilter(filter, query.Cursor)
	if err != nil {
		return List[Earning]{}, err
	}
	limit := listLimit(query.Limit)
	cursor, err := s.collection(earningsCollection).Find(ctx, filter,
		options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(int64(limit+1)))
	if err != nil {
		return List[Earning]{}, err
	}
	earnings := []Earning{}
	if err := cursor.All(ctx, &earnings); err != nil {
		return List[Earning]{}, err
	}
	next := ""
	if len(earnings) > limit {
		earnings = earnings[:limit]
		next = earnings[len(earnings)-1].ObjectID.Hex()
	}
	for i := range earnings {
		earnings[i].fill()
	}
	return List[Earning]{Data: earnings, NextCursor: next}, nil
}

// Balance sums every earning the scout has.
func (s *Store) Balance(ctx context.Context, userID string) (Balance, error) {
	if err := s.releaseDue(ctx); err != nil {
		return Balance{}, err
	}
	all, err := s.allEarnings(ctx, bson.D{{Key: "scoutUserId", Value: userID}})
	if err != nil {
		return Balance{}, err
	}
	return ComputeBalance(all), nil
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

// ListPayouts pages a scout's payouts newest first.
func (s *Store) ListPayouts(ctx context.Context, userID string, cursorValue string, limit int) (List[Payout], error) {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.listPayouts(userID, cursorValue, limit)
	}
	filter, err := cursorFilter(bson.D{{Key: "scoutUserId", Value: userID}}, cursorValue)
	if err != nil {
		return List[Payout]{}, err
	}
	limit = listLimit(limit)
	cursor, err := s.collection(payoutsCollection).Find(ctx, filter,
		options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(int64(limit+1)))
	if err != nil {
		return List[Payout]{}, err
	}
	payouts := []Payout{}
	if err := cursor.All(ctx, &payouts); err != nil {
		return List[Payout]{}, err
	}
	next := ""
	if len(payouts) > limit {
		payouts = payouts[:limit]
		next = payouts[len(payouts)-1].ObjectID.Hex()
	}
	for i := range payouts {
		payouts[i].fill()
	}
	return List[Payout]{Data: payouts, NextCursor: next}, nil
}

// RequestPayout locks every released earning into one payout for staff to send.
func (s *Store) RequestPayout(ctx context.Context, userID string) (Payout, error) {
	s.payoutMu.Lock()
	defer s.payoutMu.Unlock()

	profile, err := s.EnsureProfile(ctx, userID)
	if err != nil {
		return Payout{}, err
	}
	if err := s.releaseDue(ctx); err != nil {
		return Payout{}, err
	}
	released, err := s.allEarnings(ctx, bson.D{{Key: "scoutUserId", Value: userID}, {Key: "status", Value: EarningReleased}})
	if err != nil {
		return Payout{}, err
	}
	paid, err := s.hasPaidPayout(ctx, userID)
	if err != nil {
		return Payout{}, err
	}
	if err := wrapPayoutIdentity(FirstPayoutIdentityError(profile, paid)); err != nil {
		return Payout{}, err
	}
	if err := s.gateTaxScreening(ctx, userID, &profile); err != nil {
		return Payout{}, err
	}
	var total int64
	ids := make([]bson.ObjectID, 0, len(released))
	hexes := make([]string, 0, len(released))
	for _, earning := range released {
		total += earning.Amount.AmountCents
		ids = append(ids, earning.ObjectID)
		hexes = append(hexes, earning.ID)
	}
	if readiness := CheckPayout(profile, total, paid); !readiness.Ready {
		return Payout{}, fmt.Errorf("%w: %s", ErrPayoutBlocked, readiness.Blockers[0])
	}
	now := s.now().UTC()
	payout := Payout{
		ObjectID:    bson.NewObjectID(),
		ScoutUserID: userID,
		Amount:      cents(total),
		Method:      *profile.PayoutMethod,
		EarningIDs:  hexes,
		Status:      PayoutRequested,
		RequestedAt: now,
	}
	if err := s.insertPayout(ctx, payout); err != nil {
		return Payout{}, err
	}
	if err := s.markEarningsProcessing(ctx, ids, payout.ObjectID.Hex()); err != nil {
		return Payout{}, err
	}
	payout.fill()
	s.notify(ctx, userID, notice{kind: kindPayout, tone: toneAccent, title: "Payout requested", body: formatMoney(payout.Amount) + " to " + payout.Method.Label + " is being processed.", subjectID: payout.ID})
	return payout, nil
}

func (s *Store) payout(ctx context.Context, id string) (Payout, error) {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.payout(id)
	}
	oid, err := objectID(id)
	if err != nil {
		return Payout{}, err
	}
	var payout Payout
	err = s.collection(payoutsCollection).FindOne(ctx, bson.D{{Key: "_id", Value: oid}}).Decode(&payout)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Payout{}, ErrNotFound
	}
	if err != nil {
		return Payout{}, err
	}
	payout.fill()
	return payout, nil
}

func formatMoney(m Money) string {
	return fmt.Sprintf("$%d.%02d", m.AmountCents/100, m.AmountCents%100)
}

func (s *Store) hasPaidPayout(ctx context.Context, userID string) (bool, error) {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.hasPaidPayout(userID), nil
	}
	n, err := s.collection(payoutsCollection).CountDocuments(ctx, bson.D{
		{Key: "scoutUserId", Value: userID},
		{Key: "status", Value: PayoutPaid},
	})
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

func (s *Store) insertPayout(ctx context.Context, payout Payout) error {
	if mem, ok := s.docs.(*memDocs); ok {
		mem.insertPayout(payout)
		return nil
	}
	_, err := s.collection(payoutsCollection).InsertOne(ctx, payout)
	return err
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

func (s *Store) finishPayout(ctx context.Context, payout Payout, status, note string, now time.Time) error {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.finishPayout(payout.ID, status, note, now)
	}
	_, err := s.collection(payoutsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: payout.ObjectID}}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "status", Value: status},
		{Key: "note", Value: note},
		{Key: "decidedAt", Value: now},
	}}})
	return err
}
