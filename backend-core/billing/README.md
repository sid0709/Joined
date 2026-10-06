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
- `ACORN_MONTHLY_PRICE_CENTS` — Acorn Pro monthly price in cents. Default: `1900` ($19).
- `ACORN_YEARLY_PRICE_CENTS` — Acorn Pro yearly price in cents. Default: `18000` ($180, the former website’s $15/month billed yearly).
- `BILLING_CHECKOUT_SUCCESS_URL` — Default Checkout success redirect when the request omits `success_url`.
- `BILLING_CHECKOUT_CANCEL_URL` — Default Checkout cancel redirect when the request omits `cancel_url`.
- `BILLING_PORTAL_RETURN_URL` — Default customer-portal return URL when the request omits `return_url`.

## Package entry points

Leo (frontend) and Ravi (joined-backend) should use these names. This package does not mount routes itself.

| Function / type                    | Purpose                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `LoadConfig`                       | Env + live-key guard                                              |
| `NewHTTPClient` / `Client`         | Stripe seam (tests use `NewFakeClient`)                           |
| `SyncProducts`                     | Idempotent Premium catalog, plus Acorn Pro when its cents are set |
| `NewService`                       | Checkout, portal, customer mapping, `IsPremium`                   |
| `Service.CreateCheckoutSession`    | Start monthly or yearly Checkout (`CheckoutParams`)               |
| `Service.CreatePortalSession`      | Start the Stripe customer portal (`PortalParams`)                 |
| `Service.EnsureCustomer`           | Map Joined `userID` ↔ Stripe customer                             |
| `Service.IsPremium`                | `IsPremium(ctx, userID)` for other services                       |
| `NewMemoryStore` / `NewMongoStore` | Persist customers + `subscriptions`                               |
| `NewWebhookRouter` + `UseService`  | Signed webhook router; persists on checkout/subscription events   |
| `Handlers.Register`                | Optional HTTP: checkout, portal, subscription status              |

Suggested HTTP paths (constants in this package):

- `POST /v1/me/billing/checkout` — body `{ "plan": "monthly"|"yearly", "success_url", "cancel_url" }` → `{ "url" }`
- `POST /v1/me/billing/portal` — body `{ "return_url" }` → `{ "url" }`
- `GET /v1/me/billing/subscription` — `{ "premium", "status", "plan", "current_period_end" }`
- `POST /v1/webhooks/stripe` — Stripe-signed events

## Usage

### Configuration

```go
cfg, err := billing.LoadConfig()
if err != nil {
    log.Fatal(err)
}
```

The config loader refuses to start with a live key unless `STRIPE_ALLOW_LIVE=true` is explicitly set.

### Acorn Pro

Lookup keys: `acorn_pro`, `acorn_pro_monthly`, `acorn_pro_yearly`. `SyncProducts` writes them when `AcornMonthlyPriceCents` or `AcornYearlyPriceCents` is set (`LoadConfig` always sets the defaults). Free and Unlimited are not Stripe products: Free is $0, and Unlimited is still a sample tier.

Checkout sets `Product` to `acorn`. Webhook metadata `product=acorn_pro` is stored on the subscription. `IsPremium` stays false for that product. Joined Premium rows keep an empty product or `joined_premium`.

This repo no longer mounts Acorn HTTP (`acorn-backend` was removed). The Acorn service calls `CreateCheckoutSession` with `Product: billing.ProductAcorn`. Do not write those rows through Joined `/v1/me/billing`.

### Product sync

Idempotently create or update the Joined Premium product and prices:

```go
client := billing.NewHTTPClient(cfg.SecretKey)
if err := billing.SyncProducts(ctx, client, cfg); err != nil {
    log.Fatal(err)
}
```

Products and prices are identified by metadata lookup keys. Running sync multiple times is safe.

### Checkout, portal, and Premium

```go
store := billing.NewMemoryStore() // or billing.NewMongoStore(mongoClient, db)
svc := billing.NewService(client, store, cfg)

session, err := svc.CreateCheckoutSession(ctx, billing.CheckoutParams{
    UserID:     userID,
    Email:      email,
    Plan:       "monthly",
    SuccessURL: successURL,
    CancelURL:  cancelURL,
})
premium, err := svc.IsPremium(ctx, userID)
```

Stripe customers are created with `joined_user_id` metadata and stored locally so later portal sessions and webhooks resolve the same user.

### Webhooks

Mount the webhook handler in your HTTP service:

```go
events := billing.NewMemoryIdempotencyStore()
router := billing.NewWebhookRouter(cfg.WebhookSecret, events)
router.UseService(svc)
http.Handle("POST "+billing.WebhookPath, router)
```

Handled events (idempotent by Stripe event id; subscription upserts merge):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Replaying the same event id is a no-op after the first successful write.

## Testing

All tests use a fake client; no network calls to Stripe.

```bash
cd backend-core/billing
go vet
go test
```

## Integration (Ravi)

This package does not wire into joined-backend. Mount point in `joined-backend/internal/httpapi/server.go` (next to the other `/v1/me` routes):

```go
svc := billing.NewService(billing.NewHTTPClient(cfg.SecretKey), store, cfg)
router := billing.NewWebhookRouter(cfg.WebhookSecret, events)
router.UseService(svc)
mux.Handle("POST "+billing.WebhookPath, router)
billing.Handlers{Service: svc, CurrentUser: sessionUser}.Register(mux)
```

`CurrentUser` should return the signed-in Joined user id (and email) or `billing.ErrUnauthorized`.

Leo can call the `/v1/me/billing/*` routes once they are mounted. Other services should call `Service.IsPremium` rather than talking to Stripe.

Checkout and the billing page UI stay with Leo. Live keys stay off unless `STRIPE_ALLOW_LIVE=true`.
