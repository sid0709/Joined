package auth

import (
	"context"
	"time"
)

// ExportInterval is the minimum gap between account exports for one user.
const ExportInterval = time.Hour

// AccountSource loads the rows an account owns. The auth store still decides
// who the caller is and whether the rate window allows another export.
type AccountSource interface {
	Collect(ctx context.Context, user User, now time.Time) (AccountExport, error)
}

// AccountExport is GET /v1/auth/account/export. It is JSON, not a ZIP.
// Password hashes, session tokens, calendar refresh tokens, and Stripe secrets
// are never fields on this type.
type AccountExport struct {
	ExportedAt    time.Time `json:"exportedAt"`
	User          User      `json:"user"`
	Profile       any       `json:"profile,omitempty"`
	Resumes       any       `json:"resumes"`
	SavedJobs     any       `json:"savedJobs"`
	Applications  any       `json:"applications"`
	Interviews    any       `json:"interviews"`
	Calendar      any       `json:"calendarConnections"`
	Messages      any       `json:"messages"`
	SavedSearches any       `json:"savedSearches"`
	Transactions  any       `json:"transactions"`
}

// EmptyExport is an account with no other rows yet.
func EmptyExport(user User, now time.Time) AccountExport {
	return AccountExport{
		ExportedAt:    now.UTC(),
		User:          User{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role},
		Resumes:       []any{},
		SavedJobs:     []any{},
		Applications:  []any{},
		Interviews:    []any{},
		Calendar:      []any{},
		Messages:      []any{},
		SavedSearches: []any{},
		Transactions:  map[string]any{},
	}
}

// SetAccountSource attaches the reader for owned rows. Nil leaves the export
// as the account record only.
func (s *Store) SetAccountSource(source AccountSource) {
	s.export = source
}

// ExportAccount returns the signed-in user's bundle. A second call inside
// ExportInterval returns ErrExportLimited. The bundle is not logged.
func (s *Store) ExportAccount(ctx context.Context, token string, now time.Time) (AccountExport, error) {
	session, err := s.Session(ctx, token, now)
	if err != nil {
		return AccountExport{}, err
	}
	if err := s.reserveExport(session.User.ID, now); err != nil {
		return AccountExport{}, err
	}
	bundle := EmptyExport(session.User, now)
	if s.export != nil {
		collected, collectErr := s.export.Collect(ctx, session.User, now)
		if collectErr != nil {
			s.releaseExport(session.User.ID, now)
			return AccountExport{}, collectErr
		}
		collected.ExportedAt = bundle.ExportedAt
		collected.User = bundle.User
		bundle = collected
	}
	return bundle, nil
}

func (s *Store) reserveExport(userID string, now time.Time) error {
	s.exportMu.Lock()
	defer s.exportMu.Unlock()
	if s.exportAt == nil {
		s.exportAt = map[string]time.Time{}
	}
	if last, ok := s.exportAt[userID]; ok && now.Sub(last) < ExportInterval {
		return ErrExportLimited
	}
	s.exportAt[userID] = now
	return nil
}

func (s *Store) releaseExport(userID string, now time.Time) {
	s.exportMu.Lock()
	defer s.exportMu.Unlock()
	if last, ok := s.exportAt[userID]; ok && last.Equal(now) {
		delete(s.exportAt, userID)
	}
}
