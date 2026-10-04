package auth

import (
	"errors"
	"testing"
)

func TestMembershipForJoinCreatesAnOwner(t *testing.T) {
	role, hiringRole, err := MembershipForJoin(false, "")
	if err != nil || role != roleOwner || hiringRole != "" {
		t.Fatalf("create = %s %s %v", role, hiringRole, err)
	}
	role, hiringRole, err = MembershipForJoin(false, hiringRecruiter)
	if err != nil || role != roleOwner || hiringRole != "" {
		t.Fatalf("create ignores a stray invite role: %s %s %v", role, hiringRole, err)
	}
}

func TestMembershipForJoinRequiresAnInviteRole(t *testing.T) {
	role, hiringRole, err := MembershipForJoin(true, hiringRecruiter)
	if err != nil || role != roleMember || hiringRole != hiringRecruiter {
		t.Fatalf("invite = %s %s %v", role, hiringRole, err)
	}
	for _, inviteRole := range []string{"", "owner", "superadmin"} {
		_, _, err := MembershipForJoin(true, inviteRole)
		if !errors.Is(err, ErrInviteRequired) {
			t.Fatalf("%q = %v, want invite required", inviteRole, err)
		}
	}
}
