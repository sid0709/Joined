package jobs

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type SearchRecord struct {
	Job           SearchJob `json:"job"`
	TempJobID     string    `json:"tempJobId"`
	ApplyLink     string    `json:"applyLink"`
	AnalyzedAt    time.Time `json:"analyzedAt"`
	Model         string    `json:"model"`
	CreatedBy     string    `json:"createdBy,omitempty"`
	Source        string    `json:"source,omitempty"`
	ListingStatus string    `json:"listingStatus,omitempty"`
}

type SearchList struct {
	Jobs     []JobRow `json:"jobs"`
	Total    int64    `json:"total"`
	Page     int64    `json:"page"`
	PageSize int64    `json:"pageSize"`
	Pending  int64    `json:"pending"`
}

type storedSearchJob struct {
	ID                    bson.ObjectID `bson:"_id"`
	TempJobID             string        `bson:"tempJobId"`
	PostedAt              time.Time     `bson:"postedAt"`
	ApplyLink             string        `bson:"applyLink"`
	AnalyzedAt            time.Time     `bson:"analyzedAt"`
	Model                 string        `bson:"model"`
	CreatedBy             string        `bson:"createdBy,omitempty"`
	Source                string        `bson:"source,omitempty"`
	SourceRef             string        `bson:"sourceRef,omitempty"`
	ListingStatus         string        `bson:"listingStatus,omitempty"`
	PreviousListingStatus string        `bson:"previousListingStatus,omitempty"`
	TakedownCause         string        `bson:"takedownCause,omitempty"`
	LinkCheckFailures     int           `bson:"linkCheckFailures,omitempty"`
	LastLinkCheckedAt     time.Time     `bson:"lastLinkCheckedAt,omitempty"`
	LastVerifiedOpenAt    time.Time     `bson:"lastVerifiedOpenAt,omitempty"`
	ExpiredAt             time.Time     `bson:"expiredAt,omitempty"`
	LinkCheckSignal       string        `bson:"linkCheckSignal,omitempty"`
	ReviewNote            string        `bson:"reviewNote,omitempty"`
	ReviewedBy            string        `bson:"reviewedBy,omitempty"`
	ReviewedAt            time.Time     `bson:"reviewedAt,omitempty"`
	Job                   SearchJob     `bson:"job"`
	DedupeKey             string        `bson:"dedupeKey,omitempty"`
	// SourceCompanyID is the temp job's source company, kept so the job can still be
	// linked to its company once the temp job is dropped.
	SourceCompanyID string `bson:"sourceCompanyId,omitempty"`
}

type tempListing struct {
	ID              bson.ObjectID `bson:"_id"`
	Title           string        `bson:"title"`
	CompanyName     string        `bson:"companyName"`
	Description     string        `bson:"description"`
	CompanyID       bson.ObjectID `bson:"companyId"`
	ApplyLink       string        `bson:"applyLink"`
	PostedAt        time.Time     `bson:"postedAt"`
	CreatedBy       string        `bson:"createdBy"`
	Source          string        `bson:"source"`
	SourceRef       string        `bson:"sourceRef,omitempty"`
	CompanyPublicID string        `bson:"companyPublicId,omitempty"`
	Equity          bool          `bson:"equity,omitempty"`
	Pay             Pay           `bson:"pay,omitempty"`
	Metadata        struct {
		Details struct {
			Location  string `bson:"location"`
			Time      string `bson:"time"`
			Remote    string `bson:"remote"`
			Seniority string `bson:"seniority"`
			Salary    string `bson:"salary"`
		} `bson:"details"`
	} `bson:"metadata"`
}

// sourceCompanyID is the source company id the listing was copied with, if any.
func (listing tempListing) sourceCompanyID() string {
	if listing.CompanyID.IsZero() {
		return ""
	}
	return listing.CompanyID.Hex()
}

const maxSearchCatalog = 2000

type catalogJob struct {
	SearchJob
	ApplyLink      string         `json:"applyLink,omitempty"`
	CompanyURL     string         `json:"companyUrl,omitempty"`
	CompanyLogo    string         `json:"companyLogo,omitempty"`
	CreatedBy      string         `json:"createdBy,omitempty"`
	ListingSource  string         `json:"listingSource,omitempty"`
	Hidden         bool           `json:"hidden"`
	CompanyProfile *PublicCompany `json:"companyProfile,omitempty"`
}

type SearchCatalog struct {
	Jobs  []catalogJob `json:"jobs"`
	Total int64        `json:"total"`
}

func CatalogJob(record SearchRecord) catalogJob {
	return catalogJob{
		SearchJob:     record.Job,
		ApplyLink:     record.ApplyLink,
		CreatedBy:     record.CreatedBy,
		ListingSource: record.Source,
		Hidden:        isHiddenJob(record.Job.Source, record.Source),
	}
}

func (s *Store) ListCatalog(ctx context.Context, now time.Time) (SearchCatalog, error) {
	coll := s.structured()
	filter := publicListingFilter()
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return SearchCatalog{}, err
	}
	opts := options.Find().
		SetLimit(maxSearchCatalog).
		SetSort(bson.D{{Key: "analyzedAt", Value: -1}, {Key: "_id", Value: -1}})
	cursor, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return SearchCatalog{}, err
	}
	defer cursor.Close(ctx)

	var docs []storedSearchJob
	if err := cursor.All(ctx, &docs); err != nil {
		return SearchCatalog{}, err
	}
	jobs := make([]catalogJob, 0, len(docs))
	for _, doc := range docs {
		jobs = append(jobs, CatalogJob(doc.view(now)))
	}
	jobs, err = s.enrichCompanies(ctx, jobs)
	if err != nil {
		return SearchCatalog{}, err
	}
	return SearchCatalog{Jobs: jobs, Total: total}, nil
}

func (s *Store) enrichCompanies(ctx context.Context, jobs []catalogJob) ([]catalogJob, error) {
	if len(jobs) == 0 {
		return jobs, nil
	}
	ids := make([]string, 0, len(jobs))
	seen := map[string]struct{}{}
	for _, job := range jobs {
		if job.CompanyID == "" {
			continue
		}
		if _, ok := seen[job.CompanyID]; ok {
			continue
		}
		seen[job.CompanyID] = struct{}{}
		ids = append(ids, job.CompanyID)
	}
	if len(ids) == 0 {
		return jobs, nil
	}
	cursor, err := s.companies().Find(ctx, bson.D{{Key: "id", Value: bson.D{{Key: "$in", Value: ids}}}}, options.Find().SetProjection(bson.D{
		{Key: "id", Value: 1},
		{Key: "companyName", Value: 1},
		{Key: "companyUrl", Value: 1},
		{Key: "companyLogo", Value: 1},
		{Key: "overrides", Value: 1},
		{Key: "logoFile.contentType", Value: 1},
	}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	briefs := map[string]storedCompany{}
	for cursor.Next(ctx) {
		var doc storedCompany
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		briefs[doc.ID] = doc
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	for i := range jobs {
		brief, ok := briefs[jobs[i].CompanyID]
		if !ok {
			continue
		}
		profile := brief.publicCompany()
		jobs[i].CompanyURL = profile.URL
		jobs[i].CompanyLogo = profile.Logo
		jobs[i].CompanyProfile = &profile
	}
	return jobs, nil
}

func (s *Store) GetSearch(ctx context.Context, id string, now time.Time) (SearchRecord, error) {
	coll := s.structured()
	var doc storedSearchJob
	if objectID, err := bson.ObjectIDFromHex(id); err == nil {
		err = coll.FindOne(ctx, bson.D{{Key: "_id", Value: objectID}}).Decode(&doc)
		if errors.Is(err, mongo.ErrNoDocuments) {
			return SearchRecord{}, ErrNotFound
		}
		if err != nil {
			return SearchRecord{}, err
		}
		return doc.view(now), nil
	}

	err := coll.FindOne(ctx, bson.D{{Key: "job.id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return SearchRecord{}, ErrNotFound
	}
	if err != nil {
		return SearchRecord{}, err
	}
	return doc.view(now), nil
}

// SearchJobPatch is what an admin can edit on an analyzed job. Every field is
// applied as given — the caller (the admin UI) sends the full edited record,
// not a sparse diff, since every field is either an enum with a safe default
// or a value the admin has already seen populated in the edit form.
type SearchJobPatch struct {
	Title            string   `json:"title"`
	Company          string   `json:"company"`
	Location         string   `json:"location"`
	Workplace        string   `json:"workplace"`
	Pay              Pay      `json:"pay"`
	Seniority        string   `json:"seniority"`
	Employment       string   `json:"employment"`
	Visa             bool     `json:"visa"`
	Team             string   `json:"team"`
	Skills           []string `json:"skills"`
	Summary          string   `json:"summary"`
	Responsibilities []string `json:"responsibilities"`
	Requirements     []string `json:"requirements"`
	Benefits         []string `json:"benefits"`
	ApplyLink        string   `json:"applyLink"`
}

// UpdateSearchJob applies an admin's manual edit on top of the stored record.
// Identity fields (id, company id, source, posted/analyzed timestamps, model)
// are untouched — only what the edit form exposes can change.
func (s *Store) UpdateSearchJob(ctx context.Context, id string, patch SearchJobPatch, now time.Time) (SearchRecord, error) {
	coll := s.structured()
	filter, err := searchIDFilter(id)
	if err != nil {
		return SearchRecord{}, err
	}
	var doc storedSearchJob
	if err := coll.FindOne(ctx, filter).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return SearchRecord{}, ErrNotFound
		}
		return SearchRecord{}, err
	}

	s.backfillDescription(ctx, &doc)
	job := doc.Job
	job.Title = fallback(strings.TrimSpace(patch.Title), job.Title)
	job.Company = fallback(strings.TrimSpace(patch.Company), job.Company)
	job.Location = fallback(strings.TrimSpace(patch.Location), locationNotListed)
	job.Workplace = oneOf(patch.Workplace, []string{workplaceRemote, workplaceHybrid, workplaceOnsite}, job.Workplace)
	job.Pay = sanitizePay(patch.Pay)
	job.Seniority = oneOf(patch.Seniority, []string{seniorityJunior, seniorityMiddle, senioritySenior, seniorityLeader, seniorityManager}, job.Seniority)
	job.Employment = oneOf(patch.Employment, []string{employmentFullTime, employmentContract, employmentPartTime}, job.Employment)
	job.Visa = patch.Visa
	job.Team = strings.TrimSpace(patch.Team)
	job.Skills = cleanList(patch.Skills, maxSkills)
	job.Summary = truncate(strings.TrimSpace(patch.Summary), maxSummaryRunes)
	job.Responsibilities = cleanList(patch.Responsibilities, maxBullets)
	job.Requirements = cleanList(patch.Requirements, maxBullets)
	job.Benefits = cleanList(patch.Benefits, maxBullets)
	doc.Job = job
	if link := strings.TrimSpace(patch.ApplyLink); link != "" {
		doc.ApplyLink = link
	}

	if err := s.saveSearchJob(ctx, doc); err != nil {
		return SearchRecord{}, err
	}
	return doc.view(now), nil
}

func searchIDFilter(id string) (bson.D, error) {
	if objectID, err := bson.ObjectIDFromHex(id); err == nil {
		return bson.D{{Key: "_id", Value: objectID}}, nil
	}
	if id == "" {
		return nil, ErrNotFound
	}
	return bson.D{{Key: "job.id", Value: id}}, nil
}

// sanitizePay clamps a manually-edited pay range the same way an extracted one is:
// no negatives, min<=max, a real 3-letter currency, and a valid period.
func sanitizePay(pay Pay) Pay {
	return normalizePay(extractedPay{
		Min:       float64(pay.Min),
		Max:       float64(pay.Max),
		Currency:  pay.Currency,
		Period:    pay.Period,
		Estimated: pay.Estimated,
	}, "")
}

func (s *Store) tempListing(ctx context.Context, id bson.ObjectID) (tempListing, error) {
	var listing tempListing
	err := s.dest().FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&listing)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return tempListing{}, ErrNotFound
	}
	return listing, err
}

func (s *Store) saveSearchJob(ctx context.Context, doc storedSearchJob) error {
	if strings.TrimSpace(doc.Job.Description) == "" {
		return ErrMissingDescription
	}
	held, err := s.applyScamHold(ctx, doc)
	if err != nil {
		return err
	}
	return s.upsertDeduped(ctx, held)
}

func (s *Store) pendingCount(ctx context.Context) (int64, error) {
	tempCount, err := s.dest().CountDocuments(ctx, bson.D{})
	if err != nil {
		return 0, err
	}
	// Published temp jobs are dropped, so every temp job not marked is still pending.
	notPublishable, err := s.dest().CountDocuments(ctx, bson.D{{Key: notPublishableField, Value: bson.D{{Key: "$exists", Value: true}}}})
	if err != nil {
		return 0, err
	}
	pending := tempCount - notPublishable
	if pending < 0 {
		return 0, nil
	}
	return pending, nil
}

func (s *Store) analyzedIDs(ctx context.Context, ids []bson.ObjectID) ([]string, error) {
	if len(ids) == 0 {
		return []string{}, nil
	}
	hexes := make([]string, len(ids))
	onPage := make(map[string]struct{}, len(ids))
	for i, id := range ids {
		hexes[i] = id.Hex()
		onPage[hexes[i]] = struct{}{}
	}
	cursor, err := s.structured().Find(
		ctx,
		bson.D{{Key: "$or", Value: bson.A{
			bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: ids}}}},
			bson.D{{Key: "tempJobId", Value: bson.D{{Key: "$in", Value: hexes}}}},
		}}},
		options.Find().SetProjection(bson.D{{Key: "_id", Value: 1}, {Key: "tempJobId", Value: 1}}),
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	found := make([]string, 0, len(ids))
	seen := make(map[string]struct{}, len(ids))
	for cursor.Next(ctx) {
		var doc struct {
			ID        bson.ObjectID `bson:"_id"`
			TempJobID string        `bson:"tempJobId"`
		}
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		match := doc.ID.Hex()
		if _, ok := onPage[match]; !ok {
			match = doc.TempJobID
		}
		if _, ok := onPage[match]; !ok {
			continue
		}
		if _, ok := seen[match]; ok {
			continue
		}
		seen[match] = struct{}{}
		found = append(found, match)
	}
	return found, cursor.Err()
}

func (s *Store) analyzedObjectIDs(ctx context.Context) ([]bson.ObjectID, error) {
	cursor, err := s.structured().Find(
		ctx,
		bson.D{},
		options.Find().SetProjection(bson.D{{Key: "_id", Value: 1}, {Key: "tempJobId", Value: 1}}),
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	ids := []bson.ObjectID{}
	seen := map[bson.ObjectID]struct{}{}
	for cursor.Next(ctx) {
		var doc struct {
			ID        bson.ObjectID `bson:"_id"`
			TempJobID string        `bson:"tempJobId"`
		}
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		add := func(id bson.ObjectID) {
			if id.IsZero() {
				return
			}
			if _, ok := seen[id]; ok {
				return
			}
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
		add(doc.ID)
		if parsed, err := bson.ObjectIDFromHex(doc.TempJobID); err == nil {
			add(parsed)
		}
	}
	return ids, cursor.Err()
}

func (s *Store) structured() *mongo.Collection {
	return s.client.Database(s.destDB).Collection(s.structuredCollection)
}

func (doc storedSearchJob) view(now time.Time) SearchRecord {
	job := doc.Job
	job.PostedHoursAgo = hoursSince(doc.PostedAt, now)
	job.Skills = cleanList(job.Skills, maxSkills)
	job.Responsibilities = cleanList(job.Responsibilities, maxBullets)
	job.Requirements = cleanList(job.Requirements, maxBullets)
	job.Benefits = cleanList(job.Benefits, maxBullets)
	if job.ScreeningQuestions == nil {
		job.ScreeningQuestions = []ScreeningQuestion{}
	}
	return SearchRecord{
		Job:           job,
		TempJobID:     doc.TempJobID,
		ApplyLink:     doc.ApplyLink,
		AnalyzedAt:    doc.AnalyzedAt,
		Model:         doc.Model,
		CreatedBy:     doc.CreatedBy,
		Source:        doc.Source,
		ListingStatus: doc.ListingStatus,
	}
}

const provenanceBatch = 200

type provenanceJob struct {
	ID        bson.ObjectID `bson:"_id"`
	TempJobID string        `bson:"tempJobId"`
}

// BackfillJobProvenance copies createdBy and source from each temp job onto the
// analyzed job that came from it.
func (s *Store) BackfillJobProvenance(ctx context.Context) (int64, error) {
	cursor, err := s.structured().Find(ctx, bson.D{}, options.Find().SetProjection(bson.D{
		{Key: "_id", Value: 1},
		{Key: "tempJobId", Value: 1},
	}))
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)

	var updated int64
	batch := make([]provenanceJob, 0, provenanceBatch)
	flush := func() error {
		n, err := s.writeProvenance(ctx, batch)
		batch = batch[:0]
		updated += n
		return err
	}
	for cursor.Next(ctx) {
		var row provenanceJob
		if err := cursor.Decode(&row); err != nil {
			return updated, err
		}
		if row.TempJobID == "" {
			continue
		}
		batch = append(batch, row)
		if len(batch) == provenanceBatch {
			if err := flush(); err != nil {
				return updated, err
			}
		}
	}
	if err := cursor.Err(); err != nil {
		return updated, err
	}
	if err := flush(); err != nil {
		return updated, err
	}
	return updated, nil
}

func (s *Store) writeProvenance(ctx context.Context, rows []provenanceJob) (int64, error) {
	if len(rows) == 0 {
		return 0, nil
	}
	ids := make([]bson.ObjectID, 0, len(rows))
	jobByTemp := make(map[string]bson.ObjectID, len(rows))
	for _, row := range rows {
		objectID, err := bson.ObjectIDFromHex(row.TempJobID)
		if err != nil {
			continue
		}
		ids = append(ids, objectID)
		jobByTemp[objectID.Hex()] = row.ID
	}
	if len(ids) == 0 {
		return 0, nil
	}
	cursor, err := s.dest().Find(ctx, bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: ids}}}}, options.Find().SetProjection(bson.D{
		{Key: "createdBy", Value: 1},
		{Key: "source", Value: 1},
	}))
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)

	type tempProvenance struct {
		ID        bson.ObjectID `bson:"_id"`
		CreatedBy string        `bson:"createdBy"`
		Source    string        `bson:"source"`
	}
	models := make([]mongo.WriteModel, 0, len(ids))
	for cursor.Next(ctx) {
		var temp tempProvenance
		if err := cursor.Decode(&temp); err != nil {
			return 0, err
		}
		jobID, ok := jobByTemp[temp.ID.Hex()]
		if !ok {
			continue
		}
		models = append(models, mongo.NewUpdateOneModel().
			SetFilter(bson.D{{Key: "_id", Value: jobID}}).
			SetUpdate(bson.D{{Key: "$set", Value: bson.D{
				{Key: "createdBy", Value: strings.TrimSpace(temp.CreatedBy)},
				{Key: "source", Value: strings.TrimSpace(temp.Source)},
			}}}))
	}
	if err := cursor.Err(); err != nil {
		return 0, err
	}
	if len(models) == 0 {
		return 0, nil
	}
	result, err := s.structured().BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false))
	if err != nil {
		return 0, err
	}
	return result.ModifiedCount, nil
}
