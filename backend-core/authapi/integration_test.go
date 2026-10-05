package authapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/auth"
)

func TestRoleProtectionIntegration(t *testing.T) {
	store := &fakeStore{
		sessions: map[string]auth.Session{
			"candidate-token": {
				User: auth.User{ID: "c1", Role: auth.RoleCandidate},
			},
			"employee-token": {
				User: auth.User{ID: "e1", Role: auth.RoleEmployee},
			},
			"scout-token": {
				User: auth.User{ID: "s1", Role: auth.RoleScout},
			},
		},
		staff: map[string]auth.Staff{
			"staff-token": {Email: "staff@example.com"},
		},
	}

	tests := []struct {
		name       string
		path       string
		roles      []string
		token      string
		wantStatus int
	}{
		{
			name:       "candidate can access /v1/me routes",
			path:       "/v1/me/profile",
			roles:      []string{auth.RoleCandidate},
			token:      "candidate-token",
			wantStatus: http.StatusOK,
		},
		{
			name:       "employee can access /v1/company routes",
			path:       "/v1/company/jobs",
			roles:      []string{auth.RoleEmployee},
			token:      "employee-token",
			wantStatus: http.StatusOK,
		},
		{
			name:       "employee cannot access /v1/me routes",
			path:       "/v1/me/profile",
			roles:      []string{auth.RoleCandidate},
			token:      "employee-token",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "candidate cannot access /v1/company routes",
			path:       "/v1/company/jobs",
			roles:      []string{auth.RoleEmployee},
			token:      "candidate-token",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "scout cannot access /v1/me routes",
			path:       "/v1/me/profile",
			roles:      []string{auth.RoleCandidate},
			token:      "scout-token",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "scout cannot access /v1/company routes",
			path:       "/v1/company/jobs",
			roles:      []string{auth.RoleEmployee},
			token:      "scout-token",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "no token gets 401",
			path:       "/v1/me/profile",
			roles:      []string{auth.RoleCandidate},
			token:      "",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "staff can access admin routes",
			path:       "/v1/admin/cases",
			roles:      nil,
			token:      "staff-token",
			wantStatus: http.StatusOK,
		},
		{
			name:       "regular user cannot access admin routes",
			path:       "/v1/admin/cases",
			roles:      nil,
			token:      "candidate-token",
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})

			var wrapped http.Handler
			if tt.roles != nil {
				wrapped = RequireRole(store, tt.roles, handler)
			} else {
				wrapped = RequireStaff(store, handler)
			}

			req := httptest.NewRequest("GET", tt.path, nil)
			if tt.token != "" {
				req.Header.Set("Authorization", "Bearer "+tt.token)
			}
			rec := httptest.NewRecorder()
			wrapped.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", rec.Code, tt.wantStatus)
			}
		})
	}
}
