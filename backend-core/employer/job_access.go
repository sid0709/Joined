package employer

import (
	"context"
	"errors"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	jobAccessCollection     = "company_job_access"
	maxJobAccessAssignments = 100
	maxMemberID             = 80
)

type storedJobAccess struct {
	CompanyID   string                `bson:"companyId"`
	JobID       string                `bson:"jobId"`
	Assignments []JobAccessAssignment `bson:"assignments"`
}

// Access loads every per-job override for the company.
func (s *Store) Access(ctx context.Context, companyID string) (AccessIndex, error) {
	cursor, err := s.collection(jobAccessCollection).Find(ctx, bson.D{{Key: "companyId", Value: companyID}})
	if err != nil {
		return AccessIndex{}, err
	}
	defer cursor.Close(ctx)
	docs := []storedJobAccess{}
	if err := cursor.All(ctx, &docs); err != nil {
		return AccessIndex{}, err
	}
	byJob := make(map[string][]JobAccessAssignment, len(docs))
	for _, doc := range docs {
		byJob[doc.JobID] = doc.Assignments
	}
	return NewAccessIndex(byJob), nil
}

// GetJobAccess returns overrides for one job. No document is an empty list.
func (s *Store) GetJobAccess(ctx context.Context, companyID string, actor Actor, jobID string) (JobAccessView, error) {
	if _, err := s.job(ctx, companyID, jobID); err != nil {
		return JobAccessView{}, err
	}
	idx, err := s.Access(ctx, companyID)
	if err != nil {
		return JobAccessView{}, err
	}
	if !idx.CanViewJobAccess(actor.ID, actor.Role, jobID) {
		return JobAccessView{}, Forbidden("Missing permission: " + PermJobsView)
	}
	assignments, err := s.jobAssignments(ctx, companyID, jobID)
	if err != nil {
		return JobAccessView{}, err
	}
	return JobAccessView{Assignments: assignmentsOrEmpty(assignments)}, nil
}

// SaveJobAccess replaces per-job overrides. jobs.edit or team.manage_roles is required.
func (s *Store) SaveJobAccess(ctx context.Context, companyID string, actor Actor, jobID string, raw []JobAccessAssignment, now time.Time) (JobAccessView, error) {
	if _, err := s.job(ctx, companyID, jobID); err != nil {
		return JobAccessView{}, err
	}
	idx, err := s.Access(ctx, companyID)
	if err != nil {
		return JobAccessView{}, err
	}
	if !idx.CanEditJobAccess(actor.ID, actor.Role, jobID) {
		return JobAccessView{}, Forbidden("Missing permission: " + PermJobsEdit)
	}
	next, err := NormalizeAssignments(raw)
	if err != nil {
		return JobAccessView{}, err
	}
	if err := s.knownAssignees(ctx, companyID, next); err != nil {
		return JobAccessView{}, err
	}
	previous, err := s.jobAssignments(ctx, companyID, jobID)
	if err != nil {
		return JobAccessView{}, err
	}
	_, err = s.collection(jobAccessCollection).UpdateOne(ctx,
		bson.D{{Key: "companyId", Value: companyID}, {Key: "jobId", Value: jobID}},
		bson.D{{Key: "$set", Value: storedJobAccess{CompanyID: companyID, JobID: jobID, Assignments: next}}},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		return JobAccessView{}, err
	}
	if err := s.writeAudit(ctx, companyID, actor, AuditEvent{
		Action:      AuditJobAccessUpdated,
		SubjectType: subjectJob,
		SubjectID:   jobID,
		Summary:     "Updated job access",
		Before:      map[string]any{"assignments": assignmentsOrEmpty(previous)},
		After:       map[string]any{"assignments": assignmentsOrEmpty(next)},
	}, now); err != nil {
		return JobAccessView{}, err
	}
	return JobAccessView{Assignments: assignmentsOrEmpty(next)}, nil
}

func (s *Store) jobAssignments(ctx context.Context, companyID, jobID string) ([]JobAccessAssignment, error) {
	var doc storedJobAccess
	err := s.collection(jobAccessCollection).FindOne(ctx, bson.D{{Key: "companyId", Value: companyID}, {Key: "jobId", Value: jobID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return doc.Assignments, nil
}

func (s *Store) knownAssignees(ctx context.Context, companyID string, assignments []JobAccessAssignment) error {
	if len(assignments) == 0 {
		return nil
	}
	known := map[string]struct{}{}
	members, err := s.accounts.CompanyMembers(ctx, companyID)
	if err != nil {
		return err
	}
	for _, member := range members {
		known[member.UserID] = struct{}{}
	}
	invites, err := s.invites(ctx, companyID)
	if err != nil {
		return err
	}
	for _, invite := range invites {
		known[invite.ID] = struct{}{}
	}
	for _, item := range assignments {
		if _, ok := known[item.MemberID]; !ok {
			return Invalid("assignee is not on this company")
		}
	}
	return nil
}

func assignmentsOrEmpty(items []JobAccessAssignment) []JobAccessAssignment {
	if items == nil {
		return []JobAccessAssignment{}
	}
	return items
}

// AuthorizeJob requires permission on one job. A missing job is 404.
func (s *Store) AuthorizeJob(ctx context.Context, companyID string, actor Actor, jobID, permission string) error {
	return s.AuthorizeJobAny(ctx, companyID, actor, jobID, permission)
}

// AuthorizeJobAny allows the action when any permission is effective on the job.
func (s *Store) AuthorizeJobAny(ctx context.Context, companyID string, actor Actor, jobID string, permissions ...string) error {
	if _, err := s.job(ctx, companyID, jobID); err != nil {
		return err
	}
	idx, err := s.Access(ctx, companyID)
	if err != nil {
		return err
	}
	if idx.AllowsAny(actor.ID, actor.Role, jobID, permissions...) {
		return nil
	}
	missing := PermJobsView
	if len(permissions) > 0 {
		missing = permissions[0]
	}
	return Forbidden("Missing permission: " + missing)
}

// AuthorizeJobUpdate requires jobs.edit, and jobs.publish when a closed-to-market job is opened.
func (s *Store) AuthorizeJobUpdate(ctx context.Context, companyID string, actor Actor, jobID, nextStatus string) error {
	doc, err := s.job(ctx, companyID, jobID)
	if err != nil {
		return err
	}
	idx, err := s.Access(ctx, companyID)
	if err != nil {
		return err
	}
	if !idx.Allows(actor.ID, actor.Role, jobID, PermJobsEdit) {
		return Forbidden("Missing permission: " + PermJobsEdit)
	}
	if nextStatus == statusOpen && doc.Status != statusOpen {
		if !idx.Allows(actor.ID, actor.Role, jobID, PermJobsPublish) {
			return Forbidden("Missing permission: " + PermJobsPublish)
		}
	}
	return nil
}

// AuthorizeApplicant requires every permission on the applicant's job.
func (s *Store) AuthorizeApplicant(ctx context.Context, companyID, applicantID string, actor Actor, permissions ...string) error {
	app, err := s.loadCompanyApplicant(ctx, companyID, applicantID)
	if err != nil {
		return err
	}
	return s.authorizeJobPermissions(ctx, companyID, actor, app.JobID, true, permissions...)
}

// AuthorizeApplicantAny allows the action when any permission is effective.
func (s *Store) AuthorizeApplicantAny(ctx context.Context, companyID, applicantID string, actor Actor, permissions ...string) error {
	app, err := s.loadCompanyApplicant(ctx, companyID, applicantID)
	if err != nil {
		return err
	}
	return s.authorizeJobPermissions(ctx, companyID, actor, app.JobID, false, permissions...)
}

// AuthorizeInterview requires every permission on the interview's job.
func (s *Store) AuthorizeInterview(ctx context.Context, companyID, interviewID string, actor Actor, permissions ...string) error {
	item, err := s.people.InterviewForCompany(ctx, companyID, interviewID)
	if err != nil {
		if errors.Is(err, candidate.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return s.authorizeJobPermissions(ctx, companyID, actor, item.JobID, true, permissions...)
}

func (s *Store) authorizeJobPermissions(ctx context.Context, companyID string, actor Actor, jobID string, all bool, permissions ...string) error {
	if len(permissions) == 0 {
		return nil
	}
	idx, err := s.Access(ctx, companyID)
	if err != nil {
		return err
	}
	if all {
		for _, permission := range permissions {
			if !idx.Allows(actor.ID, actor.Role, jobID, permission) {
				return Forbidden("Missing permission: " + permission)
			}
		}
		return nil
	}
	if idx.AllowsAny(actor.ID, actor.Role, jobID, permissions...) {
		return nil
	}
	return Forbidden("Missing permission: " + permissions[0])
}
