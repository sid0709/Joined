package jobs

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const companyCopyBatch = 400

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
	ID          string           `bson:"id"`
	SourceID    string           `bson:"sourceId"`
	CompanyName string           `bson:"companyName"`
	CompanyURL  string           `bson:"companyUrl"`
	CompanyKey  string           `bson:"companyKey"`
	CompanyLogo string           `bson:"companyLogo"`
	JobCount    int64            `bson:"jobCount"`
	JobIDs      []string         `bson:"jobIds"`
	Overrides   companyOverrides `bson:"overrides,omitempty"`
	LogoFile    logoFile         `bson:"logoFile,omitempty"`
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

func (s *Store) CopyCompanies(ctx context.Context) (CompanyCopyResult, error) {
	if !s.copyMu.TryLock() {
		return CompanyCopyResult{}, ErrCopyInProgress
	}
	defer s.copyMu.Unlock()

	dest := s.companies()
	if err := ensureCompanyIndexes(ctx, dest); err != nil {
		return CompanyCopyResult{}, err
	}
	existing, err := s.companyIDsBySource(ctx)
	if err != nil {
		return CompanyCopyResult{}, err
	}

	cursor, err := s.sourceCompaniesColl().Find(ctx, bson.D{}, options.Find().SetBatchSize(companyCopyBatch))
	if err != nil {
		return CompanyCopyResult{}, fmt.Errorf("read source companies: %w", err)
	}
	defer cursor.Close(ctx)

	batch := make([]mongo.WriteModel, 0, companyCopyBatch)
	var copied int64
	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		if _, err := dest.BulkWrite(ctx, batch, options.BulkWrite().SetOrdered(false)); err != nil {
			return fmt.Errorf("write companies: %w", err)
		}
		batch = batch[:0]
		return nil
	}

	for cursor.Next(ctx) {
		var source athensCompany
		if err := cursor.Decode(&source); err != nil {
			return CompanyCopyResult{}, fmt.Errorf("decode company: %w", err)
		}
		sourceID := source.ID.Hex()
		if sourceID == "" {
			continue
		}
		id := existing[sourceID]
		if !isPublicID(id) {
			id, err = newPublicID()
			if err != nil {
				return CompanyCopyResult{}, err
			}
			existing[sourceID] = id
		}
		doc := storedCompany{
			ID:          id,
			SourceID:    sourceID,
			CompanyName: source.CompanyName,
			CompanyURL:  source.CompanyURL,
			CompanyKey:  source.CompanyKey,
			CompanyLogo: source.CompanyLogo,
			JobCount:    source.JobCount,
			JobIDs:      hexIDs(source.JobIDs),
		}
		// Source fields only. Admin edits live on `overrides` and must survive a resync.
		batch = append(batch, mongo.NewUpdateOneModel().
			SetFilter(bson.D{{Key: "sourceId", Value: sourceID}}).
			SetUpdate(bson.D{{Key: "$set", Value: bson.D{
				{Key: "id", Value: doc.ID},
				{Key: "sourceId", Value: doc.SourceID},
				{Key: "companyName", Value: doc.CompanyName},
				{Key: "companyUrl", Value: doc.CompanyURL},
				{Key: "companyKey", Value: doc.CompanyKey},
				{Key: "companyLogo", Value: doc.CompanyLogo},
				{Key: "jobCount", Value: doc.JobCount},
				{Key: "jobIds", Value: doc.JobIDs},
			}}}).
			SetUpsert(true))
		copied++
		if len(batch) == companyCopyBatch {
			if err := flush(); err != nil {
				return CompanyCopyResult{}, err
			}
			if copied%2000 == 0 {
				slog.Info("copying companies", "copied", copied)
			}
		}
	}
	if err := cursor.Err(); err != nil {
		return CompanyCopyResult{}, err
	}
	if err := flush(); err != nil {
		return CompanyCopyResult{}, err
	}

	linked, err := s.linkJobsToCompanies(ctx)
	if err != nil {
		return CompanyCopyResult{}, err
	}
	return CompanyCopyResult{
		Copied: copied,
		Linked: linked,
		Source: s.sourceDB + "." + s.sourceCompanies,
		Dest:   s.destDB + "." + s.destCompanies,
	}, nil
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
	cursor, err := s.structured().Find(ctx, bson.D{{Key: "job.companyId", Value: companyID}}, opts)
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

func (s *Store) linkJobsToCompanies(ctx context.Context) (int64, error) {
	cursor, err := s.structured().Find(ctx, bson.D{})
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)

	var linked int64
	for cursor.Next(ctx) {
		var doc storedSearchJob
		if err := cursor.Decode(&doc); err != nil {
			return linked, err
		}
		publicID := doc.Job.ID
		if !isPublicID(publicID) {
			publicID, err = newPublicID()
			if err != nil {
				return linked, err
			}
		}
		companyID := doc.Job.CompanyID
		if companyID == "" {
			companyID, err = s.companyIDForTempJob(ctx, doc.TempJobID)
			if err != nil {
				return linked, err
			}
		}
		_, err = s.structured().UpdateOne(ctx, bson.D{{Key: "_id", Value: doc.ID}}, bson.D{
			{Key: "$set", Value: bson.D{
				{Key: "job.id", Value: publicID},
				{Key: "job.companyId", Value: companyID},
			}},
			{Key: "$unset", Value: bson.D{{Key: "job.companySlug", Value: ""}}},
		})
		if err != nil {
			return linked, fmt.Errorf("link job %s: %w", doc.TempJobID, err)
		}
		linked++
	}
	return linked, cursor.Err()
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
	jobs, err := s.enrichCompanies(ctx, []catalogJob{CatalogJob(record)})
	if err != nil || len(jobs) == 0 {
		return catalogJob{}, err
	}
	return jobs[0], nil
}

func (s *Store) companyIDForTempJob(ctx context.Context, tempJobID string) (string, error) {
	objectID, err := bson.ObjectIDFromHex(tempJobID)
	if err != nil {
		return "", nil
	}
	listing, err := s.tempListing(ctx, objectID)
	if errors.Is(err, ErrNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return s.publicCompanyID(ctx, listing.CompanyID)
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
