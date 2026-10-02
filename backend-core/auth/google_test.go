package auth

import (
	"errors"
	"strings"
	"testing"
)

func TestGoogleAccessKeepsEachAppToItsAccounts(t *testing.T) {
	cases := []struct {
		name string
		user storedUser
		app  string
		link bool
		err  error
	}{
		{"password account links on first Google sign-in", storedUser{Role: RoleCandidate}, AudienceJoined, true, nil},
		{"recruiter signs in to Joined", storedUser{Role: RoleEmployee, GoogleID: "sub-1"}, AudienceJoined, false, nil},
		{"linked scout signs in", storedUser{Role: RoleScout, GoogleID: "sub-1"}, RoleScout, false, nil},
		{"scout on Joined", storedUser{Role: RoleScout}, AudienceJoined, false, ErrWrongRole},
		{"hunter on Scoutwell", storedUser{Role: RoleCandidate, GoogleID: "sub-1"}, RoleScout, false, ErrWrongRole},
		{"email held by another Google account", storedUser{Role: RoleCandidate, GoogleID: "sub-2"}, AudienceJoined, false, ErrGoogleMismatch},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			link, err := googleAccess(tc.user, "sub-1", tc.app)
			if link != tc.link || !errors.Is(err, tc.err) {
				t.Fatalf("got link=%v err=%v, want link=%v err=%v", link, err, tc.link, tc.err)
			}
		})
	}
}

func TestGoogleNameFallsBackToTheEmail(t *testing.T) {
	if got := googleName(" Ada Lovelace ", "ada@example.com"); got != "Ada Lovelace" {
		t.Errorf("name = %q", got)
	}
	if got := googleName("", "ada.l@example.com"); got != "ada.l" {
		t.Errorf("fallback = %q", got)
	}
	if got := googleName(strings.Repeat("é", maxNameLength+5), "x@example.com"); len([]rune(got)) != maxNameLength {
		t.Errorf("long name kept %d runes", len([]rune(got)))
	}
}
