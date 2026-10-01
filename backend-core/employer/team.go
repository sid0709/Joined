package employer

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
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

func (s *Store) Invite(ctx context.Context, company auth.Company, actor Actor, input InviteInput, now time.Time) (Team, error) {
	role, err := NormalizeInviteRole(actor.Role, input.Role)
	if err != nil {
		return Team{}, err
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if !strings.Contains(email, "@") {
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
		if err := s.accounts.AddMember(ctx, user.ID, company.ID, role, now); err != nil {
			return Team{}, err
		}
		if err := s.auditMembership(ctx, company.ID, actor, AuditMemberInvited, user.ID, email, "Invited "+email+" as "+role, "", role, now); err != nil {
			return Team{}, err
		}
		return s.Team(ctx, company, actor.ID)
	}
	if !errors.Is(err, auth.ErrNotFound) {
		return Team{}, err
	}
	id, err := newID()
	if err != nil {
		return Team{}, err
	}
	_, err = s.collection(invitesCollection).InsertOne(ctx, storedInvite{
		ID: id, CompanyID: company.ID, Email: email, Role: role, CreatedAt: now.UTC(),
	})
	if mongo.IsDuplicateKeyError(err) {
		return Team{}, ErrConflict
	}
	if err != nil {
		return Team{}, err
	}
	if err := s.auditMembership(ctx, company.ID, actor, AuditMemberInvited, id, email, "Invited "+email+" as "+role, "", role, now); err != nil {
		return Team{}, err
	}
	return s.Team(ctx, company, actor.ID)
}

func (s *Store) SetRole(ctx context.Context, companyID string, actor Actor, memberID, role string, now time.Time) error {
	current, label, pending, err := s.lookupTeammate(ctx, companyID, memberID)
	if err != nil {
		return err
	}
	next, err := NormalizeMemberRole(actor.Role, current, memberID == actor.ID, role)
	if err != nil {
		return err
	}
	if next == current {
		return nil
	}
	if pending {
		updated, err := s.collection(invitesCollection).UpdateOne(ctx, bson.D{{Key: "id", Value: memberID}, {Key: "companyId", Value: companyID}}, bson.D{{Key: "$set", Value: bson.D{{Key: "role", Value: next}}}})
		if err != nil {
			return err
		}
		if updated.MatchedCount == 0 {
			return ErrInvalidInput
		}
	} else if err := s.accounts.SetHiringRole(ctx, companyID, memberID, next); err != nil {
		if errors.Is(err, auth.ErrInvalidInput) || errors.Is(err, auth.ErrNotFound) {
			return ErrInvalidInput
		}
		return err
	}
	return s.auditMembership(ctx, companyID, actor, AuditRoleChanged, memberID, label, "Changed role from "+current+" to "+next, current, next, now)
}

func (s *Store) RemoveTeammate(ctx context.Context, companyID string, actor Actor, memberID string, now time.Time) error {
	current, label, pending, err := s.lookupTeammate(ctx, companyID, memberID)
	if err != nil {
		return err
	}
	if err := AuthorizeRemove(actor.Role, current, memberID == actor.ID); err != nil {
		return err
	}
	if pending {
		result, err := s.collection(invitesCollection).DeleteOne(ctx, bson.D{{Key: "id", Value: memberID}, {Key: "companyId", Value: companyID}})
		if err != nil {
			return err
		}
		if result.DeletedCount == 0 {
			return ErrInvalidInput
		}
	} else if err := s.accounts.RemoveMember(ctx, companyID, memberID); err != nil {
		if errors.Is(err, auth.ErrInvalidInput) || errors.Is(err, auth.ErrNotFound) {
			return ErrInvalidInput
		}
		return err
	}
	return s.auditMembership(ctx, companyID, actor, AuditMemberRemoved, memberID, label, "Removed "+labelOr(label, memberID), current, "", now)
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

func (s *Store) lookupTeammate(ctx context.Context, companyID, memberID string) (role, label string, pending bool, err error) {
	var invite storedInvite
	err = s.collection(invitesCollection).FindOne(ctx, bson.D{{Key: "id", Value: memberID}, {Key: "companyId", Value: companyID}}).Decode(&invite)
	if err == nil {
		return invite.Role, invite.Email, true, nil
	}
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return "", "", false, err
	}
	member, err := s.accounts.MembershipOf(ctx, memberID)
	if errors.Is(err, auth.ErrNotFound) {
		return "", "", false, ErrInvalidInput
	}
	if err != nil {
		return "", "", false, err
	}
	if member.CompanyID != companyID {
		return "", "", false, ErrInvalidInput
	}
	users, err := s.accounts.Users(ctx, []string{memberID})
	if err != nil {
		return "", "", false, err
	}
	label = users[memberID].Email
	if label == "" {
		label = users[memberID].Name
	}
	return member.HiringRole, label, false, nil
}

func (s *Store) auditMembership(ctx context.Context, companyID string, actor Actor, action, subjectID, label, summary, beforeRole, afterRole string, now time.Time) error {
	event := AuditEvent{
		Action:       action,
		SubjectType:  subjectMember,
		SubjectID:    subjectID,
		SubjectLabel: label,
		Summary:      summary,
	}
	if beforeRole != "" {
		event.Before = map[string]any{"role": beforeRole}
	}
	if afterRole != "" {
		event.After = map[string]any{"role": afterRole}
	}
	return s.writeAudit(ctx, companyID, actor, event, now)
}

func labelOr(label, fallback string) string {
	if strings.TrimSpace(label) == "" {
		return fallback
	}
	return label
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
