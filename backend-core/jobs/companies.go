package jobs

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

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

// companyIDsBySource maps source ids to public ids across staging and companies, and
// lists the source ids that are published.
func (s *Store) companyIDsBySource(ctx context.Context) (map[string]string, map[string]struct{}, error) {
	ids := map[string]string{}
	published := map[string]struct{}{}
	// Published last, so a company in both keeps its published id.
	for _, side := range []struct {
		coll      *mongo.Collection
		published bool
	}{{s.stagedCompanies(), false}, {s.companies(), true}} {
		cursor, err := side.coll.Find(ctx, bson.D{}, options.Find().SetProjection(bson.D{
			{Key: "sourceId", Value: 1},
			{Key: "id", Value: 1},
		}))
		if err != nil {
			return nil, nil, err
		}
		for cursor.Next(ctx) {
			var doc struct {
				ID       string `bson:"id"`
				SourceID string `bson:"sourceId"`
			}
			if err := cursor.Decode(&doc); err != nil {
				cursor.Close(ctx)
				return nil, nil, err
			}
			if doc.SourceID == "" || doc.ID == "" {
				continue
			}
			ids[doc.SourceID] = doc.ID
			if side.published {
				published[doc.SourceID] = struct{}{}
			}
		}
		err = cursor.Err()
		cursor.Close(ctx)
		if err != nil {
			return nil, nil, err
		}
	}
	return ids, published, nil
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

// publicCompanyID is the public id of the source company, published or still staged,
// so a job links to its company before research publishes it.
func (s *Store) publicCompanyID(ctx context.Context, source bson.ObjectID) (string, error) {
	if source.IsZero() {
		return "", nil
	}
	for _, coll := range []*mongo.Collection{s.companies(), s.stagedCompanies()} {
		var doc struct {
			ID string `bson:"id"`
		}
		err := coll.FindOne(
			ctx,
			bson.D{{Key: "sourceId", Value: source.Hex()}},
			options.FindOne().SetProjection(bson.D{{Key: "id", Value: 1}}),
		).Decode(&doc)
		if errors.Is(err, mongo.ErrNoDocuments) {
			continue
		}
		if err != nil {
			return "", err
		}
		return doc.ID, nil
	}
	return "", nil
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

func (s *Store) companies() *mongo.Collection {
	return s.client.Database(s.destDB).Collection(s.destCompanies)
}
