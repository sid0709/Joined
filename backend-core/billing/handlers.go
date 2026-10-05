package billing

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

const (
	// CheckoutPath is the Premium Checkout route to mount in joined-backend.
	CheckoutPath = "POST /v1/me/billing/checkout"
	// PortalPath is the customer-portal route to mount in joined-backend.
	PortalPath = "POST /v1/me/billing/portal"
	// SubscriptionPath is the Premium status route to mount in joined-backend.
	SubscriptionPath = "GET /v1/me/billing/subscription"
)

// CurrentUser resolves the signed-in Joined user for billing HTTP handlers.
// Ravi supplies this from the joined-backend session. Return ErrUnauthorized
// when the request has no session.
type CurrentUser func(*http.Request) (userID, email string, err error)

// Handlers expose checkout, portal, and Premium status over HTTP.
//
// Ravi: mount in joined-backend/internal/httpapi/server.go next to the other
// /v1/me routes. Do not add these routes outside billing without that wiring:
//
//	svc := billing.NewService(billing.NewHTTPClient(cfg.SecretKey), store, cfg)
//	router := billing.NewWebhookRouter(cfg.WebhookSecret, events)
//	router.UseService(svc)
//	mux.Handle("POST "+billing.WebhookPath, router)
//	billing.Handlers{Service: svc, CurrentUser: sessionUser}.Register(mux)
type Handlers struct {
	Service     *Service
	CurrentUser CurrentUser
}

// Register mounts checkout, portal, and subscription reads on mux.
func (h Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc(CheckoutPath, h.postCheckout)
	mux.HandleFunc(PortalPath, h.postPortal)
	mux.HandleFunc(SubscriptionPath, h.getSubscription)
}

type checkoutRequestBody struct {
	Plan       string `json:"plan"`
	SuccessURL string `json:"success_url"`
	CancelURL  string `json:"cancel_url"`
}

type portalRequestBody struct {
	ReturnURL string `json:"return_url"`
}

type sessionURLResponse struct {
	URL string `json:"url"`
}

type subscriptionResponse struct {
	Premium          bool   `json:"premium"`
	Status           string `json:"status,omitempty"`
	Plan             string `json:"plan,omitempty"`
	CurrentPeriodEnd string `json:"current_period_end,omitempty"`
}

func (h Handlers) postCheckout(w http.ResponseWriter, r *http.Request) {
	userID, email, ok := h.user(w, r)
	if !ok {
		return
	}
	var body checkoutRequestBody
	if err := decodeJSONBody(r, &body); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid json")
		return
	}
	session, err := h.Service.CreateCheckoutSession(r.Context(), CheckoutParams{
		UserID:     userID,
		Email:      email,
		Plan:       body.Plan,
		SuccessURL: body.SuccessURL,
		CancelURL:  body.CancelURL,
	})
	if err != nil {
		writeBillingError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, sessionURLResponse{URL: session.URL})
}

func (h Handlers) postPortal(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := h.user(w, r)
	if !ok {
		return
	}
	var body portalRequestBody
	if err := decodeJSONBody(r, &body); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid json")
		return
	}
	session, err := h.Service.CreatePortalSession(r.Context(), PortalParams{
		UserID:    userID,
		ReturnURL: body.ReturnURL,
	})
	if err != nil {
		writeBillingError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, sessionURLResponse{URL: session.URL})
}

func (h Handlers) getSubscription(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := h.user(w, r)
	if !ok {
		return
	}
	premium, err := h.Service.IsPremium(r.Context(), userID)
	if err != nil {
		writeBillingError(w, err)
		return
	}
	resp := subscriptionResponse{Premium: premium}
	sub, err := h.Service.Store.SubscriptionByUser(r.Context(), userID)
	if err == nil {
		resp.Status = sub.Status
		resp.Plan = string(sub.Plan)
		if !sub.CurrentPeriodEnd.IsZero() {
			resp.CurrentPeriodEnd = sub.CurrentPeriodEnd.UTC().Format(time.RFC3339)
		}
	} else if !errors.Is(err, ErrNotFound) {
		writeBillingError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, resp)
}

func (h Handlers) user(w http.ResponseWriter, r *http.Request) (userID, email string, ok bool) {
	if h.CurrentUser == nil {
		httpkit.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return "", "", false
	}
	userID, email, err := h.CurrentUser(r)
	if err != nil {
		status := http.StatusUnauthorized
		if !errors.Is(err, ErrUnauthorized) {
			status = http.StatusInternalServerError
		}
		httpkit.WriteError(w, status, "unauthorized")
		return "", "", false
	}
	if userID == "" {
		httpkit.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return "", "", false
	}
	return userID, email, true
}

func decodeJSONBody(r *http.Request, dest any) error {
	defer r.Body.Close()
	limited := io.LimitReader(r.Body, httpkit.MaxWriteBody)
	dec := json.NewDecoder(limited)
	if err := dec.Decode(dest); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		return err
	}
	return nil
}

func writeBillingError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrUnauthorized):
		httpkit.WriteError(w, http.StatusUnauthorized, "unauthorized")
	case errors.Is(err, ErrInvalidPlan), errors.Is(err, ErrInvalidURL), errors.Is(err, ErrMissingUserID):
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrNoCustomer), errors.Is(err, ErrNotFound):
		httpkit.WriteError(w, http.StatusNotFound, err.Error())
	default:
		httpkit.WriteError(w, http.StatusInternalServerError, "billing error")
	}
}
