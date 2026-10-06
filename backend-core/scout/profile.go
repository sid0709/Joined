package scout

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	maxLegalName        = 120
	maxPayoutLabel      = 80
	maxPayoutEmail      = 254
	maxAccountRef       = 80
	payoutBank          = "bank"
	payoutPayPal        = "paypal"
	payoutProvider      = "provider"
	countryCodeSize     = 2
	countryUnitedStates = "US"
	currencyCodeSize    = 3
)

var (
	last4Pattern    = regexp.MustCompile(`^[0-9A-Za-z]{4}$`)
	countryPattern  = regexp.MustCompile(`^[A-Z]{2}$`)
	currencyPattern = regexp.MustCompile(`^[A-Z]{3}$`)
	emailPattern    = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	ibanPattern     = regexp.MustCompile(`^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$`)
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
	if s.docs != nil {
		profile, err := s.docs.upsertProfile(ctx, userID, now)
		if err != nil {
			return Profile{}, err
		}
		return withAccount(profile, user), nil
	}
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
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.profile(userID)
	}
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
	LegalName   string `json:"legal_name"`
	Country     string `json:"country"`
	DateOfBirth string `json:"date_of_birth"`
	DocumentRef string `json:"document_ref"`
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
	legal, country, err := legalIdentity(input.LegalName, input.Country)
	problems := &ValidationError{}
	var fields *ValidationError
	if errors.As(err, &fields) {
		problems.Fields = append(problems.Fields, fields.Fields...)
	}
	dob, err := parseDateOfBirth(input.DateOfBirth, s.now())
	if errors.As(err, &fields) {
		problems.Fields = append(problems.Fields, fields.Fields...)
	}
	docRef, err := parseDocumentRef(input.DocumentRef)
	if errors.As(err, &fields) {
		problems.Fields = append(problems.Fields, fields.Fields...)
	}
	if err := problems.orNil(); err != nil {
		return Profile{}, err
	}
	if profile.PayoutMethod != nil && strings.TrimSpace(profile.PayoutMethod.HolderName) != "" && !NamesMatch(legal, profile.PayoutMethod.HolderName) {
		return Profile{}, wrapPayoutIdentity(ErrIdentityNameMismatch)
	}
	if profile.Verification == VerificationVerified && IdentityFieldsPresent(profile) && !identityCoreChanged(profile, legal, country, dob) {
		return Profile{}, ErrAlreadyDecided
	}
	now := s.now().UTC()
	next := VerificationPending
	keepVerified := profile.Verification == VerificationVerified && !identityCoreChanged(profile, legal, country, dob)
	if keepVerified {
		next = VerificationVerified
	}
	if err := s.updateProfile(ctx, userID, func(p *Profile) {
		p.Verification = next
		p.LegalName = legal
		p.Country = country
		p.DateOfBirth = dob
		p.DocumentRef = docRef
		p.VerificationUpdate = &now
		p.UpdatedAt = now
		if keepVerified {
			return
		}
		p.VerificationNote = ""
		p.VerifiedBy = ""
	}); err != nil {
		return Profile{}, err
	}
	return s.Profile(ctx, userID)
}

// Identity returns the scout-facing identity status for the first-payout gate.
func (s *Store) Identity(ctx context.Context, userID string) (Identity, error) {
	profile, err := s.EnsureProfile(ctx, userID)
	if err != nil {
		return Identity{}, err
	}
	paid, err := s.hasPaidPayout(ctx, userID)
	if err != nil {
		return Identity{}, err
	}
	holder := ""
	if profile.PayoutMethod != nil {
		holder = profile.PayoutMethod.HolderName
	}
	return Identity{
		Status:           profile.Verification,
		LegalName:        profile.LegalName,
		Country:          profile.Country,
		DateOfBirth:      profile.DateOfBirth,
		DocumentRef:      profile.DocumentRef,
		PayoutHolderName: holder,
		NameMatches:      PayoutHolderMatches(profile),
		FirstPayoutGated: !paid,
		Note:             profile.VerificationNote,
		VerifiedBy:       profile.VerifiedBy,
		UpdatedAt:        profile.VerificationUpdate,
	}, nil
}

// TaxInput is a scout's tax details. Only the last four characters of the
// tax id are sent and stored. form_type is w9, w8ben, or w8ben_e.
type TaxInput struct {
	LegalName  string `json:"legal_name"`
	Country    string `json:"country"`
	TaxIDLast4 string `json:"tax_id_last4"`
	FormType   string `json:"form_type"`
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
	form := validateTaxForm(input.FormType, country, problems)
	if err := problems.orNil(); err != nil {
		return Profile{}, err
	}
	now := s.now().UTC()
	info := TaxInfo{
		LegalName:   legal,
		Country:     country,
		TaxIDLast4:  last4,
		FormType:    form,
		CertifiedAt: now,
		CompletedAt: now,
	}
	if err := s.updateProfile(ctx, userID, func(p *Profile) {
		p.TaxInfo = &info
		p.UpdatedAt = now
	}); err != nil {
		return Profile{}, err
	}
	return s.Profile(ctx, userID)
}

// PayoutMethodInput names where payouts go. Raw bank numbers are refused;
// send a country, currency, and email or opaque account reference.
type PayoutMethodInput struct {
	Type       string `json:"type"`
	Label      string `json:"label"`
	Last4      string `json:"last4"`
	HolderName string `json:"holder_name"`
	Country    string `json:"country"`
	Currency   string `json:"currency"`
	Email      string `json:"email"`
	AccountRef string `json:"account_ref"`
}

// SavePayoutMethod stores the payout destination and creates a provider recipient.
func (s *Store) SavePayoutMethod(ctx context.Context, userID string, input PayoutMethodInput) (Profile, error) {
	if _, err := s.EnsureProfile(ctx, userID); err != nil {
		return Profile{}, err
	}
	method, err := normalizePayoutMethod(input, s.now().UTC())
	if err != nil {
		return Profile{}, err
	}
	result, err := s.provider().CreateRecipient(ctx, recipientFromMethod(userID, method))
	if err != nil {
		return Profile{}, fmt.Errorf("create payout recipient: %w", err)
	}
	method.RecipientID = result.RecipientID
	if err := s.updateProfile(ctx, userID, func(p *Profile) {
		p.PayoutMethod = &method
		p.UpdatedAt = method.UpdatedAt
	}); err != nil {
		return Profile{}, err
	}
	return s.Profile(ctx, userID)
}

func normalizePayoutMethod(input PayoutMethodInput, now time.Time) (PayoutMethod, error) {
	problems := &ValidationError{}
	kind := strings.ToLower(strings.TrimSpace(input.Type))
	if kind != payoutBank && kind != payoutPayPal && kind != payoutProvider {
		problems.add("type", "choose bank, paypal, or provider")
	}
	label := clean(input.Label)
	if label == "" || utf8.RuneCountInString(label) > maxPayoutLabel {
		problems.add("label", "name this payout method (up to 80 characters)")
	}
	country := strings.ToUpper(strings.TrimSpace(input.Country))
	if country != "" && (len(country) != countryCodeSize || !countryPattern.MatchString(country)) {
		problems.add("country", "use a two-letter country code, like US")
	}
	currency := strings.ToUpper(strings.TrimSpace(input.Currency))
	if currency == "" {
		currency = Currency
	}
	if len(currency) != currencyCodeSize || !currencyPattern.MatchString(currency) {
		problems.add("currency", "use a three-letter currency code, like USD")
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email != "" {
		if utf8.RuneCountInString(email) > maxPayoutEmail || !emailPattern.MatchString(email) {
			problems.add("email", "enter a valid email")
		}
	}
	accountRef := strings.TrimSpace(input.AccountRef)
	if accountRef != "" {
		compact := strings.ToUpper(strings.ReplaceAll(accountRef, " ", ""))
		if utf8.RuneCountInString(accountRef) > maxAccountRef {
			problems.add("account_ref", "keep the account reference under 80 characters")
		} else if ibanPattern.MatchString(compact) {
			problems.add("account_ref", "do not send a bank account number; use the provider recipient reference")
		}
	}
	if kind == payoutProvider && country == "" {
		problems.add("country", "use a two-letter country code, like US")
	}
	if kind == payoutProvider && email == "" && accountRef == "" {
		problems.add("email", "enter an email or account reference")
	}
	last4 := strings.TrimSpace(input.Last4)
	if last4 == "" {
		last4 = deriveLast4(email, accountRef)
	}
	if !last4Pattern.MatchString(last4) {
		problems.add("last4", "enter only the last 4 characters")
	}
	holder, err := parseHolderName(input.HolderName)
	var fields *ValidationError
	if errors.As(err, &fields) {
		problems.Fields = append(problems.Fields, fields.Fields...)
	}
	if err := problems.orNil(); err != nil {
		return PayoutMethod{}, err
	}
	return PayoutMethod{
		Type:       kind,
		Label:      label,
		Last4:      last4,
		HolderName: holder,
		Country:    country,
		Currency:   currency,
		Email:      email,
		AccountRef: accountRef,
		UpdatedAt:  now,
	}, nil
}

func deriveLast4(email, accountRef string) string {
	source := accountRef
	if source == "" {
		source = email
	}
	alnum := make([]rune, 0, len(source))
	for _, r := range source {
		if r >= '0' && r <= '9' || r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' {
			alnum = append(alnum, r)
		}
	}
	if len(alnum) < 4 {
		return ""
	}
	return string(alnum[len(alnum)-4:])
}

func validateTaxForm(form, country string, problems *ValidationError) string {
	form = strings.TrimSpace(form)
	switch form {
	case TaxFormW9:
		if country != countryUnitedStates {
			problems.add("form_type", "a W-9 is only for a US person")
		}
	case TaxFormW8BEN, TaxFormW8BENE:
		if country == countryUnitedStates {
			problems.add("form_type", "a US person certifies with a W-9")
		}
	default:
		problems.add("form_type", "choose w9, w8ben, or w8ben_e")
	}
	return form
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

func (s *Store) updateProfile(ctx context.Context, userID string, apply func(*Profile)) error {
	if mem, ok := s.docs.(*memDocs); ok {
		_, err := mem.applyProfile(userID, apply)
		return err
	}
	profile, err := s.storedProfile(ctx, userID)
	if err != nil {
		return err
	}
	apply(&profile)
	set, unset := profileWrite(profile)
	doc := bson.D{{Key: "$set", Value: set}}
	if len(unset) > 0 {
		doc = append(doc, bson.E{Key: "$unset", Value: unset})
	}
	_, err = s.collection(profilesCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: userID}}, doc)
	return err
}

func profileWrite(p Profile) (bson.D, bson.D) {
	set := bson.D{
		{Key: "verification", Value: p.Verification},
		{Key: "legalName", Value: p.LegalName},
		{Key: "country", Value: p.Country},
		{Key: "dateOfBirth", Value: p.DateOfBirth},
		{Key: "documentRef", Value: p.DocumentRef},
		{Key: "updatedAt", Value: p.UpdatedAt},
		{Key: "notifyDecisions", Value: p.NotifyDecisions},
		{Key: "notifyRewards", Value: p.NotifyRewards},
		{Key: "level", Value: p.Level},
		{Key: "levelPinned", Value: p.LevelPinned},
	}
	unset := bson.D{}
	if p.VerificationNote == "" {
		unset = append(unset, bson.E{Key: "verificationNote", Value: ""})
	} else {
		set = append(set, bson.E{Key: "verificationNote", Value: p.VerificationNote})
	}
	if p.VerifiedBy == "" {
		unset = append(unset, bson.E{Key: "verifiedBy", Value: ""})
	} else {
		set = append(set, bson.E{Key: "verifiedBy", Value: p.VerifiedBy})
	}
	if p.VerificationUpdate != nil {
		set = append(set, bson.E{Key: "verificationUpdatedAt", Value: *p.VerificationUpdate})
	}
	if p.PayoutMethod != nil {
		set = append(set, bson.E{Key: "payoutMethod", Value: *p.PayoutMethod})
	}
	if p.TaxInfo != nil {
		set = append(set, bson.E{Key: "taxInfo", Value: *p.TaxInfo})
	}
	if p.TermsAcceptedAt != nil {
		set = append(set, bson.E{Key: "termsAcceptedAt", Value: *p.TermsAcceptedAt})
	}
	return set, unset
}
