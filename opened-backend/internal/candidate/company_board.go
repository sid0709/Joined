package candidate

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// InterviewsForCompany lists rounds this company scheduled.
func (s *Store) InterviewsForCompany(ctx context.Context, companyID string) ([]Interview, error) {
	return s.listInterviews(ctx, bson.D{{Key: "companyId", Value: companyID}})
}

// ApplicationsForCompany lists every application to this company's jobs.
func (s *Store) ApplicationsForCompany(ctx context.Context, companyID string) ([]Application, error) {
	cursor, err := s.collection(applicationsCollection).Find(ctx, bson.D{{Key: "companyId", Value: companyID}}, options.Find().SetSort(bson.D{{Key: "updated", Value: -1}}))
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

// ApplicationForCompany loads one application that belongs to the company.
func (s *Store) ApplicationForCompany(ctx context.Context, companyID, id string) (Application, error) {
	var app Application
	err := s.collection(applicationsCollection).FindOne(ctx, bson.D{
		{Key: "id", Value: id},
		{Key: "companyId", Value: companyID},
	}).Decode(&app)
	if notFound(err) {
		return Application{}, ErrNotFound
	}
	if err != nil {
		return Application{}, err
	}
	return normalizeApplication(app), nil
}

// SetCompanyStage records the hiring stage and mirrors it onto the candidate board.
// writeOffer replaces the employer offer. A false writeOffer leaves the stored offer in place.
func (s *Store) SetCompanyStage(ctx context.Context, companyID, id, columnID, companyStage, closedReason string, notes *string, rating *int, tags *[]string, interviewerIDs *[]string, offer *OfferRecord, writeOffer bool, now time.Time) (Application, error) {
	app, err := s.ApplicationForCompany(ctx, companyID, id)
	if err != nil {
		return Application{}, err
	}
	prevStage := CompanyBoardStage(app.ColumnID, app.CompanyStage, app.ClosedReason)
	columnChanged := columnID != "" && app.ColumnID != columnID
	stageChanged := companyStage != "" && app.CompanyStage != companyStage
	if columnChanged {
		app.ColumnID = columnID
	}
	if companyStage != "" {
		app.CompanyStage = companyStage
	}
	if columnChanged || stageChanged {
		label := companyStage
		if label == "" {
			label = columnID
		}
		app.Activity = prependEvent(app.Activity, "Moved to "+label, now)
	}
	if columnID != "" {
		app.ClosedReason = closedReason
	}
	if notes != nil {
		app.CompanyNotes = clip(*notes, 2000)
	}
	if rating != nil {
		if *rating < 0 || *rating > 5 {
			return Application{}, ErrInvalidInput
		}
		app.Rating = *rating
	}
	if tags != nil {
		app.Tags = *tags
	}
	if interviewerIDs != nil {
		app.InterviewerIDs = *interviewerIDs
	}
	if writeOffer {
		app.Offer = offer
	}
	recordStageEntry(&app, prevStage, CompanyBoardStage(app.ColumnID, app.CompanyStage, app.ClosedReason), now)
	app.Updated = now.UTC()
	_, err = s.collection(applicationsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: app.ID}, {Key: "companyId", Value: companyID}}, app)
	if err != nil {
		return Application{}, err
	}
	return app, nil
}

// SetApplicationOffer stores the employer offer without moving the candidate's stage.
func (s *Store) SetApplicationOffer(ctx context.Context, companyID, id string, offer *OfferRecord, now time.Time) (Application, error) {
	if offer == nil || offer.Status == "" {
		return Application{}, ErrInvalidInput
	}
	app, err := s.ApplicationForCompany(ctx, companyID, id)
	if err != nil {
		return Application{}, err
	}
	app.Offer = offer
	app.Updated = now.UTC()
	_, err = s.collection(applicationsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: app.ID}, {Key: "companyId", Value: companyID}}, app)
	if err != nil {
		return Application{}, err
	}
	return app, nil
}

// ScheduleForCompany creates the candidate's interview and tags it as a company round.
func (s *Store) ScheduleForCompany(ctx context.Context, companyID, candidateName, jobID string, chargedCents int, app Application, input InterviewInput, now time.Time) (Interview, error) {
	if app.CompanyID != companyID {
		return Interview{}, ErrForbidden
	}
	existing, err := s.interviewRound(ctx, companyID, app.ID, input.Round)
	if err == nil {
		return existing, ErrDuplicate
	}
	if err != ErrNotFound {
		return Interview{}, err
	}
	item, err := buildInterview(app.UserID, app, input, now)
	if err != nil {
		return Interview{}, err
	}
	item.CompanyID = companyID
	item.CompanyStatus = StatusScheduled
	if input.CompanyStatus != "" {
		item.CompanyStatus = input.CompanyStatus
	}
	if item.SelfSchedule {
		if err := applySelfScheduleSecret(&item, input.PublicOrigin, now); err != nil {
			return Interview{}, err
		}
	}
	item.JobID = jobID
	item.CandidateName = candidateName
	item.ChargedCents = chargedCents
	if _, err := s.collection(interviewsCollection).InsertOne(ctx, item); err != nil {
		return Interview{}, err
	}
	event := "Interview scheduled"
	if item.CompanyStatus == CompanyStatusAwaiting {
		event = "Interview times offered"
	}
	if err := s.forceStage(ctx, app, "interview", event, now); err != nil {
		return Interview{}, err
	}
	return item, nil
}

// SetInterviewStatus updates attendance for a round this company owns.
func (s *Store) SetInterviewStatus(ctx context.Context, companyID, id, companyStatus, candidateStatus string, chargedCents int, now time.Time) (Interview, error) {
	item, err := s.interviewForCompany(ctx, companyID, id)
	if err != nil {
		return Interview{}, err
	}
	item.CompanyStatus = companyStatus
	item.Status = candidateStatus
	item.ChargedCents = chargedCents
	_, err = s.collection(interviewsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: id}, {Key: "companyId", Value: companyID}}, item)
	if err != nil {
		return Interview{}, err
	}
	_ = now
	return item, nil
}

// ProfilesByUser returns stored profiles for the given accounts.
func (s *Store) ProfilesByUser(ctx context.Context, userIDs []string) (map[string]Profile, error) {
	out := map[string]Profile{}
	if len(userIDs) == 0 {
		return out, nil
	}
	cursor, err := s.collection(profilesCollection).Find(ctx, bson.D{{Key: "userId", Value: bson.D{{Key: "$in", Value: userIDs}}}})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	for cursor.Next(ctx) {
		var stored storedProfile
		if err := cursor.Decode(&stored); err != nil {
			return nil, err
		}
		out[stored.UserID] = viewProfile(stored, "", "", time.Time{})
	}
	return out, cursor.Err()
}

func (s *Store) listInterviews(ctx context.Context, filter bson.D) ([]Interview, error) {
	cursor, err := s.collection(interviewsCollection).Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "date", Value: 1}, {Key: "start", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	items := []Interview{}
	if err := cursor.All(ctx, &items); err != nil {
		return nil, err
	}
	for i := range items {
		items[i] = normalizeInterview(items[i])
	}
	return items, nil
}

// InterviewForCompany loads one round this company owns.
func (s *Store) InterviewForCompany(ctx context.Context, companyID, id string) (Interview, error) {
	return s.interviewForCompany(ctx, companyID, id)
}

// SaveInterviewForCompany replaces a round this company owns.
func (s *Store) SaveInterviewForCompany(ctx context.Context, companyID string, item Interview) (Interview, error) {
	if item.ID == "" || item.CompanyID != companyID {
		return Interview{}, ErrForbidden
	}
	item = normalizeInterview(item)
	result, err := s.collection(interviewsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: item.ID}, {Key: "companyId", Value: companyID}}, item)
	if err != nil {
		return Interview{}, err
	}
	if result.MatchedCount == 0 {
		return Interview{}, ErrNotFound
	}
	return item, nil
}

func (s *Store) interviewForCompany(ctx context.Context, companyID, id string) (Interview, error) {
	var item Interview
	err := s.collection(interviewsCollection).FindOne(ctx, bson.D{{Key: "id", Value: id}, {Key: "companyId", Value: companyID}}).Decode(&item)
	if notFound(err) {
		return Interview{}, ErrNotFound
	}
	if err != nil {
		return Interview{}, err
	}
	return normalizeInterview(item), nil
}

func (s *Store) interviewRound(ctx context.Context, companyID, applicationID, round string) (Interview, error) {
	var item Interview
	err := s.collection(interviewsCollection).FindOne(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "applicationId", Value: applicationID},
		{Key: "round", Value: round},
		{Key: "companyStatus", Value: bson.D{{Key: "$ne", Value: "no-show"}}},
	}).Decode(&item)
	if notFound(err) {
		return Interview{}, ErrNotFound
	}
	if err != nil {
		return Interview{}, err
	}
	return item, nil
}

func (s *Store) forceStage(ctx context.Context, app Application, companyStage, event string, now time.Time) error {
	prevStage := CompanyBoardStage(app.ColumnID, app.CompanyStage, app.ClosedReason)
	column := StageInterview
	if companyStage == "interview" {
		column = StageInterview
	}
	if app.ColumnID != column {
		app.ColumnID = column
		app.Activity = prependEvent(app.Activity, event, now)
	}
	app.CompanyStage = companyStage
	recordStageEntry(&app, prevStage, CompanyBoardStage(app.ColumnID, app.CompanyStage, app.ClosedReason), now)
	app.Updated = now.UTC()
	_, err := s.collection(applicationsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: app.ID}}, app)
	return err
}
