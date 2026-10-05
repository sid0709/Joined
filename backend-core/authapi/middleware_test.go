package authapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
)

type fakeStore struct {
	sessions map[string]auth.Session
	staff    map[string]auth.Staff
}

func (f *fakeStore) Session(ctx context.Context, token string, now time.Time) (auth.Session, error) {
	if session, ok := f.sessions[token]; ok {
		return session, nil
	}
	return auth.Session{}, auth.ErrInvalidLogin
}

func (f *fakeStore) StaffSession(ctx context.Context, token string, now time.Time) (auth.Staff, error) {
	if staff, ok := f.staff[token]; ok {
		return staff, nil
	}
	return auth.Staff{}, auth.ErrInvalidLogin
}

func TestRequireRole(t *testing.T) {
	store := &fakeStore{
		sessions: map[string]auth.Session{
			"candidate-token": {
				User: auth.User{
					ID:    "candidate-id",
					Email: "candidate@example.com",
					Name:  "Candidate User",
					Role:  auth.RoleCandidate,
				},
			},
			"employee-token": {
				User: auth.User{
					ID:    "employee-id",
					Email: "employee@example.com",
					Name:  "Employee User",
					Role:  auth.RoleEmployee,
				},
			},
			"scout-token": {
				User: auth.User{
					ID:    "scout-id",
					Email: "scout@example.com",
					Name:  "Scout User",
					Role:  auth.RoleScout,
				},
			},
		},
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := Session(r.Context())
		if !ok {
			t.Fatal("session not in context")
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(session.User.ID))
	})

	tests := []struct {
		name         string
		roles        []string
		token        string
		wantStatus   int
		wantBody     string
		wantErrorMsg string
	}{
		{
			name:         "no token returns 401",
			roles:        []string{auth.RoleCandidate},
			token:        "",
			wantStatus:   http.StatusUnauthorized,
			wantErrorMsg: "sign in required",
		},
		{
			name:         "invalid token returns 401",
			roles:        []string{auth.RoleCandidate},
			token:        "invalid-token",
			wantStatus:   http.StatusUnauthorized,
			wantErrorMsg: "sign in required",
		},
		{
			name:       "candidate allowed for candidate role",
			roles:      []string{auth.RoleCandidate},
			token:      "candidate-token",
			wantStatus: http.StatusOK,
			wantBody:   "candidate-id",
		},
		{
			name:       "employee allowed for employee role",
			roles:      []string{auth.RoleEmployee},
			token:      "employee-token",
			wantStatus: http.StatusOK,
			wantBody:   "employee-id",
		},
		{
			name:       "candidate allowed for candidate or employee",
			roles:      []string{auth.RoleCandidate, auth.RoleEmployee},
			token:      "candidate-token",
			wantStatus: http.StatusOK,
			wantBody:   "candidate-id",
		},
		{
			name:       "employee allowed for candidate or employee",
			roles:      []string{auth.RoleCandidate, auth.RoleEmployee},
			token:      "employee-token",
			wantStatus: http.StatusOK,
			wantBody:   "employee-id",
		},
		{
			name:         "scout rejected for candidate role",
			roles:        []string{auth.RoleCandidate},
			token:        "scout-token",
			wantStatus:   http.StatusForbidden,
			wantErrorMsg: "this account is a scout account",
		},
		{
			name:         "scout rejected for employee role",
			roles:        []string{auth.RoleEmployee},
			token:        "scout-token",
			wantStatus:   http.StatusForbidden,
			wantErrorMsg: "this account is a scout account",
		},
		{
			name:         "candidate rejected for scout role",
			roles:        []string{auth.RoleScout},
			token:        "candidate-token",
			wantStatus:   http.StatusForbidden,
			wantErrorMsg: "this account is a job seeker account",
		},
		{
			name:         "employee rejected for scout role",
			roles:        []string{auth.RoleScout},
			token:        "employee-token",
			wantStatus:   http.StatusForbidden,
			wantErrorMsg: "this account is a recruiter account",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wrapped := RequireRole(store, tt.roles, handler)
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.token != "" {
				req.Header.Set("Authorization", "Bearer "+tt.token)
			}
			rec := httptest.NewRecorder()
			wrapped.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantBody != "" {
				if rec.Body.String() != tt.wantBody {
					t.Errorf("got body %q, want %q", rec.Body.String(), tt.wantBody)
				}
			}
			if tt.wantErrorMsg != "" {
				var resp map[string]string
				if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
					t.Fatalf("failed to decode response: %v", err)
				}
				if resp["error"] != tt.wantErrorMsg {
					t.Errorf("got error %q, want %q", resp["error"], tt.wantErrorMsg)
				}
			}
		})
	}
}

func TestRequireStaff(t *testing.T) {
	store := &fakeStore{
		sessions: map[string]auth.Session{
			"candidate-token": {
				User: auth.User{
					ID:    "candidate-id",
					Email: "candidate@example.com",
					Name:  "Candidate User",
					Role:  auth.RoleCandidate,
				},
			},
		},
		staff: map[string]auth.Staff{
			"staff-token": {
				Email: "admin@example.com",
				Name:  "Admin User",
			},
		},
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		staff, ok := Staff(r.Context())
		if !ok {
			t.Fatal("staff not in context")
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(staff.Email))
	})

	tests := []struct {
		name         string
		token        string
		wantStatus   int
		wantBody     string
		wantErrorMsg string
	}{
		{
			name:         "no token returns 401",
			token:        "",
			wantStatus:   http.StatusUnauthorized,
			wantErrorMsg: "sign in required",
		},
		{
			name:         "invalid token returns 401",
			token:        "invalid-token",
			wantStatus:   http.StatusUnauthorized,
			wantErrorMsg: "sign in required",
		},
		{
			name:         "user session rejected",
			token:        "candidate-token",
			wantStatus:   http.StatusUnauthorized,
			wantErrorMsg: "sign in required",
		},
		{
			name:       "staff session allowed",
			token:      "staff-token",
			wantStatus: http.StatusOK,
			wantBody:   "admin@example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wrapped := RequireStaff(store, handler)
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.token != "" {
				req.Header.Set("Authorization", "Bearer "+tt.token)
			}
			rec := httptest.NewRecorder()
			wrapped.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantBody != "" {
				if rec.Body.String() != tt.wantBody {
					t.Errorf("got body %q, want %q", rec.Body.String(), tt.wantBody)
				}
			}
			if tt.wantErrorMsg != "" {
				var resp map[string]string
				if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
					t.Fatalf("failed to decode response: %v", err)
				}
				if resp["error"] != tt.wantErrorMsg {
					t.Errorf("got error %q, want %q", resp["error"], tt.wantErrorMsg)
				}
			}
		})
	}
}

func TestSessionContext(t *testing.T) {
	store := &fakeStore{
		sessions: map[string]auth.Session{
			"test-token": {
				User: auth.User{
					ID:    "user-id",
					Email: "user@example.com",
					Name:  "Test User",
					Role:  auth.RoleCandidate,
				},
			},
		},
	}

	handler := RequireRole(store, []string{auth.RoleCandidate}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		retrieved, ok := Session(r.Context())
		if !ok {
			t.Fatal("session not found in context")
		}
		if retrieved.User.ID != "user-id" {
			t.Errorf("got user %s, want %s", retrieved.User.ID, "user-id")
		}
		if retrieved.User.Email != "user@example.com" {
			t.Errorf("got email %s, want %s", retrieved.User.Email, "user@example.com")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestSessionAndStaffUseSeparateKeys(t *testing.T) {
	ctx := context.WithValue(context.Background(), sessionContextKey{}, auth.Session{
		User: auth.User{ID: "user-id", Role: auth.RoleCandidate},
	})
	ctx = context.WithValue(ctx, staffContextKey{}, auth.Staff{Email: "admin@example.com"})
	session, ok := Session(ctx)
	if !ok || session.User.ID != "user-id" {
		t.Fatalf("session = %+v ok = %v", session, ok)
	}
	staff, ok := Staff(ctx)
	if !ok || staff.Email != "admin@example.com" {
		t.Fatalf("staff = %+v ok = %v", staff, ok)
	}
}

func TestStaffContext(t *testing.T) {
	store := &fakeStore{
		staff: map[string]auth.Staff{
			"staff-token": {
				Email: "admin@example.com",
				Name:  "Admin User",
			},
		},
	}

	handler := RequireStaff(store, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		retrieved, ok := Staff(r.Context())
		if !ok {
			t.Fatal("staff not found in context")
		}
		if retrieved.Email != "admin@example.com" {
			t.Errorf("got email %s, want %s", retrieved.Email, "admin@example.com")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer staff-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}
}
