package authapi

import (
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/auth"
)

func TestSignupModeKeepsEachAppToItsAccounts(t *testing.T) {
	cases := []struct {
		audience  string
		requested string
		mode      string
		ok        bool
	}{
		{auth.RoleScout, "", auth.RoleScout, true},
		{auth.RoleScout, auth.RoleCandidate, auth.RoleScout, true},
		{auth.RoleScout, auth.RoleEmployee, auth.RoleScout, true},
		{auth.AudienceJoined, "", "", true},
		{auth.AudienceJoined, auth.RoleCandidate, auth.RoleCandidate, true},
		{auth.AudienceJoined, auth.RoleEmployee, auth.RoleEmployee, true},
		{auth.AudienceJoined, auth.RoleScout, auth.RoleScout, false},
	}
	for _, tc := range cases {
		mode, ok := Handlers{Audience: tc.audience}.signupMode(tc.requested)
		if mode != tc.mode || ok != tc.ok {
			t.Errorf("%s/%q: got %q %v, want %q %v", tc.audience, tc.requested, mode, ok, tc.mode, tc.ok)
		}
	}
}
