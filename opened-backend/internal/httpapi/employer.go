package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"github.com/sid0709/OpenSeat/opened-backend/internal/employer"
	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
)

const parseJobTimeout = 90 * time.Second

func (s *Server) registerEmployer(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/company/overview", s.getCompanyOverview)
	mux.HandleFunc("GET /v1/company/analytics", s.getCompanyAnalytics)
	mux.HandleFunc("GET /v1/company/counts", s.getCompanyCounts)
	mux.HandleFunc("GET /v1/company/jobs", s.getCompanyJobs)
	mux.HandleFunc("POST /v1/company/jobs", s.postCompanyJob)
	mux.HandleFunc("POST /v1/company/jobs/parse", s.parseCompanyJob)
	mux.HandleFunc("GET /v1/company/jobs/{id}", s.getCompanyJob)
	mux.HandleFunc("PUT /v1/company/jobs/{id}", s.putCompanyJob)
	mux.HandleFunc("PATCH /v1/company/jobs/{id}", s.patchCompanyJob)
	mux.HandleFunc("GET /v1/company/jobs/{id}/pipeline", s.getCompanyPipeline)
	mux.HandleFunc("PUT /v1/company/jobs/{id}/pipeline", s.putCompanyPipeline)
	mux.HandleFunc("GET /v1/company/jobs/{id}/access", s.getJobAccess)
	mux.HandleFunc("PUT /v1/company/jobs/{id}/access", s.putJobAccess)
	mux.HandleFunc("GET /v1/company/applicants", s.getCompanyApplicants)
	mux.HandleFunc("PATCH /v1/company/applicants/{id}", s.patchCompanyApplicant)
	mux.HandleFunc("POST /v1/company/applicants/{id}/offer/approvals", s.postOfferApproval)
	mux.HandleFunc("PATCH /v1/company/applicants/{id}/offer/approvals/{approvalId}", s.patchOfferApproval)
	mux.HandleFunc("POST /v1/company/applicants/{id}/offer/esign", s.postOfferEsign)
	mux.HandleFunc("POST /v1/company/applicants/{id}/hire-packet", s.postHirePacket)
	mux.HandleFunc("GET /v1/company/applicants/{id}/scorecards", s.getApplicantScorecards)
	mux.HandleFunc("POST /v1/company/applicants/{id}/scorecards", s.postApplicantScorecard)
	mux.HandleFunc("GET /v1/company/interviews", s.getCompanyInterviews)
	mux.HandleFunc("POST /v1/company/interviews", s.postCompanyInterview)
	mux.HandleFunc("PATCH /v1/company/interviews/{id}", s.patchCompanyInterview)
	mux.HandleFunc("GET /v1/company/billing", s.getCompanyBilling)
	mux.HandleFunc("POST /v1/company/billing/purchase", s.postCompanyPurchase)
	mux.HandleFunc("GET /v1/company/team", s.getCompanyTeam)
	mux.HandleFunc("GET /v1/company/team/audit", s.getCompanyAudit)
	mux.HandleFunc("POST /v1/company/team", s.postCompanyTeam)
	mux.HandleFunc("PATCH /v1/company/team/{id}", s.patchCompanyTeam)
	mux.HandleFunc("DELETE /v1/company/team/{id}", s.deleteCompanyTeam)
	mux.HandleFunc("POST /v1/company/team/transfer", s.postCompanyTransfer)
	mux.HandleFunc("GET /v1/company/settings", s.getCompanySettings)
	mux.HandleFunc("PUT /v1/company/settings", s.putCompanySettings)
	mux.HandleFunc("GET /v1/company/job-teams", s.getCompanyJobTeams)
	mux.HandleFunc("PUT /v1/company/job-teams", s.putCompanyJobTeams)
	mux.HandleFunc("GET /v1/company/job-templates", s.getCompanyJobTemplates)
	mux.HandleFunc("PUT /v1/company/job-templates", s.putCompanyJobTemplates)
	mux.HandleFunc("GET /v1/company/departments", s.getCompanyDepartments)
	mux.HandleFunc("PUT /v1/company/departments", s.putCompanyDepartments)
	mux.HandleFunc("GET /v1/company/office-locations", s.getCompanyOfficeLocations)
	mux.HandleFunc("PUT /v1/company/office-locations", s.putCompanyOfficeLocations)
	mux.HandleFunc("GET /v1/company/page", s.getCompanyPage)
	mux.HandleFunc("PUT /v1/company/page", s.putCompanyPage)
	mux.HandleFunc("POST /v1/company/page/logo", s.postCompanyPageLogo)
	mux.HandleFunc("DELETE /v1/company/page/logo", s.deleteCompanyPageLogo)
	mux.HandleFunc("GET /v1/company/profile", s.getHiringProfile)
	mux.HandleFunc("PUT /v1/company/profile", s.putHiringProfile)
}

func (s *Server) company(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	if s.hiring == nil {
		writeError(w, http.StatusServiceUnavailable, "hiring workspace is unavailable")
		return auth.Session{}, false
	}
	return s.requireCompany(w, r)
}

func (s *Server) hiringActor(w http.ResponseWriter, r *http.Request) (auth.Session, employer.Actor, bool) {
	session, ok := s.company(w, r)
	if !ok {
		return auth.Session{}, employer.Actor{}, false
	}
	return session, employer.Actor{
		ID:   session.User.ID,
		Name: session.User.Name,
		Role: employer.ActorRole(*session.Company),
	}, true
}

func (s *Server) requirePerm(w http.ResponseWriter, actor employer.Actor, permission string) bool {
	return writeEmployer(w, employer.AuthorizeCompany(actor.Role, permission))
}

// companyCreator is the person who owns the company page. Linked recruiters run hiring only.
func (s *Server) companyCreator(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	session, ok := s.company(w, r)
	if !ok {
		return auth.Session{}, false
	}
	if !writeEmployer(w, employer.RequireCreator(*session.Company)) {
		return auth.Session{}, false
	}
	return session, true
}

func (s *Server) getCompanyOverview(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	overview, err := s.hiring.Overview(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	idx, err := s.hiring.Access(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	overview.Jobs = idx.FilterJobs(actor.ID, actor.Role, overview.Jobs)
	overview.Applicants = idx.FilterApplicants(actor.ID, actor.Role, overview.Applicants)
	overview.Interviews = idx.FilterInterviews(actor.ID, actor.Role, overview.Interviews)
	if !employer.Can(actor.Role, employer.PermBillingView) {
		overview.Billing = employer.EmptyBilling()
	}
	writeJSON(w, http.StatusOK, overview)
}

func (s *Server) getCompanyCounts(w http.ResponseWriter, r *http.Request) {
	session, ok := s.company(w, r)
	if !ok {
		return
	}
	counts, err := s.hiring.Count(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, counts)
}

func (s *Server) getCompanyJobs(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	idx, err := s.hiring.Access(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	if !idx.CompanyOrGrant(actor.ID, actor.Role, employer.PermJobsView) {
		writeEmployer(w, employer.Forbidden("Missing permission: "+employer.PermJobsView))
		return
	}
	items, err := s.hiring.ListJobs(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobs": idx.FilterJobs(actor.ID, actor.Role, items)})
}

func (s *Server) postCompanyJob(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	var input employer.JobInput
	if !decodeBody(w, r, &input) {
		return
	}
	for _, permission := range employer.JobCreatePermissions(input.Status) {
		if !s.requirePerm(w, actor, permission) {
			return
		}
	}
	job, err := s.hiring.CreateJob(r.Context(), *session.Company, session.User.ID, input, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, job)
}

func (s *Server) getCompanyJob(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if err := s.hiring.AuthorizeJob(r.Context(), session.Company.ID, actor, r.PathValue("id"), employer.PermJobsView); !writeEmployer(w, err) {
		return
	}
	job, err := s.hiring.GetJob(r.Context(), session.Company.ID, r.PathValue("id"))
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) putCompanyJob(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	var input employer.JobInput
	if !decodeBody(w, r, &input) {
		return
	}
	if err := s.hiring.AuthorizeJobUpdate(r.Context(), session.Company.ID, actor, r.PathValue("id"), input.Status); !writeEmployer(w, err) {
		return
	}
	job, err := s.hiring.UpdateJob(r.Context(), *session.Company, session.User.ID, r.PathValue("id"), input, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) parseCompanyJob(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermJobsEdit) {
		return
	}
	var input struct {
		Description string `json:"description"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), parseJobTimeout)
	defer cancel()
	draft, err := jobs.ParsePostedJob(ctx, s.reader, session.Company.Name, input.Description)
	if jobs.IsMissingAPIKey(err) {
		writeError(w, http.StatusServiceUnavailable, "Set OPENAI_API_KEY in the API environment")
		return
	}
	if errors.Is(err, jobs.ErrInvalidInput) {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		slog.Error("parse company job", "error", err)
		writeError(w, http.StatusBadGateway, "could not read that job description")
		return
	}
	writeJSON(w, http.StatusOK, draft)
}

func (s *Server) getCompanyPipeline(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if err := s.hiring.AuthorizeJob(r.Context(), session.Company.ID, actor, r.PathValue("id"), employer.PermJobsView); !writeEmployer(w, err) {
		return
	}
	cfg, err := s.hiring.GetPipeline(r.Context(), session.Company.ID, r.PathValue("id"))
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (s *Server) putCompanyPipeline(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if err := s.hiring.AuthorizeJob(r.Context(), session.Company.ID, actor, r.PathValue("id"), employer.PermJobsEdit); !writeEmployer(w, err) {
		return
	}
	var input employer.PipelinePut
	if !decodeBody(w, r, &input) {
		return
	}
	cfg, err := s.hiring.SavePipeline(r.Context(), session.Company.ID, r.PathValue("id"), input, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (s *Server) patchCompanyJob(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	// Close and reopen change whether the role is on the market, so this stays jobs.publish.
	if err := s.hiring.AuthorizeJob(r.Context(), session.Company.ID, actor, r.PathValue("id"), employer.PermJobsPublish); !writeEmployer(w, err) {
		return
	}
	var input employer.JobStatusPatch
	if !decodeBody(w, r, &input) {
		return
	}
	job, err := s.hiring.SetJobStatus(r.Context(), *session.Company, session.User.ID, r.PathValue("id"), input, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) getCompanyApplicants(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	idx, err := s.hiring.Access(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	if !idx.CompanyOrGrant(actor.ID, actor.Role, employer.PermApplicantsView) {
		writeEmployer(w, employer.Forbidden("Missing permission: "+employer.PermApplicantsView))
		return
	}
	items, err := s.hiring.Applicants(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"applicants": idx.FilterApplicants(actor.ID, actor.Role, items)})
}

func (s *Server) patchCompanyApplicant(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	var input employer.StageInput
	if !decodeBody(w, r, &input) {
		return
	}
	permissions, err := employer.MutationPermissions(input)
	if !writeEmployer(w, err) {
		return
	}
	if err := s.hiring.AuthorizeApplicant(r.Context(), session.Company.ID, r.PathValue("id"), actor, permissions...); !writeEmployer(w, err) {
		return
	}
	person, err := s.hiring.MoveApplicant(r.Context(), session.Company.ID, r.PathValue("id"), input, actor, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, person)
}

func (s *Server) postOfferApproval(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if err := s.hiring.AuthorizeApplicant(r.Context(), session.Company.ID, r.PathValue("id"), actor, employer.PermOffersDraft); !writeEmployer(w, err) {
		return
	}
	var input employer.ApprovalRequest
	if !decodeBody(w, r, &input) {
		return
	}
	item, err := s.hiring.RequestOfferApproval(r.Context(), session.Company.ID, r.PathValue("id"), input, actor, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) patchOfferApproval(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if err := s.hiring.AuthorizeApplicant(r.Context(), session.Company.ID, r.PathValue("id"), actor, employer.PermOffersApprove); !writeEmployer(w, err) {
		return
	}
	var input employer.ApprovalDecision
	if !decodeBody(w, r, &input) {
		return
	}
	item, err := s.hiring.DecideOfferApproval(r.Context(), session.Company.ID, r.PathValue("id"), r.PathValue("approvalId"), input, actor, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) postOfferEsign(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if err := s.hiring.AuthorizeApplicant(r.Context(), session.Company.ID, r.PathValue("id"), actor, employer.PermOffersSend); !writeEmployer(w, err) {
		return
	}
	var input employer.EsignInput
	if !decodeBody(w, r, &input) {
		return
	}
	item, err := s.hiring.CreateOfferEsign(r.Context(), session.Company.ID, r.PathValue("id"), s.frontend, input, actor, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) postHirePacket(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if err := s.hiring.AuthorizeApplicant(r.Context(), session.Company.ID, r.PathValue("id"), actor, employer.PermOffersHire); !writeEmployer(w, err) {
		return
	}
	var input employer.HirePacketInput
	if !decodeBody(w, r, &input) {
		return
	}
	item, err := s.hiring.CreateHirePacket(r.Context(), session.Company.ID, r.PathValue("id"), input, actor, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) getApplicantScorecards(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if err := s.hiring.AuthorizeApplicantAny(r.Context(), session.Company.ID, r.PathValue("id"), actor, employer.PermApplicantsView, employer.PermInterviewsScore); !writeEmployer(w, err) {
		return
	}
	items, err := s.hiring.ListScorecards(r.Context(), session.Company.ID, r.PathValue("id"))
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) postApplicantScorecard(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if err := s.hiring.AuthorizeApplicant(r.Context(), session.Company.ID, r.PathValue("id"), actor, employer.PermInterviewsScore); !writeEmployer(w, err) {
		return
	}
	var input employer.ScorecardInput
	if !decodeBody(w, r, &input) {
		return
	}
	item, err := s.hiring.AddScorecard(r.Context(), session.Company.ID, r.PathValue("id"), session.User.ID, input, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) getCompanyInterviews(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	idx, err := s.hiring.Access(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	if !idx.CompanyOrGrantAny(actor.ID, actor.Role, employer.PermInterviewsSchedule, employer.PermInterviewsScore) {
		writeEmployer(w, employer.Forbidden("Missing permission: "+employer.PermInterviewsSchedule))
		return
	}
	items, err := s.hiring.Interviews(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"interviews": idx.FilterInterviews(actor.ID, actor.Role, items)})
}

func (s *Server) postCompanyInterview(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	var input employer.ScheduleInput
	if !decodeBody(w, r, &input) {
		return
	}
	if input.ApplicationID == "" {
		if !s.requirePerm(w, actor, employer.PermInterviewsSchedule) {
			return
		}
	} else if err := s.hiring.AuthorizeApplicant(r.Context(), session.Company.ID, input.ApplicationID, actor, employer.PermInterviewsSchedule); !writeEmployer(w, err) {
		return
	}
	item, err := s.hiring.ScheduleInterview(r.Context(), *session.Company, session.User.Name, input, s.frontend, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) patchCompanyInterview(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if err := s.hiring.AuthorizeInterview(r.Context(), session.Company.ID, r.PathValue("id"), actor, employer.PermInterviewsSchedule); !writeEmployer(w, err) {
		return
	}
	var input employer.InterviewUpdate
	if !decodeBody(w, r, &input) {
		return
	}
	item, err := s.hiring.PatchInterview(r.Context(), session.Company.ID, r.PathValue("id"), input, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) getCompanyBilling(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermBillingView) {
		return
	}
	billing, err := s.hiring.Billing(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, billing)
}

func (s *Server) postCompanyPurchase(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermBillingPurchase) {
		return
	}
	var input employer.PurchaseInput
	if !decodeBody(w, r, &input) {
		return
	}
	billing, err := s.hiring.Purchase(r.Context(), session.Company.ID, input.AmountCents, actor, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, billing)
}

func (s *Server) getCompanyTeam(w http.ResponseWriter, r *http.Request) {
	session, _, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	team, err := s.hiring.Team(r.Context(), *session.Company, session.User.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, team)
}

func (s *Server) postCompanyTeam(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	var input employer.InviteInput
	if !decodeBody(w, r, &input) {
		return
	}
	team, err := s.hiring.Invite(r.Context(), *session.Company, actor, input, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, team)
}

func (s *Server) patchCompanyTeam(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	var input employer.RoleInput
	if !decodeBody(w, r, &input) {
		return
	}
	err := s.hiring.SetRole(r.Context(), session.Company.ID, actor, r.PathValue("id"), input.Role, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) deleteCompanyTeam(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	err := s.hiring.RemoveTeammate(r.Context(), session.Company.ID, actor, r.PathValue("id"), time.Now())
	if !writeEmployer(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) postCompanyTransfer(w http.ResponseWriter, r *http.Request) {
	session, ok := s.companyCreator(w, r)
	if !ok {
		return
	}
	var input employer.TransferInput
	if !decodeBody(w, r, &input) {
		return
	}
	err := s.hiring.Transfer(r.Context(), session.Company.ID, session.User.ID, input.UserID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) getCompanySettings(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermTeamManageRoles) {
		return
	}
	settings, err := s.hiring.Settings(r.Context(), *session.Company)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (s *Server) putCompanySettings(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermTeamManageRoles) {
		return
	}
	var input employer.Settings
	if !decodeBody(w, r, &input) {
		return
	}
	settings, err := s.hiring.SaveSettings(r.Context(), *session.Company, input)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (s *Server) getCompanyJobTeams(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermJobsView) {
		return
	}
	teams, err := s.hiring.JobTeams(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, teams)
}

func (s *Server) putCompanyJobTeams(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermJobsEdit) {
		return
	}
	var input employer.JobTeamsWrite
	if !decodeBody(w, r, &input) {
		return
	}
	teams, err := s.hiring.SaveJobTeams(r.Context(), session.Company.ID, input)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, teams)
}

func (s *Server) getCompanyJobTemplates(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermJobsView) {
		return
	}
	templates, err := s.hiring.JobTemplates(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, templates)
}

func (s *Server) putCompanyJobTemplates(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermJobsEdit) {
		return
	}
	var input employer.JobTemplatesWrite
	if !decodeBody(w, r, &input) {
		return
	}
	templates, err := s.hiring.SaveJobTemplates(r.Context(), session.Company.ID, input, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, templates)
}

func (s *Server) getCompanyDepartments(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermJobsView) {
		return
	}
	departments, err := s.hiring.Departments(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, departments)
}

func (s *Server) putCompanyDepartments(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermJobsEdit) {
		return
	}
	var input employer.DepartmentsWrite
	if !decodeBody(w, r, &input) {
		return
	}
	departments, err := s.hiring.SaveDepartments(r.Context(), session.Company.ID, input)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, departments)
}

func (s *Server) getCompanyOfficeLocations(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermJobsView) {
		return
	}
	locations, err := s.hiring.OfficeLocations(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, locations)
}

func (s *Server) putCompanyOfficeLocations(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermJobsEdit) {
		return
	}
	var input employer.OfficeLocationsWrite
	if !decodeBody(w, r, &input) {
		return
	}
	locations, err := s.hiring.SaveOfficeLocations(r.Context(), session.Company.ID, input)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, locations)
}

func (s *Server) getCompanyPage(w http.ResponseWriter, r *http.Request) {
	session, ok := s.company(w, r)
	if !ok {
		return
	}
	page, err := s.hiring.Page(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) putCompanyPage(w http.ResponseWriter, r *http.Request) {
	session, ok := s.companyCreator(w, r)
	if !ok {
		return
	}
	var input jobs.CompanyWrite
	if !decodeBody(w, r, &input) {
		return
	}
	page, err := s.hiring.SavePage(r.Context(), session.Company.ID, input)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) postCompanyPageLogo(w http.ResponseWriter, r *http.Request) {
	session, ok := s.companyCreator(w, r)
	if !ok {
		return
	}
	data, contentType, ok := readLogoUpload(w, r)
	if !ok {
		return
	}
	page, err := s.hiring.SaveLogo(r.Context(), session.Company.ID, contentType, data)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) deleteCompanyPageLogo(w http.ResponseWriter, r *http.Request) {
	session, ok := s.companyCreator(w, r)
	if !ok {
		return
	}
	page, err := s.hiring.ClearLogo(r.Context(), session.Company.ID)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) getJobAccess(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	view, err := s.hiring.GetJobAccess(r.Context(), session.Company.ID, actor, r.PathValue("id"))
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (s *Server) putJobAccess(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	var input employer.JobAccessView
	if !decodeBody(w, r, &input) {
		return
	}
	view, err := s.hiring.SaveJobAccess(r.Context(), session.Company.ID, actor, r.PathValue("id"), input.Assignments, time.Now())
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (s *Server) getCompanyAudit(w http.ResponseWriter, r *http.Request) {
	session, actor, ok := s.hiringActor(w, r)
	if !ok {
		return
	}
	if !s.requirePerm(w, actor, employer.PermAuditView) {
		return
	}
	limit, err := employer.ParseAuditLimit(r.URL.Query().Get("limit"))
	if !writeEmployer(w, err) {
		return
	}
	page, err := s.hiring.ListAudit(r.Context(), session.Company.ID, r.URL.Query().Get("cursor"), limit)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) getHiringProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := s.company(w, r)
	if !ok {
		return
	}
	profile, err := s.hiring.HiringProfile(r.Context(), session.User)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (s *Server) putHiringProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := s.company(w, r)
	if !ok {
		return
	}
	var input employer.HiringProfile
	if !decodeBody(w, r, &input) {
		return
	}
	profile, err := s.hiring.SaveHiringProfile(r.Context(), session.User, input)
	if !writeEmployer(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func writeEmployer(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return true
	case errors.Is(err, employer.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, employer.ErrInvalidInput), errors.Is(err, auth.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, employer.ErrInsufficient):
		writeError(w, http.StatusPaymentRequired, err.Error())
	case errors.Is(err, employer.ErrForbidden):
		writeError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, employer.ErrConflict), errors.Is(err, auth.ErrHasCompany):
		writeError(w, http.StatusConflict, err.Error())
	default:
		slog.Error("company", "error", err)
		writeError(w, http.StatusInternalServerError, "could not complete the request")
	}
	return false
}
