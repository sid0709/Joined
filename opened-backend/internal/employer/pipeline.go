package employer

import (
	"bytes"
	"encoding/json"
	"regexp"
	"strings"
	"time"
)

const (
	stageKindCustom = "custom"
	stageKindFixed  = "fixed"

	maxCustomStages      = 8
	maxScorecardCriteria = 10
	maxGuideSections     = 8
	maxGuidePrompts      = 6
	defaultCriterionMax  = 5
	maxPipelineName      = 80
	maxPipelineText      = 240
	maxSlugID            = 80
	maxInterviewers      = 12
	maxInterviewerID     = 80
	maxScorecardNote     = 500
	defaultScorecardName = "Interview scorecard"
	defaultGuideTitle    = "Interview guide"

	notesRequiredReason     = "Add team notes before advancing this candidate."
	ratingRequiredReason    = "Add a team rating before advancing this candidate."
	scorecardRequiredReason = "Submit a scorecard before advancing to this stage."
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// FeedbackGateError rejects a stage move the feedback gate does not allow.
// It unwraps to ErrConflict so the HTTP layer answers 409.
type FeedbackGateError struct {
	Reason string
}

func (e *FeedbackGateError) Error() string { return e.Reason }

func (e *FeedbackGateError) Unwrap() error { return ErrConflict }

type PipelineStageDef struct {
	ID                string `json:"id" bson:"id"`
	Title             string `json:"title" bson:"title"`
	Kind              string `json:"kind" bson:"kind"`
	RequiresFeedback  bool   `json:"requiresFeedback,omitempty" bson:"requiresFeedback,omitempty"`
	RequiresScorecard bool   `json:"requiresScorecard,omitempty" bson:"requiresScorecard,omitempty"`
}

type FeedbackGateConfig struct {
	RequireNotesOnAdvance  bool     `json:"requireNotesOnAdvance" bson:"requireNotesOnAdvance"`
	RequireRatingOnAdvance bool     `json:"requireRatingOnAdvance" bson:"requireRatingOnAdvance"`
	RequireScorecardStages []string `json:"requireScorecardStages" bson:"requireScorecardStages"`
}

type ScorecardCriterion struct {
	ID          string `json:"id" bson:"id"`
	Label       string `json:"label" bson:"label"`
	Description string `json:"description,omitempty" bson:"description,omitempty"`
	MaxScore    int    `json:"maxScore" bson:"maxScore"`
}

type ScorecardTemplate struct {
	ID       string               `json:"id" bson:"id"`
	Name     string               `json:"name" bson:"name"`
	Criteria []ScorecardCriterion `json:"criteria" bson:"criteria"`
}

type ScorecardScore struct {
	CriterionID string `json:"criterionId" bson:"criterionId"`
	Score       int    `json:"score" bson:"score"`
	Note        string `json:"note,omitempty" bson:"note,omitempty"`
}

type ScorecardSubmission struct {
	ID          string           `json:"id" bson:"id"`
	ApplicantID string           `json:"applicantId" bson:"applicantId"`
	InterviewID string           `json:"interviewId,omitempty" bson:"interviewId,omitempty"`
	TemplateID  string           `json:"templateId" bson:"templateId"`
	Scores      []ScorecardScore `json:"scores" bson:"scores"`
	Overall     *float64         `json:"overall,omitempty" bson:"overall,omitempty"`
	SubmittedAt time.Time        `json:"submittedAt" bson:"submittedAt"`
	SubmittedBy string           `json:"submittedBy,omitempty" bson:"submittedBy,omitempty"`
}

type ScorecardInput struct {
	TemplateID  string           `json:"templateId"`
	InterviewID string           `json:"interviewId"`
	Scores      []ScorecardScore `json:"scores"`
	Overall     *float64         `json:"overall"`
}

type InterviewGuideSection struct {
	ID      string   `json:"id" bson:"id"`
	Title   string   `json:"title" bson:"title"`
	Prompts []string `json:"prompts" bson:"prompts"`
}

type InterviewGuide struct {
	ID       string                  `json:"id" bson:"id"`
	Title    string                  `json:"title" bson:"title"`
	Sections []InterviewGuideSection `json:"sections" bson:"sections"`
}

// PipelineConfig is the GET/PUT /v1/company/jobs/:id/pipeline body.
type PipelineConfig struct {
	Stages            []PipelineStageDef `json:"stages"`
	FeedbackGate      FeedbackGateConfig `json:"feedbackGate"`
	ScorecardTemplate *ScorecardTemplate `json:"scorecardTemplate,omitempty"`
	InterviewGuide    *InterviewGuide    `json:"interviewGuide,omitempty"`
}

// PipelinePut is a partial pipeline write. Absent keys stay as they are.
type PipelinePut struct {
	Stages            json.RawMessage `json:"stages"`
	FeedbackGate      json.RawMessage `json:"feedbackGate"`
	ScorecardTemplate json.RawMessage `json:"scorecardTemplate"`
	InterviewGuide    json.RawMessage `json:"interviewGuide"`
}

type pipelinePatch struct {
	setStages   bool
	stages      []PipelineStageDef
	setGate     bool
	gate        *FeedbackGateConfig
	setTemplate bool
	template    *ScorecardTemplate
	setGuide    bool
	guide       *InterviewGuide
}

func (p pipelinePatch) touches() bool {
	return p.setStages || p.setGate || p.setTemplate || p.setGuide
}

type advanceCheck struct {
	from         string
	to           string
	notes        string
	rating       int
	hasScorecard bool
	gate         FeedbackGateConfig
	custom       []PipelineStageDef
}

func (p PipelinePut) patch() (pipelinePatch, error) {
	var out pipelinePatch
	if p.Stages != nil {
		out.setStages = true
		if !rawNull(p.Stages) {
			var stages []PipelineStageDef
			if err := json.Unmarshal(p.Stages, &stages); err != nil {
				return pipelinePatch{}, ErrInvalidInput
			}
			normalized, err := normalizeStages(stages)
			if err != nil {
				return pipelinePatch{}, err
			}
			out.stages = normalized
		} else {
			out.stages = []PipelineStageDef{}
		}
	}
	if p.FeedbackGate != nil {
		out.setGate = true
		gate := defaultFeedbackGate()
		if !rawNull(p.FeedbackGate) {
			var raw FeedbackGateConfig
			if err := json.Unmarshal(p.FeedbackGate, &raw); err != nil {
				return pipelinePatch{}, ErrInvalidInput
			}
			gate = normalizeFeedbackGate(raw)
		}
		out.gate = &gate
	}
	if p.ScorecardTemplate != nil {
		out.setTemplate = true
		if !rawNull(p.ScorecardTemplate) {
			var raw ScorecardTemplate
			if err := json.Unmarshal(p.ScorecardTemplate, &raw); err != nil {
				return pipelinePatch{}, ErrInvalidInput
			}
			normalized, err := normalizeScorecardTemplate(&raw)
			if err != nil {
				return pipelinePatch{}, err
			}
			out.template = normalized
		}
	}
	if p.InterviewGuide != nil {
		out.setGuide = true
		if !rawNull(p.InterviewGuide) {
			var raw InterviewGuide
			if err := json.Unmarshal(p.InterviewGuide, &raw); err != nil {
				return pipelinePatch{}, ErrInvalidInput
			}
			normalized, err := normalizeInterviewGuide(&raw)
			if err != nil {
				return pipelinePatch{}, err
			}
			out.guide = normalized
		}
	}
	return out, nil
}

func applyPipeline(doc storedJob, patch pipelinePatch) storedJob {
	if patch.setStages {
		doc.CustomStages = patch.stages
	}
	if patch.setGate {
		doc.FeedbackGate = patch.gate
	}
	if patch.setTemplate {
		doc.ScorecardTemplate = patch.template
	}
	if patch.setGuide {
		doc.InterviewGuide = patch.guide
	}
	return doc
}

func pipelineConfig(doc storedJob) PipelineConfig {
	stages := doc.CustomStages
	if stages == nil {
		stages = []PipelineStageDef{}
	}
	gate := defaultFeedbackGate()
	if doc.FeedbackGate != nil {
		gate = *doc.FeedbackGate
		if gate.RequireScorecardStages == nil {
			gate.RequireScorecardStages = []string{}
		}
	}
	return PipelineConfig{
		Stages:            stages,
		FeedbackGate:      gate,
		ScorecardTemplate: doc.ScorecardTemplate,
		InterviewGuide:    doc.InterviewGuide,
	}
}

func carryPipeline(dst, src storedJob) storedJob {
	dst.CustomStages = src.CustomStages
	dst.FeedbackGate = src.FeedbackGate
	dst.ScorecardTemplate = src.ScorecardTemplate
	dst.InterviewGuide = src.InterviewGuide
	return dst
}

func defaultFeedbackGate() FeedbackGateConfig {
	return FeedbackGateConfig{RequireScorecardStages: []string{}}
}

func normalizeStages(items []PipelineStageDef) ([]PipelineStageDef, error) {
	if items == nil {
		return []PipelineStageDef{}, nil
	}
	out := make([]PipelineStageDef, 0, min(len(items), maxCustomStages))
	seen := map[string]struct{}{}
	for _, item := range items {
		if item.Kind != stageKindCustom {
			continue
		}
		title := clip(item.Title, maxPipelineName)
		if title == "" {
			continue
		}
		id := strings.TrimSpace(item.ID)
		if fixedCompanyStage(id) {
			continue
		}
		slug, err := slugOrNew(id, "stage")
		if err != nil {
			return nil, err
		}
		if _, ok := seen[slug]; ok {
			return nil, ErrInvalidInput
		}
		seen[slug] = struct{}{}
		out = append(out, PipelineStageDef{
			ID:                slug,
			Title:             title,
			Kind:              stageKindCustom,
			RequiresFeedback:  item.RequiresFeedback,
			RequiresScorecard: item.RequiresScorecard,
		})
		if len(out) == maxCustomStages {
			break
		}
	}
	return out, nil
}

func normalizeFeedbackGate(raw FeedbackGateConfig) FeedbackGateConfig {
	stages := make([]string, 0, len(raw.RequireScorecardStages))
	seen := map[string]struct{}{}
	for _, stage := range raw.RequireScorecardStages {
		stage = strings.TrimSpace(stage)
		if stage == "" {
			continue
		}
		if _, ok := seen[stage]; ok {
			continue
		}
		seen[stage] = struct{}{}
		stages = append(stages, stage)
	}
	return FeedbackGateConfig{
		RequireNotesOnAdvance:  raw.RequireNotesOnAdvance,
		RequireRatingOnAdvance: raw.RequireRatingOnAdvance,
		RequireScorecardStages: stages,
	}
}

func normalizeScorecardTemplate(raw *ScorecardTemplate) (*ScorecardTemplate, error) {
	if raw == nil {
		return nil, nil
	}
	criteria := make([]ScorecardCriterion, 0, min(len(raw.Criteria), maxScorecardCriteria))
	seen := map[string]struct{}{}
	for _, item := range raw.Criteria {
		label := clip(item.Label, maxPipelineName)
		if label == "" {
			continue
		}
		id, err := slugOrNew(item.ID, "crit")
		if err != nil {
			return nil, err
		}
		if _, ok := seen[id]; ok {
			return nil, ErrInvalidInput
		}
		seen[id] = struct{}{}
		maxScore := item.MaxScore
		if maxScore <= 0 {
			maxScore = defaultCriterionMax
		}
		next := ScorecardCriterion{ID: id, Label: label, MaxScore: maxScore}
		if description := clip(item.Description, maxPipelineText); description != "" {
			next.Description = description
		}
		criteria = append(criteria, next)
		if len(criteria) == maxScorecardCriteria {
			break
		}
	}
	if len(criteria) == 0 {
		return nil, nil
	}
	id, err := slugOrNew(raw.ID, "tmpl")
	if err != nil {
		return nil, err
	}
	name := clip(raw.Name, maxPipelineName)
	if name == "" {
		name = defaultScorecardName
	}
	return &ScorecardTemplate{ID: id, Name: name, Criteria: criteria}, nil
}

func normalizeInterviewGuide(raw *InterviewGuide) (*InterviewGuide, error) {
	if raw == nil {
		return nil, nil
	}
	sections := make([]InterviewGuideSection, 0, min(len(raw.Sections), maxGuideSections))
	seen := map[string]struct{}{}
	for _, item := range raw.Sections {
		title := clip(item.Title, maxPipelineName)
		if title == "" {
			continue
		}
		id, err := slugOrNew(item.ID, "sec")
		if err != nil {
			return nil, err
		}
		if _, ok := seen[id]; ok {
			return nil, ErrInvalidInput
		}
		seen[id] = struct{}{}
		prompts := make([]string, 0, maxGuidePrompts)
		for _, prompt := range item.Prompts {
			prompt = clip(prompt, maxPipelineText)
			if prompt == "" {
				continue
			}
			prompts = append(prompts, prompt)
			if len(prompts) == maxGuidePrompts {
				break
			}
		}
		sections = append(sections, InterviewGuideSection{ID: id, Title: title, Prompts: prompts})
		if len(sections) == maxGuideSections {
			break
		}
	}
	if len(sections) == 0 {
		return nil, nil
	}
	id, err := slugOrNew(raw.ID, "guide")
	if err != nil {
		return nil, err
	}
	title := clip(raw.Title, maxPipelineName)
	if title == "" {
		title = defaultGuideTitle
	}
	return &InterviewGuide{ID: id, Title: title, Sections: sections}, nil
}

func normalizeScorecard(input ScorecardInput, template *ScorecardTemplate, applicantID, userID string, now time.Time) (ScorecardSubmission, error) {
	if template == nil || strings.TrimSpace(input.TemplateID) == "" || input.TemplateID != template.ID {
		return ScorecardSubmission{}, ErrInvalidInput
	}
	if input.Overall != nil && *input.Overall < 0 {
		return ScorecardSubmission{}, ErrInvalidInput
	}
	interviewID := strings.TrimSpace(input.InterviewID)
	if len([]rune(interviewID)) > maxSlugID {
		return ScorecardSubmission{}, ErrInvalidInput
	}
	byID := make(map[string]ScorecardScore, len(input.Scores))
	for _, score := range input.Scores {
		id := strings.TrimSpace(score.CriterionID)
		if id == "" {
			return ScorecardSubmission{}, ErrInvalidInput
		}
		if _, ok := byID[id]; ok {
			return ScorecardSubmission{}, ErrInvalidInput
		}
		byID[id] = score
	}
	if len(byID) != len(template.Criteria) {
		return ScorecardSubmission{}, ErrInvalidInput
	}
	scores := make([]ScorecardScore, 0, len(template.Criteria))
	for _, criterion := range template.Criteria {
		score, ok := byID[criterion.ID]
		if !ok || score.Score < 1 || score.Score > criterion.MaxScore {
			return ScorecardSubmission{}, ErrInvalidInput
		}
		next := ScorecardScore{CriterionID: criterion.ID, Score: score.Score}
		if note := clip(score.Note, maxScorecardNote); note != "" {
			next.Note = note
		}
		scores = append(scores, next)
	}
	id, err := newID()
	if err != nil {
		return ScorecardSubmission{}, err
	}
	item := ScorecardSubmission{
		ID:          id,
		ApplicantID: applicantID,
		TemplateID:  template.ID,
		Scores:      scores,
		Overall:     input.Overall,
		SubmittedAt: now.UTC(),
		SubmittedBy: userID,
	}
	if interviewID != "" {
		item.InterviewID = interviewID
	}
	return item, nil
}

func normalizeInterviewerIDs(values []string) []string {
	out := make([]string, 0, min(len(values), maxInterviewers))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || len([]rune(value)) > maxInterviewerID {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
		if len(out) == maxInterviewers {
			break
		}
	}
	return out
}

func feedbackGate(check advanceCheck) error {
	if check.from == check.to || check.to == stageRejected {
		return nil
	}
	stageMeta := stageByID(check.custom, check.to)
	needsNotes := check.gate.RequireNotesOnAdvance || (stageMeta != nil && stageMeta.RequiresFeedback)
	needsRating := check.gate.RequireRatingOnAdvance
	needsScorecard := stageListed(check.gate.RequireScorecardStages, check.to) || (stageMeta != nil && stageMeta.RequiresScorecard)
	if needsNotes && strings.TrimSpace(check.notes) == "" {
		return &FeedbackGateError{Reason: notesRequiredReason}
	}
	if needsRating && check.rating <= 0 {
		return &FeedbackGateError{Reason: ratingRequiredReason}
	}
	if needsScorecard && !check.hasScorecard {
		return &FeedbackGateError{Reason: scorecardRequiredReason}
	}
	return nil
}

func advanceNeedsScorecard(from, to string, gate FeedbackGateConfig, custom []PipelineStageDef) bool {
	if from == to || to == stageRejected {
		return false
	}
	if stageListed(gate.RequireScorecardStages, to) {
		return true
	}
	stageMeta := stageByID(custom, to)
	return stageMeta != nil && stageMeta.RequiresScorecard
}

func stageByID(stages []PipelineStageDef, id string) *PipelineStageDef {
	for i := range stages {
		if stages[i].ID == id {
			return &stages[i]
		}
	}
	return nil
}

func stageListed(stages []string, id string) bool {
	for _, stage := range stages {
		if stage == id {
			return true
		}
	}
	return false
}

func stageSet(stages []PipelineStageDef) map[string]struct{} {
	out := make(map[string]struct{}, len(stages))
	for _, stage := range stages {
		if stage.ID != "" {
			out[stage.ID] = struct{}{}
		}
	}
	return out
}

func slugSafe(id string) bool {
	return id != "" && len(id) <= maxSlugID && slugPattern.MatchString(id)
}

func slugOrNew(id, prefix string) (string, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return prefixedID(prefix)
	}
	if !slugSafe(id) {
		return "", ErrInvalidInput
	}
	return id, nil
}

func prefixedID(prefix string) (string, error) {
	id, err := newID()
	if err != nil {
		return "", err
	}
	return prefix + "-" + id, nil
}

func rawNull(raw json.RawMessage) bool {
	return bytes.Equal(bytes.TrimSpace(raw), []byte("null"))
}

func nonNilStages(stages []PipelineStageDef) []PipelineStageDef {
	if stages == nil {
		return []PipelineStageDef{}
	}
	return stages
}

func gateOrEmpty(gate *FeedbackGateConfig) FeedbackGateConfig {
	if gate == nil {
		return defaultFeedbackGate()
	}
	return *gate
}
