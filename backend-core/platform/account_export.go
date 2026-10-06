package platform

import (
	"context"
	"errors"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/billing"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/savedsearch"
)

// Collector reads the rows a Joined account owns. It does not call Stripe and
// does not read Scout payout collections.
type Collector struct {
	People   *candidate.Store
	Searches savedsearch.Store
	Billing  billing.Store
}

// Collect implements auth.AccountSource.
func (c Collector) Collect(ctx context.Context, user auth.User, now time.Time) (auth.AccountExport, error) {
	bundle := auth.EmptyExport(user, now)
	if c.People != nil {
		snap, err := c.People.ExportUser(ctx, user.ID)
		if err != nil {
			return auth.AccountExport{}, err
		}
		if snap.Profile != nil {
			bundle.Profile = snap.Profile
		}
		bundle.Resumes = snap.Resumes
		bundle.SavedJobs = snap.SavedJobs
		bundle.Applications = snap.Applications
		bundle.Interviews = snap.Interviews
		bundle.Calendar = snap.Calendar
		bundle.Messages = snap.Messages
	}
	if c.Searches != nil {
		items, err := c.Searches.ListByUser(ctx, user.ID)
		if err != nil {
			return auth.AccountExport{}, err
		}
		if items == nil {
			items = []savedsearch.SavedSearch{}
		}
		bundle.SavedSearches = items
	}
	if c.Billing != nil {
		tx, err := billingSnapshot(ctx, c.Billing, user.ID)
		if err != nil {
			return auth.AccountExport{}, err
		}
		bundle.Transactions = tx
	}
	return bundle, nil
}

type billingSnapshotBody struct {
	CustomerID       string    `json:"customerId,omitempty"`
	SubscriptionID   string    `json:"subscriptionId,omitempty"`
	Status           string    `json:"status,omitempty"`
	Plan             string    `json:"plan,omitempty"`
	CurrentPeriodEnd time.Time `json:"currentPeriodEnd,omitempty"`
}

func billingSnapshot(ctx context.Context, store billing.Store, userID string) (billingSnapshotBody, error) {
	var out billingSnapshotBody
	customerID, err := store.CustomerID(ctx, userID)
	if err != nil && !errors.Is(err, billing.ErrNotFound) {
		return out, err
	}
	out.CustomerID = customerID
	sub, err := store.SubscriptionByUser(ctx, userID)
	if err != nil && !errors.Is(err, billing.ErrNotFound) {
		return out, err
	}
	if err == nil {
		out.SubscriptionID = sub.StripeSubscriptionID
		out.Status = sub.Status
		out.Plan = string(sub.Plan)
		out.CurrentPeriodEnd = sub.CurrentPeriodEnd
	}
	return out, nil
}
