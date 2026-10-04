package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// invitesCollection is the pending-teammate list the hiring workspace writes.
// Auth reads it so joining an existing company can redeem one row and nothing else.
const (
	invitesCollection   = "company_invites"
	invitedCompanyLimit = 20
)

type storedInvite struct {
	CompanyID string `bson:"companyId"`
	Email     string `bson:"email"`
	Role      string `bson:"role"`
}

// InvitedCompanies lists companies that have a pending invite for the signed-in employee.
func (s *Store) InvitedCompanies(ctx context.Context, token string, now time.Time) ([]Company, error) {
	session, err := s.Session(ctx, token, now)
	if err != nil {
		return nil, err
	}
	if session.User.Role != RoleEmployee {
		return nil, &RoleError{Role: session.User.Role}
	}
	email := inviteEmail(session.User.Email)
	if email == "" {
		return []Company{}, nil
	}
	cursor, err := s.collection(invitesCollection).Find(ctx, bson.D{{Key: "email", Value: email}}, options.Find().
		SetSort(bson.D{{Key: "createdAt", Value: 1}}).
		SetLimit(invitedCompanyLimit))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []storedInvite
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	companies := make([]Company, 0, len(docs))
	for _, doc := range docs {
		company, _, err := s.companyByID(ctx, doc.CompanyID)
		if errors.Is(err, ErrNotFound) {
			continue
		}
		if err != nil {
			return nil, err
		}
		companies = append(companies, company)
	}
	return companies, nil
}

func (s *Store) pendingInviteRole(ctx context.Context, companyID, email string) (string, error) {
	email = inviteEmail(email)
	if email == "" || companyID == "" {
		return "", nil
	}
	var doc storedInvite
	err := s.collection(invitesCollection).FindOne(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "email", Value: email},
	}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return doc.Role, nil
}

func (s *Store) deletePendingInvite(ctx context.Context, companyID, email string) error {
	email = inviteEmail(email)
	if email == "" || companyID == "" {
		return nil
	}
	_, err := s.collection(invitesCollection).DeleteOne(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "email", Value: email},
	})
	return err
}

func inviteEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(normalizeEmail(email)))
}
