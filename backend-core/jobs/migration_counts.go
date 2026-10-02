package jobs

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/sync/errgroup"
)

// MigrationCounts is how far the copy from the source database has come.
type MigrationCounts struct {
	JobSource           string `json:"jobSource"`
	JobDestination      string `json:"jobDestination"`
	SourceJobs          int64  `json:"sourceJobs"`
	TempJobs            int64  `json:"tempJobs"`
	AnalyzedJobs        int64  `json:"analyzedJobs"`
	CompanySource       string `json:"companySource"`
	CompanyDestination  string `json:"companyDestination"`
	SourceCompanies     int64  `json:"sourceCompanies"`
	Companies           int64  `json:"companies"`
	ResearchedCompanies int64  `json:"researchedCompanies"`
}

// MigrationCounts counts both sides of the migration at once. Whole collections use
// the fast estimate.
func (s *Store) MigrationCounts(ctx context.Context) (MigrationCounts, error) {
	counts := MigrationCounts{
		JobSource:          s.sourceDB + "." + s.sourceCollection,
		JobDestination:     s.destDB + "." + s.destCollection,
		CompanySource:      s.sourceDB + "." + s.sourceCompanies,
		CompanyDestination: s.destDB + "." + s.destCompanies,
	}
	group, ctx := errgroup.WithContext(ctx)
	estimate := func(target *int64, count func(context.Context) (int64, error)) {
		group.Go(func() error {
			n, err := count(ctx)
			*target = n
			return err
		})
	}
	estimate(&counts.SourceJobs, func(ctx context.Context) (int64, error) { return s.source().EstimatedDocumentCount(ctx) })
	estimate(&counts.TempJobs, func(ctx context.Context) (int64, error) { return s.dest().EstimatedDocumentCount(ctx) })
	estimate(&counts.SourceCompanies, func(ctx context.Context) (int64, error) {
		return s.sourceCompaniesColl().EstimatedDocumentCount(ctx)
	})
	estimate(&counts.Companies, func(ctx context.Context) (int64, error) { return s.companies().EstimatedDocumentCount(ctx) })
	estimate(&counts.AnalyzedJobs, func(ctx context.Context) (int64, error) {
		// Scouted jobs are published without a temp job, so only analyzed temp jobs count.
		return s.structured().CountDocuments(ctx, bson.D{{Key: "tempJobId", Value: bson.D{{Key: "$gt", Value: ""}}}})
	})
	estimate(&counts.ResearchedCompanies, func(ctx context.Context) (int64, error) {
		return s.companies().CountDocuments(ctx, bson.D{{Key: researchedAtField, Value: bson.D{{Key: "$exists", Value: true}}}})
	})
	if err := group.Wait(); err != nil {
		return MigrationCounts{}, err
	}
	return counts, nil
}
