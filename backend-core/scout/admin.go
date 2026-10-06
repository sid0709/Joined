package scout

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Moderator decisions on a submission.
const (
	DecisionApprove   = "approve"
	DecisionReject    = "reject"
	DecisionDuplicate = "duplicate"

	OutcomeInterview = "interview"
	OutcomeHire      = "hire"

	PayoutDecisionPaid    = "paid"
	PayoutDecisionApprove = "approved"
	PayoutDecisionReject  = "rejected"

	defaultAdminPageSize = 25
	maxAdminPageSize     = 100
	maxReviewNote        = 1000
	auditTrailLimit      = 50
	recentForScout       = 10
)

// Reason is a rejection reason moderators can pick.
type Reason struct {
	Code  string `json:"code"`
	Label string `json:"label"`
}

var rejectReasons = []Reason{
	{Code: ReasonNotOfficial, Label: "Not an official source"},
	{Code: ReasonClosed, Label: "Posting is closed"},
	{Code: ReasonUnreachable, Label: "Link does not work"},
	{Code: ReasonScam, Label: "Looks fake or a scam"},
	{Code: "company_mismatch", Label: "Company does not match the link"},
	{Code: "copied_summary", Label: "Summary copied from the posting"},
	{Code: "low_quality", Label: "Missing or misleading details"},
	{Code: ReasonModerator, Label: "Other"},
}

// RejectReasons lists the reasons a moderator can give.
func RejectReasons() []Reason { return rejectReasons }

func reasonLabel(code string) (string, bool) {
	for _, reason := range rejectReasons {
		if reason.Code == code {
			return reason.Label, true
		}
	}
	return "", false
}

// ScoutBrief identifies the scout behind a row in admin tables.
type ScoutBrief struct {
	UserID       string `json:"user_id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Level        string `json:"level"`
	Verification string `json:"verification"`
}

// AdminSubmission is a submission row in the review queue.
type AdminSubmission struct {
	Submission
	Scout ScoutBrief `json:"scout"`
}

// AdminSubmissionQuery filters the review queue.
type AdminSubmissionQuery struct {
	Status   string
	Channel  string
	Q        string
	Page     int64
	PageSize int64
}

func pageBounds(page, size int64) (int64, int64) {
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = defaultAdminPageSize
	}
	if size > maxAdminPageSize {
		size = maxAdminPageSize
	}
	return page, size
}

// AdminListSubmissions pages the review queue. The needs-review queue is
// oldest first (work it in order); everything else is newest first.
func (s *Store) AdminListSubmissions(ctx context.Context, query AdminSubmissionQuery) (AdminList[AdminSubmission], error) {
	page, size := pageBounds(query.Page, query.PageSize)
	filter := bson.D{}
	if query.Status != "" {
		if query.Status == "expired" {
			filter = append(filter, bson.E{Key: "expired", Value: true})
		} else if validStatus(query.Status) {
			filter = append(filter, bson.E{Key: "status", Value: query.Status})
		} else {
			return AdminList[AdminSubmission]{}, &ValidationError{Fields: []FieldError{{Field: "status", Detail: "unknown status"}}}
		}
	}
	if query.Channel == ChannelWeb || query.Channel == ChannelAPI {
		filter = append(filter, bson.E{Key: "channel", Value: query.Channel})
	}
	if q := strings.TrimSpace(query.Q); q != "" {
		pattern := bson.D{{Key: "$regex", Value: regexp.QuoteMeta(q)}, {Key: "$options", Value: "i"}}
		or := bson.A{
			bson.D{{Key: "title", Value: pattern}},
			bson.D{{Key: "companyName", Value: pattern}},
			bson.D{{Key: "host", Value: pattern}},
			bson.D{{Key: "externalRef", Value: pattern}},
		}
		if oid, err := bson.ObjectIDFromHex(q); err == nil {
			or = append(or, bson.D{{Key: "_id", Value: oid}})
		}
		userIDs, err := s.accounts.SearchUserIDs(ctx, q)
		if err != nil {
			return AdminList[AdminSubmission]{}, err
		}
		if len(userIDs) > 0 {
			or = append(or, bson.D{{Key: "scoutUserId", Value: bson.D{{Key: "$in", Value: userIDs}}}})
		}
		filter = append(filter, bson.E{Key: "$or", Value: or})
	}
	coll := s.collection(submissionsCollection)
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return AdminList[AdminSubmission]{}, err
	}
	sort := -1
	if query.Status == StatusNeedsReview {
		sort = 1
	}
	cursor, err := coll.Find(ctx, filter, options.Find().
		SetSort(bson.D{{Key: "_id", Value: sort}}).
		SetSkip((page-1)*size).
		SetLimit(size))
	if err != nil {
		return AdminList[AdminSubmission]{}, err
	}
	subs := []Submission{}
	if err := cursor.All(ctx, &subs); err != nil {
		return AdminList[AdminSubmission]{}, err
	}
	for i := range subs {
		subs[i].fill()
	}
	if err := s.attachActivity(ctx, subs); err != nil {
		return AdminList[AdminSubmission]{}, err
	}
	briefs, err := s.briefs(ctx, scoutIDs(subs))
	if err != nil {
		return AdminList[AdminSubmission]{}, err
	}
	rows := make([]AdminSubmission, 0, len(subs))
	for _, sub := range subs {
		rows = append(rows, AdminSubmission{Submission: sub, Scout: briefs[sub.ScoutUserID]})
	}
	return AdminList[AdminSubmission]{Data: rows, Total: total, Page: page, PageSize: size}, nil
}

func scoutIDs(subs []Submission) []string {
	seen := map[string]struct{}{}
	ids := []string{}
	for _, sub := range subs {
		if _, ok := seen[sub.ScoutUserID]; ok {
			continue
		}
		seen[sub.ScoutUserID] = struct{}{}
		ids = append(ids, sub.ScoutUserID)
	}
	return ids
}

func (s *Store) briefs(ctx context.Context, userIDs []string) (map[string]ScoutBrief, error) {
	out := make(map[string]ScoutBrief, len(userIDs))
	if len(userIDs) == 0 {
		return out, nil
	}
	users, err := s.accounts.Users(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	cursor, err := s.collection(profilesCollection).Find(ctx, bson.D{{Key: "userId", Value: bson.D{{Key: "$in", Value: userIDs}}}})
	if err != nil {
		return nil, err
	}
	profiles := []Profile{}
	if err := cursor.All(ctx, &profiles); err != nil {
		return nil, err
	}
	for _, profile := range profiles {
		user := users[profile.UserID]
		out[profile.UserID] = ScoutBrief{
			UserID:       profile.UserID,
			Name:         user.Name,
			Email:        user.Email,
			Level:        profile.Level,
			Verification: profile.Verification,
		}
	}
	return out, nil
}

// ScoutSummary is a scout with quality metrics and money, for staff.
type ScoutSummary struct {
	Profile Profile `json:"profile"`
	Metrics Metrics `json:"metrics"`
	Balance Balance `json:"balance"`
}

// AdminSubmissionDetail is everything a moderator needs to decide.
type AdminSubmissionDetail struct {
	Submission  Submission    `json:"submission"`
	Scout       ScoutSummary  `json:"scout"`
	DuplicateOf *Submission   `json:"duplicate_of_submission,omitempty"`
	Earnings    []Earning     `json:"earnings"`
	Audit       []AuditEntry  `json:"audit"`
	Reasons     []Reason      `json:"rejection_reasons"`
	Related     []Submission  `json:"related"`
	Recent      []Submission  `json:"scout_recent"`
	Rules       LevelRule     `json:"level_rule"`
	Queue       QueuePosition `json:"queue"`
}

// QueuePosition helps a moderator step through the queue.
type QueuePosition struct {
	NextID string `json:"next_id,omitempty"`
}

// AdminSubmission loads one submission with its scout, money, and history.
func (s *Store) AdminSubmission(ctx context.Context, id string) (AdminSubmissionDetail, error) {
	sub, err := s.submission(ctx, id)
	if err != nil {
		return AdminSubmissionDetail{}, err
	}
	subs := []Submission{sub}
	if err := s.attachActivity(ctx, subs); err != nil {
		return AdminSubmissionDetail{}, err
	}
	sub = subs[0]
	summary, err := s.scoutSummary(ctx, sub.ScoutUserID)
	if err != nil {
		return AdminSubmissionDetail{}, err
	}
	earnings, err := s.allEarnings(ctx, bson.D{{Key: "submissionId", Value: sub.ID}})
	if err != nil {
		return AdminSubmissionDetail{}, err
	}
	trail, err := s.auditTrail(ctx, sub.ID)
	if err != nil {
		return AdminSubmissionDetail{}, err
	}
	related, err := s.relatedSubmissions(ctx, sub)
	if err != nil {
		return AdminSubmissionDetail{}, err
	}
	recent, err := s.findSubmissions(ctx, bson.D{
		{Key: "scoutUserId", Value: sub.ScoutUserID},
		{Key: "_id", Value: bson.D{{Key: "$ne", Value: sub.ObjectID}}},
	}, recentForScout)
	if err != nil {
		return AdminSubmissionDetail{}, err
	}
	detail := AdminSubmissionDetail{
		Submission: sub,
		Scout:      summary,
		Earnings:   earnings,
		Audit:      trail,
		Reasons:    RejectReasons(),
		Related:    related,
		Recent:     recent,
		Rules:      Rule(summary.Profile.Level),
	}
	if target := strings.TrimPrefix(sub.DuplicateOf, "submission "); target != sub.DuplicateOf {
		if dup, err := s.submission(ctx, target); err == nil {
			detail.DuplicateOf = &dup
		}
	}
	var next Submission
	err = s.collection(submissionsCollection).FindOne(ctx, bson.D{
		{Key: "status", Value: StatusNeedsReview},
		{Key: "_id", Value: bson.D{{Key: "$ne", Value: sub.ObjectID}}},
	}, options.FindOne().SetSort(bson.D{{Key: "_id", Value: 1}}).SetProjection(bson.D{{Key: "_id", Value: 1}})).Decode(&next)
	if err == nil {
		detail.Queue.NextID = next.ObjectID.Hex()
	} else if !errors.Is(err, mongo.ErrNoDocuments) {
		return AdminSubmissionDetail{}, err
	}
	return detail, nil
}

// relatedSubmissions are other submissions of the same link or role.
func (s *Store) relatedSubmissions(ctx context.Context, sub Submission) ([]Submission, error) {
	or := bson.A{bson.D{{Key: "canonicalUrl", Value: sub.CanonicalURL}}}
	if sub.DedupeKey != "" {
		or = append(or, bson.D{{Key: "dedupeKey", Value: sub.DedupeKey}})
	}
	return s.findSubmissions(ctx, bson.D{
		{Key: "_id", Value: bson.D{{Key: "$ne", Value: sub.ObjectID}}},
		{Key: "$or", Value: or},
	}, recentForScout)
}

func (s *Store) findSubmissions(ctx context.Context, filter bson.D, limit int64) ([]Submission, error) {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.findSubmissions(filter, limit), nil
	}
	cursor, err := s.collection(submissionsCollection).Find(ctx, filter,
		options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(limit))
	if err != nil {
		return nil, err
	}
	subs := []Submission{}
	if err := cursor.All(ctx, &subs); err != nil {
		return nil, err
	}
	for i := range subs {
		subs[i].fill()
	}
	return subs, nil
}

func (s *Store) auditTrail(ctx context.Context, subjectID string) ([]AuditEntry, error) {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.auditTrail(subjectID), nil
	}
	cursor, err := s.collection(auditCollection).Find(ctx, bson.D{{Key: "subjectId", Value: subjectID}},
		options.Find().SetSort(bson.D{{Key: "at", Value: -1}}).SetLimit(auditTrailLimit))
	if err != nil {
		return nil, err
	}
	entries := []AuditEntry{}
	return entries, cursor.All(ctx, &entries)
}

func (s *Store) scoutSummary(ctx context.Context, userID string) (ScoutSummary, error) {
	profile, err := s.Profile(ctx, userID)
	if err != nil {
		return ScoutSummary{}, err
	}
	metrics, err := s.metrics(ctx, userID, profile.Level)
	if err != nil {
		return ScoutSummary{}, err
	}
	balance, err := s.Balance(ctx, userID)
	if err != nil {
		return ScoutSummary{}, err
	}
	return ScoutSummary{Profile: profile, Metrics: metrics, Balance: balance}, nil
}

// ReviewInput is a moderator's decision. Edits, when sent, replace the
// submission's job details before it is approved.
type ReviewInput struct {
	Decision    string           `json:"decision"`
	ReasonCode  string           `json:"reason_code"`
	Note        string           `json:"note"`
	DuplicateOf string           `json:"duplicate_of"`
	Edits       *SubmissionInput `json:"edits"`
}

// Review applies a moderator decision.
func (s *Store) Review(ctx context.Context, id, actor string, input ReviewInput) (Submission, error) {
	sub, err := s.submission(ctx, id)
	if err != nil {
		return Submission{}, err
	}
	note := strings.TrimSpace(input.Note)
	if len(note) > maxReviewNote {
		return Submission{}, &ValidationError{Fields: []FieldError{{Field: "note", Detail: "keep the note under 1000 characters"}}}
	}
	switch input.Decision {
	case DecisionApprove:
		if sub.Status != StatusNeedsReview && sub.Status != StatusRejected && sub.Status != StatusDuplicate {
			return Submission{}, ErrNotDecidable
		}
		if input.Edits != nil {
			if sub, err = s.applyEdits(ctx, sub, *input.Edits); err != nil {
				return Submission{}, err
			}
		}
		if err := s.approve(ctx, sub, actor, note); err != nil {
			return Submission{}, err
		}
	case DecisionReject:
		label, ok := reasonLabel(input.ReasonCode)
		if !ok {
			return Submission{}, &ValidationError{Fields: []FieldError{{Field: "reason_code", Detail: "pick a rejection reason"}}}
		}
		if input.ReasonCode == ReasonModerator && note == "" {
			return Submission{}, &ValidationError{Fields: []FieldError{{Field: "note", Detail: "explain the rejection"}}}
		}
		switch sub.Status {
		case StatusNeedsReview:
		case StatusApproved:
			if err := s.revoke(ctx, sub); err != nil {
				return Submission{}, err
			}
		default:
			return Submission{}, ErrNotDecidable
		}
		reason := strings.ToLower(label[:1]) + label[1:]
		if note != "" {
			reason += ": " + note
		}
		if err := s.setDecision(ctx, sub, StatusRejected, input.ReasonCode, reason, actor, note, ""); err != nil {
			return Submission{}, err
		}
		s.notifyDecision(ctx, sub, StatusRejected, reason)
	case DecisionDuplicate:
		if sub.Status != StatusNeedsReview {
			return Submission{}, ErrNotDecidable
		}
		target := strings.TrimSpace(input.DuplicateOf)
		if target == "" {
			target = "a job already in the pool"
		}
		if err := s.setDecision(ctx, sub, StatusDuplicate, ReasonDuplicate, "first valid submission owns this job", actor, note, target); err != nil {
			return Submission{}, err
		}
		s.notifyDecision(ctx, sub, StatusDuplicate, "")
	default:
		return Submission{}, &ValidationError{Fields: []FieldError{{Field: "decision", Detail: "use approve, reject, or duplicate"}}}
	}
	s.audit(ctx, "submission."+input.Decision, "scout_submission", sub.ID, actor, joinNote(input.ReasonCode, note))
	if err := s.recomputeLevel(ctx, sub.ScoutUserID); err != nil {
		return Submission{}, err
	}
	return s.submission(ctx, id)
}

func joinNote(code, note string) string {
	switch {
	case code != "" && note != "":
		return code + ": " + note
	case code != "":
		return code
	default:
		return note
	}
}

func (s *Store) setDecision(ctx context.Context, sub Submission, status, code, reason, actor, note, duplicateOf string) error {
	now := s.now().UTC()
	set := bson.D{
		{Key: "status", Value: status},
		{Key: "rejectionCode", Value: code},
		{Key: "rejectionReason", Value: reason},
		{Key: "reviewedBy", Value: actor},
		{Key: "reviewedAt", Value: now},
		{Key: "reviewNote", Value: note},
		{Key: "updatedAt", Value: now},
	}
	if duplicateOf != "" {
		set = append(set, bson.E{Key: "duplicateOf", Value: duplicateOf})
	}
	_, err := s.collection(submissionsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}}, bson.D{{Key: "$set", Value: set}})
	return err
}

// applyEdits replaces the job details of a submission, keeping its link.
func (s *Store) applyEdits(ctx context.Context, sub Submission, edits SubmissionInput) (Submission, error) {
	edits.URL = sub.URL
	edits.ExternalRef = sub.ExternalRef
	normalized, _, err := NormalizeInput(edits)
	if err != nil {
		return Submission{}, err
	}
	_, err = s.collection(submissionsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "companyName", Value: normalized.CompanyName},
		{Key: "companyId", Value: normalized.CompanyID},
		{Key: "title", Value: normalized.Title},
		{Key: "locationText", Value: normalized.LocationText},
		{Key: "workplace", Value: normalized.Workplace},
		{Key: "employment", Value: normalized.Employment},
		{Key: "seniority", Value: normalized.Seniority},
		{Key: "pay", Value: normalized.Pay},
		{Key: "equity", Value: normalized.Equity},
		{Key: "salaryText", Value: normalized.SalaryText},
		{Key: "summary", Value: normalized.Summary},
		{Key: "hiddenJob", Value: true},
		{Key: "dedupeKey", Value: DedupeKey(normalized.CompanyID, normalized.CompanyName, normalized.Title)},
		{Key: "updatedAt", Value: s.now().UTC()},
	}}})
	if err != nil {
		return Submission{}, err
	}
	return s.submission(ctx, sub.ID)
}

// Analyze runs duplicate screening, then the job extractor unless a likely
// duplicate was found. continueExtract skips screening.
func (s *Store) Analyze(ctx context.Context, id, actor string, edits *SubmissionInput, now time.Time, run func(jobs.ScoutedListing, string) (jobs.AnalyzeScoutedResult, error)) (Submission, jobs.AnalyzeScoutedResult, error) {
	sub, err := s.submission(ctx, id)
	if err != nil {
		return Submission{}, jobs.AnalyzeScoutedResult{}, err
	}
	if edits != nil {
		sub, err = s.applyEdits(ctx, sub, *edits)
		if err != nil {
			return Submission{}, jobs.AnalyzeScoutedResult{}, err
		}
	}
	if run == nil {
		return Submission{}, jobs.AnalyzeScoutedResult{}, errors.New("analyze is not configured")
	}
	result, err := run(stagedListing(sub), sub.TempJobID)
	if err != nil {
		return Submission{}, jobs.AnalyzeScoutedResult{}, err
	}
	if result.Record == nil {
		return sub, result, nil
	}
	record := result.Record
	wasLive := sub.JobID != ""
	set := bson.D{
		{Key: "jobId", Value: record.Job.ID},
		{Key: "jobRef", Value: record.TempJobID},
		{Key: "updatedAt", Value: now.UTC()},
	}
	if record.TempJobID != "" && sub.TempJobID == "" {
		set = append(set, bson.E{Key: "tempJobId", Value: record.TempJobID})
	}
	if _, err := s.collection(submissionsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}}, bson.D{{Key: "$set", Value: set}}); err != nil {
		return Submission{}, jobs.AnalyzeScoutedResult{}, err
	}
	s.audit(ctx, "submission.analyze", "scout_submission", sub.ID, actor, record.Model)
	sub, err = s.submission(ctx, id)
	if err != nil {
		return Submission{}, jobs.AnalyzeScoutedResult{}, err
	}
	if !wasLive && sub.JobID != "" {
		s.notifyPublished(ctx, sub)
	}
	return sub, result, nil
}

// MatchCompare is an AI same-position check for one company+title match.
type MatchCompare struct {
	Match        Match  `json:"match"`
	SamePosition bool   `json:"same_position"`
	Reason       string `json:"reason"`
}

// CompareMatches asks the model whether company+title matches are the same opening.
func (s *Store) CompareMatches(ctx context.Context, id string, reader jobs.ModelReader) ([]MatchCompare, error) {
	sub, err := s.submission(ctx, id)
	if err != nil {
		return nil, err
	}
	out := []MatchCompare{}
	jobIDs := []string{}
	for _, m := range sub.Matches {
		if m.Kind == MatchKindCompanyTitle && m.JobID != "" {
			jobIDs = append(jobIDs, m.JobID)
		}
	}
	briefs := map[string]jobs.JobBrief{}
	if s.publisher != nil && len(jobIDs) > 0 {
		found, err := s.publisher.JobBriefsByID(ctx, jobIDs)
		if err != nil {
			return nil, err
		}
		for _, brief := range found {
			briefs[brief.ID] = brief
		}
	}
	for _, m := range sub.Matches {
		if m.Kind != MatchKindCompanyTitle {
			continue
		}
		existDesc := ""
		if brief, ok := briefs[m.JobID]; ok {
			existDesc = jobs.ListingCopy(brief.Summary, brief.Responsibilities, brief.Requirements)
		} else if m.SubmissionID != "" {
			other, lookupErr := s.submission(ctx, m.SubmissionID)
			if lookupErr == nil {
				existDesc = other.Summary
				if m.Title == "" {
					m.Title = other.Title
				}
				if m.Company == "" {
					m.Company = other.CompanyName
				}
			}
		}
		same, reason, err := jobs.CompareSamePosition(ctx, reader, sub.Title, sub.CompanyName, sub.Summary, m.JobID, m.Title, m.Company, existDesc)
		if err != nil {
			return nil, err
		}
		out = append(out, MatchCompare{Match: m, SamePosition: same, Reason: reason})
	}
	return out, nil
}

// revoke takes a published job back out of the pool and claws back every
// reward that has not been paid (docs/13: clawed back if the job was fake).
func (s *Store) revoke(ctx context.Context, sub Submission) error {
	if sub.JobRef != "" {
		if err := s.publisher.UnpublishScouted(ctx, sub.JobRef); err != nil {
			return err
		}
	}
	_, err := s.collection(earningsCollection).UpdateMany(ctx,
		bson.D{{Key: "submissionId", Value: sub.ID}, {Key: "status", Value: bson.D{{Key: "$in", Value: bson.A{EarningHeld, EarningReleased}}}}},
		bson.D{{Key: "$set", Value: bson.D{{Key: "status", Value: EarningClawedBack}}}},
	)
	if err != nil {
		return err
	}
	_, err = s.collection(submissionsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}}, bson.D{
		{Key: "$unset", Value: bson.D{{Key: "jobId", Value: ""}, {Key: "jobRef", Value: ""}}},
	})
	return err
}

// Expire marks a published job closed and removes it from search.
func (s *Store) Expire(ctx context.Context, id, actor, note string) (Submission, error) {
	sub, err := s.submission(ctx, id)
	if err != nil {
		return Submission{}, err
	}
	if sub.Status != StatusApproved || sub.Expired {
		return Submission{}, ErrNotDecidable
	}
	if sub.JobRef != "" {
		if err := s.publisher.UnpublishScouted(ctx, sub.JobRef); err != nil {
			return Submission{}, err
		}
	}
	now := s.now().UTC()
	if _, err := s.collection(submissionsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "expired", Value: true},
		{Key: "expiredAt", Value: now},
		{Key: "updatedAt", Value: now},
	}}}); err != nil {
		return Submission{}, err
	}
	s.notify(ctx, sub.ScoutUserID, notice{kind: kindDecision, tone: toneNeutral, title: "Job expired", body: sub.Title + " at " + sub.CompanyName + " closed and left the pool.", subjectID: sub.ID})
	s.audit(ctx, "submission.expire", "scout_submission", sub.ID, actor, note)
	if err := s.recomputeLevel(ctx, sub.ScoutUserID); err != nil {
		return Submission{}, err
	}
	return s.submission(ctx, id)
}

// RecordOutcome records a settled interview or confirmed hire on a scouted job
// and pays the matching reward.
func (s *Store) RecordOutcome(ctx context.Context, id, actor, kind string) (Submission, error) {
	sub, err := s.submission(ctx, id)
	if err != nil {
		return Submission{}, err
	}
	if sub.Status != StatusApproved {
		return Submission{}, ErrNotDecidable
	}
	profile, err := s.EnsureProfile(ctx, sub.ScoutUserID)
	if err != nil {
		return Submission{}, err
	}
	var field, description, status string
	var amount Money
	switch kind {
	case OutcomeInterview:
		field, description, status = "settledInterviews", "Settled interview", EarningReleased
		amount = InterviewReward(profile.Level, sub.Seniority)
	case OutcomeHire:
		field, description, status = "hires", "Confirmed hire", EarningHeld
		amount = HireReward(sub.Seniority)
	default:
		return Submission{}, &ValidationError{Fields: []FieldError{{Field: "type", Detail: "use interview or hire"}}}
	}
	if _, err := s.collection(submissionsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}}, bson.D{
		{Key: "$inc", Value: bson.D{{Key: field, Value: 1}}},
		{Key: "$set", Value: bson.D{{Key: "updatedAt", Value: s.now().UTC()}}},
	}); err != nil {
		return Submission{}, err
	}
	if err := s.addEarning(ctx, sub, kind, amount, status, description); err != nil {
		return Submission{}, err
	}
	s.audit(ctx, "submission.outcome."+kind, "scout_submission", sub.ID, actor, "")
	if err := s.recomputeLevel(ctx, sub.ScoutUserID); err != nil {
		return Submission{}, err
	}
	return s.submission(ctx, id)
}

// Recheck runs the automatic checks again on a submission that is not live.
func (s *Store) Recheck(ctx context.Context, id, actor string) (Submission, error) {
	sub, err := s.submission(ctx, id)
	if err != nil {
		return Submission{}, err
	}
	if sub.Status == StatusApproved || sub.Status == StatusSubmitted || sub.Status == StatusAutoChecking {
		return Submission{}, ErrNotDecidable
	}
	if _, err := s.collection(submissionsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: sub.ObjectID}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "status", Value: StatusSubmitted}, {Key: "checks", Value: bson.A{}}, {Key: "updatedAt", Value: s.now().UTC()}}},
		{Key: "$unset", Value: bson.D{{Key: "rejectionCode", Value: ""}, {Key: "rejectionReason", Value: ""}, {Key: "duplicateOf", Value: ""}}},
	}); err != nil {
		return Submission{}, err
	}
	s.audit(ctx, "submission.recheck", "scout_submission", sub.ID, actor, "")
	s.enqueue(sub.ObjectID)
	return s.submission(ctx, id)
}

// AdminScoutQuery filters the scouts table.
type AdminScoutQuery struct {
	Q            string
	Level        string
	Verification string
	Page         int64
	PageSize     int64
}

// AdminListScouts pages scouts with their quality and balances.
func (s *Store) AdminListScouts(ctx context.Context, query AdminScoutQuery) (AdminList[ScoutSummary], error) {
	page, size := pageBounds(query.Page, query.PageSize)
	filter := bson.D{}
	if ValidLevel(query.Level) {
		filter = append(filter, bson.E{Key: "level", Value: query.Level})
	}
	switch query.Verification {
	case VerificationNone, VerificationPending, VerificationVerified, VerificationRejected:
		filter = append(filter, bson.E{Key: "verification", Value: query.Verification})
	}
	if q := strings.TrimSpace(query.Q); q != "" {
		ids, err := s.accounts.SearchUserIDs(ctx, q)
		if err != nil {
			return AdminList[ScoutSummary]{}, err
		}
		filter = append(filter, bson.E{Key: "userId", Value: bson.D{{Key: "$in", Value: ids}}})
	}
	coll := s.collection(profilesCollection)
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return AdminList[ScoutSummary]{}, err
	}
	sortKey := "createdAt"
	if query.Verification == VerificationPending {
		sortKey = "verificationUpdatedAt"
	}
	cursor, err := coll.Find(ctx, filter, options.Find().
		SetSort(bson.D{{Key: sortKey, Value: -1}}).
		SetSkip((page-1)*size).
		SetLimit(size))
	if err != nil {
		return AdminList[ScoutSummary]{}, err
	}
	profiles := []Profile{}
	if err := cursor.All(ctx, &profiles); err != nil {
		return AdminList[ScoutSummary]{}, err
	}
	rows := make([]ScoutSummary, 0, len(profiles))
	for _, profile := range profiles {
		summary, err := s.scoutSummary(ctx, profile.UserID)
		if err != nil {
			return AdminList[ScoutSummary]{}, err
		}
		rows = append(rows, summary)
	}
	return AdminList[ScoutSummary]{Data: rows, Total: total, Page: page, PageSize: size}, nil
}

// AdminScoutDetail is one scout for staff.
type AdminScoutDetail struct {
	ScoutSummary
	Submissions []Submission `json:"submissions"`
	Payouts     []Payout     `json:"payouts"`
	Audit       []AuditEntry `json:"audit"`
}

// AdminScout loads one scout with recent work, payouts, and staff actions.
func (s *Store) AdminScout(ctx context.Context, userID string) (AdminScoutDetail, error) {
	summary, err := s.scoutSummary(ctx, userID)
	if err != nil {
		return AdminScoutDetail{}, err
	}
	subs, err := s.findSubmissions(ctx, bson.D{{Key: "scoutUserId", Value: userID}}, recentForScout)
	if err != nil {
		return AdminScoutDetail{}, err
	}
	payouts, err := s.ListPayouts(ctx, userID, "", recentForScout)
	if err != nil {
		return AdminScoutDetail{}, err
	}
	trail, err := s.auditTrail(ctx, userID)
	if err != nil {
		return AdminScoutDetail{}, err
	}
	return AdminScoutDetail{ScoutSummary: summary, Submissions: subs, Payouts: payouts.Data, Audit: trail}, nil
}

// ScoutPatch is a staff change to a scout.
type ScoutPatch struct {
	Level        *string `json:"level"`
	LevelPinned  *bool   `json:"level_pinned"`
	Verification *string `json:"verification"`
	Note         string  `json:"note"`
}

// UpdateScout applies a staff change: set or unpin a level, or decide identity.
func (s *Store) UpdateScout(ctx context.Context, userID, actor string, patch ScoutPatch) (AdminScoutDetail, error) {
	profile, err := s.storedProfile(ctx, userID)
	if err != nil {
		return AdminScoutDetail{}, err
	}
	now := s.now().UTC()
	set := bson.D{{Key: "updatedAt", Value: now}}
	actions := []string{}
	if patch.Level != nil {
		if !ValidLevel(*patch.Level) {
			return AdminScoutDetail{}, &ValidationError{Fields: []FieldError{{Field: "level", Detail: "unknown level"}}}
		}
		set = append(set, bson.E{Key: "level", Value: *patch.Level}, bson.E{Key: "levelPinned", Value: true})
		actions = append(actions, "scout.level."+*patch.Level)
	} else if patch.LevelPinned != nil {
		set = append(set, bson.E{Key: "levelPinned", Value: *patch.LevelPinned})
		actions = append(actions, "scout.level.pin")
	}
	if patch.Verification != nil {
		decision := *patch.Verification
		if decision != VerificationVerified && decision != VerificationRejected {
			return AdminScoutDetail{}, &ValidationError{Fields: []FieldError{{Field: "verification", Detail: "use verified or rejected"}}}
		}
		if profile.Verification != VerificationPending {
			return AdminScoutDetail{}, ErrAlreadyDecided
		}
		if decision == VerificationVerified {
			if err := staffCanVerify(profile); err != nil {
				return AdminScoutDetail{}, err
			}
		}
		set = append(set,
			bson.E{Key: "verification", Value: decision},
			bson.E{Key: "verificationNote", Value: strings.TrimSpace(patch.Note)},
			bson.E{Key: "verificationUpdatedAt", Value: now},
		)
		if decision == VerificationVerified {
			set = append(set, bson.E{Key: "verifiedBy", Value: actor})
		} else {
			set = append(set, bson.E{Key: "verifiedBy", Value: ""})
		}
		actions = append(actions, "scout.verification."+decision)
	}
	if len(actions) == 0 {
		return AdminScoutDetail{}, &ValidationError{Fields: []FieldError{{Field: "patch", Detail: "nothing to change"}}}
	}
	if mem, ok := s.docs.(*memDocs); ok {
		if _, err := mem.applyProfile(userID, func(p *Profile) {
			if patch.Level != nil {
				p.Level = *patch.Level
				p.LevelPinned = true
			} else if patch.LevelPinned != nil {
				p.LevelPinned = *patch.LevelPinned
			}
			if patch.Verification != nil {
				p.Verification = *patch.Verification
				p.VerificationNote = strings.TrimSpace(patch.Note)
				p.VerificationUpdate = &now
				if *patch.Verification == VerificationVerified {
					p.VerifiedBy = actor
				} else {
					p.VerifiedBy = ""
				}
			}
			p.UpdatedAt = now
		}); err != nil {
			return AdminScoutDetail{}, err
		}
	} else if _, err := s.collection(profilesCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: userID}}, bson.D{{Key: "$set", Value: set}}); err != nil {
		return AdminScoutDetail{}, err
	}
	for _, action := range actions {
		s.audit(ctx, action, "scout", userID, actor, patch.Note)
	}
	if patch.Level != nil && *patch.Level != profile.Level {
		s.notifyLevel(ctx, userID, profile.Level, *patch.Level)
	}
	if patch.Verification != nil {
		if *patch.Verification == VerificationVerified {
			s.notify(ctx, userID, notice{kind: kindVerification, tone: toneSuccess, title: "Identity verified", body: "You are tier 2: payouts are unlocked."})
		} else {
			body := "Your identity could not be verified."
			if note := strings.TrimSpace(patch.Note); note != "" {
				body += " " + note
			}
			s.notify(ctx, userID, notice{kind: kindVerification, tone: toneDanger, title: "Verification declined", body: body})
		}
	}
	if patch.LevelPinned != nil && !*patch.LevelPinned && patch.Level == nil {
		if err := s.recomputeLevel(ctx, userID); err != nil {
			return AdminScoutDetail{}, err
		}
	}
	return s.AdminScout(ctx, userID)
}

// AdminListPayouts pages payouts, oldest requested first when filtering by requested.
func (s *Store) AdminListPayouts(ctx context.Context, status string, pageNumber, pageSize int64) (AdminList[Payout], error) {
	page, size := pageBounds(pageNumber, pageSize)
	filter := bson.D{}
	if status == PayoutRequested || status == PayoutApproved || status == PayoutSent || status == PayoutPaid || status == PayoutFailed || status == PayoutRejected {
		filter = append(filter, bson.E{Key: "status", Value: status})
	}
	coll := s.collection(payoutsCollection)
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return AdminList[Payout]{}, err
	}
	sort := -1
	if status == PayoutRequested || status == PayoutApproved || status == PayoutSent {
		sort = 1
	}
	cursor, err := coll.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "_id", Value: sort}}).SetSkip((page-1)*size).SetLimit(size))
	if err != nil {
		return AdminList[Payout]{}, err
	}
	payouts := []Payout{}
	if err := cursor.All(ctx, &payouts); err != nil {
		return AdminList[Payout]{}, err
	}
	ids := []string{}
	for i := range payouts {
		payouts[i].fill()
		ids = append(ids, payouts[i].ScoutUserID)
	}
	users, err := s.accounts.Users(ctx, ids)
	if err != nil {
		return AdminList[Payout]{}, err
	}
	for i := range payouts {
		payouts[i].ScoutName = users[payouts[i].ScoutUserID].Name
		payouts[i].ScoutEmail = users[payouts[i].ScoutUserID].Email
	}
	return AdminList[Payout]{Data: payouts, Total: total, Page: page, PageSize: size}, nil
}

// PayoutDecision is finance marking a payout sent or declined.
type PayoutDecision struct {
	Decision string `json:"decision"`
	Note     string `json:"note"`
}

// DecidePayout is the staff gate: approve sends to the payout provider once,
// or decline returns the money to the scout's released balance.
func (s *Store) DecidePayout(ctx context.Context, id, actor string, input PayoutDecision) (Payout, error) {
	s.payoutMu.Lock()
	defer s.payoutMu.Unlock()

	payout, err := s.payout(ctx, id)
	if err != nil {
		return Payout{}, err
	}
	note := strings.TrimSpace(input.Note)
	switch input.Decision {
	case PayoutDecisionPaid, PayoutDecisionApprove:
		if payout.Status == PayoutRequested {
			profile, err := s.EnsureProfile(ctx, payout.ScoutUserID)
			if err != nil {
				return Payout{}, err
			}
			paid, err := s.hasPaidPayout(ctx, payout.ScoutUserID)
			if err != nil {
				return Payout{}, err
			}
			if err := wrapPayoutIdentity(FirstPayoutIdentityError(profile, paid)); err != nil {
				return Payout{}, err
			}
			if err := s.gateTaxScreening(ctx, payout.ScoutUserID, &profile); err != nil {
				return Payout{}, err
			}
		}
		return s.approvePayout(ctx, payout, actor, note)
	case PayoutDecisionReject:
		if payout.Status != PayoutRequested && payout.Status != PayoutApproved {
			return Payout{}, ErrAlreadyDecided
		}
		if note == "" {
			return Payout{}, &ValidationError{Fields: []FieldError{{Field: "note", Detail: "explain why the payout is declined"}}}
		}
		now := s.now().UTC()
		if err := s.settlePayoutEarnings(ctx, payout.ID, now, false); err != nil {
			return Payout{}, err
		}
		payout.Status = PayoutRejected
		payout.Note = note
		payout.DecidedAt = &now
		if err := s.savePayout(ctx, payout); err != nil {
			return Payout{}, err
		}
		s.notify(ctx, payout.ScoutUserID, notice{kind: kindPayout, tone: toneDanger, title: "Payout declined", body: note, subjectID: payout.ID})
		s.audit(ctx, "payout."+PayoutDecisionReject, "scout_payout", payout.ID, actor, note)
		return s.payout(ctx, id)
	default:
		return Payout{}, &ValidationError{Fields: []FieldError{{Field: "decision", Detail: "use paid, approved, or rejected"}}}
	}
}

// Overview is the moderation dashboard's headline numbers.
type Overview struct {
	NeedsReview          int64      `json:"needs_review"`
	Checking             int64      `json:"checking"`
	OldestReviewAt       *time.Time `json:"oldest_review_at"`
	SubmittedToday       int64      `json:"submitted_today"`
	ApprovedToday        int64      `json:"approved_today"`
	RejectedToday        int64      `json:"rejected_today"`
	LiveJobs             int64      `json:"live_jobs"`
	Scouts               int64      `json:"scouts"`
	PendingVerifications int64      `json:"pending_verifications"`
	PendingPayouts       int64      `json:"pending_payouts"`
	PendingPayoutAmount  Money      `json:"pending_payout_amount"`
	APIShareToday        int64      `json:"api_submitted_today"`
}

// AdminOverview counts what needs staff attention.
func (s *Store) AdminOverview(ctx context.Context) (Overview, error) {
	subs := s.collection(submissionsCollection)
	dayStart := startOfDay(s.now())
	count := func(coll *mongo.Collection, filter bson.D) (int64, error) { return coll.CountDocuments(ctx, filter) }
	var out Overview
	var err error
	counts := []struct {
		target *int64
		coll   *mongo.Collection
		filter bson.D
	}{
		{&out.NeedsReview, subs, bson.D{{Key: "status", Value: StatusNeedsReview}}},
		{&out.Checking, subs, bson.D{{Key: "status", Value: bson.D{{Key: "$in", Value: bson.A{StatusSubmitted, StatusAutoChecking}}}}}},
		{&out.SubmittedToday, subs, bson.D{{Key: "submittedAt", Value: bson.D{{Key: "$gte", Value: dayStart}}}}},
		{&out.APIShareToday, subs, bson.D{{Key: "submittedAt", Value: bson.D{{Key: "$gte", Value: dayStart}}}, {Key: "channel", Value: ChannelAPI}}},
		{&out.ApprovedToday, subs, bson.D{{Key: "status", Value: StatusApproved}, {Key: "reviewedAt", Value: bson.D{{Key: "$gte", Value: dayStart}}}}},
		{&out.RejectedToday, subs, bson.D{{Key: "status", Value: StatusRejected}, {Key: "updatedAt", Value: bson.D{{Key: "$gte", Value: dayStart}}}}},
		{&out.LiveJobs, subs, bson.D{{Key: "status", Value: StatusApproved}, {Key: "expired", Value: false}}},
		{&out.Scouts, s.collection(profilesCollection), bson.D{}},
		{&out.PendingVerifications, s.collection(profilesCollection), bson.D{{Key: "verification", Value: VerificationPending}}},
		{&out.PendingPayouts, s.collection(payoutsCollection), bson.D{{Key: "status", Value: bson.D{{Key: "$in", Value: pendingPayoutStatuses()}}}}},
	}
	for _, c := range counts {
		if *c.target, err = count(c.coll, c.filter); err != nil {
			return Overview{}, err
		}
	}
	var oldest Submission
	err = subs.FindOne(ctx, bson.D{{Key: "status", Value: StatusNeedsReview}}, options.FindOne().SetSort(bson.D{{Key: "_id", Value: 1}})).Decode(&oldest)
	if err == nil {
		at := oldest.SubmittedAt
		out.OldestReviewAt = &at
	} else if !errors.Is(err, mongo.ErrNoDocuments) {
		return Overview{}, err
	}
	requested := []Payout{}
	cursor, err := s.collection(payoutsCollection).Find(ctx, bson.D{{Key: "status", Value: bson.D{{Key: "$in", Value: pendingPayoutStatuses()}}}})
	if err != nil {
		return Overview{}, err
	}
	if err := cursor.All(ctx, &requested); err != nil {
		return Overview{}, err
	}
	var pending int64
	for _, payout := range requested {
		pending += payout.Amount.AmountCents
	}
	out.PendingPayoutAmount = cents(pending)
	return out, nil
}
