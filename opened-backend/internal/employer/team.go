package employer

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func (s *Store) Team(ctx context.Context, company auth.Company, userID string) (Team, error) {
	members, err := s.accounts.CompanyMembers(ctx, company.ID)
	if err != nil {
		return Team{}, err
	}
	ids := make([]string, 0, len(members))
	for _, member := range members {
		ids = append(ids, member.UserID)
	}
	users, err := s.accounts.Users(ctx, ids)
	if err != nil {
		return Team{}, err
	}
	out := make([]Member, 0, len(members))
	for _, member := range members {
		user := users[member.UserID]
		name := user.Name
		if name == "" {
			name = user.Email
		}
		out = append(out, Member{
			ID:         member.UserID,
			Name:       name,
			Email:      user.Email,
			Role:       member.HiringRole,
			LastActive: "Joined " + member.CreatedAt.UTC().Format("Jan 2, 2006"),
			IsYou:      member.UserID == userID,
		})
	}
	invites, err := s.invites(ctx, company.ID)
	if err != nil {
		return Team{}, err
	}
	for _, invite := range invites {
		out = append(out, Member{
			ID:         invite.ID,
			Name:       invite.Email,
			Email:      invite.Email,
			Role:       invite.Role,
			LastActive: "Invited " + invite.CreatedAt.UTC().Format("Jan 2"),
			IsPending:  true,
		})
	}
	return Team{Members: out, EmailDomain: emailDomain(company.URL)}, nil
}

func (s *Store) Invite(ctx context.Context, company auth.Company, actorID string, input InviteInput, now time.Time) (Team, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if !strings.Contains(email, "@") || !validTeamRole(input.Role) {
		return Team{}, ErrInvalidInput
	}
	domain := emailDomain(company.URL)
	if domain != "" && !strings.HasSuffix(email, "@"+domain) {
		return Team{}, ErrInvalidInput
	}
	user, err := s.accounts.UserByEmail(ctx, email)
	if err == nil {
		if user.Role != auth.RoleEmployee {
			return Team{}, ErrConflict
		}
		member, memberErr := s.accounts.MembershipOf(ctx, user.ID)
		if memberErr == nil {
			if member.CompanyID == company.ID {
				return Team{}, ErrConflict
			}
			return Team{}, ErrConflict
		}
		if !errors.Is(memberErr, auth.ErrNotFound) {
			return Team{}, memberErr
		}
		if err := s.accounts.AddMember(ctx, user.ID, company.ID, input.Role, now); err != nil {
			return Team{}, err
		}
		return s.Team(ctx, company, actorID)
	}
	if !errors.Is(err, auth.ErrNotFound) {
		return Team{}, err
	}
	id, err := newID()
	if err != nil {
		return Team{}, err
	}
	_, err = s.collection(invitesCollection).InsertOne(ctx, storedInvite{
		ID: id, CompanyID: company.ID, Email: email, Role: input.Role, CreatedAt: now.UTC(),
	})
	if mongo.IsDuplicateKeyError(err) {
		return Team{}, ErrConflict
	}
	if err != nil {
		return Team{}, err
	}
	return s.Team(ctx, company, actorID)
}

func (s *Store) SetRole(ctx context.Context, companyID, actorID, memberID, role string) error {
	if memberID == actorID || !validTeamRole(role) {
		return ErrInvalidInput
	}
	updated, err := s.collection(invitesCollection).UpdateOne(ctx, bson.D{{Key: "id", Value: memberID}, {Key: "companyId", Value: companyID}}, bson.D{{Key: "$set", Value: bson.D{{Key: "role", Value: role}}}})
	if err != nil {
		return err
	}
	if updated.MatchedCount > 0 {
		return nil
	}
	if err := s.accounts.SetHiringRole(ctx, companyID, memberID, role); err != nil {
		if errors.Is(err, auth.ErrInvalidInput) || errors.Is(err, auth.ErrNotFound) {
			return ErrInvalidInput
		}
		return err
	}
	return nil
}

func (s *Store) RemoveTeammate(ctx context.Context, companyID, actorID, memberID string) error {
	if memberID == actorID {
		return ErrInvalidInput
	}
	result, err := s.collection(invitesCollection).DeleteOne(ctx, bson.D{{Key: "id", Value: memberID}, {Key: "companyId", Value: companyID}})
	if err != nil {
		return err
	}
	if result.DeletedCount > 0 {
		return nil
	}
	if err := s.accounts.RemoveMember(ctx, companyID, memberID); err != nil {
		if errors.Is(err, auth.ErrInvalidInput) || errors.Is(err, auth.ErrNotFound) {
			return ErrInvalidInput
		}
		return err
	}
	return nil
}

func (s *Store) Transfer(ctx context.Context, companyID, fromUser, toUser string) error {
	if err := s.accounts.TransferOwner(ctx, companyID, fromUser, toUser); err != nil {
		if errors.Is(err, auth.ErrInvalidInput) || errors.Is(err, auth.ErrNotFound) {
			return ErrInvalidInput
		}
		return err
	}
	return nil
}

func (s *Store) invites(ctx context.Context, companyID string) ([]storedInvite, error) {
	cursor, err := s.collection(invitesCollection).Find(ctx, bson.D{{Key: "companyId", Value: companyID}})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	docs := []storedInvite{}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	return docs, nil
}

func validTeamRole(role string) bool {
	switch role {
	case "admin", "recruiter", "viewer":
		return true
	default:
		return false
	}
}

func emailDomain(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	host := strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
	if !strings.Contains(host, ".") {
		return ""
	}
	return host
}
