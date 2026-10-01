package employer

import (
	"context"
	"errors"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func (s *Store) GetPipeline(ctx context.Context, companyID, id string) (PipelineConfig, error) {
	doc, err := s.job(ctx, companyID, id)
	if err != nil {
		return PipelineConfig{}, err
	}
	return pipelineConfig(doc), nil
}

func (s *Store) SavePipeline(ctx context.Context, companyID, id string, put PipelinePut, now time.Time) (PipelineConfig, error) {
	doc, err := s.job(ctx, companyID, id)
	if err != nil {
		return PipelineConfig{}, err
	}
	patch, err := put.patch()
	if err != nil {
		return PipelineConfig{}, err
	}
	if !patch.touches() {
		return pipelineConfig(doc), nil
	}
	doc = applyPipeline(doc, patch)
	set := bson.D{{Key: "updatedAt", Value: now.UTC()}}
	if patch.setStages {
		set = append(set, bson.E{Key: "customStages", Value: nonNilStages(doc.CustomStages)})
	}
	if patch.setGate {
		set = append(set, bson.E{Key: "feedbackGate", Value: doc.FeedbackGate})
	}
	if patch.setTemplate {
		set = append(set, bson.E{Key: "scorecardTemplate", Value: doc.ScorecardTemplate})
	}
	if patch.setGuide {
		set = append(set, bson.E{Key: "interviewGuide", Value: doc.InterviewGuide})
	}
	_, err = s.collection(jobsCollection).UpdateOne(ctx, bson.D{{Key: "id", Value: id}, {Key: "companyId", Value: companyID}}, bson.D{{Key: "$set", Value: set}})
	if err != nil {
		return PipelineConfig{}, err
	}
	return pipelineConfig(doc), nil
}

func (s *Store) AddScorecard(ctx context.Context, companyID, applicantID, userID string, input ScorecardInput, now time.Time) (ScorecardSubmission, error) {
	app, err := s.people.ApplicationForCompany(ctx, companyID, applicantID)
	if errors.Is(err, candidate.ErrNotFound) {
		return ScorecardSubmission{}, ErrNotFound
	}
	if err != nil {
		return ScorecardSubmission{}, err
	}
	doc, err := s.job(ctx, companyID, app.JobID)
	if err != nil {
		return ScorecardSubmission{}, err
	}
	item, err := normalizeScorecard(input, doc.ScorecardTemplate, app.ID, userID, now)
	if err != nil {
		return ScorecardSubmission{}, err
	}
	stored := storedScorecard{
		ID:          item.ID,
		CompanyID:   companyID,
		ApplicantID: item.ApplicantID,
		InterviewID: item.InterviewID,
		TemplateID:  item.TemplateID,
		Scores:      item.Scores,
		Overall:     item.Overall,
		SubmittedAt: item.SubmittedAt,
		SubmittedBy: item.SubmittedBy,
	}
	if _, err := s.collection(scorecardsCollection).InsertOne(ctx, stored); err != nil {
		return ScorecardSubmission{}, err
	}
	return item, nil
}

func (s *Store) ListScorecards(ctx context.Context, companyID, applicantID string) ([]ScorecardSubmission, error) {
	if _, err := s.people.ApplicationForCompany(ctx, companyID, applicantID); errors.Is(err, candidate.ErrNotFound) {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}
	cursor, err := s.collection(scorecardsCollection).Find(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "applicantId", Value: applicantID},
	}, options.Find().SetSort(bson.D{{Key: "submittedAt", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	docs := []storedScorecard{}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]ScorecardSubmission, 0, len(docs))
	for _, doc := range docs {
		out = append(out, doc.view())
	}
	return out, nil
}

func (s *Store) applicantHasScorecard(ctx context.Context, companyID, applicantID string) (bool, error) {
	n, err := s.collection(scorecardsCollection).CountDocuments(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "applicantId", Value: applicantID},
	}, options.Count().SetLimit(1))
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

type storedScorecard struct {
	ID          string           `bson:"id"`
	CompanyID   string           `bson:"companyId"`
	ApplicantID string           `bson:"applicantId"`
	InterviewID string           `bson:"interviewId,omitempty"`
	TemplateID  string           `bson:"templateId"`
	Scores      []ScorecardScore `bson:"scores"`
	Overall     *float64         `bson:"overall,omitempty"`
	SubmittedAt time.Time        `bson:"submittedAt"`
	SubmittedBy string           `bson:"submittedBy,omitempty"`
}

func (doc storedScorecard) view() ScorecardSubmission {
	scores := doc.Scores
	if scores == nil {
		scores = []ScorecardScore{}
	}
	return ScorecardSubmission{
		ID:          doc.ID,
		ApplicantID: doc.ApplicantID,
		InterviewID: doc.InterviewID,
		TemplateID:  doc.TemplateID,
		Scores:      scores,
		Overall:     doc.Overall,
		SubmittedAt: doc.SubmittedAt,
		SubmittedBy: doc.SubmittedBy,
	}
}
