package employer

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/joined-backend/internal/jobs"
	"github.com/sid0709/OpenSeat/joined-backend/internal/jobschema"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	// Caps match joined-frontend/lib/layer-a.ts.
	maxJobTemplates     = 12
	maxTemplateName     = 80
	maxTemplateTitle    = 120
	maxTemplateTeam     = 80
	maxTemplateLocation = 120
	maxTemplateSummary  = 2000
	maxTemplateDesc     = 12000
	maxTemplateSkills   = 40
	maxTemplateSkill    = 40
	maxTemplateBullets  = 20
	maxTemplateBullet   = 120
	maxJobTemplateID    = 80
)

func (s *Store) JobTemplates(ctx context.Context, companyID string) (JobTemplates, error) {
	stored, err := s.storedJobTemplates(ctx, companyID)
	if err != nil {
		return JobTemplates{}, err
	}
	return JobTemplates{Templates: presentTemplates(stored)}, nil
}

func (s *Store) SaveJobTemplates(ctx context.Context, companyID string, input JobTemplatesWrite, now time.Time) (JobTemplates, error) {
	if input.Templates == nil {
		return JobTemplates{}, ErrInvalidInput
	}
	templates, err := normalizeJobTemplates(input.Templates, now)
	if err != nil {
		return JobTemplates{}, err
	}
	_, err = s.collection(jobTemplatesCollection).UpdateOne(ctx, bson.D{{Key: "companyId", Value: companyID}}, bson.D{
		{Key: "$set", Value: storedJobTemplates{CompanyID: companyID, Templates: templates}},
	}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return JobTemplates{}, err
	}
	return JobTemplates{Templates: presentTemplates(templates)}, nil
}

func (s *Store) storedJobTemplates(ctx context.Context, companyID string) ([]JobTemplate, error) {
	var doc storedJobTemplates
	err := s.collection(jobTemplatesCollection).FindOne(ctx, bson.D{{Key: "companyId", Value: companyID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return doc.Templates, nil
}

func normalizeJobTemplates(raw []JobTemplate, now time.Time) ([]JobTemplate, error) {
	if len(raw) > maxJobTemplates {
		return nil, Invalid("at most 12 job templates")
	}
	out := make([]JobTemplate, 0, len(raw))
	seen := map[string]struct{}{}
	for _, item := range raw {
		next, err := normalizeJobTemplate(item, now)
		if err != nil {
			return nil, err
		}
		if _, ok := seen[next.ID]; ok {
			return nil, Invalid("template id is duplicated")
		}
		seen[next.ID] = struct{}{}
		out = append(out, next)
	}
	return out, nil
}

func normalizeJobTemplate(item JobTemplate, now time.Time) (JobTemplate, error) {
	name := clip(item.Name, maxTemplateName)
	if name == "" {
		return JobTemplate{}, Invalid("template name is required")
	}
	id := strings.TrimSpace(item.ID)
	if len([]rune(id)) > maxJobTemplateID {
		return JobTemplate{}, Invalid("template id is too long")
	}
	if id == "" {
		generated, err := newTemplateID()
		if err != nil {
			return JobTemplate{}, err
		}
		id = generated
	}
	team := clip(item.Team, maxTemplateTeam)
	if team == "" {
		team = clip(item.Department, maxTemplateTeam)
	}
	seniority, err := templateSeniority(item.Seniority)
	if err != nil {
		return JobTemplate{}, err
	}
	workplace := item.Workplace
	if workplace == "" {
		workplace = jobschema.WorkplaceHybrid
	}
	if !oneOf(workplace, jobschema.Workplaces()) {
		return JobTemplate{}, Invalid("template workplace is invalid")
	}
	if item.PayMin < 0 || item.PayMax < 0 {
		return JobTemplate{}, ErrInvalidInput
	}
	questions, err := jobs.NormalizeScreeningQuestions(item.ScreeningQuestions)
	if err != nil {
		return JobTemplate{}, ErrInvalidInput
	}
	return JobTemplate{
		ID:                 id,
		Name:               name,
		Title:              clip(item.Title, maxTemplateTitle),
		Team:               team,
		Department:         team,
		Seniority:          seniority,
		Location:           clip(item.Location, maxTemplateLocation),
		Workplace:          workplace,
		PayMin:             item.PayMin,
		PayMax:             item.PayMax,
		Currency:           jobschema.CanonicalCurrency(item.Currency),
		Visa:               item.Visa,
		Summary:            clip(item.Summary, maxTemplateSummary),
		Skills:             compactList(item.Skills, maxTemplateSkills, maxTemplateSkill),
		Responsibilities:   compactList(item.Responsibilities, maxTemplateBullets, maxTemplateBullet),
		Requirements:       compactList(item.Requirements, maxTemplateBullets, maxTemplateBullet),
		Description:        clip(item.Description, maxTemplateDesc),
		ScreeningQuestions: questionsOrEmpty(questions),
		UpdatedAt:          now.UTC(),
	}, nil
}

func templateSeniority(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return jobschema.SeniorityMiddle, nil
	}
	if mapped, ok := jobschema.CanonicalSeniority(value); ok {
		return mapped, nil
	}
	if oneOf(value, jobschema.Seniorities()) {
		return value, nil
	}
	return "", Invalid("template seniority is invalid")
}

func newTemplateID() (string, error) {
	id, err := newID()
	if err != nil {
		return "", err
	}
	return "jt-" + id, nil
}

func presentTemplates(items []JobTemplate) []JobTemplate {
	if len(items) == 0 {
		return []JobTemplate{}
	}
	out := make([]JobTemplate, len(items))
	for i, item := range items {
		out[i] = presentTemplate(item)
	}
	return out
}

func presentTemplate(item JobTemplate) JobTemplate {
	if item.Department == "" {
		item.Department = item.Team
	}
	item.Skills = listOrEmpty(item.Skills)
	item.Responsibilities = listOrEmpty(item.Responsibilities)
	item.Requirements = listOrEmpty(item.Requirements)
	item.ScreeningQuestions = questionsOrEmpty(item.ScreeningQuestions)
	return item
}
