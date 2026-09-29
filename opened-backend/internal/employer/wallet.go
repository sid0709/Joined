package employer

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func (s *Store) Billing(ctx context.Context, companyID string) (Billing, error) {
	wallet, err := s.wallet(ctx, companyID)
	if err != nil {
		return Billing{}, err
	}
	events, purchases, err := s.ledger(ctx, companyID)
	if err != nil {
		return Billing{}, err
	}
	return Billing{
		Plan:                   PlanPayPerInterview,
		PricePerInterviewCents: InterviewPriceCents,
		BalanceCents:           wallet.BalanceCents,
		PurchasedCents:         wallet.PurchasedCents,
		SpentCents:             wallet.SpentCents,
		Currency:               wallet.Currency,
		Events:                 events,
		Purchases:              purchases,
	}, nil
}

func (s *Store) Purchase(ctx context.Context, companyID string, amountCents int, actor Actor, now time.Time) (Billing, error) {
	if err := validatePurchase(amountCents); err != nil {
		return Billing{}, err
	}
	wallet, err := s.credit(ctx, companyID, amountCents, amountCents, 0, now)
	if err != nil {
		return Billing{}, err
	}
	if err := s.appendLedger(ctx, storedLedger{
		CompanyID:    companyID,
		Kind:         ledgerPurchase,
		AmountCents:  amountCents,
		BalanceAfter: wallet.BalanceCents,
		Note:         "Purchase",
		CreatedAt:    now.UTC(),
	}); err != nil {
		return Billing{}, err
	}
	if err := s.record(ctx, companyID, "Purchase added", "Balance updated", "success", now); err != nil {
		return Billing{}, err
	}
	if err := s.writeAudit(ctx, companyID, actor, AuditEvent{
		Action:      AuditBillingPurchased,
		SubjectType: subjectBilling,
		SubjectID:   companyID,
		Summary:     "Purchased balance",
		After:       map[string]any{"amountCents": amountCents},
	}, now); err != nil {
		return Billing{}, err
	}
	return s.Billing(ctx, companyID)
}

func (s *Store) returnInterview(ctx context.Context, companyID, candidate, jobID, jobTitle, interviewID string, amount int, now time.Time) error {
	if amount <= 0 {
		return nil
	}
	wallet, err := s.credit(ctx, companyID, amount, 0, -amount, now)
	if err != nil {
		return err
	}
	return s.appendLedger(ctx, storedLedger{
		CompanyID:    companyID,
		Kind:         ledgerRefund,
		AmountCents:  amount,
		BalanceAfter: wallet.BalanceCents,
		Candidate:    candidate,
		JobID:        jobID,
		JobTitle:     jobTitle,
		InterviewID:  interviewID,
		Note:         "No-show, returned",
		CreatedAt:    now.UTC(),
	})
}

func (s *Store) wallet(ctx context.Context, companyID string) (Wallet, error) {
	var doc storedWallet
	err := s.collection(walletsCollection).FindOne(ctx, bson.D{{Key: "companyId", Value: companyID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return emptyWallet(), nil
	}
	if err != nil {
		return Wallet{}, err
	}
	return normalizeWallet(Wallet{
		BalanceCents:   doc.BalanceCents,
		PurchasedCents: doc.PurchasedCents,
		SpentCents:     doc.SpentCents,
		Currency:       doc.Currency,
	}), nil
}

func (s *Store) debit(ctx context.Context, companyID string, amount int, now time.Time) (Wallet, error) {
	result, err := s.collection(walletsCollection).UpdateOne(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "balanceCents", Value: bson.D{{Key: "$gte", Value: amount}}},
	}, bson.D{
		{Key: "$inc", Value: bson.D{{Key: "balanceCents", Value: -amount}, {Key: "spentCents", Value: amount}}},
		{Key: "$set", Value: bson.D{{Key: "updatedAt", Value: now.UTC()}}},
	})
	if err != nil {
		return Wallet{}, err
	}
	if result.MatchedCount == 0 {
		return Wallet{}, ErrInsufficient
	}
	return s.wallet(ctx, companyID)
}

func (s *Store) credit(ctx context.Context, companyID string, balance, purchased, spent int, now time.Time) (Wallet, error) {
	_, err := s.collection(walletsCollection).UpdateOne(ctx, bson.D{{Key: "companyId", Value: companyID}}, bson.D{
		{Key: "$inc", Value: bson.D{
			{Key: "balanceCents", Value: balance},
			{Key: "purchasedCents", Value: purchased},
			{Key: "spentCents", Value: spent},
		}},
		{Key: "$set", Value: bson.D{{Key: "currency", Value: CurrencyUSD}, {Key: "updatedAt", Value: now.UTC()}}},
	}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return Wallet{}, err
	}
	return s.wallet(ctx, companyID)
}

func (s *Store) appendLedger(ctx context.Context, entry storedLedger) error {
	id, err := newID()
	if err != nil {
		return err
	}
	entry.ID = id
	if entry.CreatedAt.IsZero() {
		entry.CreatedAt = time.Now().UTC()
	}
	_, err = s.collection(ledgerCollection).InsertOne(ctx, entry)
	return err
}

func (s *Store) ledger(ctx context.Context, companyID string) ([]BillingEvent, []Purchase, error) {
	cursor, err := s.collection(ledgerCollection).Find(ctx, bson.D{{Key: "companyId", Value: companyID}}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(100))
	if err != nil {
		return nil, nil, err
	}
	defer cursor.Close(ctx)
	var docs []storedLedger
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, nil, err
	}
	events := []BillingEvent{}
	purchases := []Purchase{}
	for _, doc := range docs {
		switch doc.Kind {
		case ledgerPurchase:
			purchases = append(purchases, Purchase{ID: doc.ID, Date: doc.CreatedAt, AmountCents: doc.AmountCents})
		case ledgerInterview:
			events = append(events, BillingEvent{
				ID: doc.ID, Date: doc.CreatedAt, Candidate: doc.Candidate, JobID: doc.JobID, JobTitle: doc.JobTitle,
				AmountCents: -doc.AmountCents, Status: "billed", Note: doc.Note,
			})
		case ledgerRefund:
			events = append(events, BillingEvent{
				ID: doc.ID, Date: doc.CreatedAt, Candidate: doc.Candidate, JobID: doc.JobID, JobTitle: doc.JobTitle,
				AmountCents: 0, Status: "waived", Note: doc.Note,
			})
		}
	}
	return events, purchases, nil
}
