package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/mail"
	"strings"
	"time"
	"unicode"
)

const (
	maxNameLength   = 80
	maxURLLength    = 300
	sessionLifetime = 30 * 24 * time.Hour
	tokenBytes      = 32

	roleOwner  = "owner"
	roleMember = "member"

	// An account is exactly one of these. The role is chosen at signup and
	// never gains a second one: a job hunter, a recruiter, or a scout.
	RoleCandidate = "candidate"
	RoleEmployee  = "employee"
	RoleScout     = "scout"

	// AudienceJoined is sign-in from the job hunter and recruiter app.
	AudienceJoined = "joined"
)

var (
	ErrEmailTaken     = errors.New("an account with that email already exists")
	ErrInvalidLogin   = errors.New("sign in required")
	ErrInvalidInput   = errors.New("check the form and try again")
	ErrNotFound       = errors.New("not found")
	ErrHasCompany     = errors.New("this account is already linked to a company")
	ErrWrongRole      = errors.New("this email is registered as a different kind of account")
	ErrInviteRequired = errors.New("an owner must invite you before you can join this company")
)

// RoleError is a sign-in or action from the wrong app for this account.
type RoleError struct {
	Role string
}

func (e *RoleError) Error() string {
	switch e.Role {
	case RoleCandidate:
		return "This email is a job hunter account."
	case RoleEmployee:
		return "This email is a recruiter account."
	case RoleScout:
		return "This email is a scout account."
	default:
		return ErrWrongRole.Error()
	}
}

func (e *RoleError) Unwrap() error { return ErrWrongRole }

// AllowsAudience reports whether a sign-in from audience can use an account of role.
func AllowsAudience(audience, role string) bool {
	switch audience {
	case "", "any":
		return true
	case AudienceJoined:
		return role == RoleCandidate || role == RoleEmployee
	case RoleScout:
		return role == RoleScout
	default:
		return false
	}
}

// UserData removes a person's records in other stores when their account is deleted.
// ownedCompanyID is set when this person created the company page, so that page
// and everything that exists only because of it are deleted too.
type UserData interface {
	DeleteUser(ctx context.Context, userID, ownedCompanyID string) error
}

type User struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type Company struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	URL        string `json:"url,omitempty"`
	Logo       string `json:"logo,omitempty"`
	Role       string `json:"role"`
	HiringRole string `json:"hiringRole,omitempty"`
	IsCreator  bool   `json:"isCreator,omitempty"`
}

type Session struct {
	User    User     `json:"user"`
	Company *Company `json:"company"`
}

// CompanyChoice is optional employer setup on an individual account.
// An id redeems a pending invite for a company already stored. A name starts a new company page.
type CompanyChoice struct {
	ID   string
	Name string
	URL  string
}

// storedUser is an account. Sign in with Google is the only way in; accounts made
// with a password before that still carry a passwordHash nothing reads, and link
// their Google account the first time they sign in with it.
type storedUser struct {
	ID    string `bson:"id"`
	Name  string `bson:"name"`
	Email string `bson:"email"`
	Role  string `bson:"role,omitempty"`
	// GoogleID links Sign in with Google.
	GoogleID  string    `bson:"googleId,omitempty"`
	CreatedAt time.Time `bson:"createdAt"`
}

type storedSession struct {
	TokenHash string    `bson:"tokenHash"`
	UserID    string    `bson:"userId"`
	ExpiresAt time.Time `bson:"expiresAt"`
	CreatedAt time.Time `bson:"createdAt"`
}

type storedMember struct {
	UserID     string    `bson:"userId"`
	CompanyID  string    `bson:"companyId"`
	Role       string    `bson:"role"`
	HiringRole string    `bson:"hiringRole,omitempty"`
	CreatedAt  time.Time `bson:"createdAt"`
}

// Membership is one person's place on a company.
type Membership struct {
	UserID     string
	CompanyID  string
	Role       string
	HiringRole string
	CreatedAt  time.Time
}

func normalizeCompany(choice CompanyChoice) (CompanyChoice, error) {
	choice.ID = strings.TrimSpace(choice.ID)
	choice.Name = strings.TrimSpace(choice.Name)
	choice.URL = strings.TrimSpace(choice.URL)
	linking := choice.ID != ""
	creating := choice.Name != "" || choice.URL != ""
	if linking == creating {
		return CompanyChoice{}, ErrInvalidInput
	}
	if linking && !isPublicID(choice.ID) {
		return CompanyChoice{}, ErrInvalidInput
	}
	if creating {
		if choice.Name == "" || len([]rune(choice.Name)) > maxNameLength {
			return CompanyChoice{}, ErrInvalidInput
		}
		if choice.URL != "" {
			if len(choice.URL) > maxURLLength || !strings.Contains(choice.URL, ".") {
				return CompanyChoice{}, ErrInvalidInput
			}
			if !strings.Contains(choice.URL, "://") {
				choice.URL = "https://" + choice.URL
			}
		}
	}
	return choice, nil
}

func normalizeEmail(value string) string {
	value = strings.TrimSpace(value)
	parsed, err := mail.ParseAddress(value)
	if err != nil {
		return ""
	}
	return strings.ToLower(parsed.Address)
}

func newToken() (string, string, error) {
	raw := make([]byte, tokenBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	token := hex.EncodeToString(raw)
	return token, hashToken(token), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func newPublicID() (string, error) {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80
	return hex.EncodeToString(raw[0:4]) + "-" + hex.EncodeToString(raw[4:6]) + "-" + hex.EncodeToString(raw[6:8]) + "-" + hex.EncodeToString(raw[8:10]) + "-" + hex.EncodeToString(raw[10:]), nil
}

func isPublicID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i, r := range value {
		switch i {
		case 8, 13, 18, 23:
			if r != '-' {
				return false
			}
		default:
			if !unicode.Is(unicode.ASCII_Hex_Digit, r) {
				return false
			}
		}
	}
	return value[14] == '4'
}

// removesCompany is true when this person created the company page, so deleting
// their account also deletes that page.
func removesCompany(createdBy, userID string) bool {
	return createdBy != "" && createdBy == userID
}

func companyKey(name string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(name) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			dash = false
			continue
		}
		if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	return strings.Trim(b.String(), "-")
}
