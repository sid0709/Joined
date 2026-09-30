package httpapi

import (
	"context"
	"errors"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/candidate"
	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
)

type jobsCatalog struct {
	store *jobs.Store
}

func NewJobsCatalog(store *jobs.Store) candidate.Catalog {
	return jobsCatalog{store: store}
}

func (c jobsCatalog) Lookup(ctx context.Context, jobID string) (candidate.Listing, error) {
	job, err := c.store.GetCatalogJob(ctx, jobID, time.Now())
	if err != nil {
		if errors.Is(err, jobs.ErrNotFound) {
			return candidate.Listing{}, candidate.ErrNotFound
		}
		return candidate.Listing{}, err
	}
	return candidate.FromSearchJob(
		job.ID,
		job.Title,
		job.Company,
		job.CompanyID,
		job.Location,
		job.Workplace,
		job.Source,
		job.Pay.Min,
		job.Pay.Max,
		job.Pay.Currency,
		job.Pay.Period,
	), nil
}
