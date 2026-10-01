package staff

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type companyDoc struct {
	ID          string    `bson:"id"`
	CompanyName string    `bson:"companyName"`
	CompanyURL  string    `bson:"companyUrl"`
	CreatedAt   time.Time `bson:"createdAt"`
	Overrides   struct {
		Name *string `bson:"name,omitempty"`
		URL  *string `bson:"url,omitempty"`
	} `bson:"overrides"`
	VerificationStatus string    `bson:"verificationStatus"`
	Claimed            bool      `bson:"claimed"`
	ClaimMethod        string    `bson:"claimMethod"`
	ClaimedBy          string    `bson:"claimedBy"`
	Domains            []string  `bson:"domains"`
	VerificationID     string    `bson:"verificationId"`
	VerifiedAt         time.Time `bson:"verifiedAt"`
	SuspendedAt        time.Time `bson:"suspendedAt"`
}

func (doc companyDoc) name() string {
	if doc.Overrides.Name != nil && strings.TrimSpace(*doc.Overrides.Name) != "" {
		return strings.TrimSpace(*doc.Overrides.Name)
	}
	return strings.TrimSpace(doc.CompanyName)
}

func (doc companyDoc) url() string {
	if doc.Overrides.URL != nil && strings.TrimSpace(*doc.Overrides.URL) != "" {
		return strings.TrimSpace(*doc.Overrides.URL)
	}
	return strings.TrimSpace(doc.CompanyURL)
}

type storedVerification struct {
	ID          bson.ObjectID `bson:"_id,omitempty"`
	CompanyID   string        `bson:"companyId"`
	ClaimMethod string        `bson:"claimMethod"`
	RequestedBy string        `bson:"requestedBy"`
	Domains     []string      `bson:"domains"`
	Status      string        `bson:"status"`
	CreatedAt   time.Time     `bson:"createdAt"`
	SLAAt       time.Time     `bson:"slaAt,omitempty"`
	DecidedAt   time.Time     `bson:"decidedAt,omitempty"`
	Reason      string        `bson:"reason,omitempty"`
}

type memberDoc struct {
	UserID     string `bson:"userId"`
	Role       string `bson:"role"`
	HiringRole string `bson:"hiringRole"`
}

type userDoc struct {
	ID    string `bson:"id"`
	Name  string `bson:"name"`
	Email string `bson:"email"`
}

// VerificationQuery is GET /v1/admin/companies/verifications.
type VerificationQuery struct {
	Status   string
	Page     int64
	PageSize int64
}

// ListVerifications returns the company verification queue.
func (s *Store) ListVerifications(ctx context.Context, query VerificationQuery) (VerificationList, error) {
	page, size := pageBounds(query.Page, query.PageSize)
	filter, err := verificationFilter(query.Status)
	if err != nil {
		return VerificationList{}, err
	}
	total, err := s.verifications().CountDocuments(ctx, filter)
	if err != nil {
		return VerificationList{}, err
	}
	opts := options.Find().
		SetSkip((page - 1) * size).
		SetLimit(size).
		SetSort(bson.D{{Key: "createdAt", Value: 1}})
	cursor, err := s.verifications().Find(ctx, filter, opts)
	if err != nil {
		return VerificationList{}, err
	}
	defer cursor.Close(ctx)
	docs := []storedVerification{}
	if err := cursor.All(ctx, &docs); err != nil {
		return VerificationList{}, err
	}
	ids := make([]string, len(docs))
	for i, doc := range docs {
		ids[i] = doc.CompanyID
	}
	names, err := s.companyNames(ctx, ids)
	if err != nil {
		return VerificationList{}, err
	}
	counts, err := s.memberCounts(ctx, ids)
	if err != nil {
		return VerificationList{}, err
	}
	rows := make([]Verification, 0, len(docs))
	for _, doc := range docs {
		rows = append(rows, Verification{
			ID:          doc.ID.Hex(),
			CompanyID:   doc.CompanyID,
			CompanyName: names[doc.CompanyID],
			ClaimMethod: doc.ClaimMethod,
			RequestedBy: doc.RequestedBy,
			Domains:     stringsOrEmpty(doc.Domains),
			MemberCount: counts[doc.CompanyID],
			Status:      doc.Status,
			CreatedAt:   doc.CreatedAt,
			SLAAt:       timePtr(doc.SLAAt),
		})
	}
	return VerificationList{Data: rows, Total: total, Next: nextPage(page, size, total)}, nil
}

// PendingVerifications counts company verifications still waiting.
func (s *Store) PendingVerifications(ctx context.Context) (PendingCount, error) {
	n, err := s.verifications().CountDocuments(ctx, bson.D{{Key: "status", Value: jobs.VerificationPending}})
	if err != nil {
		return PendingCount{}, err
	}
	return PendingCount{Pending: n}, nil
}

// Company loads one company for staff review.
func (s *Store) Company(ctx context.Context, id string) (CompanyDetail, error) {
	doc, err := s.company(ctx, id)
	if err != nil {
		return CompanyDetail{}, err
	}
	return s.detail(ctx, doc)
}

// VerifyCompany approves, rejects, or suspends a company and records the actor.
// It does not change the company's jobs.
func (s *Store) VerifyCompany(ctx context.Context, id, actor string, input CompanyVerify, now time.Time) (VerifyResult, error) {
	if err := input.Normalize(); err != nil {
		return VerifyResult{}, err
	}
	doc, err := s.company(ctx, id)
	if err != nil {
		return VerifyResult{}, err
	}
	next, err := NextVerification(doc.VerificationStatus, input.Decision)
	if err != nil {
		return VerifyResult{}, err
	}
	now = now.UTC()
	verificationID, err := s.syncVerification(ctx, doc, next, input.Reason, now)
	if err != nil {
		return VerifyResult{}, err
	}
	set := bson.D{
		{Key: "verificationStatus", Value: next},
		{Key: "verificationId", Value: verificationID},
	}
	update := bson.D{{Key: "$set", Value: set}}
	switch next {
	case jobs.VerificationApproved:
		set = append(set, bson.E{Key: "verifiedAt", Value: now}, bson.E{Key: "claimed", Value: true})
		update = bson.D{
			{Key: "$set", Value: set},
			{Key: "$unset", Value: bson.D{{Key: "suspendedAt", Value: ""}}},
		}
	case jobs.VerificationSuspended:
		set = append(set, bson.E{Key: "suspendedAt", Value: now})
		update = bson.D{{Key: "$set", Value: set}}
	}
	if _, err := s.companiesColl().UpdateOne(ctx, bson.D{{Key: "id", Value: id}}, update); err != nil {
		return VerifyResult{}, err
	}
	auditID, err := s.audit(ctx, "company.verify."+input.Decision, subjectCompany, id, actor, input.Reason, now)
	if err != nil {
		return VerifyResult{}, err
	}
	detail, err := s.Company(ctx, id)
	if err != nil {
		return VerifyResult{}, err
	}
	return VerifyResult{Company: detail, AuditID: auditID}, nil
}

// NoteCompanyCreated opens the verification queue row for a company page the owner just created.
func (s *Store) NoteCompanyCreated(ctx context.Context, companyID, userID, website string, now time.Time) error {
	companyID = strings.TrimSpace(companyID)
	if companyID == "" {
		return nil
	}
	doc, err := s.company(ctx, companyID)
	if err != nil {
		return err
	}
	if jobs.EffectiveVerification(doc.VerificationStatus) == jobs.VerificationApproved {
		return nil
	}
	now = now.UTC()
	host := websiteHost(website)
	if host == "" {
		host = websiteHost(doc.url())
	}
	domains := cleanDomains(append(doc.Domains, host))
	if host != "" {
		if _, err := s.companiesColl().UpdateOne(ctx, bson.D{{Key: "id", Value: companyID}}, bson.D{
			{Key: "$addToSet", Value: bson.D{{Key: "domains", Value: host}}},
		}); err != nil {
			return err
		}
	}
	var existing storedVerification
	err = s.verifications().FindOne(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "status", Value: jobs.VerificationPending},
	}).Decode(&existing)
	if err == nil {
		return nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return err
	}
	method := doc.ClaimMethod
	if method == "" {
		method = jobs.ClaimManual
	}
	record := storedVerification{
		ID:          bson.NewObjectID(),
		CompanyID:   companyID,
		ClaimMethod: method,
		RequestedBy: userID,
		Domains:     domains,
		Status:      jobs.VerificationPending,
		CreatedAt:   now,
		SLAAt:       now.Add(verificationSLA),
	}
	if _, err := s.verifications().InsertOne(ctx, record); err != nil {
		return err
	}
	_, err = s.companiesColl().UpdateOne(ctx, bson.D{{Key: "id", Value: companyID}}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "verificationStatus", Value: jobs.VerificationPending},
		{Key: "claimed", Value: true},
		{Key: "claimMethod", Value: method},
		{Key: "claimedBy", Value: userID},
		{Key: "verificationId", Value: record.ID.Hex()},
		{Key: "domains", Value: domains},
	}}})
	return err
}

func (s *Store) company(ctx context.Context, id string) (companyDoc, error) {
	var doc companyDoc
	err := s.companiesColl().FindOne(ctx, bson.D{{Key: "id", Value: id}}, options.FindOne().SetProjection(bson.D{
		{Key: "jobIds", Value: 0},
		{Key: "logoFile", Value: 0},
	})).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return companyDoc{}, ErrNotFound
	}
	return doc, err
}

func (s *Store) detail(ctx context.Context, doc companyDoc) (CompanyDetail, error) {
	status := jobs.EffectiveVerification(doc.VerificationStatus)
	members, err := s.membersOf(ctx, doc.ID)
	if err != nil {
		return CompanyDetail{}, err
	}
	audit, err := s.auditTrail(ctx, doc.ID)
	if err != nil {
		return CompanyDetail{}, err
	}
	detail := CompanyDetail{
		ID:                 doc.ID,
		CompanyName:        doc.name(),
		CompanyURL:         doc.url(),
		Domains:            stringsOrEmpty(cleanDomains(doc.Domains)),
		Members:            members,
		ClaimMethod:        doc.ClaimMethod,
		Claimed:            doc.Claimed,
		VerificationStatus: status,
		VerifiedAt:         timePtr(doc.VerifiedAt),
		SuspendedAt:        timePtr(doc.SuspendedAt),
		Audit:              audit,
	}
	if status == jobs.VerificationPending {
		claim, err := s.pendingClaim(ctx, doc)
		if err != nil {
			return CompanyDetail{}, err
		}
		detail.PendingClaim = claim
	}
	return detail, nil
}

func (s *Store) pendingClaim(ctx context.Context, doc companyDoc) (*PendingClaim, error) {
	var record storedVerification
	err := s.verifications().FindOne(ctx, bson.D{
		{Key: "companyId", Value: doc.ID},
		{Key: "status", Value: jobs.VerificationPending},
	}, options.FindOne().SetSort(bson.D{{Key: "createdAt", Value: -1}})).Decode(&record)
	if errors.Is(err, mongo.ErrNoDocuments) {
		created := doc.CreatedAt
		claim := PendingClaim{
			ClaimMethod: doc.ClaimMethod,
			RequestedBy: doc.ClaimedBy,
			Domains:     stringsOrEmpty(cleanDomains(doc.Domains)),
			Status:      jobs.VerificationPending,
			CreatedAt:   created,
			SLAAt:       timePtr(created.Add(verificationSLA)),
		}
		if created.IsZero() {
			claim.SLAAt = nil
		}
		return &claim, nil
	}
	if err != nil {
		return nil, err
	}
	return &PendingClaim{
		ID:          record.ID.Hex(),
		ClaimMethod: record.ClaimMethod,
		RequestedBy: record.RequestedBy,
		Domains:     stringsOrEmpty(record.Domains),
		Status:      record.Status,
		CreatedAt:   record.CreatedAt,
		SLAAt:       timePtr(record.SLAAt),
	}, nil
}

func (s *Store) syncVerification(ctx context.Context, doc companyDoc, status, reason string, now time.Time) (string, error) {
	set := bson.D{
		{Key: "status", Value: status},
		{Key: "decidedAt", Value: now},
		{Key: "reason", Value: reason},
	}
	result, err := s.verifications().UpdateMany(ctx, bson.D{{Key: "companyId", Value: doc.ID}}, bson.D{{Key: "$set", Value: set}})
	if err != nil {
		return "", err
	}
	if result.MatchedCount > 0 {
		var latest storedVerification
		err := s.verifications().FindOne(ctx, bson.D{{Key: "companyId", Value: doc.ID}}, options.FindOne().SetSort(bson.D{{Key: "createdAt", Value: -1}})).Decode(&latest)
		if err != nil {
			return "", err
		}
		return latest.ID.Hex(), nil
	}
	method := doc.ClaimMethod
	if method == "" {
		method = jobs.ClaimManual
	}
	record := storedVerification{
		ID:          bson.NewObjectID(),
		CompanyID:   doc.ID,
		ClaimMethod: method,
		RequestedBy: doc.ClaimedBy,
		Domains:     cleanDomains(doc.Domains),
		Status:      status,
		CreatedAt:   now,
		DecidedAt:   now,
		Reason:      reason,
	}
	if _, err := s.verifications().InsertOne(ctx, record); err != nil {
		return "", err
	}
	return record.ID.Hex(), nil
}

func (s *Store) companyNames(ctx context.Context, ids []string) (map[string]string, error) {
	out := map[string]string{}
	ids = uniqueIDs(ids)
	if len(ids) == 0 {
		return out, nil
	}
	cursor, err := s.companiesColl().Find(ctx, bson.D{{Key: "id", Value: bson.D{{Key: "$in", Value: ids}}}}, options.Find().SetProjection(bson.D{
		{Key: "id", Value: 1},
		{Key: "companyName", Value: 1},
		{Key: "overrides.name", Value: 1},
	}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []companyDoc
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	for _, doc := range docs {
		out[doc.ID] = doc.name()
	}
	return out, nil
}

func (s *Store) memberCounts(ctx context.Context, ids []string) (map[string]int64, error) {
	out := map[string]int64{}
	ids = uniqueIDs(ids)
	if len(ids) == 0 {
		return out, nil
	}
	cursor, err := s.members().Aggregate(ctx, mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.D{{Key: "companyId", Value: bson.D{{Key: "$in", Value: ids}}}}}},
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$companyId"},
			{Key: "n", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var rows []struct {
		ID string `bson:"_id"`
		N  int64  `bson:"n"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.ID] = row.N
	}
	return out, nil
}

func (s *Store) membersOf(ctx context.Context, companyID string) ([]Member, error) {
	cursor, err := s.members().Find(ctx, bson.D{{Key: "companyId", Value: companyID}}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	docs := []memberDoc{}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	if len(docs) == 0 {
		return []Member{}, nil
	}
	ids := make([]string, len(docs))
	for i, doc := range docs {
		ids[i] = doc.UserID
	}
	people, err := s.userNames(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]Member, 0, len(docs))
	for _, doc := range docs {
		person := people[doc.UserID]
		role := doc.HiringRole
		if role == "" {
			role = doc.Role
		}
		out = append(out, Member{
			UserID:     doc.UserID,
			Name:       person.Name,
			Email:      person.Email,
			Role:       role,
			HiringRole: doc.HiringRole,
		})
	}
	return out, nil
}

func (s *Store) userNames(ctx context.Context, ids []string) (map[string]userDoc, error) {
	out := map[string]userDoc{}
	cursor, err := s.users().Find(ctx, bson.D{{Key: "id", Value: bson.D{{Key: "$in", Value: ids}}}}, options.Find().SetProjection(bson.D{
		{Key: "id", Value: 1},
		{Key: "name", Value: 1},
		{Key: "email", Value: 1},
	}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []userDoc
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	for _, doc := range docs {
		out[doc.ID] = doc
	}
	return out, nil
}

func verificationFilter(status string) (bson.D, error) {
	status = strings.TrimSpace(status)
	if status == "" {
		return bson.D{}, nil
	}
	switch status {
	case jobs.VerificationPending, jobs.VerificationApproved, jobs.VerificationRejected, jobs.VerificationSuspended:
		return bson.D{{Key: "status", Value: status}}, nil
	default:
		return nil, &ValidationError{Fields: []FieldError{{Field: "status", Detail: "use pending, approved, rejected, or suspended"}}}
	}
}
