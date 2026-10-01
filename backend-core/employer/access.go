package employer

import "github.com/sid0709/OpenSeat/backend-core/auth"

// RequireCreator allows company-page, team, billing, and company settings changes.
// A person who only linked to the company at signup can run the hiring workspace.
func RequireCreator(company auth.Company) error {
	if company.IsCreator {
		return nil
	}
	return ErrForbidden
}
