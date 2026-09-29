package candidate

import (
	"context"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var applicationStages = map[string]struct{}{
	StageApplied:   {},
	StageScreening: {},
	StageInterview: {},
	StageOffer:     {},
	StageClosed:    {},
}

type ApplyInput struct {
	JobID        string `json:"jobId"`
	Title        string `json:"title"`
	Company      string `json:"company"`
	Location     string `json:"location"`
	Salary       string `json:"salary"`
	Source       string `json:"source"`
	Resume       string `json:"resume"`
	Stage        string `json:"columnId"`
	Note         string `json:"note"`
	ClosedReason string `json:"closedReason"`
}

func (s *Store) ListBoard(ctx context.Context, userID string) ([]Application, error) {
	apps, err := s.listApplications(ctx, userID)
	if err != nil {
		return nil, err
	}
	saved, err := s.listSaved(ctx, userID)
	if err != nil {
		return nil, err
	}
	return BoardItems(apps, saved), nil
}

func (s *Store) AppliedJobIDs(ctx context.Context, userID string) ([]string, error) {
	apps, err := s.listApplications(ctx, userID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(apps))
	for _, app := range apps {
		if app.JobID != "" {
			ids = append(ids, app.JobID)
		}
	}
	return ids, nil
}

func (s *Store) Apply(ctx context.Context, userID string, input ApplyInput, now time.Time) (Application, error) {
	app, err := buildApplication(userID, input, now)
	if err != nil {
		return Application{}, err
	}
	if input.JobID != "" {
		listing, err := s.listing(ctx, input.JobID)
		if err != nil {
			return Application{}, err
		}
		app.JobID = listing.ID
		app.CompanyID = listing.CompanyID
		app.Title = listing.Title
		app.Company = listing.Company
		app.Location = listing.Location
		app.Salary = listing.Salary
		app.Source = applicationSource(listing.Source)
		if app.Resume == "" {
			app.Resume = DefaultResume
		}
		if existing, err := s.applicationByJob(ctx, userID, listing.ID); err == nil {
			return existing, ErrAlreadyApplied
		} else if err != ErrNotFound {
			return Application{}, err
		}
	} else {
		app.Source = SourceScouted
		if app.JobID == "" {
			app.JobID = "ext-" + app.ID
		}
	}
	_, err = s.collection(applicationsCollection).InsertOne(ctx, app)
	if isDup(err) {
		existing, loadErr := s.applicationByJob(ctx, userID, app.JobID)
		if loadErr != nil {
			return Application{}, ErrAlreadyApplied
		}
		return existing, ErrAlreadyApplied
	}
	if err != nil {
		return Application{}, err
	}
	if app.Source == SourceDirect && app.CompanyID != "" {
		if err := s.ensureThread(ctx, app, now); err != nil {
			return Application{}, err
		}
	}
	return app, nil
}

func (s *Store) PatchApplication(ctx context.Context, userID, id string, patch ApplicationPatch, now time.Time) (Application, error) {
	app, err := s.applicationByID(ctx, userID, id)
	if err != nil {
		return Application{}, err
	}
	if patch.ColumnID != nil {
		stage := *patch.ColumnID
		if _, ok := applicationStages[stage]; !ok {
			return Application{}, ErrInvalidInput
		}
		if app.ColumnID != stage {
			app.ColumnID = stage
			app.Activity = prependEvent(app.Activity, "Moved to "+stage, now)
		}
		if stage == StageClosed {
			reason := strings.TrimSpace(patch.ClosedReason)
			if reason == "" {
				reason = "Withdrawn"
			}
			app.ClosedReason = reason
		} else {
			app.ClosedReason = ""
		}
	}
	if patch.NextStep != nil {
		app.NextStep = clip(*patch.NextStep, 120)
	}
	app.Updated = now.UTC()
	_, err = s.collection(applicationsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: app.ID}, {Key: "userId", Value: userID}}, app)
	if err != nil {
		return Application{}, err
	}
	return normalizeApplication(app), nil
}

type ApplicationPatch struct {
	ColumnID     *string `json:"columnId"`
	ClosedReason string  `json:"closedReason"`
	NextStep     *string `json:"nextStep"`
}

func (s *Store) RemoveApplication(ctx context.Context, userID, id string) error {
	result, err := s.collection(applicationsCollection).DeleteOne(ctx, bson.D{{Key: "id", Value: id}, {Key: "userId", Value: userID}})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) listApplications(ctx context.Context, userID string) ([]Application, error) {
	cursor, err := s.collection(applicationsCollection).Find(ctx, bson.D{{Key: "userId", Value: userID}}, options.Find().SetSort(bson.D{{Key: "updated", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	items := []Application{}
	if err := cursor.All(ctx, &items); err != nil {
		return nil, err
	}
	for i := range items {
		items[i] = normalizeApplication(items[i])
	}
	return items, nil
}

func (s *Store) applicationByID(ctx context.Context, userID, id string) (Application, error) {
	var app Application
	err := s.collection(applicationsCollection).FindOne(ctx, bson.D{{Key: "id", Value: id}, {Key: "userId", Value: userID}}).Decode(&app)
	if notFound(err) {
		return Application{}, ErrNotFound
	}
	if err != nil {
		return Application{}, err
	}
	return normalizeApplication(app), nil
}

func (s *Store) applicationByJob(ctx context.Context, userID, jobID string) (Application, error) {
	var app Application
	err := s.collection(applicationsCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}, {Key: "jobId", Value: jobID}}).Decode(&app)
	if notFound(err) {
		return Application{}, ErrNotFound
	}
	if err != nil {
		return Application{}, err
	}
	return normalizeApplication(app), nil
}

func (s *Store) setApplicationStage(ctx context.Context, userID, id, stage, event string, now time.Time) error {
	app, err := s.applicationByID(ctx, userID, id)
	if err != nil {
		return err
	}
	if app.ColumnID == StageOffer || app.ColumnID == StageClosed {
		if stage == StageInterview {
			return nil
		}
	}
	if app.ColumnID == stage {
		return nil
	}
	app.ColumnID = stage
	app.Updated = now.UTC()
	if event != "" {
		app.Activity = prependEvent(app.Activity, event, now)
	}
	if stage != StageClosed {
		app.ClosedReason = ""
	}
	_, err = s.collection(applicationsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: app.ID}}, app)
	return err
}

func buildApplication(userID string, input ApplyInput, now time.Time) (Application, error) {
	stage := input.Stage
	if stage == "" || stage == StageSaved {
		stage = StageApplied
	}
	if _, ok := applicationStages[stage]; !ok {
		return Application{}, ErrInvalidInput
	}
	title := clip(input.Title, 120)
	company := clip(input.Company, 80)
	if input.JobID == "" && (title == "" || company == "") {
		return Application{}, ErrInvalidInput
	}
	id, err := newPublicID()
	if err != nil {
		return Application{}, err
	}
	resume := clip(input.Resume, 40)
	if resume == "" {
		resume = DefaultResume
	}
	label := "Applied with " + resume + " resume"
	if input.JobID == "" {
		label = "Added to tracker"
	}
	app := Application{
		ID:        id,
		ColumnID:  stage,
		UserID:    userID,
		JobID:     strings.TrimSpace(input.JobID),
		Title:     title,
		Company:   company,
		Location:  clip(input.Location, 80),
		Salary:    clip(input.Salary, 40),
		Source:    applicationSource(input.Source),
		Resume:    resume,
		Match:     0,
		Updated:   now.UTC(),
		Activity:  []ApplicationEvent{{ID: id + "-applied", Label: label, Date: now.UTC()}},
	}
	if input.Note != "" {
		app.Activity = prependEvent(app.Activity, "Note sent with application", now)
	}
	if stage == StageClosed {
		app.ClosedReason = strings.TrimSpace(input.ClosedReason)
		if app.ClosedReason == "" {
			app.ClosedReason = "No response"
		}
	}
	return normalizeApplication(app), nil
}

func normalizeApplication(app Application) Application {
	if app.Activity == nil {
		app.Activity = []ApplicationEvent{}
	}
	return app
}

func prependEvent(events []ApplicationEvent, label string, now time.Time) []ApplicationEvent {
	id, err := newPublicID()
	if err != nil {
		id = now.UTC().Format(time.RFC3339Nano)
	}
	next := ApplicationEvent{ID: id, Label: label, Date: now.UTC()}
	return append([]ApplicationEvent{next}, events...)
}

func BoardItems(apps []Application, saved []SavedJob) []Application {
	applied := make(map[string]struct{}, len(apps))
	out := make([]Application, 0, len(apps)+len(saved))
	for _, app := range apps {
		if app.JobID != "" {
			applied[app.JobID] = struct{}{}
		}
		out = append(out, normalizeApplication(app))
	}
	for _, item := range saved {
		if _, ok := applied[item.JobID]; ok {
			continue
		}
		out = append(out, savedAsApplication(item))
	}
	return out
}

func savedAsApplication(item SavedJob) Application {
	return Application{
		ID:       "saved:" + item.JobID,
		ColumnID: StageSaved,
		JobID:    item.JobID,
		Title:    item.Title,
		Company:  item.Company,
		Location: item.Location,
		Salary:   item.Salary,
		Source:   item.Source,
		Resume:   DefaultResume,
		Match:    0,
		Updated:  item.SavedAt,
		NextStep: "Apply before the posting closes",
		Activity: []ApplicationEvent{{ID: item.ID + "-saved", Label: "Saved", Date: item.SavedAt}},
	}
}

func IsSavedBoardID(id string) (string, bool) {
	jobID, ok := strings.CutPrefix(id, "saved:")
	return jobID, ok && jobID != ""
}

func stageOnInterviewScheduled(current string) string {
	switch current {
	case StageOffer, StageClosed:
		return current
	default:
		return StageInterview
	}
}

func stageOnOutcome(outcome string) (stage, closedReason string) {
	switch outcome {
	case OutcomeAdvanced:
		return StageOffer, ""
	case OutcomeRejected:
		return StageClosed, "Rejected"
	default:
		return StageInterview, ""
	}
}

func openApplications(apps []Application) []Application {
	out := make([]Application, 0, len(apps))
	for _, app := range apps {
		if app.ColumnID == StageClosed || app.ColumnID == StageSaved {
			continue
		}
		out = append(out, app)
	}
	return out
}
