package billing

import (
	"errors"
	"time"
)

const (
	// WebhookPath is the public Stripe webhook route Ravi mounts in joined-backend.
	WebhookPath = "/v1/webhooks/stripe"

	PlanMonthly Plan = "monthly"
	PlanYearly  Plan = "yearly"

	StatusActive            SubscriptionStatus = "active"
	StatusTrialing          SubscriptionStatus = "trialing"
	StatusPastDue           SubscriptionStatus = "past_due"
	StatusCanceled          SubscriptionStatus = "canceled"
	StatusUnpaid            SubscriptionStatus = "unpaid"
	StatusIncomplete        SubscriptionStatus = "incomplete"
	StatusIncompleteExpired SubscriptionStatus = "incomplete_expired"

	EventCheckoutSessionCompleted = "checkout.session.completed"
	EventSubscriptionCreated      = "customer.subscription.created"
	EventSubscriptionUpdated      = "customer.subscription.updated"
	EventSubscriptionDeleted      = "customer.subscription.deleted"

	metadataUserIDKey         = "joined_user_id"
	metadataPlanKey           = "plan"
	metadataProductKey        = "product"
	checkoutModeSubscription  = "subscription"
	checkoutLineQuantity      = 1
	customerIdempotencyPrefix = "customer_user_"
	redirectSchemeHTTP        = "http"
	redirectSchemeHTTPS       = "https"
)

// Plan is a Joined Premium billing interval.
type Plan string

// SubscriptionStatus is a Stripe subscription status we persist.
type SubscriptionStatus string

// Subscription is the Premium record kept for a Joined user.
type Subscription struct {
	UserID               string
	StripeCustomerID     string
	StripeSubscriptionID string
	Status               string
	Plan                 Plan
	// Product is joined_premium or acorn_pro. Empty means a Joined Premium row
	// written before Acorn prices existed.
	Product          string
	CurrentPeriodEnd time.Time
	UpdatedAt        time.Time
}

var (
	ErrNotFound      = errors.New("not found")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrInvalidPlan   = errors.New("invalid plan")
	ErrInvalidURL    = errors.New("invalid redirect url")
	ErrNoCustomer    = errors.New("no stripe customer")
	ErrInvalidEvent  = errors.New("invalid webhook event")
	ErrMissingUserID = errors.New("missing joined user id")
)

// ParsePlan accepts monthly or yearly.
func ParsePlan(value string) (Plan, error) {
	switch Plan(value) {
	case PlanMonthly:
		return PlanMonthly, nil
	case PlanYearly:
		return PlanYearly, nil
	default:
		return "", ErrInvalidPlan
	}
}

func checkoutLookupKey(product string, plan Plan) (string, string, error) {
	switch product {
	case "", ProductPremium:
		key, err := planLookupKey(plan)
		if err != nil {
			return "", "", err
		}
		return premiumProductLookupKey, key, nil
	case ProductAcorn:
		switch plan {
		case PlanMonthly:
			return acornProductLookupKey, acornMonthlyPriceLookupKey, nil
		case PlanYearly:
			return acornProductLookupKey, acornYearlyPriceLookupKey, nil
		default:
			return "", "", ErrInvalidPlan
		}
	default:
		return "", "", ErrInvalidPlan
	}
}

func planLookupKey(plan Plan) (string, error) {
	switch plan {
	case PlanMonthly:
		return monthlyPriceLookupKey, nil
	case PlanYearly:
		return yearlyPriceLookupKey, nil
	default:
		return "", ErrInvalidPlan
	}
}

func planFromLookupKey(lookupKey, interval string) Plan {
	switch lookupKey {
	case monthlyPriceLookupKey:
		return PlanMonthly
	case yearlyPriceLookupKey:
		return PlanYearly
	}
	switch interval {
	case "month":
		return PlanMonthly
	case "year":
		return PlanYearly
	default:
		return ""
	}
}

func parsePlanMetadata(value string) Plan {
	plan, err := ParsePlan(value)
	if err != nil {
		return ""
	}
	return plan
}

// IsPremium reports whether the subscription currently grants Joined Premium.
// An Acorn purchase never does, even when the status is active.
func (s Subscription) IsPremium(now time.Time) bool {
	if s.Product != "" && s.Product != premiumProductLookupKey {
		return false
	}
	switch SubscriptionStatus(s.Status) {
	case StatusActive, StatusTrialing, StatusPastDue:
		return true
	case StatusCanceled:
		return !s.CurrentPeriodEnd.IsZero() && now.Before(s.CurrentPeriodEnd)
	case StatusUnpaid, StatusIncomplete, StatusIncompleteExpired:
		return false
	default:
		return false
	}
}
