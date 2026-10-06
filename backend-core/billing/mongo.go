package billing

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	customersCollection     = "billing_customers"
	subscriptionsCollection = "subscriptions"
)

// MongoStore persists billing records in MongoDB. Ravi constructs this when
// wiring joined-backend; tests use MemoryStore.
type MongoStore struct {
	client *mongo.Client
	db     string
	now    func() time.Time
}

// NewMongoStore creates a Mongo-backed billing store.
func NewMongoStore(client *mongo.Client, db string) *MongoStore {
	return &MongoStore{client: client, db: db, now: time.Now}
}

func (s *MongoStore) customers() *mongo.Collection {
	return s.client.Database(s.db).Collection(customersCollection)
}

func (s *MongoStore) subscriptions() *mongo.Collection {
	return s.client.Database(s.db).Collection(subscriptionsCollection)
}

func (s *MongoStore) UpsertCustomer(ctx context.Context, userID, customerID string) error {
	if userID == "" || customerID == "" {
		return ErrMissingUserID
	}
	_, err := s.customers().UpdateOne(ctx,
		bson.D{{Key: "user_id", Value: userID}},
		bson.D{{Key: "$set", Value: bson.D{
			{Key: "user_id", Value: userID},
			{Key: "stripe_customer_id", Value: customerID},
		}}},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		return fmt.Errorf("upsert customer: %w", err)
	}
	return nil
}

func (s *MongoStore) CustomerID(ctx context.Context, userID string) (string, error) {
	var rec storedCustomer
	err := s.customers().FindOne(ctx, bson.D{{Key: "user_id", Value: userID}}).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("load customer: %w", err)
	}
	return rec.StripeCustomerID, nil
}

func (s *MongoStore) UserIDByCustomer(ctx context.Context, customerID string) (string, error) {
	var rec storedCustomer
	err := s.customers().FindOne(ctx, bson.D{{Key: "stripe_customer_id", Value: customerID}}).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("load user by customer: %w", err)
	}
	return rec.UserID, nil
}

func (s *MongoStore) UpsertSubscription(ctx context.Context, sub Subscription) error {
	existing := Subscription{}
	if sub.StripeSubscriptionID != "" {
		found, err := s.subscriptionByID(ctx, sub.StripeSubscriptionID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return err
		}
		if err == nil {
			existing = found
		}
	} else if sub.UserID != "" {
		found, err := s.SubscriptionByUser(ctx, sub.UserID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return err
		}
		if err == nil {
			existing = found
		}
	}
	sub = mergeSubscription(existing, sub)
	if sub.UpdatedAt.IsZero() {
		sub.UpdatedAt = s.now().UTC()
	}
	filter := bson.D{{Key: "stripe_subscription_id", Value: sub.StripeSubscriptionID}}
	if sub.StripeSubscriptionID == "" {
		filter = bson.D{{Key: "user_id", Value: sub.UserID}}
	}
	_, err := s.subscriptions().UpdateOne(ctx, filter,
		bson.D{{Key: "$set", Value: storedSubscription{
			UserID:               sub.UserID,
			StripeCustomerID:     sub.StripeCustomerID,
			StripeSubscriptionID: sub.StripeSubscriptionID,
			Status:               sub.Status,
			Plan:                 string(sub.Plan),
			Product:              sub.Product,
			RefundedCents:        sub.RefundedCents,
			CurrentPeriodEnd:     sub.CurrentPeriodEnd,
			UpdatedAt:            sub.UpdatedAt,
		}}},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		return fmt.Errorf("upsert subscription: %w", err)
	}
	return nil
}

func (s *MongoStore) SubscriptionByUser(ctx context.Context, userID string) (Subscription, error) {
	var rec storedSubscription
	err := s.subscriptions().FindOne(ctx, bson.D{{Key: "user_id", Value: userID}}).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Subscription{}, ErrNotFound
	}
	if err != nil {
		return Subscription{}, fmt.Errorf("load subscription: %w", err)
	}
	return rec.toSubscription(), nil
}

func (s *MongoStore) subscriptionByID(ctx context.Context, subscriptionID string) (Subscription, error) {
	var rec storedSubscription
	err := s.subscriptions().FindOne(ctx, bson.D{{Key: "stripe_subscription_id", Value: subscriptionID}}).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Subscription{}, ErrNotFound
	}
	if err != nil {
		return Subscription{}, fmt.Errorf("load subscription by id: %w", err)
	}
	return rec.toSubscription(), nil
}

type storedCustomer struct {
	UserID           string `bson:"user_id"`
	StripeCustomerID string `bson:"stripe_customer_id"`
}

type storedSubscription struct {
	UserID               string    `bson:"user_id"`
	StripeCustomerID     string    `bson:"stripe_customer_id"`
	StripeSubscriptionID string    `bson:"stripe_subscription_id"`
	Status               string    `bson:"status"`
	Plan                 string    `bson:"plan"`
	Product              string    `bson:"product,omitempty"`
	RefundedCents        int64     `bson:"refunded_cents,omitempty"`
	CurrentPeriodEnd     time.Time `bson:"current_period_end"`
	UpdatedAt            time.Time `bson:"updated_at"`
}

func (s storedSubscription) toSubscription() Subscription {
	return Subscription{
		UserID:               s.UserID,
		StripeCustomerID:     s.StripeCustomerID,
		StripeSubscriptionID: s.StripeSubscriptionID,
		Status:               s.Status,
		Plan:                 Plan(s.Plan),
		Product:              s.Product,
		RefundedCents:        s.RefundedCents,
		CurrentPeriodEnd:     s.CurrentPeriodEnd,
		UpdatedAt:            s.UpdatedAt,
	}
}
