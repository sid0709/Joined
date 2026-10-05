package scout

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// First-payout identity rules. A scout cannot request (or have staff mark paid)
// their first payout until staff have verified a complete identity: legal name,
// country, date of birth, and a payout-account holder name that matches.
//
// Migration: scouts who already have at least one payout with status "paid" are
// not newly blocked by the stricter fields (date of birth, holder-name match).
// Today's checks still apply to them: verification must be verified, tax info
// and a payout method must be present, and the released balance must meet the
// minimum. Verified scouts with no paid payout must complete the stricter
// fields before their first payout.
const (
	CodeIdentityUnverified   = "identity_unverified"
	CodeIdentityRejected     = "identity_rejected"
	CodeIdentityIncomplete   = "identity_incomplete"
	CodeIdentityNameMismatch = "identity_name_mismatch"

	dateOfBirthLayout = "2006-01-02"
	minPayoutAgeYears = 18
	maxPayoutAgeYears = 120
	maxDocumentRef    = 128
	minHolderName     = 2
)

var (
	ErrIdentityUnverified   = errors.New("verify your identity before the first payout")
	ErrIdentityRejected     = errors.New("identity verification was declined")
	ErrIdentityIncomplete   = errors.New("complete identity details before the first payout")
	ErrIdentityNameMismatch = errors.New("payout account holder name must match legal name")

	documentRefPattern  = regexp.MustCompile(`^[A-Za-z0-9._:-]+$`)
	governmentIDPattern = regexp.MustCompile(`(?i)^(\d{3}-?\d{2}-?\d{4}|\d{8,})$`)
)

// Identity is the scout-facing identity status used before the first payout.
type Identity struct {
	Status           string     `json:"status"`
	LegalName        string     `json:"legal_name,omitempty"`
	Country          string     `json:"country,omitempty"`
	DateOfBirth      string     `json:"date_of_birth,omitempty"`
	DocumentRef      string     `json:"document_ref,omitempty"`
	PayoutHolderName string     `json:"payout_holder_name,omitempty"`
	NameMatches      bool       `json:"name_matches"`
	FirstPayoutGated bool       `json:"first_payout_gated"`
	Note             string     `json:"note,omitempty"`
	VerifiedBy       string     `json:"verified_by,omitempty"`
	UpdatedAt        *time.Time `json:"updated_at,omitempty"`
}

// NamesMatch reports whether a legal name and a payout-account holder name
// refer to the same person after letter-folding and punctuation stripping.
func NamesMatch(legalName, holderName string) bool {
	left, right := foldPersonName(legalName), foldPersonName(holderName)
	return left != "" && left == right
}

func foldPersonName(value string) string {
	var b strings.Builder
	space := false
	for _, r := range strings.TrimSpace(value) {
		switch {
		case unicode.Is(unicode.Mn, r):
			continue
		case unicode.IsLetter(r):
			b.WriteRune(unicode.ToLower(r))
			space = false
		case unicode.IsSpace(r) || r == '-' || r == '\'':
			if !space && b.Len() > 0 {
				b.WriteByte(' ')
				space = true
			}
		}
	}
	return strings.TrimSpace(b.String())
}

// IdentityFieldsPresent is true when legal name, country, and date of birth are set.
func IdentityFieldsPresent(p Profile) bool {
	return strings.TrimSpace(p.LegalName) != "" && strings.TrimSpace(p.Country) != "" && strings.TrimSpace(p.DateOfBirth) != ""
}

// PayoutHolderMatches is true when the payout method names the same person as the legal name.
func PayoutHolderMatches(p Profile) bool {
	if p.PayoutMethod == nil {
		return false
	}
	return NamesMatch(p.LegalName, p.PayoutMethod.HolderName)
}

// FirstPayoutIdentityError is the typed identity failure for a payout request
// or a staff paid decision on the scout's first payout. A paid payout in the
// scout's history skips the stricter field checks (see package comment).
func FirstPayoutIdentityError(p Profile, hasPaidPayout bool) error {
	switch p.Verification {
	case VerificationRejected:
		return ErrIdentityRejected
	case VerificationVerified:
		if hasPaidPayout {
			return nil
		}
		if !IdentityFieldsPresent(p) {
			return ErrIdentityIncomplete
		}
		if p.PayoutMethod == nil || strings.TrimSpace(p.PayoutMethod.HolderName) == "" {
			return ErrIdentityIncomplete
		}
		if !PayoutHolderMatches(p) {
			return ErrIdentityNameMismatch
		}
		return nil
	default:
		return ErrIdentityUnverified
	}
}

// IdentityProblem maps a first-payout identity error to its stable API code.
func IdentityProblem(err error) (code, detail string, ok bool) {
	switch {
	case errors.Is(err, ErrIdentityNameMismatch):
		return CodeIdentityNameMismatch, ErrIdentityNameMismatch.Error(), true
	case errors.Is(err, ErrIdentityRejected):
		return CodeIdentityRejected, ErrIdentityRejected.Error(), true
	case errors.Is(err, ErrIdentityIncomplete):
		return CodeIdentityIncomplete, ErrIdentityIncomplete.Error(), true
	case errors.Is(err, ErrIdentityUnverified):
		return CodeIdentityUnverified, ErrIdentityUnverified.Error(), true
	default:
		return "", "", false
	}
}

func wrapPayoutIdentity(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%w: %w", ErrPayoutBlocked, err)
}

func parseDateOfBirth(value string, now time.Time) (string, error) {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return "", &ValidationError{Fields: []FieldError{{Field: "date_of_birth", Detail: "enter your date of birth as YYYY-MM-DD"}}}
	}
	day, err := time.Parse(dateOfBirthLayout, raw)
	if err != nil || day.Format(dateOfBirthLayout) != raw {
		return "", &ValidationError{Fields: []FieldError{{Field: "date_of_birth", Detail: "enter your date of birth as YYYY-MM-DD"}}}
	}
	now = now.UTC()
	day = day.UTC()
	latest := now.AddDate(-minPayoutAgeYears, 0, 0)
	earliest := now.AddDate(-maxPayoutAgeYears, 0, 0)
	if day.After(latest) {
		return "", &ValidationError{Fields: []FieldError{{Field: "date_of_birth", Detail: "you must be at least 18"}}}
	}
	if day.Before(earliest) {
		return "", &ValidationError{Fields: []FieldError{{Field: "date_of_birth", Detail: "enter a valid date of birth"}}}
	}
	return raw, nil
}

func parseDocumentRef(value string) (string, error) {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return "", nil
	}
	if utf8.RuneCountInString(raw) > maxDocumentRef || !documentRefPattern.MatchString(raw) {
		return "", &ValidationError{Fields: []FieldError{{Field: "document_ref", Detail: "use an opaque document reference, not an ID number or file"}}}
	}
	if governmentIDPattern.MatchString(raw) {
		return "", &ValidationError{Fields: []FieldError{{Field: "document_ref", Detail: "do not send a government ID number"}}}
	}
	return raw, nil
}

func parseHolderName(value string) (string, error) {
	name := clean(value)
	if name == "" {
		return "", nil
	}
	n := utf8.RuneCountInString(name)
	if n < minHolderName || n > maxLegalName {
		return "", &ValidationError{Fields: []FieldError{{Field: "holder_name", Detail: "enter the account holder's full legal name"}}}
	}
	return name, nil
}

func identityCoreChanged(profile Profile, legal, country, dob string) bool {
	if profile.LegalName != "" && !NamesMatch(profile.LegalName, legal) {
		return true
	}
	if profile.Country != "" && !strings.EqualFold(profile.Country, country) {
		return true
	}
	if profile.DateOfBirth != "" && profile.DateOfBirth != dob {
		return true
	}
	return false
}

func staffCanVerify(profile Profile) error {
	if !IdentityFieldsPresent(profile) {
		return &ValidationError{Fields: []FieldError{{Field: "verification", Detail: "legal name, country, and date of birth are required"}}}
	}
	if profile.PayoutMethod == nil || strings.TrimSpace(profile.PayoutMethod.HolderName) == "" {
		return &ValidationError{Fields: []FieldError{{Field: "verification", Detail: "payout account holder name is required"}}}
	}
	if !PayoutHolderMatches(profile) {
		return &ValidationError{Fields: []FieldError{{Field: "verification", Detail: "payout account holder name must match legal name"}}}
	}
	return nil
}
