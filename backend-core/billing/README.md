# billing

Stripe billing for Joined Premium subscriptions. Test mode only unless explicitly enabled.

## Environment variables

### Required

- `STRIPE_SECRET_KEY` — Stripe API key (`sk_test_...` or `sk_live_...`). Live keys require `STRIPE_ALLOW_LIVE=true`.
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret from Stripe dashboard (`whsec_...`).

### Optional

- `STRIPE_ALLOW_LIVE` — Set to `true` to permit live keys. Default: `false`.
- `PREMIUM_MONTHLY_PRICE_CENTS` — Monthly Premium price in cents. Default: `2900` ($29).
- `PREMIUM_YEARLY_PRICE_CENTS` — Yearly Premium price in cents. Default: `29000` ($290).

## Usage

### Configuration

```go
cfg, err := billing.LoadConfig()
if err != nil {
    log.Fatal(err)
}
```

The config loader refuses to start with a live key unless `STRIPE_ALLOW_LIVE=true` is explicitly set.

### Product sync

Idempotently create or update the Joined Premium product and prices:

```go
client := billing.NewHTTPClient(cfg.SecretKey)
if err := billing.SyncProducts(ctx, client, cfg); err != nil {
    log.Fatal(err)
}
```

Products and prices are identified by metadata lookup keys. Running sync multiple times is safe.

### Webhooks

Mount the webhook handler in your HTTP service:

```go
store := billing.NewMemoryIdempotencyStore()
router := billing.NewWebhookRouter(cfg.WebhookSecret, store)
http.Handle("/stripe/webhook", router)
```

Supported events (handlers are stubs):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The router verifies signatures, enforces idempotency, and routes events to handlers.

## Testing

All tests use a fake client; no network calls to Stripe.

```bash
cd backend-core/billing
go test -v
```

## Integration

This package does not wire into any service routes. To integrate:

1. Add billing config load to your service's startup.
2. Call `SyncProducts` on boot or via admin endpoint.
3. Mount the webhook router at a public path (e.g., `/stripe/webhook`).
4. Configure the webhook URL in Stripe dashboard.

Checkout and billing page implementation will come in a later step.
