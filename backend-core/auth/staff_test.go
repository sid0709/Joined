package auth

import "testing"

func TestIsStaffDomainNeedsTheWorkspaceAndTheEmailDomain(t *testing.T) {
	cases := []struct {
		email, hosted, domain string
		want                  bool
	}{
		{"robin@joinedhq.com", "joinedhq.com", "joinedhq.com", true},
		{"Robin@JoinedHQ.com", "JOINEDHQ.COM", "@joinedhq.com", true},
		// A personal Gmail is not managed by the Workspace, whatever it is called.
		{"robin@gmail.com", "", "joinedhq.com", false},
		// An account the Workspace manages but on another domain alias.
		{"robin@other.com", "joinedhq.com", "joinedhq.com", false},
		// A look-alike domain.
		{"robin@evil-joinedhq.com", "evil-joinedhq.com", "joinedhq.com", false},
		// No domain configured lets nobody in.
		{"robin@joinedhq.com", "joinedhq.com", "", false},
	}
	for _, tc := range cases {
		if got := IsStaffDomain(tc.email, tc.hosted, tc.domain); got != tc.want {
			t.Errorf("IsStaffDomain(%q, %q, %q) = %v", tc.email, tc.hosted, tc.domain, got)
		}
	}
}
