package auth

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	hiringAdmin       = "admin"
	hiringRecruiter   = "recruiter"
	hiringViewer      = "viewer"
	hiringManager     = "hiring_manager"
	hiringInterviewer = "interviewer"
	hiringFinance     = "finance"
)

// UserByEmail finds an account by its sign-in email.
func (s *Store) UserByEmail(ctx context.Context, email string) (User, error) {
	email = normalizeEmail(email)
	if email == "" {
		return User{}, ErrInvalidInput
	}
	var user storedUser
	err := s.collection(usersCollection).FindOne(ctx, bson.D{{Key: "email", Value: email}}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	return User{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role}, nil
}

// CompanyMembers lists everyone linked to the company, oldest first.
func (s *Store) CompanyMembers(ctx context.Context, companyID string) ([]Membership, error) {
	cursor, err := s.collection(membersCollection).Find(ctx, bson.D{{Key: "companyId", Value: companyID}}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []storedMember
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]Membership, 0, len(docs))
	for _, doc := range docs {
		out = append(out, membershipFrom(doc))
	}
	return out, nil
}

// MembershipOf returns the company a person belongs to.
func (s *Store) MembershipOf(ctx context.Context, userID string) (Membership, error) {
	var doc storedMember
	err := s.collection(membersCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Membership{}, ErrNotFound
	}
	if err != nil {
		return Membership{}, err
	}
	return membershipFrom(doc), nil
}

// AddMember links an existing account to a company as a non-owner.
func (s *Store) AddMember(ctx context.Context, userID, companyID, hiringRole string, now time.Time) error {
	if !validHiringRole(hiringRole) {
		return ErrInvalidInput
	}
	_, err := s.collection(membersCollection).InsertOne(ctx, storedMember{
		UserID:     userID,
		CompanyID:  companyID,
		Role:       roleMember,
		HiringRole: hiringRole,
		CreatedAt:  now.UTC(),
	})
	if mongo.IsDuplicateKeyError(err) {
		return ErrHasCompany
	}
	return err
}

// SetHiringRole changes a teammate's role. The owner role stays on the creator.
func (s *Store) SetHiringRole(ctx context.Context, companyID, userID, hiringRole string) error {
	if !validHiringRole(hiringRole) {
		return ErrInvalidInput
	}
	member, err := s.MembershipOf(ctx, userID)
	if err != nil {
		return err
	}
	if member.CompanyID != companyID || member.Role == roleOwner {
		return ErrInvalidInput
	}
	_, err = s.collection(membersCollection).UpdateOne(ctx, bson.D{
		{Key: "userId", Value: userID},
		{Key: "companyId", Value: companyID},
	}, bson.D{{Key: "$set", Value: bson.D{{Key: "hiringRole", Value: hiringRole}}}})
	return err
}

// RemoveMember drops a non-owner from the company.
func (s *Store) RemoveMember(ctx context.Context, companyID, userID string) error {
	member, err := s.MembershipOf(ctx, userID)
	if err != nil {
		return err
	}
	if member.CompanyID != companyID || member.Role == roleOwner {
		return ErrInvalidInput
	}
	_, err = s.collection(membersCollection).DeleteOne(ctx, bson.D{{Key: "userId", Value: userID}})
	return err
}

// TransferOwner makes another member the creator. The previous owner becomes an admin.
func (s *Store) TransferOwner(ctx context.Context, companyID, fromUser, toUser string) error {
	if fromUser == "" || toUser == "" || fromUser == toUser {
		return ErrInvalidInput
	}
	_, createdBy, err := s.companyByID(ctx, companyID)
	if err != nil {
		return err
	}
	if createdBy != fromUser {
		return ErrInvalidInput
	}
	next, err := s.MembershipOf(ctx, toUser)
	if err != nil {
		return err
	}
	if next.CompanyID != companyID || next.Role == roleOwner {
		return ErrInvalidInput
	}
	if _, err := s.collection(s.companies).UpdateOne(ctx, bson.D{{Key: "id", Value: companyID}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "createdBy", Value: toUser}}},
	}); err != nil {
		return err
	}
	if _, err := s.collection(membersCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: fromUser}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "role", Value: roleMember}, {Key: "hiringRole", Value: hiringAdmin}}},
	}); err != nil {
		return err
	}
	_, err = s.collection(membersCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: toUser}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "role", Value: roleOwner}, {Key: "hiringRole", Value: roleOwner}}},
	})
	return err
}

func membershipFrom(doc storedMember) Membership {
	role := doc.HiringRole
	if doc.Role == roleOwner {
		role = roleOwner
	}
	if role == "" {
		role = hiringRecruiter
	}
	return Membership{
		UserID:     doc.UserID,
		CompanyID:  doc.CompanyID,
		Role:       doc.Role,
		HiringRole: role,
		CreatedAt:  doc.CreatedAt,
	}
}

// validHiringRole is the company hiring role stored on a membership.
// Owner stays on the creator row and is not assigned here.
// viewer remains so legacy rows can be rewritten; invite/role-change rejects it.
func validHiringRole(role string) bool {
	switch role {
	case hiringAdmin, hiringRecruiter, hiringViewer, hiringManager, hiringInterviewer, hiringFinance:
		return true
	default:
		return false
	}
}

// MemberCompanyIDs lists every company a recruiter belongs to.
func (s *Store) MemberCompanyIDs(ctx context.Context) ([]string, error) {
	var ids []string
	err := s.collection(membersCollection).Distinct(ctx, "companyId", bson.D{{Key: "companyId", Value: bson.D{{Key: "$gt", Value: ""}}}}).Decode(&ids)
	// None comes back as "no documents".
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return ids, err
}
