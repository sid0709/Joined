package platform

import (
	"context"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/scout"
)

// companiesInUse lists the companies a recruiter belongs to or a scout submitted a job
// for. The company copy keeps those published.
func companiesInUse(accounts *auth.Store, scouts *scout.Store) jobs.CompanyRefs {
	return func(ctx context.Context) ([]string, error) {
		members, err := accounts.MemberCompanyIDs(ctx)
		if err != nil {
			return nil, err
		}
		submitted, err := scouts.SubmissionCompanyIDs(ctx)
		if err != nil {
			return nil, err
		}
		return append(members, submitted...), nil
	}
}
