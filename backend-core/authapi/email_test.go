package authapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
)

type testEmailSender struct {
	verifications    []verificationSent
	resets           []resetSent
	duplicateNotices []string
}

type verificationSent struct {
	to    string
	name  string
	token string
}

type resetSent struct {
	to    string
	name  string
	token string
}

func (t *testEmailSender) SendVerification(ctx context.Context, to, name, token string) error {
	t.verifications = append(t.verifications, verificationSent{to, name, token})
	return nil
}

func (t *testEmailSender) SendPasswordReset(ctx context.Context, to, name, token string) error {
	t.resets = append(t.resets, resetSent{to, name, token})
	return nil
}

func (t *testEmailSender) SendDuplicateSignupNotice(ctx context.Context, to string) error {
	t.duplicateNotices = append(t.duplicateNotices, to)
	return nil
}

// testAccountsStore wraps AuthStore with stubs for handler testing
type testAccountsStore struct {
	auth.AuthStore
}

func newTestAccountsStore() *testAccountsStore {
	return &testAccountsStore{AuthStore: auth.NewMemStore()}
}

// Stub non-AuthStore methods
func (t *testAccountsStore) Signout(ctx context.Context, token string) error {
	return nil
}

func (t *testAccountsStore) Session(ctx context.Context, token string, now time.Time) (auth.Session, error) {
	return auth.Session{}, nil
}

func (t *testAccountsStore) DeleteAccount(ctx context.Context, token string, now time.Time) error {
	return nil
}

func (t *testAccountsStore) AttachCompany(ctx context.Context, token string, choice auth.CompanyChoice, now time.Time) (auth.Session, error) {
	return auth.Session{}, nil
}

func (t *testAccountsStore) InvitedCompanies(ctx context.Context, token string, now time.Time) ([]auth.Company, error) {
	return nil, nil
}

func (t *testAccountsStore) SaveGoogleState(ctx context.Context, state string, saved auth.GoogleState, now time.Time) error {
	return nil
}

func (t *testAccountsStore) TakeGoogleState(ctx context.Context, state string, now time.Time) (auth.GoogleState, error) {
	return auth.GoogleState{}, nil
}

func (t *testAccountsStore) GoogleSignin(ctx context.Context, identity auth.GoogleIdentity, audience, newRole string, now time.Time) (string, auth.Session, error) {
	return "", auth.Session{}, nil
}


func TestEmailSignup(t *testing.T) {
	store := newTestAccountsStore()
	sender := &testEmailSender{}

	handlers := Handlers{
		Accounts: store,
		Audience: auth.AudienceJoined,
		Email:    &EmailAuth{Sender: sender},
	}

	mux := http.NewServeMux()
	handlers.Register(mux)

	tests := []struct {
		name       string
		body       map[string]string
		wantStatus int
		wantError  string
	}{
		{
			name: "valid signup",
			body: map[string]string{
				"email":    "test@example.com",
				"password": "password123",
				"name":     "Test User",
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "weak password",
			body: map[string]string{
				"email":    "weak@example.com",
				"password": "short",
				"name":     "Weak User",
			},
			wantStatus: http.StatusBadRequest,
			wantError:  "password must be at least 8 characters",
		},
		{
			name: "duplicate email",
			body: map[string]string{
				"email":    "test@example.com",
				"password": "password123",
				"name":     "Duplicate User",
			},
			wantStatus: http.StatusOK, // Same as success to prevent enumeration
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewReader(body))
			w := httptest.NewRecorder()

			mux.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("status = %v, want %v", w.Code, tt.wantStatus)
			}

			if tt.wantError != "" {
				var resp map[string]string
				json.NewDecoder(w.Body).Decode(&resp)
				if resp["error"] != tt.wantError {
					t.Errorf("error = %v, want %v", resp["error"], tt.wantError)
				}
			}
		})
	}

	// Verify correct number of emails sent
	if len(sender.verifications) != 1 {
		t.Errorf("verifications sent = %v, want 1 (only for new signup)", len(sender.verifications))
	}
	if len(sender.duplicateNotices) != 1 {
		t.Errorf("duplicate notices sent = %v, want 1 (for duplicate signup)", len(sender.duplicateNotices))
	}
}

func TestEmailVerification(t *testing.T) {
	store := newTestAccountsStore()
	sender := &testEmailSender{}

	handlers := Handlers{
		Accounts: store,
		Audience: auth.AudienceJoined,
		Email:    &EmailAuth{Sender: sender},
	}

	mux := http.NewServeMux()
	handlers.Register(mux)

	// Create user
	ctx := context.Background()
	now := time.Now()
	userID, _, err := store.EmailSignup(ctx, "verify@example.com", "password123", "Verify User", auth.RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	token, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil {
		t.Fatalf("Failed to create token: %v", err)
	}

	// Verify email
	body, _ := json.Marshal(map[string]string{"token": token})
	req := httptest.NewRequest("POST", "/v1/auth/verify", bytes.NewReader(body))
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %v, want %v", w.Code, http.StatusOK)
	}

	// Test invalid token
	body, _ = json.Marshal(map[string]string{"token": "invalid"})
	req = httptest.NewRequest("POST", "/v1/auth/verify", bytes.NewReader(body))
	w = httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %v, want %v", w.Code, http.StatusBadRequest)
	}
}

func TestEmailSignin(t *testing.T) {
	store := newTestAccountsStore()
	sender := &testEmailSender{}

	handlers := Handlers{
		Accounts: store,
		Audience: auth.AudienceJoined,
		Email:    &EmailAuth{Sender: sender},
	}

	mux := http.NewServeMux()
	handlers.Register(mux)

	// Create and verify user
	ctx := context.Background()
	now := time.Now()
	email := "signin@example.com"
	password := "password123"
	userID, _, err := store.EmailSignup(ctx, email, password, "Sign In User", auth.RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	token, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil {
		t.Fatalf("Failed to create token: %v", err)
	}
	err = store.VerifyEmail(ctx, token, now)
	if err != nil {
		t.Fatalf("Failed to verify: %v", err)
	}

	// Test successful sign-in
	body, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
	})
	req := httptest.NewRequest("POST", "/v1/auth/signin", bytes.NewReader(body))
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %v, want %v", w.Code, http.StatusOK)
	}

	var resp authResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Token == "" {
		t.Error("token is empty")
	}
	if resp.Session.User.Email != email {
		t.Errorf("session email = %v, want %v", resp.Session.User.Email, email)
	}

	// Test wrong password
	body, _ = json.Marshal(map[string]string{
		"email":    email,
		"password": "wrongpassword",
	})
	req = httptest.NewRequest("POST", "/v1/auth/signin", bytes.NewReader(body))
	w = httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %v, want %v", w.Code, http.StatusUnauthorized)
	}

	// Test unverified user
	_, _, err = store.EmailSignup(ctx, "unverified@example.com", password, "Unverified", auth.RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create unverified user: %v", err)
	}

	body, _ = json.Marshal(map[string]string{
		"email":    "unverified@example.com",
		"password": password,
	})
	req = httptest.NewRequest("POST", "/v1/auth/signin", bytes.NewReader(body))
	w = httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("status = %v, want %v", w.Code, http.StatusForbidden)
	}
}

func TestPasswordReset(t *testing.T) {
	store := newTestAccountsStore()
	sender := &testEmailSender{}

	handlers := Handlers{
		Accounts: store,
		Audience: auth.AudienceJoined,
		Email:    &EmailAuth{Sender: sender},
	}

	mux := http.NewServeMux()
	handlers.Register(mux)

	// Create and verify user
	ctx := context.Background()
	now := time.Now()
	email := "reset@example.com"
	oldPassword := "oldpassword123"
	newPassword := "newpassword123"

	userID, _, err := store.EmailSignup(ctx, email, oldPassword, "Reset User", auth.RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	verifyToken, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil {
		t.Fatalf("Failed to create token: %v", err)
	}
	err = store.VerifyEmail(ctx, verifyToken, now)
	if err != nil {
		t.Fatalf("Failed to verify: %v", err)
	}

	// Request password reset
	body, _ := json.Marshal(map[string]string{"email": email})
	req := httptest.NewRequest("POST", "/v1/auth/password/reset-request", bytes.NewReader(body))
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %v, want %v", w.Code, http.StatusOK)
	}

	// Get reset token (would normally come from email)
	resetToken, err := store.RequestPasswordReset(ctx, email, now)
	if err != nil {
		t.Fatalf("Failed to get reset token: %v", err)
	}

	// Reset password
	body, _ = json.Marshal(map[string]string{
		"token":       resetToken,
		"newPassword": newPassword,
	})
	req = httptest.NewRequest("POST", "/v1/auth/password/reset", bytes.NewReader(body))
	w = httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %v, want %v", w.Code, http.StatusOK)
	}

	// Verify old password doesn't work
	body, _ = json.Marshal(map[string]string{
		"email":    email,
		"password": oldPassword,
	})
	req = httptest.NewRequest("POST", "/v1/auth/signin", bytes.NewReader(body))
	w = httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %v, want %v (old password should not work)", w.Code, http.StatusUnauthorized)
	}

	// Verify new password works
	body, _ = json.Marshal(map[string]string{
		"email":    email,
		"password": newPassword,
	})
	req = httptest.NewRequest("POST", "/v1/auth/signin", bytes.NewReader(body))
	w = httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %v, want %v (new password should work)", w.Code, http.StatusOK)
	}
}
