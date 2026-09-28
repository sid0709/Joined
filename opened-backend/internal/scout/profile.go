package scout

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	maxLegalName    = 120
	maxPayoutLabel  = 80
	payoutBank      = "bank"
	payoutPayPal    = "paypal"
	countryCodeSize = 2
)

var (
	last4Pattern   = regexp.MustCompile(`^[0-9A-Za-z]{4}$`)
	countryPattern = regexp.MustCompile(`^[A-Z]{2}$`)
)

// EnsureProfile returns the scout profile, creating a probation one the first
// time a scout account uses Scoutwell. A job hunter or recruiter account is refused.
func (s *Store) EnsureProfile(ctx context.Context, userID string) (Profile, error) {
	user, _, err := s.accounts.Account(ctx, userID)
	if err != nil {
		return Profile{}, err
	}
	if user.Role != auth.RoleScout {
		return Profile{}, ErrNotScout
	}
	now := s.now().UTC()
	var profile Profile
	err = s.collection(profilesCollection).FindOneAndUpdate(ctx,
		bson.D{{Key: "userId", Value: userID}},
		bson.D{{Key: "$setOnInsert", Value: bson.D{
			{Key: "userId", Value: userID},
			{Key: "level", Value: LevelProbation},
			{Key: "levelPinned", Value: false},
			{Key: "verification", Value: VerificationNone},
			{Key: "notifyDecisions", Value: true},
			{Key: "notifyRewards", Value: true},
			{Key: "createdAt", Value: now},
			{Key: "updatedAt", Value: now},
		}}},
		options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After),
	).Decode(&profile)
	if err != nil {
		return Profile{}, err
	}
	return withAccount(profile, user), nil
}

// Profile returns an existing profile without creating one.
func (s *Store) Profile(ctx context.Context, userID string) (Profile, error) {
	profile, err := s.storedProfile(ctx, userID)
	if err != nil {
		return Profile{}, err
	}
	return s.viewProfile(ctx, profile)
}

func (s *Store) storedProfile(ctx context.Context, userID string) (Profile, error) {
	var profile Profile
	err := s.collection(profilesCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&profile)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Profile{}, ErrNotFound
	}
	return profile, err
}

func (s *Store) viewProfile(ctx context.Context, profile Profile) (Profile, error) {
	user, _, err := s.accounts.Account(ctx, profile.UserID)
	if err != nil {
		return Profile{}, err
	}
	return withAccount(profile, user), nil
}

func withAccount(profile Profile, user auth.User) Profile {
	profile.Name = user.Name
	profile.Email = user.Email
	profile.VerificationTier = Tier(profile)
	return profile
}

// AcceptTerms records the scout agreement (tier 1).
func (s *Store) AcceptTerms(ctx context.Context, userID string) (Profile, error) {
	if _, err := s.EnsureProfile(ctx, userID); err != nil {
		return Profile{}, err
	}
	now := s.now().UTC()
	_, err := s.collection(profilesCollection).UpdateOne(ctx,
		bson.D{{Key: "userId", Value: userID}, {Key: "termsAcceptedAt", Value: bson.D{{Key: "$exists", Value: false}}}},
		bson.D{{Key: "$set", Value: bson.D{{Key: "termsAcceptedAt", Value: now}, {Key: "updatedAt", Value: now}}}},
	)
	if err != nil {
		return Profile{}, err
	}
	return s.Profile(ctx, userID)
}

// ProfilePatch is what a scout can change about themselves.
type ProfilePatch struct {
	Name            *string `json:"name"`
	NotifyDecisions *bool   `json:"notify_decisions"`
	NotifyRewards   *bool   `json:"notify_rewards"`
}

// UpdateProfile applies a scout's own edits.
func (s *Store) UpdateProfile(ctx context.Context, userID string, patch ProfilePatch) (Profile, error) {
	if _, err := s.EnsureProfile(ctx, userID); err != nil {
		return Profile{}, err
	}
	if patch.Name != nil {
		if err := s.accounts.SetName(ctx, userID, *patch.Name); err != nil {
			return Profile{}, &ValidationError{Fields: []FieldError{{Field: "name", Detail: "enter your name (up to 80 characters)"}}}
		}
	}
	set := bson.D{{Key: "updatedAt", Value: s.now().UTC()}}
	if patch.NotifyDecisions != nil {
		set = append(set, bson.E{Key: "notifyDecisions", Value: *patch.NotifyDecisions})
	}
	if patch.NotifyRewards != nil {
		set = append(set, bson.E{Key: "notifyRewards", Value: *patch.NotifyRewards})
	}
	if _, err := s.collection(profilesCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: userID}}, bson.D{{Key: "$set", Value: set}}); err != nil {
		return Profile{}, err
	}
	return s.Profile(ctx, userID)
}

// VerificationRequest asks staff to verify the scout's identity (tier 2).
type VerificationRequest struct {
	LegalName string `json:"legal_name"`
	Country   string `json:"country"`
}

// RequestVerification queues the scout for identity review.
func (s *Store) RequestVerification(ctx context.Context, userID string, input VerificationRequest) (Profile, error) {
	profile, err := s.EnsureProfile(ctx, userID)
	if err != nil {
		return Profile{}, err
	}
	if profile.TermsAcceptedAt == nil {
		return Profile{}, ErrTermsRequired
	}
	if profile.Verification == VerificationVerified || profile.Verification == VerificationPending {
		return Profile{}, ErrAlreadyDecided
	}
	legal, country, err := legalIdentity(input.LegalName, input.Country)
	if err != nil {
		return Profile{}, err
	}
	now := s.now().UTC()
	_, err = s.collection(profilesCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: userID}}, bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "verification", Value: VerificationPending},
			{Key: "legalName", Value: legal},
			{Key: "country", Value: country},
			{Key: "verificationUpdatedAt", Value: now},
			{Key: "updatedAt", Value: now},
		}},
		{Key: "$unset", Value: bson.D{{Key: "verificationNote", Value: ""}}},
	})
	if err != nil {
		return Profile{}, err
	}
	return s.Profile(ctx, userID)
}

// TaxInput is a scout's tax details. Only the last four characters of the
// tax id are sent and stored.
type TaxInput struct {
	LegalName  string `json:"legal_name"`
	Country    string `json:"country"`
	TaxIDLast4 string `json:"tax_id_last4"`
}

// SaveTaxInfo stores tax details needed before payouts.
func (s *Store) SaveTaxInfo(ctx context.Context, userID string, input TaxInput) (Profile, error) {
	if _, err := s.EnsureProfile(ctx, userID); err != nil {
		return Profile{}, err
	}
	legal, country, err := legalIdentity(input.LegalName, input.Country)
	problems := &ValidationError{}
	var fields *ValidationError
	if errors.As(err, &fields) {
		problems.Fields = append(problems.Fields, fields.Fields...)
	}
	last4 := strings.TrimSpace(input.TaxIDLast4)
	if !last4Pattern.MatchString(last4) {
		problems.add("tax_id_last4", "enter only the last 4 characters of your tax id")
	}
	if err := problems.orNil(); err != nil {
		return Profile{}, err
	}
	now := s.now().UTC()
	info := TaxInfo{LegalName: legal, Country: country, TaxIDLast4: last4, CompletedAt: now}
	if _, err := s.collection(profilesCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: userID}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "taxInfo", Value: info}, {Key: "updatedAt", Value: now}}},
	}); err != nil {
		return Profile{}, err
	}
	return s.Profile(ctx, userID)
}

// PayoutMethodInput names where payouts go. Only a masked last four is accepted.
type PayoutMethodInput struct {
	Type  string `json:"type"`
	Label string `json:"label"`
	Last4 string `json:"last4"`
}

// SavePayoutMethod stores the payout destination.
func (s *Store) SavePayoutMethod(ctx context.Context, userID string, input PayoutMethodInput) (Profile, error) {
	if _, err := s.EnsureProfile(ctx, userID); err != nil {
		return Profile{}, err
	}
	problems := &ValidationError{}
	kind := strings.ToLower(strings.TrimSpace(input.Type))
	if kind != payoutBank && kind != payoutPayPal {
		problems.add("type", "choose bank or paypal")
	}
	label := clean(input.Label)
	if label == "" || utf8.RuneCountInString(label) > maxPayoutLabel {
		problems.add("label", "name this payout method (up to 80 characters)")
	}
	last4 := strings.TrimSpace(input.Last4)
	if !last4Pattern.MatchString(last4) {
		problems.add("last4", "enter only the last 4 characters")
	}
	if err := problems.orNil(); err != nil {
		return Profile{}, err
	}
	now := s.now().UTC()
	method := PayoutMethod{Type: kind, Label: label, Last4: last4, UpdatedAt: now}
	if _, err := s.collection(profilesCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: userID}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "payoutMethod", Value: method}, {Key: "updatedAt", Value: now}}},
	}); err != nil {
		return Profile{}, err
	}
	return s.Profile(ctx, userID)
}

func legalIdentity(name, country string) (string, string, error) {
	problems := &ValidationError{}
	name = clean(name)
	if name == "" || utf8.RuneCountInString(name) > maxLegalName {
		problems.add("legal_name", "enter your full legal name")
	}
	country = strings.ToUpper(strings.TrimSpace(country))
	if len(country) != countryCodeSize || !countryPattern.MatchString(country) {
		problems.add("country", "use a two-letter country code, like US")
	}
	return name, country, problems.orNil()
}
