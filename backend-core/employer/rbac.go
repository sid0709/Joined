package employer

import (
	"strings"

	"github.com/sid0709/OpenSeat/joined-backend/internal/auth"
	"github.com/sid0709/OpenSeat/joined-backend/internal/candidate"
)

// Company hiring RBAC matches joined-frontend/lib/rbac.ts.
// Frontend gates are soft. These checks are what mutations enforce.

const (
	RoleOwner         = "owner"
	RoleAdmin         = "admin"
	RoleRecruiter     = "recruiter"
	RoleHiringManager = "hiring_manager"
	RoleInterviewer   = "interviewer"
	RoleFinance       = "finance"
	RoleViewer        = "viewer"

	PermJobsView           = "jobs.view"
	PermJobsEdit           = "jobs.edit"
	PermJobsPublish        = "jobs.publish"
	PermApplicantsView     = "applicants.view"
	PermApplicantsMove     = "applicants.move"
	PermInterviewsSchedule = "interviews.schedule"
	PermInterviewsScore    = "interviews.score"
	PermOffersDraft        = "offers.draft"
	PermOffersSend         = "offers.send"
	PermOffersApprove      = "offers.approve"
	PermOffersHire         = "offers.hire"
	PermBillingView        = "billing.view"
	PermBillingPurchase    = "billing.purchase"
	PermTeamInvite         = "team.invite"
	PermTeamManageRoles    = "team.manage_roles"
	PermAuditView          = "audit.view"
	PermAnalyticsView      = "analytics.view"
)

// Actor is the signed-in company member performing a hiring action.
type Actor struct {
	ID   string
	Name string
	Role string
}

// ActorRole is the hiring role used for permission checks.
// The company creator is owner even when an older row left hiringRole blank.
func ActorRole(company auth.Company) string {
	if company.IsCreator {
		return RoleOwner
	}
	switch company.HiringRole {
	case RoleOwner, RoleAdmin, RoleRecruiter, RoleHiringManager, RoleInterviewer, RoleFinance, RoleViewer:
		return company.HiringRole
	}
	if company.Role == RoleOwner {
		return RoleOwner
	}
	return RoleRecruiter
}

// effectiveRole collapses legacy viewer onto interviewer, matching effectiveTeamRole.
func effectiveRole(role string) string {
	if role == RoleViewer {
		return RoleInterviewer
	}
	return role
}

var rolePermissions = map[string][]string{
	RoleOwner: {
		PermJobsView, PermJobsEdit, PermJobsPublish,
		PermApplicantsView, PermApplicantsMove,
		PermInterviewsSchedule, PermInterviewsScore,
		PermOffersDraft, PermOffersSend, PermOffersApprove, PermOffersHire,
		PermBillingView, PermBillingPurchase,
		PermTeamInvite, PermTeamManageRoles, PermAuditView,
		PermAnalyticsView,
	},
	RoleAdmin: {
		PermJobsView, PermJobsEdit, PermJobsPublish,
		PermApplicantsView, PermApplicantsMove,
		PermInterviewsSchedule, PermInterviewsScore,
		PermOffersDraft, PermOffersSend, PermOffersApprove, PermOffersHire,
		PermBillingView,
		PermTeamInvite, PermTeamManageRoles, PermAuditView,
		PermAnalyticsView,
	},
	RoleRecruiter: {
		PermJobsView, PermJobsEdit, PermJobsPublish,
		PermApplicantsView, PermApplicantsMove,
		PermInterviewsSchedule, PermInterviewsScore,
		PermOffersDraft, PermOffersSend, PermOffersHire,
		PermAnalyticsView,
	},
	RoleHiringManager: {
		PermJobsView, PermJobsEdit,
		PermApplicantsView, PermApplicantsMove,
		PermInterviewsSchedule, PermInterviewsScore,
		PermOffersDraft, PermOffersApprove,
		PermAnalyticsView,
	},
	RoleInterviewer: {PermJobsView, PermApplicantsView, PermInterviewsScore},
	RoleFinance: {
		PermJobsView,
		PermBillingView, PermBillingPurchase,
		PermOffersApprove,
		PermAuditView,
		PermAnalyticsView,
	},
}

var knownPermissions = func() map[string]struct{} {
	out := map[string]struct{}{}
	for _, perms := range rolePermissions {
		for _, perm := range perms {
			out[perm] = struct{}{}
		}
	}
	return out
}()

// Can reports whether a company role grants permission.
// An unknown role grants nothing. Viewer uses the interviewer set.
func Can(role, permission string) bool {
	perms, ok := rolePermissions[effectiveRole(role)]
	if !ok {
		return false
	}
	return containsPerm(perms, permission)
}

// AuthorizeCompany rejects a company-level action the role cannot perform.
func AuthorizeCompany(role, permission string) error {
	if Can(role, permission) {
		return nil
	}
	return Forbidden("Missing permission: " + permission)
}

// KnownPermission reports whether permission is one the matrix defines.
func KnownPermission(permission string) bool {
	_, ok := knownPermissions[permission]
	return ok
}

// CanonicalRole maps API strings onto a team role. Unknown values are not a role.
func CanonicalRole(raw string) (string, bool) {
	value := strings.ToLower(strings.TrimSpace(raw))
	switch value {
	case "hm", "hiring-manager", "hiring_manager":
		return RoleHiringManager, true
	case RoleOwner, RoleAdmin, RoleRecruiter, RoleInterviewer, RoleFinance, RoleViewer:
		return value, true
	default:
		return "", false
	}
}

// NormalizeInviteRole accepts an invitible role for this actor.
// Owner and viewer are 400. Missing team.invite, and a non-owner granting admin, are 403.
func NormalizeInviteRole(actorRole, raw string) (string, error) {
	if !Can(actorRole, PermTeamInvite) {
		return "", Forbidden("Your role cannot invite teammates.")
	}
	role, ok := CanonicalRole(raw)
	if !ok {
		return "", Invalid("That role cannot be invited.")
	}
	if role == RoleOwner {
		return "", Invalid("Owner is transferred, not invited.")
	}
	if role == RoleViewer {
		return "", Invalid("Viewer is legacy — invite as Interviewer instead.")
	}
	if role == RoleAdmin && actorRole != RoleOwner {
		return "", Forbidden("Only the owner can invite admins.")
	}
	return role, nil
}

// NormalizeMemberRole accepts the next role for a teammate who is not the actor.
func NormalizeMemberRole(actorRole, targetRole string, targetIsSelf bool, raw string) (string, error) {
	if !Can(actorRole, PermTeamManageRoles) {
		return "", Forbidden("Your role cannot change teammate roles.")
	}
	if targetIsSelf || targetRole == RoleOwner {
		return "", Forbidden("Owner role stays on the creator.")
	}
	role, ok := CanonicalRole(raw)
	if !ok {
		return "", Invalid("That role cannot be invited.")
	}
	if role == RoleOwner {
		return "", Invalid("Use ownership transfer instead.")
	}
	if role == RoleViewer {
		return "", Invalid("Viewer is legacy — invite as Interviewer instead.")
	}
	if role == RoleAdmin && actorRole != RoleOwner {
		return "", Forbidden("Only the owner can grant admin.")
	}
	if targetRole == RoleAdmin && actorRole != RoleOwner {
		return "", Forbidden("Only the owner can change an admin.")
	}
	return role, nil
}

// AuthorizeRemove rejects deleting the owner, an admin (unless the actor is owner), or a caller without team.manage_roles.
func AuthorizeRemove(actorRole, targetRole string, targetIsSelf bool) error {
	if !Can(actorRole, PermTeamManageRoles) {
		return Forbidden("Your role cannot change teammate roles.")
	}
	if targetIsSelf {
		return Invalid("You cannot remove yourself.")
	}
	if targetRole == RoleOwner {
		return Forbidden("Owner role stays on the creator.")
	}
	if targetRole == RoleAdmin && actorRole != RoleOwner {
		return Forbidden("Only the owner can change an admin.")
	}
	return nil
}

// JobAccessAssignment is one member's per-job override.
// Empty permissions means inherit the company role.
type JobAccessAssignment struct {
	MemberID    string   `json:"memberId" bson:"memberId"`
	Permissions []string `json:"permissions,omitempty" bson:"permissions,omitempty"`
	RoleHint    string   `json:"roleHint,omitempty" bson:"roleHint,omitempty"`
}

// JobAccessView is GET/PUT /v1/company/jobs/:id/access.
type JobAccessView struct {
	Assignments []JobAccessAssignment `json:"assignments"`
}

// AccessIndex is the company's per-job overrides, keyed by job id.
type AccessIndex struct {
	byJob map[string][]JobAccessAssignment
}

// NewAccessIndex builds an index from stored assignments.
func NewAccessIndex(byJob map[string][]JobAccessAssignment) AccessIndex {
	if byJob == nil {
		byJob = map[string][]JobAccessAssignment{}
	}
	return AccessIndex{byJob: byJob}
}

func (idx AccessIndex) assignment(userID, jobID string) *JobAccessAssignment {
	for i := range idx.byJob[jobID] {
		if idx.byJob[jobID][i].MemberID == userID {
			return &idx.byJob[jobID][i]
		}
	}
	return nil
}

// EffectivePermissions merges a company role with an optional per-job override.
// A non-empty override replaces the role set. An empty one inherits.
func EffectivePermissions(role string, assignment *JobAccessAssignment) []string {
	if assignment != nil && len(assignment.Permissions) > 0 {
		out := make([]string, 0, len(assignment.Permissions))
		for _, perm := range assignment.Permissions {
			if KnownPermission(perm) {
				out = append(out, perm)
			}
		}
		// A non-empty override replaces the role, even when every entry was unknown.
		return out
	}
	perms := rolePermissions[effectiveRole(role)]
	return append([]string(nil), perms...)
}

// Allows reports the effective permission for one job.
func (idx AccessIndex) Allows(userID, role, jobID, permission string) bool {
	return containsPerm(EffectivePermissions(role, idx.assignment(userID, jobID)), permission)
}

// AllowsAny is true when any permission is effective on the job.
func (idx AccessIndex) AllowsAny(userID, role, jobID string, permissions ...string) bool {
	for _, permission := range permissions {
		if idx.Allows(userID, role, jobID, permission) {
			return true
		}
	}
	return false
}

// CompanyOrGrant is true when the role grants permission, or any job override does.
func (idx AccessIndex) CompanyOrGrant(userID, role, permission string) bool {
	if Can(role, permission) {
		return true
	}
	for jobID := range idx.byJob {
		if idx.Allows(userID, role, jobID, permission) {
			return true
		}
	}
	return false
}

// CompanyOrGrantAny is true when any permission is granted at company or job scope.
func (idx AccessIndex) CompanyOrGrantAny(userID, role string, permissions ...string) bool {
	for _, permission := range permissions {
		if idx.CompanyOrGrant(userID, role, permission) {
			return true
		}
	}
	return false
}

// CanViewJobAccess is company jobs.edit / team.manage_roles, or effective jobs.view.
// Company editors stay able to read the document after a tighter override.
func (idx AccessIndex) CanViewJobAccess(userID, role, jobID string) bool {
	if Can(role, PermJobsEdit) || Can(role, PermTeamManageRoles) {
		return true
	}
	return idx.Allows(userID, role, jobID, PermJobsView)
}

// CanEditJobAccess is company jobs.edit or team.manage_roles, or the same grant on the job.
// A tighter override does not lock the company role out of repairing access.
func (idx AccessIndex) CanEditJobAccess(userID, role, jobID string) bool {
	if Can(role, PermJobsEdit) || Can(role, PermTeamManageRoles) {
		return true
	}
	return idx.Allows(userID, role, jobID, PermJobsEdit) || idx.Allows(userID, role, jobID, PermTeamManageRoles)
}

func (idx AccessIndex) FilterJobs(userID, role string, jobs []Job) []Job {
	out := make([]Job, 0, len(jobs))
	for _, job := range jobs {
		if idx.Allows(userID, role, job.ID, PermJobsView) {
			out = append(out, job)
		}
	}
	return out
}

func (idx AccessIndex) FilterApplicants(userID, role string, items []Applicant) []Applicant {
	out := make([]Applicant, 0, len(items))
	for _, item := range items {
		if idx.Allows(userID, role, item.JobID, PermApplicantsView) {
			out = append(out, item)
		}
	}
	return out
}

func (idx AccessIndex) FilterInterviews(userID, role string, items []Interview) []Interview {
	out := make([]Interview, 0, len(items))
	for _, item := range items {
		if idx.AllowsAny(userID, role, item.JobID, PermInterviewsSchedule, PermInterviewsScore) {
			out = append(out, item)
		}
	}
	return out
}

// MutationPermissions is the set a PATCH /applicants/:id must hold, in stable order.
func MutationPermissions(input StageInput) ([]string, error) {
	var perms []string
	seen := map[string]struct{}{}
	add := func(permission string) {
		if _, ok := seen[permission]; ok {
			return
		}
		seen[permission] = struct{}{}
		perms = append(perms, permission)
	}
	if input.ColumnID != "" {
		if input.ColumnID == stageHired {
			add(PermOffersHire)
		} else {
			add(PermApplicantsMove)
		}
	}
	if input.Tags != nil || input.InterviewerIDs != nil || input.Rating != nil || strings.TrimSpace(input.Notes) != "" {
		add(PermApplicantsMove)
	}
	wire, hasWire, err := decodeOfferPatch(input.Offer)
	if err != nil {
		return nil, err
	}
	if !hasWire {
		return perms, nil
	}
	if wire.Status != nil {
		status, err := parseOfferStatus(wire.Status)
		if err != nil {
			return nil, err
		}
		switch status {
		case candidate.OfferSent:
			add(PermOffersSend)
		case candidate.OfferAccepted:
			add(PermOffersHire)
		case candidate.OfferApproved:
			add(PermOffersApprove)
		default:
			add(PermOffersDraft)
		}
	}
	if wire.Comp != nil || wire.Notes != nil || wire.TemplateID != nil || wire.ExpiresAt != nil {
		add(PermOffersDraft)
	} else if wire.Status == nil && (wire.SentAt != nil || wire.RespondedAt != nil) {
		add(PermOffersDraft)
	}
	return perms, nil
}

// JobCreatePermissions covers drafting a job, plus publish when it is created open.
func JobCreatePermissions(status string) []string {
	perms := []string{PermJobsEdit}
	if status == statusOpen {
		perms = append(perms, PermJobsPublish)
	}
	return perms
}

func containsPerm(perms []string, permission string) bool {
	for _, item := range perms {
		if item == permission {
			return true
		}
	}
	return false
}

// NormalizeAssignments validates a PUT body. An empty list clears overrides.
func NormalizeAssignments(raw []JobAccessAssignment) ([]JobAccessAssignment, error) {
	if raw == nil {
		return nil, Invalid("assignments are required")
	}
	if len(raw) > maxJobAccessAssignments {
		return nil, Invalid("too many job access assignments")
	}
	seen := map[string]struct{}{}
	out := make([]JobAccessAssignment, 0, len(raw))
	for _, item := range raw {
		memberID := strings.TrimSpace(item.MemberID)
		if memberID == "" || len(memberID) > maxMemberID {
			return nil, Invalid("each assignment needs a member")
		}
		if _, ok := seen[memberID]; ok {
			return nil, Invalid("a member can only be assigned once")
		}
		seen[memberID] = struct{}{}
		var perms []string
		if len(item.Permissions) > 0 {
			perms = make([]string, 0, len(item.Permissions))
			for _, permission := range item.Permissions {
				permission = strings.TrimSpace(permission)
				if !KnownPermission(permission) {
					return nil, Invalid("unknown permission")
				}
				if containsPerm(perms, permission) {
					continue
				}
				perms = append(perms, permission)
			}
		}
		hint := ""
		if strings.TrimSpace(item.RoleHint) != "" {
			role, ok := CanonicalRole(item.RoleHint)
			if !ok {
				return nil, Invalid("unknown role hint")
			}
			hint = role
		}
		out = append(out, JobAccessAssignment{MemberID: memberID, Permissions: perms, RoleHint: hint})
	}
	return out, nil
}

// offerAuditAction maps a stored offer status onto an audit action.
func offerAuditAction(status string) string {
	switch status {
	case candidate.OfferSent:
		return AuditOfferSent
	case candidate.OfferAccepted:
		return AuditHireMarked
	case candidate.OfferApproved:
		return AuditOfferApproved
	default:
		return AuditOfferUpdated
	}
}

// EmptyBilling is the overview balance shown to roles without billing.view.
func EmptyBilling() Billing {
	return Billing{Events: []BillingEvent{}, Purchases: []Purchase{}}
}
