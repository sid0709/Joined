package employer

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"github.com/sid0709/OpenSeat/opened-backend/internal/candidate"
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

func (s *Store) MoveApplicant(ctx context.Context, companyID, id string, input StageInput, now time.Time) (Applicant, error) {
	column, reason, ok := candidateStage(input.ColumnID)
	if !ok {
		return Applicant{}, ErrInvalidInput
	}
	notes := input.Notes
	var notePtr *string
	if notes != "" {
		notePtr = &notes
	}
	app, err := s.people.SetCompanyStage(ctx, companyID, id, column, input.ColumnID, reason, notePtr, input.Rating, now)
	if errors.Is(err, candidate.ErrNotFound) {
		return Applicant{}, ErrNotFound
	}
	if errors.Is(err, candidate.ErrInvalidInput) {
		return Applicant{}, ErrInvalidInput
	}
	if err != nil {
		return Applicant{}, err
	}
	if err := s.record(ctx, companyID, app.Title, input.ColumnID, "accent", now); err != nil {
		return Applicant{}, err
	}
	people, err := s.presentApplicants(ctx, companyID, []candidate.Application{app})
	if err != nil || len(people) == 0 {
		return Applicant{}, err
	}
	return people[0], nil
}

func (s *Store) Interviews(ctx context.Context, companyID string) ([]Interview, error) {
	items, err := s.people.InterviewsForCompany(ctx, companyID)
	if err != nil {
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

func (s *Store) ScheduleInterview(ctx context.Context, company auth.Company, actor string, input ScheduleInput, now time.Time) (Interview, error) {
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
		Date:          input.Date,
		Start:         input.Start,
		End:           input.End,
		Format:        input.Format,
		Where:         input.Format,
		Interviewers:  panelNames(panel),
		Status:        candidate.StatusScheduled,
		Source:        candidate.SourceDirect,
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
	if err := s.record(ctx, company.ID, "Interview scheduled with "+candidateName, job.Title, "accent", now); err != nil {
		return Interview{}, err
	}
	return viewInterview(item, job.Title), nil
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
		ID:              app.ID,
		ColumnID:        companyStage(app.ColumnID, app.CompanyStage, app.ClosedReason),
		Name:            name,
		Headline:        profile.Headline,
		Location:        firstText(profile.Location, app.Location),
		JobID:           app.JobID,
		JobTitle:        jobTitle,
		Fit:             app.Match,
		Verified:        false,
		Assisted:        assistedFrom(app.Source),
		Resume:          app.Resume,
		AppliedOn:       applied,
		ExperienceYears: 0,
		LastCompany:     last,
		Skills:          skills,
		Rating:          app.Rating,
		Notes:           app.CompanyNotes,
	}
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
	return Interview{
		ID:           item.ID,
		ApplicantID:  item.ApplicationID,
		Candidate:    name,
		JobID:        item.JobID,
		JobTitle:     title,
		Round:        item.Round,
		Date:         item.Date,
		Start:        item.Start,
		End:          item.End,
		Format:       item.Format,
		Interviewers: names,
		Status:       status,
		FaceCheck:    face,
		ChargedCents: item.ChargedCents,
		Where:        item.Where,
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
