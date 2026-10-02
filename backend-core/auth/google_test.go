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
		role string
		link bool
		err  error
	}{
		{"first Google sign-in links", storedUser{Role: RoleCandidate}, RoleCandidate, true, nil},
		{"linked account signs in", storedUser{Role: RoleScout, GoogleID: "sub-1"}, RoleScout, false, nil},
		{"recruiter on the hunter sign-in", storedUser{Role: RoleEmployee}, RoleCandidate, false, ErrWrongRole},
		{"hunter on Scoutwell", storedUser{Role: RoleCandidate, GoogleID: "sub-1"}, RoleScout, false, ErrWrongRole},
		{"email held by another Google account", storedUser{Role: RoleCandidate, GoogleID: "sub-2"}, RoleCandidate, false, ErrGoogleMismatch},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			link, err := googleAccess(tc.user, "sub-1", tc.role)
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
