package auth

// MembershipForJoin decides the membership written when an employee attaches a company.
// Creating a company makes the caller the owner. Joining an existing company requires
// the hiring role stored on a pending invite; anything else is refused.
func MembershipForJoin(existingCompany bool, inviteRole string) (role, hiringRole string, err error) {
	if !existingCompany {
		return roleOwner, "", nil
	}
	if !validHiringRole(inviteRole) {
		return "", "", ErrInviteRequired
	}
	return roleMember, inviteRole, nil
}
