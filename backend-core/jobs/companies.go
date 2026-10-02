package jobs

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/sync/errgroup"
)

const (
	companyCopyBatch = 500
	// companyCopyWriters is how many company batches are written at once.
	companyCopyWriters = 8
	// linkBatch is how many public jobs are relinked to their companies per write.
	linkBatch = 500
)

type CompanyCopyResult struct {
	Copied int64  `json:"copied"`
	Linked int64  `json:"linked"`
	Source string `json:"source"`
	Dest   string `json:"destination"`
}

type PublicCompany struct {
	ID                string            `json:"id"`
	Name              string            `json:"name"`
	URL               string            `json:"url,omitempty"`
	Logo              string            `json:"logo,omitempty"`
	Tagline           string            `json:"tagline,omitempty"`
	About             string            `json:"about,omitempty"`
	Industry          string            `json:"industry,omitempty"`
	Size              string            `json:"size,omitempty"`
	Founded           int               `json:"founded,omitempty"`
	ReplyDays         int               `json:"replyDays,omitempty"`
	Headquarters      string            `json:"headquarters,omitempty"`
	CompanyType       string            `json:"companyType,omitempty"`
	Locations         string            `json:"locations,omitempty"`
	Specialties       []string          `json:"specialties,omitempty"`
	Mission           string            `json:"mission,omitempty"`
	Values            []companyValue    `json:"values,omitempty"`
	BenefitCategories []benefitCategory `json:"benefitCategories,omitempty"`
	HasLogoFile       bool              `json:"hasLogoFile,omitempty"`
	Verified          bool              `json:"verified,omitempty"`
}

type logoFile struct {
	ContentType string `bson:"contentType,omitempty"`
	Data        []byte `bson:"data,omitempty"`
}

type CompanyPage struct {
	Company PublicCompany `json:"company"`
	Jobs    []catalogJob  `json:"jobs"`
}

type storedCompany struct {
	ID                 string           `bson:"id"`
	SourceID           string           `bson:"sourceId"`
	CompanyName        string           `bson:"companyName"`
	CompanyURL         string           `bson:"companyUrl"`
	CompanyKey         string           `bson:"companyKey"`
	CompanyLogo        string           `bson:"companyLogo"`
	JobCount           int64            `bson:"jobCount"`
	JobIDs             []string         `bson:"jobIds"`
	Overrides          companyOverrides `bson:"overrides,omitempty"`
	LogoFile           logoFile         `bson:"logoFile,omitempty"`
	VerificationStatus string           `bson:"verificationStatus,omitempty"`
}

type athensCompany struct {
	ID          bson.ObjectID   `bson:"_id"`
	CompanyKey  string          `bson:"companyKey"`
	CompanyLogo string          `bson:"companyLogo"`
	CompanyName string          `bson:"companyName"`
	CompanyURL  string          `bson:"companyUrl"`
	JobCount    int64           `bson:"jobCount"`
	JobIDs      []bson.ObjectID `bson:"jobIds"`
}

// CopyCompanies upserts every source company by its source id, keeping each company's
// public id and admin edits, then links public jobs to their companies.
func (s *Store) CopyCompanies(ctx context.Context, progress Progress) (CompanyCopyResult, error) {
	if !s.companyCopyMu.TryLock() {
		return CompanyCopyResult{}, ErrCopyInProgress
	}
	defer s.companyCopyMu.Unlock()
	progress = orNoProgress(progress)

	dest := s.companies()
	if err := ensureCompanyIndexes(ctx, dest); err != nil {
		return CompanyCopyResult{}, err
	}
	existing, err := s.companyIDsBySource(ctx)
	if err != nil {
		return CompanyCopyResult{}, err
	}
	source := s.sourceCompaniesColl()
	if estimate, err := source.EstimatedDocumentCount(ctx); err == nil {
		progress.Total(estimate)
	}
	cursor, err := source.Find(ctx, bson.D{}, options.Find().SetBatchSize(companyCopyBatch))
	if err != nil {
		return CompanyCopyResult{}, fmt.Errorf("read source companies: %w", err)
	}
	defer cursor.Close(ctx)

	group, groupCtx := errgroup.WithContext(ctx)
	batches := make(chan []mongo.WriteModel, companyCopyWriters)
	var copied atomic.Int64
	for range companyCopyWriters {
		group.Go(func() error {
			for batch := range batches {
				if _, err := dest.BulkWrite(groupCtx, batch, options.BulkWrite().SetOrdered(false)); err != nil {
					return fmt.Errorf("write companies: %w", err)
				}
				progress.Done(int64(len(batch)))
				copied.Add(int64(len(batch)))
			}
			return nil
		})
	}
	group.Go(func() error {
		defer close(batches)
		send := func(batch []mongo.WriteModel) error {
			select {
			case batches <- batch:
				return nil
			case <-groupCtx.Done():
				return groupCtx.Err()
			}
		}
		batch := make([]mongo.WriteModel, 0, companyCopyBatch)
		for cursor.Next(groupCtx) {
			var company athensCompany
			if err := cursor.Decode(&company); err != nil {
				return fmt.Errorf("decode company: %w", err)
			}
			model, err := upsertCompany(company, existing)
			if err != nil {
				return err
			}
			batch = append(batch, model)
			if len(batch) == companyCopyBatch {
				if err := send(batch); err != nil {
					return err
				}
				batch = make([]mongo.WriteModel, 0, companyCopyBatch)
			}
		}
		if err := cursor.Err(); err != nil {
			return fmt.Errorf("read source companies: %w", err)
		}
		if len(batch) > 0 {
			return send(batch)
		}
		return nil
	})
	if err := group.Wait(); err != nil {
		return CompanyCopyResult{}, err
	}
	slog.Info("copied companies", "copied", copied.Load())

	linked, err := s.linkJobsToCompanies(ctx, existing)
	if err != nil {
		return CompanyCopyResult{}, err
	}
	return CompanyCopyResult{
		Copied: copied.Load(),
		Linked: linked,
		Source: s.sourceDB + "." + s.sourceCompanies,
		Dest:   s.destDB + "." + s.destCompanies,
	}, nil
}

// upsertCompany writes a source company's own fields. Admin edits live on `overrides`
// and must survive a resync. existing maps source ids to public ids and gains new ones;
// only the reading goroutine touches it.
func upsertCompany(source athensCompany, existing map[string]string) (mongo.WriteModel, error) {
	sourceID := source.ID.Hex()
	id := existing[sourceID]
	if !isPublicID(id) {
		var err error
		id, err = newPublicID()
		if err != nil {
			return nil, err
		}
		existing[sourceID] = id
	}
	return mongo.NewUpdateOneModel().
		SetFilter(bson.D{{Key: "sourceId", Value: sourceID}}).
		SetUpdate(bson.D{{Key: "$set", Value: bson.D{
			{Key: "id", Value: id},
			{Key: "sourceId", Value: sourceID},
			{Key: "companyName", Value: source.CompanyName},
			{Key: "companyUrl", Value: source.CompanyURL},
			{Key: "companyKey", Value: source.CompanyKey},
			{Key: "companyLogo", Value: source.CompanyLogo},
			{Key: "jobCount", Value: source.JobCount},
			{Key: "jobIds", Value: hexIDs(source.JobIDs)},
		}}}).
		SetUpsert(true), nil
}

func (s *Store) CompanyPage(ctx context.Context, id string, now time.Time) (CompanyPage, error) {
	company, err := s.publicCompany(ctx, id)
	if err != nil {
		return CompanyPage{}, err
	}
	jobs, err := s.jobsForCompany(ctx, id, now)
	if err != nil {
		return CompanyPage{}, err
	}
	return CompanyPage{Company: company, Jobs: jobs}, nil
}

func (s *Store) jobsForCompany(ctx context.Context, companyID string, now time.Time) ([]catalogJob, error) {
	opts := options.Find().
		SetLimit(maxSearchCatalog).
		SetSort(bson.D{{Key: "analyzedAt", Value: -1}, {Key: "_id", Value: -1}})
	cursor, err := s.structured().Find(ctx, publicCompanyJobs(companyID), opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var docs []storedSearchJob
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	jobs := make([]catalogJob, 0, len(docs))
	for _, doc := range docs {
		jobs = append(jobs, CatalogJob(doc.view(now)))
	}
	return s.enrichCompanies(ctx, jobs)
}

func hexIDs(ids []bson.ObjectID) []string {
	if len(ids) == 0 {
		return []string{}
	}
	out := make([]string, len(ids))
	for i, id := range ids {
		out[i] = id.Hex()
	}
	return out
}

func ensureCompanyIndexes(ctx context.Context, coll *mongo.Collection) error {
	_, err := coll.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "sourceId", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "id", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	})
	if err != nil {
		return fmt.Errorf("index companies: %w", err)
	}
	return nil
}

func (s *Store) companyIDsBySource(ctx context.Context) (map[string]string, error) {
	cursor, err := s.companies().Find(ctx, bson.D{}, options.Find().SetProjection(bson.D{
		{Key: "sourceId", Value: 1},
		{Key: "id", Value: 1},
	}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	ids := map[string]string{}
	for cursor.Next(ctx) {
		var doc struct {
			ID       string `bson:"id"`
			SourceID string `bson:"sourceId"`
		}
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		if doc.SourceID != "" && doc.ID != "" {
			ids[doc.SourceID] = doc.ID
		}
	}
	return ids, cursor.Err()
}

// linkJobsToCompanies gives every public job a public id and its company's public id,
// writing in batches. companyIDs maps source company ids to public ids.
func (s *Store) linkJobsToCompanies(ctx context.Context, companyIDs map[string]string) (int64, error) {
	cursor, err := s.structured().Find(ctx, bson.D{}, options.Find().SetProjection(bson.D{
		{Key: "_id", Value: 1},
		{Key: "tempJobId", Value: 1},
		{Key: "job.id", Value: 1},
		{Key: "job.companyId", Value: 1},
	}))
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)

	var linked int64
	pending := make([]storedSearchJob, 0, linkBatch)
	flush := func() error {
		if len(pending) == 0 {
			return nil
		}
		models, err := s.linkModels(ctx, pending, companyIDs)
		if err != nil {
			return err
		}
		if _, err := s.structured().BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false)); err != nil {
			return fmt.Errorf("link jobs: %w", err)
		}
		linked += int64(len(models))
		pending = pending[:0]
		return nil
	}
	for cursor.Next(ctx) {
		var doc storedSearchJob
		if err := cursor.Decode(&doc); err != nil {
			return linked, err
		}
		pending = append(pending, doc)
		if len(pending) == linkBatch {
			if err := flush(); err != nil {
				return linked, err
			}
		}
	}
	if err := cursor.Err(); err != nil {
		return linked, err
	}
	return linked, flush()
}

// linkModels builds one update per job. Jobs without a company are matched through
// their temp job's source company, read for the whole batch at once.
func (s *Store) linkModels(ctx context.Context, docs []storedSearchJob, companyIDs map[string]string) ([]mongo.WriteModel, error) {
	sources, err := s.tempCompanySources(ctx, docs)
	if err != nil {
		return nil, err
	}
	models := make([]mongo.WriteModel, 0, len(docs))
	for _, doc := range docs {
		publicID := doc.Job.ID
		if !isPublicID(publicID) {
			publicID, err = newPublicID()
			if err != nil {
				return nil, err
			}
		}
		companyID := doc.Job.CompanyID
		if companyID == "" {
			companyID = companyIDs[sources[doc.TempJobID]]
		}
		models = append(models, mongo.NewUpdateOneModel().
			SetFilter(bson.D{{Key: "_id", Value: doc.ID}}).
			SetUpdate(bson.D{
				{Key: "$set", Value: bson.D{
					{Key: "job.id", Value: publicID},
					{Key: "job.companyId", Value: companyID},
				}},
				{Key: "$unset", Value: bson.D{{Key: "job.companySlug", Value: ""}}},
			}))
	}
	return models, nil
}

// tempCompanySources maps the temp job ids of jobs without a company to their source
// company ids.
func (s *Store) tempCompanySources(ctx context.Context, docs []storedSearchJob) (map[string]string, error) {
	ids := make([]bson.ObjectID, 0, len(docs))
	for _, doc := range docs {
		if doc.Job.CompanyID != "" {
			continue
		}
		if id, err := bson.ObjectIDFromHex(doc.TempJobID); err == nil {
			ids = append(ids, id)
		}
	}
	sources := make(map[string]string, len(ids))
	if len(ids) == 0 {
		return sources, nil
	}
	cursor, err := s.dest().Find(ctx,
		bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: ids}}}},
		options.Find().SetProjection(bson.D{{Key: "companyId", Value: 1}}),
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	for cursor.Next(ctx) {
		var row struct {
			ID        bson.ObjectID `bson:"_id"`
			CompanyID bson.ObjectID `bson:"companyId"`
		}
		if err := cursor.Decode(&row); err != nil {
			return nil, err
		}
		if !row.CompanyID.IsZero() {
			sources[row.ID.Hex()] = row.CompanyID.Hex()
		}
	}
	return sources, cursor.Err()
}

func (s *Store) searchIdentity(ctx context.Context, listing tempListing) (string, string, error) {
	publicID, companyID, err := s.existingSearchIdentity(ctx, listing.ID)
	if err != nil {
		return "", "", err
	}
	if !isPublicID(publicID) {
		publicID, err = newPublicID()
		if err != nil {
			return "", "", err
		}
	}
	if companyID == "" {
		companyID, err = s.publicCompanyID(ctx, listing.CompanyID)
		if err != nil {
			return "", "", err
		}
	}
	return publicID, companyID, nil
}

func (s *Store) existingSearchIdentity(ctx context.Context, id bson.ObjectID) (string, string, error) {
	var doc struct {
		Job struct {
			ID        string `bson:"id"`
			CompanyID string `bson:"companyId"`
		} `bson:"job"`
	}
	err := s.structured().FindOne(
		ctx,
		bson.D{{Key: "_id", Value: id}},
		options.FindOne().SetProjection(bson.D{{Key: "job.id", Value: 1}, {Key: "job.companyId", Value: 1}}),
	).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", "", nil
	}
	if err != nil {
		return "", "", err
	}
	return doc.Job.ID, doc.Job.CompanyID, nil
}

func (s *Store) GetCatalogJob(ctx context.Context, id string, now time.Time) (catalogJob, error) {
	record, err := s.GetSearch(ctx, id, now)
	if err != nil {
		return catalogJob{}, err
	}
	if !ListingPublic(record.ListingStatus) {
		return catalogJob{}, ErrNotFound
	}
	jobs, err := s.enrichCompanies(ctx, []catalogJob{CatalogJob(record)})
	if err != nil || len(jobs) == 0 {
		return catalogJob{}, err
	}
	return jobs[0], nil
}

func (s *Store) publicCompanyID(ctx context.Context, source bson.ObjectID) (string, error) {
	if source.IsZero() {
		return "", nil
	}
	var doc struct {
		ID string `bson:"id"`
	}
	err := s.companies().FindOne(
		ctx,
		bson.D{{Key: "sourceId", Value: source.Hex()}},
		options.FindOne().SetProjection(bson.D{{Key: "id", Value: 1}}),
	).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return doc.ID, nil
}

func (s *Store) publicCompany(ctx context.Context, id string) (PublicCompany, error) {
	if !isPublicID(id) {
		return PublicCompany{}, ErrNotFound
	}
	var doc storedCompany
	err := s.companies().FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return PublicCompany{}, ErrNotFound
	}
	if err != nil {
		return PublicCompany{}, err
	}
	return doc.public(), nil
}

func (doc storedCompany) public() PublicCompany {
	return doc.publicCompany()
}

func (s *Store) sourceCompaniesColl() *mongo.Collection {
	return s.client.Database(s.sourceDB).Collection(s.sourceCompanies)
}

func (s *Store) companies() *mongo.Collection {
	return s.client.Database(s.destDB).Collection(s.destCompanies)
}
