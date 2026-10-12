package auth

import (
	"context"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// AdminAccount is a staff lookup row. Email is unmasked; the HTTP layer masks it.
type AdminAccount struct {
	ID          string
	Name        string
	Email       string
	Role        string
	CreatedAt   time.Time
	SuspendedAt time.Time
}

// AdminLookup finds one account by email or id. Email wins when both are set.
func (s *Store) AdminLookup(ctx context.Context, email, id string) (AdminAccount, error) {
	email = normalizeEmail(email)
	id = strings.TrimSpace(id)
	if email == "" && id == "" {
		return AdminAccount{}, ErrInvalidInput
	}
	var user AccountUser
	var err error
	if email != "" {
		user, err = s.records.UserByEmail(ctx, email)
	} else {
		user, err = s.records.UserByID(ctx, id)
	}
	if err != nil {
		return AdminAccount{}, err
	}
	if s.userSuspended(user) && user.SuspendedAt.IsZero() {
		s.suspendMu.Lock()
		user.SuspendedAt = s.suspended[user.ID]
		s.suspendMu.Unlock()
	}
	return AdminAccount{
		ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role,
		CreatedAt: user.CreatedAt, SuspendedAt: user.SuspendedAt,
	}, nil
}

// SetSuspended blocks or restores sign-in. A suspended account fails Session and EmailSignin.
func (s *Store) SetSuspended(ctx context.Context, userID string, suspended bool, now time.Time) error {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return ErrInvalidInput
	}
	if _, err := s.records.UserByID(ctx, userID); err != nil {
		return err
	}
	s.suspendMu.Lock()
	if s.suspended == nil {
		s.suspended = map[string]time.Time{}
	}
	if suspended {
		s.suspended[userID] = now.UTC()
	} else {
		delete(s.suspended, userID)
	}
	s.suspendMu.Unlock()
	if s.client == nil {
		return nil
	}
	update := bson.D{{Key: "$unset", Value: bson.D{{Key: "suspendedAt", Value: ""}}}}
	if suspended {
		update = bson.D{{Key: "$set", Value: bson.D{{Key: "suspendedAt", Value: now.UTC()}}}}
	}
	_, err := s.collection(usersCollection).UpdateOne(ctx, bson.D{{Key: "id", Value: userID}}, update)
	return err
}

func (s *Store) userSuspended(user AccountUser) bool {
	if !user.SuspendedAt.IsZero() {
		return true
	}
	s.suspendMu.Lock()
	defer s.suspendMu.Unlock()
	_, ok := s.suspended[user.ID]
	return ok
}
