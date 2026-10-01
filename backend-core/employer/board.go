package employer

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func (s *Store) pipelines(ctx context.Context, companyID string) (map[string]Pipeline, error) {
	apps, err := s.people.ApplicationsForCompany(ctx, companyID)
	if err != nil {
		return nil, err
	}
	out := map[string]Pipeline{}
	for _, app := range apps {
		stage := companyStage(app.ColumnID, app.CompanyStage, app.ClosedReason)
		pipe := out[app.JobID]
		switch stage {
		case stageNew:
			pipe.New++
		case stageScreening:
			pipe.Screening++
		case stageInterview:
			pipe.Interview++
		case stageOffer:
			pipe.Offer++
		}
		out[app.JobID] = pipe
	}
	return out, nil
}

func (s *Store) Applicants(ctx context.Context, companyID string) ([]Applicant, error) {
	apps, err := s.people.ApplicationsForCompany(ctx, companyID)
	if err != nil {
		return nil, err
	}
	return s.presentApplicants(ctx, companyID, apps)
}

func (s *Store) MoveApplicant(ctx context.Context, companyID, id string, input StageInput, actor Actor, now time.Time) (Applicant, error) {
	app, err := s.people.ApplicationForCompany(ctx, companyID, id)
	if errors.Is(err, candidate.ErrNotFound) {
		return Applicant{}, ErrNotFound
	}
	if err != nil {
		return Applicant{}, err
	}
	doc, err := s.job(ctx, companyID, app.JobID)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return Applicant{}, err
	}
	if errors.Is(err, ErrNotFound) {
		doc = storedJob{}
	}
	hasSide := input.Tags != nil || input.InterviewerIDs != nil || input.Rating != nil || strings.TrimSpace(input.Notes) != "" || offerPatchPresent(input.Offer)
	column, reason, nextStage, ok := applicantPatch(input.ColumnID, stageSet(doc.CustomStages), hasSide)
	if !ok {
		return Applicant{}, ErrInvalidInput
	}
	if input.ColumnID != "" {
		from := companyStage(app.ColumnID, app.CompanyStage, app.ClosedReason)
		notes := app.CompanyNotes
		if strings.TrimSpace(input.Notes) != "" {
			notes = input.Notes
		}
		rating := app.Rating
		if input.Rating != nil {
			rating = *input.Rating
		}
		gate := gateOrEmpty(doc.FeedbackGate)
		hasCard := false
		if advanceNeedsScorecard(from, input.ColumnID, gate, doc.CustomStages) {
			hasCard, err = s.applicantHasScorecard(ctx, companyID, app.ID)
			if err != nil {
				return Applicant{}, err
			}
		}
		if err := feedbackGate(advanceCheck{
			from: from, to: input.ColumnID, notes: notes, rating: rating,
			hasScorecard: hasCard, gate: gate, custom: doc.CustomStages,
		}); err != nil {
			return Applicant{}, err
		}
		if nextStage != "" && !fixedCompanyStage(nextStage) && app.ColumnID == candidate.StageClosed {
			column = candidate.StageInterview
			reason = ""
		}
	}
	var tags *[]string
	if input.Tags != nil {
		normalized := normalizeTags(*input.Tags)
		tags = &normalized
	}
	var interviewerIDs *[]string
	if input.InterviewerIDs != nil {
		normalized := normalizeInterviewerIDs(*input.InterviewerIDs)
		interviewerIDs = &normalized
	}
	notes := input.Notes
	var notePtr *string
	if notes != "" {
		notePtr = &notes
	}
	fromColumn := companyStage(app.ColumnID, app.CompanyStage, app.ClosedReason)
	prevOfferStatus := ""
	if app.Offer != nil {
		prevOfferStatus = app.Offer.Status
	}
	offer, writeOffer, err := mergeApplicantOffer(app.Offer, input.Offer, input.ColumnID, fromColumn, doc.OfferTemplates, now)
	if err != nil {
		return Applicant{}, err
	}
	app, err = s.people.SetCompanyStage(ctx, companyID, id, column, nextStage, reason, notePtr, input.Rating, tags, interviewerIDs, offer, writeOffer, now)
	if errors.Is(err, candidate.ErrNotFound) {
		return Applicant{}, ErrNotFound
	}
	if errors.Is(err, candidate.ErrInvalidInput) {
		return Applicant{}, ErrInvalidInput
	}
	if err != nil {
		return Applicant{}, err
	}
	if input.ColumnID != "" {
		if err := s.record(ctx, companyID, app.Title, input.ColumnID, "accent", now); err != nil {
			return Applicant{}, err
		}
	}
	people, err := s.presentApplicants(ctx, companyID, []candidate.Application{app})
	if err != nil || len(people) == 0 {
		return Applicant{}, err
	}
	if err := s.auditApplicantChange(ctx, companyID, actor, people[0], fromColumn, input.ColumnID, prevOfferStatus, offer, writeOffer, now); err != nil {
		return Applicant{}, err
	}
	return people[0], nil
}

func (s *Store) auditApplicantChange(ctx context.Context, companyID string, actor Actor, person Applicant, fromColumn, toColumn, prevOfferStatus string, offer *candidate.OfferRecord, writeOffer bool, now time.Time) error {
	if toColumn != "" && toColumn != fromColumn {
		action := AuditStageMoved
		summary := "Moved applicant to " + toColumn
		if toColumn == stageHired {
			action = AuditHireMarked
			summary = "Marked hired"
		}
		if err := s.writeAudit(ctx, companyID, actor, AuditEvent{
			Action:       action,
			SubjectType:  subjectApplicant,
			SubjectID:    person.ID,
			SubjectLabel: person.Name,
			Summary:      summary,
			Before:       map[string]any{"columnId": fromColumn},
			After:        map[string]any{"columnId": toColumn},
		}, now); err != nil {
			return err
		}
	}
	if !writeOffer || offer == nil {
		return nil
	}
	action := offerAuditAction(offer.Status)
	if action == AuditHireMarked && toColumn == stageHired {
		return nil
	}
	summary := "Updated offer"
	switch action {
	case AuditOfferSent:
		summary = "Sent offer"
	case AuditOfferApproved:
		summary = "Approved offer"
	case AuditHireMarked:
		summary = "Marked hired"
	}
	before := map[string]any{}
	if prevOfferStatus != "" {
		before["status"] = prevOfferStatus
	}
	return s.writeAudit(ctx, companyID, actor, AuditEvent{
		Action:       action,
		SubjectType:  subjectOffer,
		SubjectID:    person.ID,
		SubjectLabel: person.Name,
		Summary:      summary,
		Before:       before,
		After:        map[string]any{"status": offer.Status},
	}, now)
}

func (s *Store) Interviews(ctx context.Context, companyID string) ([]Interview, error) {
	items, err := s.people.InterviewsForCompany(ctx, companyID)
	if err != nil {
		return nil, err
	}
	items, err = s.people.BackfillSelfScheduleSecrets(ctx, items, time.Now())
	if err != nil {
		if errors.Is(err, candidate.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	titles, err := s.jobTitles(ctx, companyID)
	if err != nil {
		return nil, err
	}
	out := make([]Interview, 0, len(items))
	for _, item := range items {
		out = append(out, viewInterview(item, titles[item.JobID]))
	}
	return out, nil
}

func (s *Store) ScheduleInterview(ctx context.Context, company auth.Company, actor string, input ScheduleInput, origin string, now time.Time) (Interview, error) {
	plan, err := planSchedule(input)
	if err != nil {
		return Interview{}, err
	}
	app, err := s.people.ApplicationForCompany(ctx, company.ID, input.ApplicationID)
	if errors.Is(err, candidate.ErrNotFound) {
		return Interview{}, ErrNotFound
	}
	if err != nil {
		return Interview{}, err
	}
	job, err := s.job(ctx, company.ID, app.JobID)
	if err != nil {
		return Interview{}, err
	}
	names, err := s.accounts.Users(ctx, []string{app.UserID})
	if err != nil {
		return Interview{}, err
	}
	candidateName := names[app.UserID].Name
	if candidateName == "" {
		candidateName = "Candidate"
	}
	if _, err := s.debit(ctx, company.ID, InterviewPriceCents, now); err != nil {
		return Interview{}, err
	}
	round := strings.TrimSpace(input.Round)
	if round == "" {
		round = "Round 1"
	}
	panel := input.Interviewers
	if len(panel) == 0 && actor != "" {
		panel = []string{actor}
	}
	item, err := s.people.ScheduleForCompany(ctx, company.ID, candidateName, app.JobID, InterviewPriceCents, app, candidate.InterviewInput{
		ApplicationID: app.ID,
		Round:         round,
		Date:          plan.Date,
		Start:         plan.Start,
		End:           plan.End,
		Format:        input.Format,
		Where:         plan.Where,
		Interviewers:  panelNames(panel),
		Status:        plan.CandidateStatus,
		Source:        candidate.SourceDirect,
		MeetingURL:    plan.MeetingURL,
		ScheduleMode:  plan.Mode,
		ProposedSlots: plan.ProposedSlots,
		SelfSchedule:  plan.SelfSchedule,
		CompanyStatus: plan.CompanyStatus,
		PublicOrigin:  origin,
		OpenSlot:      plan.OpenSlot,
	}, now)
	if err != nil {
		_, _ = s.credit(ctx, company.ID, InterviewPriceCents, 0, -InterviewPriceCents, now)
		if errors.Is(err, candidate.ErrDuplicate) {
			return Interview{}, ErrConflict
		}
		if errors.Is(err, candidate.ErrInvalidInput) {
			return Interview{}, ErrInvalidInput
		}
		return Interview{}, err
	}
	wallet, err := s.wallet(ctx, company.ID)
	if err != nil {
		return Interview{}, err
	}
	if err := s.appendLedger(ctx, storedLedger{
		CompanyID:    company.ID,
		Kind:         ledgerInterview,
		AmountCents:  -InterviewPriceCents,
		BalanceAfter: wallet.BalanceCents,
		Candidate:    candidateName,
		JobID:        job.ID,
		JobTitle:     job.Title,
		InterviewID:  item.ID,
		Note:         "Scheduled",
		CreatedAt:    now.UTC(),
	}); err != nil {
		return Interview{}, err
	}
	activity := "Interview scheduled with " + candidateName
	if plan.CompanyStatus == interviewAwaiting {
		if plan.SelfSchedule {
			activity = "Self-schedule link sent to " + candidateName
		} else {
			activity = "Times offered to " + candidateName
		}
	}
	if err := s.record(ctx, company.ID, activity, job.Title, "accent", now); err != nil {
		return Interview{}, err
	}
	return viewInterview(item, job.Title), nil
}

func (s *Store) PatchInterview(ctx context.Context, companyID, id string, input InterviewUpdate, now time.Time) (Interview, error) {
	current, err := s.people.InterviewForCompany(ctx, companyID, id)
	if err != nil {
		if errors.Is(err, candidate.ErrNotFound) {
			return Interview{}, ErrNotFound
		}
		return Interview{}, err
	}
	next, attendance, _, err := applyInterviewUpdate(current, input)
	if err != nil {
		return Interview{}, err
	}
	if attendance == "" || input.Where != nil || input.MeetingURL != nil || input.ProposedSlots != nil || input.Date != nil {
		saved, err := s.people.SaveInterviewForCompany(ctx, companyID, next)
		if err != nil {
			if errors.Is(err, candidate.ErrNotFound) {
				return Interview{}, ErrNotFound
			}
			if errors.Is(err, candidate.ErrForbidden) {
				return Interview{}, ErrForbidden
			}
			return Interview{}, err
		}
		current = saved
	}
	if attendance != "" {
		return s.SetAttendance(ctx, companyID, id, attendance, now)
	}
	current, err = s.people.BackfillSelfScheduleSecretsOne(ctx, current, now)
	if err != nil {
		if errors.Is(err, candidate.ErrNotFound) {
			return Interview{}, ErrNotFound
		}
		return Interview{}, err
	}
	titles, err := s.jobTitles(ctx, companyID)
	if err != nil {
		return Interview{}, err
	}
	return viewInterview(current, titles[current.JobID]), nil
}

func (s *Store) SetAttendance(ctx context.Context, companyID, id, status string, now time.Time) (Interview, error) {
	items, err := s.people.InterviewsForCompany(ctx, companyID)
	if err != nil {
		return Interview{}, err
	}
	var current candidate.Interview
	found := false
	for _, item := range items {
		if item.ID == id {
			current = item
			found = true
			break
		}
	}
	if !found {
		return Interview{}, ErrNotFound
	}
	titles, err := s.jobTitles(ctx, companyID)
	if err != nil {
		return Interview{}, err
	}
	title := titles[current.JobID]
	switch status {
	case "attended":
		current, err = s.people.SetInterviewStatus(ctx, companyID, id, "attended", candidate.StatusCompleted, current.ChargedCents, now)
	case "no-show":
		if current.ChargedCents > 0 {
			if err := s.returnInterview(ctx, companyID, current.CandidateName, current.JobID, title, current.ID, current.ChargedCents, now); err != nil {
				return Interview{}, err
			}
		}
		current, err = s.people.SetInterviewStatus(ctx, companyID, id, "no-show", candidate.StatusCancelled, 0, now)
	default:
		return Interview{}, ErrInvalidInput
	}
	if err != nil {
		return Interview{}, err
	}
	tone := "success"
	label := "Attended"
	if status == "no-show" {
		tone = "warning"
		label = "No-show"
	}
	if err := s.record(ctx, companyID, label+": "+current.CandidateName, title, tone, now); err != nil {
		return Interview{}, err
	}
	return viewInterview(current, title), nil
}

func (s *Store) Overview(ctx context.Context, companyID string) (Overview, error) {
	jobs, err := s.ListJobs(ctx, companyID)
	if err != nil {
		return Overview{}, err
	}
	applicants, err := s.Applicants(ctx, companyID)
	if err != nil {
		return Overview{}, err
	}
	interviews, err := s.Interviews(ctx, companyID)
	if err != nil {
		return Overview{}, err
	}
	activity, err := s.recentActivity(ctx, companyID)
	if err != nil {
		return Overview{}, err
	}
	billing, err := s.Billing(ctx, companyID)
	if err != nil {
		return Overview{}, err
	}
	return Overview{
		Jobs: jobs, Applicants: applicants, Interviews: interviews, Activity: activity, Billing: billing,
		Counts: countWorkspace(jobs, applicants),
	}, nil
}

func (s *Store) Count(ctx context.Context, companyID string) (Counts, error) {
	jobs, err := s.ListJobs(ctx, companyID)
	if err != nil {
		return Counts{}, err
	}
	applicants, err := s.Applicants(ctx, companyID)
	if err != nil {
		return Counts{}, err
	}
	return countWorkspace(jobs, applicants), nil
}

func (s *Store) presentApplicants(ctx context.Context, companyID string, apps []candidate.Application) ([]Applicant, error) {
	if len(apps) == 0 {
		return []Applicant{}, nil
	}
	ids := make([]string, 0, len(apps))
	for _, app := range apps {
		ids = append(ids, app.UserID)
	}
	users, err := s.accounts.Users(ctx, ids)
	if err != nil {
		return nil, err
	}
	profiles, err := s.people.ProfilesByUser(ctx, ids)
	if err != nil {
		return nil, err
	}
	titles, err := s.jobTitles(ctx, companyID)
	if err != nil {
		return nil, err
	}
	out := make([]Applicant, 0, len(apps))
	for _, app := range apps {
		out = append(out, viewApplicant(app, users[app.UserID], profiles[app.UserID], titles[app.JobID]))
	}
	return out, nil
}

func (s *Store) jobTitles(ctx context.Context, companyID string) (map[string]string, error) {
	docs, err := s.jobsFor(ctx, companyID)
	if err != nil {
		return nil, err
	}
	out := make(map[string]string, len(docs))
	for _, doc := range docs {
		out[doc.ID] = doc.Title
	}
	return out, nil
}

func (s *Store) recentActivity(ctx context.Context, companyID string) ([]Activity, error) {
	cursor, err := s.collection(activityCollection).Find(ctx, bson.D{{Key: "companyId", Value: companyID}}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(activityLimit))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	docs := []storedActivity{}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]Activity, 0, len(docs))
	for _, doc := range docs {
		out = append(out, Activity{ID: doc.ID, Title: doc.Title, Description: doc.Description, Tone: doc.Tone, CreatedAt: doc.CreatedAt})
	}
	return out, nil
}

func viewApplicant(app candidate.Application, user auth.User, profile candidate.Profile, jobTitle string) Applicant {
	name := user.Name
	if name == "" {
		name = "Candidate"
	}
	skills := profile.Skills
	if skills == nil {
		skills = []string{}
	}
	last := ""
	for _, item := range profile.Experience {
		if item.Current || last == "" {
			last = item.Company
		}
		if item.Current {
			break
		}
	}
	applied := app.Updated
	if len(app.Activity) > 0 {
		applied = app.Activity[len(app.Activity)-1].Date
	}
	if jobTitle == "" {
		jobTitle = app.Title
	}
	return Applicant{
		ID:               app.ID,
		ColumnID:         companyStage(app.ColumnID, app.CompanyStage, app.ClosedReason),
		Name:             name,
		Headline:         profile.Headline,
		Location:         firstText(profile.Location, app.Location),
		JobID:            app.JobID,
		JobTitle:         jobTitle,
		Fit:              app.Match,
		Verified:         false,
		Assisted:         assistedFrom(app.Source),
		Resume:           app.Resume,
		AppliedOn:        applied,
		ExperienceYears:  0,
		LastCompany:      last,
		Skills:           skills,
		Rating:           app.Rating,
		Notes:            app.CompanyNotes,
		Tags:             listOrEmpty(app.Tags),
		InterviewerIDs:   app.InterviewerIDs,
		UserID:           app.UserID,
		ScreeningAnswers: answersOrEmpty(app.ScreeningAnswers),
		ReferralSource:   app.ReferralSource,
		ConsentAt:        app.ConsentAt,
		ConsentVersion:   app.ConsentVersion,
		Offer:            presentOffer(app.Offer),
		StageEnteredAt:   app.StageEnteredAt,
		StageHistory:     stageHistoryOrNil(app.StageHistory),
	}
}

func stageHistoryOrNil(items []candidate.StageVisit) []candidate.StageVisit {
	if len(items) == 0 {
		return nil
	}
	return append([]candidate.StageVisit(nil), items...)
}

func answersOrEmpty(items []candidate.ScreeningAnswer) []candidate.ScreeningAnswer {
	if items == nil {
		return []candidate.ScreeningAnswer{}
	}
	return items
}

func viewInterview(item candidate.Interview, jobTitle string) Interview {
	names := make([]string, 0, len(item.Interviewers))
	for _, person := range item.Interviewers {
		if person.Name != "" {
			names = append(names, person.Name)
		}
	}
	status := item.CompanyStatus
	if status == "" {
		status = "scheduled"
	}
	face := "pending"
	title := jobTitle
	if title == "" {
		title = item.Role
	}
	name := item.CandidateName
	if name == "" {
		name = "Candidate"
	}
	slots := item.ProposedSlots
	if len(slots) == 0 {
		slots = nil
	}
	selfURL := ""
	var expires *time.Time
	if status == interviewAwaiting {
		selfURL = strings.TrimSpace(item.SelfScheduleURL)
		if !item.SelfScheduleExpiresAt.IsZero() {
			when := item.SelfScheduleExpiresAt.UTC()
			expires = &when
		}
	}
	return Interview{
		ID:                    item.ID,
		ApplicantID:           item.ApplicationID,
		Candidate:             name,
		JobID:                 item.JobID,
		JobTitle:              title,
		Round:                 item.Round,
		Date:                  item.Date,
		Start:                 item.Start,
		End:                   item.End,
		Format:                item.Format,
		Interviewers:          names,
		Status:                status,
		FaceCheck:             face,
		ChargedCents:          item.ChargedCents,
		Where:                 presentedWhere(item),
		MeetingURL:            strings.TrimSpace(item.MeetingURL),
		Mode:                  item.ScheduleMode,
		SelfScheduleURL:       selfURL,
		SelfScheduleExpiresAt: expires,
		ProposedSlots:         slots,
	}
}

func panelNames(names []string) []candidate.Interviewer {
	out := make([]candidate.Interviewer, 0, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name != "" {
			out = append(out, candidate.Interviewer{Name: name})
		}
	}
	return out
}

func countWorkspace(jobs []Job, applicants []Applicant) Counts {
	counts := Counts{}
	for _, job := range jobs {
		if job.Status == statusOpen {
			counts.OpenJobs++
		}
	}
	for _, person := range applicants {
		if person.ColumnID == stageNew {
			counts.NewApplicants++
		}
	}
	return counts
}

func firstText(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
