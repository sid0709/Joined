package staff

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type companyDoc struct {
	ID          string `bson:"id"`
	CompanyName string `bson:"companyName"`
	CompanyURL  string `bson:"companyUrl"`
	CompanyLogo string `bson:"companyLogo"`
	Overrides   struct {
		Name *string `bson:"name,omitempty"`
		URL  *string `bson:"url,omitempty"`
		Logo *string `bson:"logo,omitempty"`
	} `bson:"overrides"`
	TrustStatus      string    `bson:"trustStatus"`
	Claimed          bool      `bson:"claimed"`
	ClaimMethod      string    `bson:"claimMethod"`
	ClaimStatus      string    `bson:"claimStatus"`
	ClaimedBy        string    `bson:"claimedBy"`
	Domains          []string  `bson:"domains"`
	VerificationNote string    `bson:"verificationNote"`
	VerifiedAt       time.Time `bson:"verifiedAt"`
	TrustUpdatedAt   time.Time `bson:"trustUpdatedAt"`
}

func (doc companyDoc) name() string {
	if doc.Overrides.Name != nil && strings.TrimSpace(*doc.Overrides.Name) != "" {
		return strings.TrimSpace(*doc.Overrides.Name)
	}
	return strings.TrimSpace(doc.CompanyName)
}

func (doc companyDoc) url() string {
	if doc.Overrides.URL != nil {
		return strings.TrimSpace(*doc.Overrides.URL)
	}
	return strings.TrimSpace(doc.CompanyURL)
}

func (doc companyDoc) logo() string {
	if doc.Overrides.Logo != nil {
		return strings.TrimSpace(*doc.Overrides.Logo)
	}
	return strings.TrimSpace(doc.CompanyLogo)
}

// CompanyQuery filters the staff company list.
type CompanyQuery struct {
	Status   string
	Q        string
	Page     int64
	PageSize int64
}

// ListCompanies returns companies for the verification queue.
func (s *Store) ListCompanies(ctx context.Context, query CompanyQuery) (Page[CompanySummary], error) {
	page, size := pageBounds(query.Page, query.PageSize)
	trust, err := trustFilter(query.Status)
	if err != nil {
		return Page[CompanySummary]{}, err
	}
	filter := andFilter(trust, nameFilter(query.Q))
	total, err := s.companiesColl().CountDocuments(ctx, filter)
	if err != nil {
		return Page[CompanySummary]{}, err
	}
	opts := options.Find().
		SetSkip((page - 1) * size).
		SetLimit(size).
		SetSort(bson.D{{Key: "trustUpdatedAt", Value: -1}, {Key: "companyName", Value: 1}}).
		SetProjection(bson.D{{Key: "jobIds", Value: 0}, {Key: "logoFile", Value: 0}})
	cursor, err := s.companiesColl().Find(ctx, filter, opts)
	if err != nil {
		return Page[CompanySummary]{}, err
	}
	defer cursor.Close(ctx)
	var docs []companyDoc
	if err := cursor.All(ctx, &docs); err != nil {
		return Page[CompanySummary]{}, err
	}
	rows := make([]CompanySummary, 0, len(docs))
	for _, doc := range docs {
		rows = append(rows, doc.summary(nil))
	}
	return Page[CompanySummary]{Data: rows, Total: total, Page: page, PageSize: size}, nil
}

// Company loads one company with members, domains, cases, and the audit trail.
func (s *Store) Company(ctx context.Context, id string) (CompanyDetail, error) {
	doc, err := s.company(ctx, id)
	if err != nil {
		return CompanyDetail{}, err
	}
	return s.detail(ctx, doc)
}

// DecideCompany approves, rejects, or suspends a company and records the actor.
func (s *Store) DecideCompany(ctx context.Context, id, actor string, input CompanyDecision, now time.Time) (CompanyDetail, error) {
	if err := input.Normalize(); err != nil {
		return CompanyDetail{}, err
	}
	doc, err := s.company(ctx, id)
	if err != nil {
		return CompanyDetail{}, err
	}
	return s.applyCompany(ctx, doc, actor, input, now)
}

// NoteCompanyCreated files the verification case for a company page the owner just created.
func (s *Store) NoteCompanyCreated(ctx context.Context, companyID, userID, website string, now time.Time) error {
	if strings.TrimSpace(companyID) == "" {
		return nil
	}
	doc, err := s.company(ctx, companyID)
	if err != nil {
		return err
	}
	if jobs.EffectiveTrust(doc.TrustStatus) == jobs.TrustVerified {
		return nil
	}
	host := websiteHost(website)
	if host == "" {
		host = websiteHost(doc.url())
	}
	if host != "" {
		if _, err := s.companiesColl().UpdateOne(ctx, bson.D{{Key: "id", Value: companyID}}, bson.D{
			{Key: "$addToSet", Value: bson.D{{Key: "domains", Value: host}}},
		}); err != nil {
			return err
		}
	}
	domains := cleanDomains(append(doc.Domains, host))
	note := "Owner created the company page"
	opened, created, err := s.openCase(ctx, OpenCase{
		CompanyID:   companyID,
		Method:      jobs.ClaimManual,
		Domains:     domains,
		Note:        note,
		RequestedBy: userID,
	}, now)
	if err != nil {
		return err
	}
	if created {
		s.audit(ctx, "company.case.opened", subjectCompany, companyID, userID, note, now.UTC())
		s.audit(ctx, "case.opened", subjectCase, opened.ID.Hex(), userID, note, now.UTC())
	}
	return nil
}

func (s *Store) applyCompany(ctx context.Context, doc companyDoc, actor string, input CompanyDecision, now time.Time) (CompanyDetail, error) {
	trust := jobs.EffectiveTrust(doc.TrustStatus)
	nextTrust, nextClaim, err := NextCompanyTrust(trust, doc.ClaimStatus, input.Decision)
	noChange := errors.Is(err, ErrNoChange)
	if err != nil && !noChange {
		return CompanyDetail{}, err
	}
	now = now.UTC()
	if !noChange {
		method := doc.ClaimMethod
		if input.ClaimMethod != "" {
			method = input.ClaimMethod
		}
		claimed := doc.Claimed
		switch input.Decision {
		case DecisionApprove:
			claimed = true
		case DecisionReject:
			claimed = false
		}
		set := bson.D{
			{Key: "trustStatus", Value: nextTrust},
			{Key: "claimStatus", Value: nextClaim},
			{Key: "claimed", Value: claimed},
			{Key: "claimMethod", Value: method},
			{Key: "verificationNote", Value: input.Reason},
			{Key: "trustUpdatedAt", Value: now},
		}
		if input.Decision == DecisionApprove {
			set = append(set, bson.E{Key: "verifiedAt", Value: now})
		}
		if _, err := s.companiesColl().UpdateOne(ctx, bson.D{{Key: "id", Value: doc.ID}}, bson.D{{Key: "$set", Value: set}}); err != nil {
			return CompanyDetail{}, err
		}
	}
	switch input.Decision {
	case DecisionApprove:
		if err := s.releaseCompanyListings(ctx, doc.ID, actor, input.Reason, now); err != nil {
			return CompanyDetail{}, err
		}
	case DecisionSuspend:
		if err := s.suspendCompanyListings(ctx, doc.ID, actor, input.Reason, now); err != nil {
			return CompanyDetail{}, err
		}
	}
	if err := s.closeOpenCases(ctx, doc.ID, input.Decision, input.Reason, actor, now); err != nil {
		return CompanyDetail{}, err
	}
	if !noChange {
		s.audit(ctx, "company.verification."+input.Decision, subjectCompany, doc.ID, actor, input.Reason, now)
	}
	return s.Company(ctx, doc.ID)
}

func (s *Store) company(ctx context.Context, id string) (companyDoc, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return companyDoc{}, ErrNotFound
	}
	var doc companyDoc
	err := s.companiesColl().FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) || doc.ID == "" {
		return companyDoc{}, ErrNotFound
	}
	if err != nil {
		return companyDoc{}, err
	}
	return doc, nil
}

func (s *Store) detail(ctx context.Context, doc companyDoc) (CompanyDetail, error) {
	members, err := s.members(ctx, doc.ID)
	if err != nil {
		return CompanyDetail{}, err
	}
	cases, err := s.casesForCompany(ctx, doc.ID)
	if err != nil {
		return CompanyDetail{}, err
	}
	trail, err := s.auditTrail(ctx, doc.ID)
	if err != nil {
		return CompanyDetail{}, err
	}
	extra, err := s.settingDomains(ctx, doc)
	if err != nil {
		return CompanyDetail{}, err
	}
	summary := doc.summary(extra)
	return CompanyDetail{
		CompanySummary: summary,
		Logo:           doc.logo(),
		ClaimedBy:      doc.ClaimedBy,
		Note:           doc.VerificationNote,
		VerifiedAt:     doc.VerifiedAt,
		Members:        members,
		Cases:          cases,
		Audit:          trail,
	}, nil
}

func (doc companyDoc) summary(extra []string) CompanySummary {
	trust := jobs.EffectiveTrust(doc.TrustStatus)
	names := cleanDomains(append(append([]string{}, doc.Domains...), extra...))
	if host := websiteHost(doc.url()); host != "" {
		names = cleanDomains(append([]string{host}, names...))
	}
	domains := make([]Domain, 0, len(names))
	verified := trust == jobs.TrustVerified
	for _, name := range names {
		domains = append(domains, Domain{Name: name, Verified: verified})
	}
	return CompanySummary{
		ID:          doc.ID,
		Name:        doc.name(),
		URL:         doc.url(),
		Verified:    verified,
		TrustStatus: trust,
		Claimed:     doc.Claimed,
		ClaimMethod: doc.ClaimMethod,
		ClaimStatus: doc.ClaimStatus,
		Domains:     domains,
		UpdatedAt:   doc.TrustUpdatedAt,
	}
}

func (s *Store) members(ctx context.Context, companyID string) ([]Member, error) {
	if s.accounts == nil {
		return []Member{}, nil
	}
	rows, err := s.accounts.CompanyMembers(ctx, companyID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.UserID)
	}
	users, err := s.accounts.Users(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]Member, 0, len(rows))
	for _, row := range rows {
		user := users[row.UserID]
		out = append(out, Member{
			UserID:     row.UserID,
			Name:       user.Name,
			Email:      user.Email,
			Role:       row.Role,
			HiringRole: row.HiringRole,
		})
	}
	return out, nil
}

func (s *Store) settingDomains(ctx context.Context, doc companyDoc) ([]string, error) {
	if s.hiring == nil {
		return nil, nil
	}
	settings, err := s.hiring.Settings(ctx, auth.Company{ID: doc.ID, URL: doc.url()})
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(settings.Domains))
	for _, domain := range settings.Domains {
		names = append(names, domain.Name)
	}
	return names, nil
}

func trustFilter(status string) (bson.D, error) {
	status = strings.TrimSpace(status)
	switch status {
	case "":
		return nil, nil
	case jobs.TrustUnclaimed:
		return bson.D{{Key: "$or", Value: bson.A{
			bson.D{{Key: "trustStatus", Value: jobs.TrustUnclaimed}},
			bson.D{{Key: "trustStatus", Value: ""}},
			bson.D{{Key: "trustStatus", Value: bson.D{{Key: "$exists", Value: false}}}},
		}}}, nil
	case jobs.TrustClaimed, jobs.TrustVerified, jobs.TrustSuspended:
		return bson.D{{Key: "trustStatus", Value: status}}, nil
	default:
		return nil, &ValidationError{Fields: []FieldError{{Field: "status", Detail: "use unclaimed, claimed, verified, or suspended"}}}
	}
}
