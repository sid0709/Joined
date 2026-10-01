package platform

import (
	"context"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/employer"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/scout"
)

// accountEraser deletes an account's hunter, recruiter, and scout records together.
type accountEraser struct {
	people *candidate.Store
	scouts *scout.Store
	jobs   *jobs.Store
	hiring *employer.Store
}

func newAccountEraser(people *candidate.Store, scouts *scout.Store, jobsStore *jobs.Store, hiring *employer.Store) accountEraser {
	return accountEraser{people: people, scouts: scouts, jobs: jobsStore, hiring: hiring}
}

// DeleteUser removes the person and everything that exists only because of them.
// ownedCompanyID is the company page they created; it is deleted with its jobs
// and the activity on those jobs.
func (e accountEraser) DeleteUser(ctx context.Context, userID, ownedCompanyID string) error {
	removed, err := e.scouts.DeleteUser(ctx, userID)
	if err != nil {
		return err
	}
	published, err := e.jobs.DeleteScoutedBy(ctx, userID)
	if err != nil {
		return err
	}
	jobIDs := append(removed.JobIDs, published...)
	if ownedCompanyID != "" {
		if err := e.hiring.DeleteCompany(ctx, ownedCompanyID); err != nil {
			return err
		}
		companyJobs, err := e.jobs.DeleteByCompany(ctx, ownedCompanyID)
		if err != nil {
			return err
		}
		jobIDs = append(jobIDs, companyJobs...)
		if err := e.people.DeleteCompany(ctx, ownedCompanyID); err != nil {
			return err
		}
	}
	if err := e.people.DeleteJobs(ctx, jobIDs); err != nil {
		return err
	}
	if err := e.people.DeleteUser(ctx, userID); err != nil {
		return err
	}
	if err := e.hiring.DeleteUser(ctx, userID); err != nil {
		return err
	}
	for _, companyID := range removed.CompanyIDs {
		if companyID == "" || companyID == ownedCompanyID {
			continue
		}
		stillUsed, err := e.scouts.HasCompanySubmissions(ctx, companyID)
		if err != nil {
			return err
		}
		if stillUsed {
			continue
		}
		remaining, err := e.jobs.CountCompanyJobs(ctx, companyID)
		if err != nil {
			return err
		}
		if remaining > 0 {
			continue
		}
		if err := e.jobs.DeleteUnclaimedScoutCompany(ctx, companyID); err != nil {
			return err
		}
	}
	return nil
}
