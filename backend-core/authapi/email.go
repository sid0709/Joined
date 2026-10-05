package authapi

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

// EmailAuth handles email authentication routes.
type EmailAuth struct {
	Sender auth.EmailSender
}

func (e *EmailAuth) configured() bool {
	return e != nil && e.Sender != nil
}

// signup creates a new account with email and password.
func (h Handlers) signup(w http.ResponseWriter, r *http.Request) {
	if !h.Email.configured() {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "email sign-up is not available")
		return
	}

	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
		Role     string `json:"role,omitempty"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}

	// Determine role: use requested role if allowed by this audience, otherwise default
	role := body.Role
	if role == "" || !auth.AllowsAudience(h.Audience, role) {
		// Default role for Joined audience
		if h.Audience == auth.AudienceJoined {
			role = auth.RoleCandidate
		} else {
			role = auth.RoleScout
		}
	}

	now := time.Now()
	userID, err := h.Accounts.EmailSignup(r.Context(), body.Email, body.Password, body.Name, role, now)
	if errors.Is(err, auth.ErrEmailTaken) {
		httpkit.WriteError(w, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, auth.ErrInvalidInput) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, auth.ErrWeakPassword) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		slog.Error("email signup", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	// Create verification token
	token, err := h.Accounts.CreateVerificationToken(r.Context(), userID, now)
	if err != nil {
		slog.Error("create verification token", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	// Send verification email
	if err := h.Email.Sender.SendVerification(r.Context(), body.Email, body.Name, token); err != nil {
		slog.Error("send verification email", "error", err)
	}

	httpkit.WriteJSON(w, http.StatusCreated, map[string]string{
		"message": "Account created. Please check your email to verify your account.",
	})
}

// verifyEmail verifies an email address using a token.
func (h Handlers) verifyEmail(w http.ResponseWriter, r *http.Request) {
	if !h.Email.configured() {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "email verification is not available")
		return
	}

	var body struct {
		Token string `json:"token"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}

	err := h.Accounts.VerifyEmail(r.Context(), body.Token, time.Now())
	if errors.Is(err, auth.ErrInvalidToken) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, auth.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "account not found")
		return
	}
	if err != nil {
		slog.Error("verify email", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not verify email")
		return
	}

	httpkit.WriteJSON(w, http.StatusOK, map[string]string{
		"message": "Email verified successfully. You can now sign in.",
	})
}

// emailSignin signs in with email and password.
func (h Handlers) emailSignin(w http.ResponseWriter, r *http.Request) {
	if !h.Email.configured() {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "email sign-in is not available")
		return
	}

	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}

	token, session, err := h.Accounts.EmailSignin(r.Context(), body.Email, body.Password, h.Audience, time.Now())
	if errors.Is(err, auth.ErrEmailNotVerified) {
		httpkit.WriteError(w, http.StatusForbidden, err.Error())
		return
	}
	if errors.Is(err, auth.ErrAccountLocked) {
		httpkit.WriteError(w, http.StatusTooManyRequests, err.Error())
		return
	}
	writeAuthResult(w, token, session, err)
}

// requestPasswordReset sends a password reset email.
func (h Handlers) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	if !h.Email.configured() {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "password reset is not available")
		return
	}

	var body struct {
		Email string `json:"email"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}

	token, err := h.Accounts.RequestPasswordReset(r.Context(), body.Email, time.Now())
	if err != nil {
		slog.Error("request password reset", "error", err)
		// Don't reveal whether email exists
		httpkit.WriteJSON(w, http.StatusOK, map[string]string{
			"message": "If that email is registered, a password reset link has been sent.",
		})
		return
	}

	// If token is empty, email doesn't exist, but we don't reveal that
	if token != "" {
		// Look up user to get their name
		// We need to query the user by email to get the name
		var userName string
		// This is a simple approach - in production you might want to return name from RequestPasswordReset
		if err := h.Email.Sender.SendPasswordReset(r.Context(), body.Email, userName, token); err != nil {
			slog.Error("send password reset email", "error", err)
		}
	}

	httpkit.WriteJSON(w, http.StatusOK, map[string]string{
		"message": "If that email is registered, a password reset link has been sent.",
	})
}

// resetPassword changes the password using a reset token.
func (h Handlers) resetPassword(w http.ResponseWriter, r *http.Request) {
	if !h.Email.configured() {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "password reset is not available")
		return
	}

	var body struct {
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}

	err := h.Accounts.ResetPassword(r.Context(), body.Token, body.NewPassword, time.Now())
	if errors.Is(err, auth.ErrInvalidToken) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, auth.ErrInvalidInput) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, auth.ErrWeakPassword) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, auth.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "account not found")
		return
	}
	if err != nil {
		slog.Error("reset password", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not reset password")
		return
	}

	httpkit.WriteJSON(w, http.StatusOK, map[string]string{
		"message": "Password has been reset successfully. Please sign in with your new password.",
	})
}
