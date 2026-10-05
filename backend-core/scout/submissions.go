package scout

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// MaxBatchSize is how many submissions one batch request may carry.
const MaxBatchSize = 50

// reviewerAuto marks decisions the pipeline made by itself.
const reviewerAuto = "auto"

// Actor is who is calling: a signed-in scout, or a scout's API key.
type Actor struct {
	UserID   string
	APIKeyID string
}

func (a Actor) channel() string {
	if a.APIKeyID != "" {
		return ChannelAPI
	}
	return ChannelWeb
}

// QuotaError says the daily submission limit is used up.
type QuotaError struct {
	Quota Quota
}

func (e *QuotaError) Error() string { return ErrQuotaExceeded.Error() }
func (e *QuotaError) Unwrap() error { return ErrQuotaExceeded }

// Quota is the scout's daily submission allowance.
type Quota struct {
	Limit     int       `json:"limit"`
	Remaining int       `json:"remaining"`
	ResetsAt  time.Time `json:"resets_at"`
}

// Quota reports how many submissions the scout has left today.
func (s *Store) Quota(ctx context.Context, userID string) (Quota, error) {
	profile, err := s.EnsureProfile(ctx, userID)
	if err != nil {
		return Quota{}, err
	}
	return s.quotaFor(ctx, userID, profile.Level)
}

func (s *Store) quotaFor(ctx context.Context, userID, level string) (Quota, error) {
	dayStart := startOfDay(s.now())
	var used int64
	var err error
	if s.docs != nil {
		used, err = s.docs.countSubmissionsSince(ctx, userID, dayStart)
	} else {
		used, err = s.collection(submissionsCollection).CountDocuments(ctx, bson.D{
			{Key: "scoutUserId", Value: userID},
			{Key: "submittedAt", Value: bson.D{{Key: "$gte", Value: dayStart}}},
		})
	}
	if err != nil {
		return Quota{}, err
	}
	limit := Rule(level).DailyLimit
	return Quota{Limit: limit, Remaining: max(0, limit-int(used)), ResetsAt: dayStart.Add(24 * time.Hour)}, nil
}

// Submit validates a job link, stores it, and queues the automatic checks.
func (s *Store) Submit(ctx context.Context, actor Actor, input SubmissionInput) (Submission, error) {
	profile, err := s.EnsureProfile(ctx, actor.UserID)
	if err != nil {
		return Submission{}, err
	}
	if profile.TermsAcceptedAt == nil {
		return Submission{}, ErrTermsRequired
	}
	normalized, parsed, err := NormalizeInput(input)
	if err != nil {
		return Submission{}, err
	}
	quota, err := s.quotaFor(ctx, actor.UserID, profile.Level)
	if err != nil {
		return Submission{}, err
	}
	if quota.Remaining <= 0 {
		return Submission{}, &QuotaError{Quota: quota}
	}
	if normalized.ExternalRef != "" {
		if existing, err := s.byExternalRef(ctx, actor.UserID, normalized.ExternalRef); err == nil {
			return Submission{}, &ConflictError{Detail: "external_ref is already used by another submission", ExistingID: existing.ID}
		} else if !errors.Is(err, ErrNotFound) {
			return Submission{}, err
		}
	}
	var matches []Match
	if s.docs != nil {
		matches, err = s.docs.matches(ctx, MatchQuery{
			URL:         normalized.URL,
			CompanyID:   normalized.CompanyID,
			CompanyName: normalized.CompanyName,
			Title:       normalized.Title,
		}, bson.ObjectID{})
	} else {
		matches, err = s.FindMatches(ctx, MatchQuery{
			URL:         normalized.URL,
			CompanyID:   normalized.CompanyID,
			CompanyName: normalized.CompanyName,
			Title:       normalized.Title,
		}, bson.ObjectID{})
	}
	if err != nil {
		return Submission{}, err
	}
	if len(matches) > 0 && !normalized.NotDuplicateClaim {
		return Submission{}, &ValidationError{Fields: []FieldError{{Field: "not_duplicate_claim", Detail: "confirm this is not the same job"}}}
	}

	now := s.now().UTC()
	sub := Submission{
		ObjectID:       bson.NewObjectID(),
		ScoutUserID:    actor.UserID,
		Channel:        actor.channel(),
		APIKeyID:       actor.APIKeyID,
		ExternalRef:    normalized.ExternalRef,
		URL:            parsed.Raw,
		CanonicalURL:   parsed.Canonical,
		Host:           parsed.Host,
		ATS:            parsed.ATS,
		CompanyName:    normalized.CompanyName,
		CompanyID:      normalized.CompanyID,
		Title:          normalized.Title,
		LocationText:   normalized.LocationText,
		Workplace:      normalized.Workplace,
		Employment:     normalized.Employment,
		Seniority:      normalized.Seniority,
		Pay:            normalized.Pay,
		Equity:         normalized.Equity,
		SalaryText:     normalized.SalaryText,
		Summary:        normalized.Summary,
		DedupeKey:      DedupeKey(normalized.CompanyID, normalized.CompanyName, normalized.Title),
		DuplicateClaim: normalized.NotDuplicateClaim,
		Matches:        matches,
		HiddenJob:      true,
		Status:         StatusSubmitted,
		Checks:         []Check{},
		SubmittedAt:    now,
		UpdatedAt:      now,
	}
	if _, err := s.insertSubmission(ctx, sub); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			existing, lookupErr := s.byExternalRef(ctx, actor.UserID, normalized.ExternalRef)
			if lookupErr == nil {
				return Submission{}, &ConflictError{Detail: "external_ref is already used by another submission", ExistingID: existing.ID}
			}
		}
		return Submission{}, err
	}
	sub.fill()
	if s.publisher != nil {
		tempID, stageErr := s.publisher.StageScouted(ctx, stagedListing(sub), now)
		if stageErr != nil {
			_, _ = s.collection(submissionsCollection).DeleteOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}})
			return Submission{}, stageErr
		}
		if _, stageErr = s.collection(submissionsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}}, bson.D{
			{Key: "$set", Value: bson.D{{Key: "tempJobId", Value: tempID}}},
		}); stageErr != nil {
			return Submission{}, stageErr
		}
	}
	s.enqueue(sub.ObjectID)
	return sub, nil
}

// SubmitFromExtension accepts a captured job from the Scout extension and
// stores it through Submit (same scout_submissions collection).
func (s *Store) SubmitFromExtension(ctx context.Context, actor Actor, input ExtensionSubmissionInput) (Submission, error) {
	normalized, err := NormalizeExtensionInput(input)
	if err != nil {
		return Submission{}, err
	}
	return s.Submit(ctx, actor, extensionToSubmission(normalized))
}

// extensionToSubmission maps the captured-job shape onto the existing
// submission input. The extension does not collect pay, workplace, or
// employment; those use documented defaults so Submit stays the one path.
func extensionToSubmission(in ExtensionSubmissionInput) SubmissionInput {
	return SubmissionInput{
		URL:               in.ApplyURL,
		CompanyName:       in.Company,
		Title:             in.Title,
		LocationText:      in.Location,
		Summary:           in.Description,
		Workplace:         WorkplaceRemote,
		Employment:        EmploymentFullTime,
		Equity:            true,
		NotDuplicateClaim: true,
	}
}

func stagedListing(sub Submission) jobs.ScoutedListing {
	return jobs.ScoutedListing{
		SubmissionID: sub.ID,
		ScoutUserID:  sub.ScoutUserID,
		ApplyLink:    sub.URL,
		CompanyName:  sub.CompanyName,
		CompanyID:    sub.CompanyID,
		Title:        sub.Title,
		Location:     sub.LocationText,
		Workplace:    sub.Workplace,
		Employment:   sub.Employment,
		Seniority:    sub.Seniority,
		Pay:          jobs.Pay{Min: sub.Pay.Min, Max: sub.Pay.Max, Currency: sub.Pay.Currency, Period: sub.Pay.Period},
		Equity:       sub.Equity,
		SalaryText:   sub.SalaryText,
		Summary:      sub.Summary,
		SubmittedAt:  sub.SubmittedAt,
	}
}

// insertSubmission leaves externalRef out when empty so the unique index only
// covers refs that were actually sent.
func (s *Store) insertSubmission(ctx context.Context, sub Submission) (*mongo.InsertOneResult, error) {
	if s.docs != nil {
		return &mongo.InsertOneResult{}, s.docs.insertSubmission(ctx, sub)
	}
	raw, err := bson.Marshal(sub)
	if err != nil {
		return nil, err
	}
	var doc bson.D
	if err := bson.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	if sub.ExternalRef == "" {
		filtered := doc[:0]
		for _, field := range doc {
			if field.Key != "externalRef" {
				filtered = append(filtered, field)
			}
		}
		doc = filtered
	}
	return s.collection(submissionsCollection).InsertOne(ctx, doc)
}

// BatchResult is one item of a batch submission.
type BatchResult struct {
	Index      int         `json:"index"`
	Submission *Submission `json:"submission,omitempty"`
	Error      *ItemError  `json:"error,omitempty"`
}

// ItemError explains why one batch item was not accepted.
type ItemError struct {
	Code       string       `json:"code"`
	Detail     string       `json:"detail"`
	Fields     []FieldError `json:"errors,omitempty"`
	ExistingID string       `json:"existing_id,omitempty"`
}

// SubmitBatch accepts up to MaxBatchSize submissions; each item succeeds or
// fails on its own.
func (s *Store) SubmitBatch(ctx context.Context, actor Actor, inputs []SubmissionInput) ([]BatchResult, error) {
	if len(inputs) == 0 || len(inputs) > MaxBatchSize {
		return nil, &ValidationError{Fields: []FieldError{{Field: "submissions", Detail: fmt.Sprintf("send between 1 and %d submissions", MaxBatchSize)}}}
	}
	results := make([]BatchResult, 0, len(inputs))
	for i, input := range inputs {
		sub, err := s.Submit(ctx, actor, input)
		if err == nil {
			created := sub
			results = append(results, BatchResult{Index: i, Submission: &created})
			continue
		}
		item := &ItemError{Code: "internal_error", Detail: "could not store this submission"}
		var fields *ValidationError
		var conflict *ConflictError
		switch {
		case errors.As(err, &fields):
			item = &ItemError{Code: "validation_failed", Detail: "check the fields", Fields: fields.Fields}
		case errors.As(err, &conflict):
			item = &ItemError{Code: "conflict", Detail: conflict.Detail, ExistingID: conflict.ExistingID}
		case errors.Is(err, ErrQuotaExceeded):
			item = &ItemError{Code: "quota_exceeded", Detail: err.Error()}
		case errors.Is(err, ErrTermsRequired):
			return nil, err
		default:
			slog.Error("scout batch item", "index", i, "error", err)
		}
		results = append(results, BatchResult{Index: i, Error: item})
	}
	return results, nil
}

// SubmissionQuery filters a scout's own submissions.
type SubmissionQuery struct {
	Status       string
	Cursor       string
	Limit        int
	UpdatedSince *time.Time
	ExternalRef  string
}

// ListSubmissions pages a scout's submissions newest first.
func (s *Store) ListSubmissions(ctx context.Context, userID string, query SubmissionQuery) (List[Submission], error) {
	filter := bson.D{{Key: "scoutUserId", Value: userID}}
	if query.Status != "" {
		if !validStatus(query.Status) {
			return List[Submission]{}, &ValidationError{Fields: []FieldError{{Field: "status", Detail: "unknown status"}}}
		}
		filter = append(filter, bson.E{Key: "status", Value: query.Status})
	}
	if query.UpdatedSince != nil {
		filter = append(filter, bson.E{Key: "updatedAt", Value: bson.D{{Key: "$gte", Value: query.UpdatedSince.UTC()}}})
	}
	if query.ExternalRef != "" {
		filter = append(filter, bson.E{Key: "externalRef", Value: query.ExternalRef})
	}
	filter, err := cursorFilter(filter, query.Cursor)
	if err != nil {
		return List[Submission]{}, err
	}
	limit := listLimit(query.Limit)
	cursor, err := s.collection(submissionsCollection).Find(ctx, filter,
		options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(int64(limit+1)))
	if err != nil {
		return List[Submission]{}, err
	}
	var subs []Submission
	if err := cursor.All(ctx, &subs); err != nil {
		return List[Submission]{}, err
	}
	next := ""
	if len(subs) > limit {
		subs = subs[:limit]
		next = subs[len(subs)-1].ObjectID.Hex()
	}
	if subs == nil {
		subs = []Submission{}
	}
	for i := range subs {
		subs[i].fill()
	}
	if err := s.attachActivity(ctx, subs); err != nil {
		return List[Submission]{}, err
	}
	return List[Submission]{Data: subs, NextCursor: next}, nil
}

// GetSubmission returns one of the scout's own submissions.
func (s *Store) GetSubmission(ctx context.Context, userID, id string) (Submission, error) {
	sub, err := s.submission(ctx, id)
	if err != nil {
		return Submission{}, err
	}
	if sub.ScoutUserID != userID {
		return Submission{}, ErrNotFound
	}
	subs := []Submission{sub}
	if err := s.attachActivity(ctx, subs); err != nil {
		return Submission{}, err
	}
	return subs[0], nil
}

func (s *Store) submission(ctx context.Context, id string) (Submission, error) {
	oid, err := objectID(id)
	if err != nil {
		return Submission{}, err
	}
	var sub Submission
	err = s.collection(submissionsCollection).FindOne(ctx, bson.D{{Key: "_id", Value: oid}}).Decode(&sub)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Submission{}, ErrNotFound
	}
	if err != nil {
		return Submission{}, err
	}
	sub.fill()
	return sub, nil
}

func (s *Store) byExternalRef(ctx context.Context, userID, ref string) (Submission, error) {
	if s.docs != nil {
		return s.docs.submissionByExternalRef(ctx, userID, ref)
	}
	var sub Submission
	err := s.collection(submissionsCollection).FindOne(ctx, bson.D{
		{Key: "scoutUserId", Value: userID},
		{Key: "externalRef", Value: ref},
	}).Decode(&sub)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Submission{}, ErrNotFound
	}
	if err != nil {
		return Submission{}, err
	}
	sub.fill()
	return sub, nil
}

func (s *Store) attachActivity(ctx context.Context, subs []Submission) error {
	if s.usage == nil {
		return nil
	}
	ids := []string{}
	for _, sub := range subs {
		if sub.JobID != "" {
			ids = append(ids, sub.JobID)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	usage, err := s.usage.UsageByJob(ctx, ids)
	if err != nil {
		return err
	}
	for i := range subs {
		if u, ok := usage[subs[i].JobID]; ok {
			subs[i].Activity = JobActivity{Applications: u.Applications, Interviews: u.Interviews}
		}
	}
	return nil
}

// Precheck is the live answer while a scout types a link.
type Precheck struct {
	URL          string `json:"url"`
	CanonicalURL string `json:"canonical_url"`
	Host         string `json:"host"`
	ATS          string `json:"ats,omitempty"`
	Reachable    bool   `json:"reachable"`
	Status       int    `json:"http_status,omitempty"`
	Official     bool   `json:"official"`
	StillOpen    *bool  `json:"still_open"`
	Reason       string `json:"reason"`
}

// Precheck runs the fast checks for one link without storing anything.
func (s *Store) Precheck(ctx context.Context, rawURL string) (Precheck, error) {
	parsed, err := ParseJobURL(rawURL)
	if err != nil {
		return Precheck{}, &ValidationError{Fields: []FieldError{{Field: "url", Detail: err.Error()}}}
	}
	out := Precheck{URL: parsed.Raw, CanonicalURL: parsed.Canonical, Host: parsed.Host, ATS: parsed.ATS}
	if parsed.JobBoard {
		out.Reason = "not an official source: " + parsed.Host + " is a job board"
		return out, nil
	}
	page := s.fetcher.Fetch(ctx, parsed.Raw)
	out.Status = page.Status
	out.Reachable = page.Err == nil && page.Status >= 200 && page.Status <= 299
	effective := parsed
	if page.FinalURL != "" {
		if final, err := ParseJobURL(page.FinalURL); err == nil {
			effective = final
		}
	}
	out.Official = !effective.JobBoard
	if out.Reachable {
		open := ClosedMarker(page.Text) == ""
		out.StillOpen = &open
	}
	switch {
	case !out.Official:
		out.Reason = "not an official source: redirects to " + effective.Host
	case page.Err != nil:
		out.Reason = "could not reach the page; a moderator will check it"
	case !out.Reachable:
		out.Reason = fmt.Sprintf("page answered HTTP %d", page.Status)
	case out.StillOpen != nil && !*out.StillOpen:
		out.Reason = "the posting looks closed"
	case effective.ATS != "":
		out.Reason = "official " + effective.ATS + " board"
	default:
		out.Reason = "company careers site"
	}
	return out, nil
}

// process runs the automatic checks for one submission and applies the result.
func (s *Store) process(ctx context.Context, id bson.ObjectID) error {
	var sub Submission
	err := s.collection(submissionsCollection).FindOneAndUpdate(ctx,
		bson.D{{Key: "_id", Value: id}, {Key: "status", Value: bson.D{{Key: "$in", Value: bson.A{StatusSubmitted, StatusAutoChecking}}}}},
		bson.D{{Key: "$set", Value: bson.D{{Key: "status", Value: StatusAutoChecking}, {Key: "updatedAt", Value: s.now().UTC()}}}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&sub)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil
	}
	if err != nil {
		return err
	}
	sub.fill()
	profile, err := s.EnsureProfile(ctx, sub.ScoutUserID)
	if err != nil {
		return err
	}
	parsed, err := ParseJobURL(sub.URL)
	if err != nil {
		return s.finish(ctx, sub, Decision{
			Status:          StatusRejected,
			RejectionCode:   ReasonUnreachable,
			RejectionReason: err.Error(),
			Checks:          []Check{{ID: CheckReachable, Label: "URL reachable", Outcome: OutcomeFail, Detail: err.Error()}},
		})
	}

	facts := Facts{Input: sub.input(), URL: parsed, Level: profile.Level}
	if !parsed.JobBoard {
		facts.Page = s.fetcher.Fetch(ctx, parsed.Raw)
		facts.Fetched = true
		if facts.Page.FinalURL != "" {
			if final, err := ParseJobURL(facts.Page.FinalURL); err == nil && final.Canonical != parsed.Canonical {
				facts.Final = &final
			}
		}
	}
	matches, err := s.FindMatches(ctx, MatchQuery{
		URL:         sub.URL,
		CompanyID:   sub.CompanyID,
		CompanyName: sub.CompanyName,
		Title:       sub.Title,
	}, sub.ObjectID)
	if err != nil {
		return err
	}
	facts.Duplicate, facts.SimilarTo = factsFromMatches(matches)
	if rate := Rule(profile.Level).SpotCheckRate; rate > 0 {
		facts.SpotCheck = s.roll() < rate
	}
	return s.finish(ctx, sub, Evaluate(facts))
}

func (sub Submission) input() SubmissionInput {
	return SubmissionInput{
		URL:          sub.URL,
		CompanyName:  sub.CompanyName,
		CompanyID:    sub.CompanyID,
		Title:        sub.Title,
		LocationText: sub.LocationText,
		Workplace:    sub.Workplace,
		Employment:   sub.Employment,
		Seniority:    sub.Seniority,
		Pay:          sub.Pay,
		Equity:       sub.Equity,
		SalaryText:   sub.SalaryText,
		Summary:      sub.Summary,
		ExternalRef:  sub.ExternalRef,
	}
}

// finish stores an automatic decision and runs its side effects.
func (s *Store) finish(ctx context.Context, sub Submission, decision Decision) error {
	now := s.now().UTC()
	set := bson.D{
		{Key: "checks", Value: decision.Checks},
		{Key: "hiddenJob", Value: decision.HiddenJob},
		{Key: "spotCheck", Value: decision.SpotCheck},
		{Key: "checkedAt", Value: now},
		{Key: "updatedAt", Value: now},
	}
	if decision.FinalURL != "" {
		set = append(set, bson.E{Key: "finalUrl", Value: decision.FinalURL})
		sub.FinalURL = decision.FinalURL
	}
	if decision.Status != StatusApproved {
		set = append(set,
			bson.E{Key: "status", Value: decision.Status},
			bson.E{Key: "rejectionCode", Value: decision.RejectionCode},
			bson.E{Key: "rejectionReason", Value: decision.RejectionReason},
		)
	}
	if _, err := s.collection(submissionsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}}, bson.D{{Key: "$set", Value: set}}); err != nil {
		return err
	}
	sub.Checks = decision.Checks
	sub.HiddenJob = decision.HiddenJob

	switch decision.Status {
	case StatusApproved:
		return s.approve(ctx, sub, reviewerAuto, "")
	case StatusRejected:
		s.notifyDecision(ctx, sub, StatusRejected, decision.RejectionReason)
		return s.recomputeLevel(ctx, sub.ScoutUserID)
	default:
		s.notifyDecision(ctx, sub, StatusNeedsReview, "")
	}
	return nil
}

// approve records the decision and pays the approval reward. The posting stays
// in temp_scout_jobs until staff analyze it into the search pool.
func (s *Store) approve(ctx context.Context, sub Submission, reviewer, note string) error {
	s.publishMu.Lock()
	defer s.publishMu.Unlock()

	now := s.now().UTC()
	set := bson.D{
		{Key: "status", Value: StatusApproved},
		{Key: "reviewedBy", Value: reviewer},
		{Key: "reviewedAt", Value: now},
		{Key: "updatedAt", Value: now},
	}
	if note != "" {
		set = append(set, bson.E{Key: "reviewNote", Value: note})
	}
	_, err := s.collection(submissionsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}}, bson.D{
		{Key: "$set", Value: set},
		{Key: "$unset", Value: bson.D{{Key: "rejectionCode", Value: ""}, {Key: "rejectionReason", Value: ""}, {Key: "duplicateOf", Value: ""}}},
	})
	if err != nil {
		return err
	}
	sub.Status = StatusApproved

	profile, err := s.EnsureProfile(ctx, sub.ScoutUserID)
	if err != nil {
		return err
	}
	if reward := ApprovalReward(profile.Level); reward.AmountCents > 0 {
		if err := s.addEarning(ctx, sub, RewardApproval, reward, EarningHeld, "Job approved"); err != nil {
			return err
		}
	}
	s.notifyDecision(ctx, sub, StatusApproved, "")
	return s.recomputeLevel(ctx, sub.ScoutUserID)
}

// companySite is the employer's own origin, or "" for an ATS-hosted link.
func companySite(p ParsedURL) string {
	if p.ATS != "" || p.JobBoard {
		return ""
	}
	return "https://" + p.Host
}

func validStatus(status string) bool {
	switch status {
	case StatusSubmitted, StatusAutoChecking, StatusNeedsReview, StatusApproved, StatusRejected, StatusDuplicate:
		return true
	}
	return false
}

// recomputeLevel moves the scout between levels when their quality changes,
// unless staff pinned the level.
func (s *Store) recomputeLevel(ctx context.Context, userID string) error {
	profile, err := s.storedProfile(ctx, userID)
	if err != nil {
		return err
	}
	if profile.LevelPinned {
		return nil
	}
	metrics, err := s.metrics(ctx, userID, profile.Level)
	if err != nil {
		return err
	}
	next := RecomputeLevel(profile.Level, metrics)
	if next == profile.Level {
		return nil
	}
	if _, err := s.collection(profilesCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: userID}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "level", Value: next}, {Key: "updatedAt", Value: s.now().UTC()}}},
	}); err != nil {
		return err
	}
	s.notifyLevel(ctx, userID, profile.Level, next)
	return nil
}

func (s *Store) metrics(ctx context.Context, userID, level string) (Metrics, error) {
	rows, err := s.metricRows(ctx, userID)
	if err != nil {
		return Metrics{}, err
	}
	return ComputeMetrics(level, rows, s.now()), nil
}

// metricRows loads the few fields level math and usage totals need.
func (s *Store) metricRows(ctx context.Context, userID string) ([]metricRow, error) {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.metricRows(userID), nil
	}
	cursor, err := s.collection(submissionsCollection).Find(ctx, bson.D{{Key: "scoutUserId", Value: userID}},
		options.Find().SetProjection(bson.D{
			{Key: "status", Value: 1},
			{Key: "expired", Value: 1},
			{Key: "settledInterviews", Value: 1},
			{Key: "submittedAt", Value: 1},
			{Key: "jobId", Value: 1},
		}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	rows := []metricRow{}
	for cursor.Next(ctx) {
		var row struct {
			Status      string    `bson:"status"`
			Expired     bool      `bson:"expired"`
			Interviews  int       `bson:"settledInterviews"`
			SubmittedAt time.Time `bson:"submittedAt"`
			JobID       string    `bson:"jobId"`
		}
		if err := cursor.Decode(&row); err != nil {
			return nil, err
		}
		rows = append(rows, metricRow{Status: row.Status, Expired: row.Expired, Interviews: row.Interviews, SubmittedAt: row.SubmittedAt, JobID: row.JobID})
	}
	return rows, cursor.Err()
}
