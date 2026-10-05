package acorn

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"
)

const (
	proseTimeout    = 20 * time.Second
	identityTimeout = 8 * time.Second
	extractTimeout  = 25 * time.Second
	maxQuestion     = 8000
)

// ErrModelUnavailable is returned when no model key is configured.
var ErrModelUnavailable = errors.New("the AI model is not configured")

// ErrInvalid is a request the extension should fix, not retry.
var ErrInvalid = errors.New("invalid request")

// Model is the language model behind Acorn: one JSON object per request, matching a schema.
type Model interface {
	JSON(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error)
	Model() string
	Ready() bool
}

type Service struct {
	model Model
}

func New(model Model) *Service { return &Service{model: model} }

func (s *Service) ask(ctx context.Context, system, user string, schema json.RawMessage) (string, error) {
	if s.model == nil || !s.model.Ready() {
		return "", ErrModelUnavailable
	}
	raw, err := s.model.JSON(ctx, system, user, schema)
	return string(raw), err
}

// AnalyzeResult is what the extension runs: a plan of form actions.
type AnalyzeResult struct {
	OK         bool    `json:"ok"`
	Plan       Plan    `json:"plan"`
	Model      string  `json:"model"`
	ResponseID *string `json:"responseId"`
}

// Analyze plans a fill of every answerable control in the pure tree from the
// applicant's profile, then classifies identity questions and rewrites typed answers.
func (s *Service) Analyze(ctx context.Context, applicant, pureTree string, page map[string]any) (AnalyzeResult, error) {
	if strings.TrimSpace(pureTree) == "" {
		return AnalyzeResult{}, fmt.Errorf("%w: pureTree is required", ErrInvalid)
	}
	// Résumés are not generated or recommended here, so the planner is told none is available.
	page = withResumeUnavailable(page)

	text, err := s.ask(ctx, analyzeSystem, analyzeUserPrompt(applicant, pureTree, page), actionPlanSchema())
	if err != nil {
		return AnalyzeResult{}, err
	}
	var plan Plan
	if err := json.Unmarshal([]byte(text), &plan); err != nil {
		return AnalyzeResult{}, errors.New("model returned non-JSON output")
	}
	if err := validatePlan(plan); err != nil {
		return AnalyzeResult{}, err
	}

	identity := s.classifyIdentity(ctx, plan)
	plan = applyApplicantIdentity(plan, identity)
	plan = s.rewriteTyping(ctx, plan, applicant, page)
	plan = applyApplicantIdentity(plan, identity)
	return AnalyzeResult{OK: true, Plan: plan, Model: s.model.Model()}, nil
}

func withResumeUnavailable(page map[string]any) map[string]any {
	next := make(map[string]any, len(page)+1)
	for key, value := range page {
		next[key] = value
	}
	next["recommendedResumeAvailable"] = false
	return next
}

// classifyIdentity finds the questions about the applicant being an AI. It fails open.
func (s *Service) classifyIdentity(ctx context.Context, plan Plan) map[int]bool {
	fields := collectIdentityQuestions(plan)
	if len(fields) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, identityTimeout)
	defer cancel()
	text, err := s.ask(ctx, identitySystem, identityUserPrompt(fields), identitySchema())
	if err == nil {
		var indexes map[int]bool
		if indexes, err = parseApplicationAI(text, fields); err == nil {
			return indexes
		}
	}
	slog.Warn("acorn identity classify skipped", "error", err)
	return nil
}

// rewriteTyping has the writer replace planner drafts in typed fields. It fails open.
func (s *Service) rewriteTyping(ctx context.Context, plan Plan, applicant string, page map[string]any) Plan {
	fields := typingFields(plan)
	if len(fields) == 0 {
		return plan
	}
	ctx, cancel := context.WithTimeout(ctx, proseTimeout)
	defer cancel()
	text, err := s.ask(ctx, proseSystem, proseUserPrompt(applicant, fields, page), proseAnswersSchema())
	if err == nil {
		allowed := map[int]bool{}
		for _, field := range fields {
			allowed[field.ElementIndex] = true
		}
		var answers map[int]string
		if answers, err = parseProseAnswers(text, allowed); err == nil {
			return overlayTypingFills(plan, answers)
		}
	}
	slog.Warn("acorn typing-field rewrite skipped", "error", err)
	return plan
}

// MatchResult is the dropdown option that best fits an intended answer.
type MatchResult struct {
	OK            bool    `json:"ok"`
	MatchedOption *string `json:"matched_option"`
	Confidence    float64 `json:"confidence"`
	Reason        string  `json:"reason"`
	Model         string  `json:"model"`
}

// MatchOption picks the listed option that means the intended value.
func (s *Service) MatchOption(ctx context.Context, intended string, options []string, fieldLabel, typedQuery string) (MatchResult, error) {
	var list []string
	for _, option := range options {
		if strings.TrimSpace(option) != "" {
			list = append(list, option)
		}
	}
	if strings.TrimSpace(intended) == "" || len(list) == 0 {
		return MatchResult{OK: true, Reason: "Missing value or options", Model: s.model.Model()}, nil
	}

	lines := []string{}
	if fieldLabel != "" {
		lines = append(lines, "Field label: "+fieldLabel)
	}
	if typedQuery != "" {
		lines = append(lines, "Current typed filter: "+typedQuery)
	}
	lines = append(lines, "Intended answer: "+intended, "Visible options:")
	for i, option := range list {
		lines = append(lines, fmt.Sprintf("%d. %s", i+1, option))
	}
	lines = append(lines, "Pick one Visible options string verbatim. Do not return null.", "Respond with json.")

	text, err := s.ask(ctx, matchOptionSystem, strings.Join(lines, "\n"), matchOptionSchema(list))
	if err != nil {
		return MatchResult{}, err
	}
	var parsed struct {
		MatchedOption *string  `json:"matched_option"`
		Confidence    *float64 `json:"confidence"`
		Reason        string   `json:"reason"`
	}
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return MatchResult{}, errors.New("LLM returned non-JSON option match")
	}
	result := MatchResult{OK: true, Reason: parsed.Reason, Model: s.model.Model()}
	if parsed.Confidence != nil {
		result.Confidence = *parsed.Confidence
	}
	if parsed.MatchedOption != nil {
		matched := *parsed.MatchedOption
		if !contains(list, matched) {
			matched = recoverListedOption(matched, list)
		}
		if matched != "" {
			result.MatchedOption = &matched
		}
	}
	return result, nil
}

// QAResult is a written answer to one free-text question.
type QAResult struct {
	OK     bool   `json:"ok"`
	Answer string `json:"answer"`
	Model  string `json:"model"`
}

// Answer writes the applicant's answer to a question that Fill left blank.
func (s *Service) Answer(ctx context.Context, applicant, question string, page map[string]any) (QAResult, error) {
	question = strings.TrimSpace(question)
	if question == "" || len([]rune(question)) > maxQuestion {
		return QAResult{}, fmt.Errorf("%w: question must be 1-%d characters", ErrInvalid, maxQuestion)
	}
	ctx, cancel := context.WithTimeout(ctx, proseTimeout)
	defer cancel()
	fields := []typingField{{ElementIndex: qaFieldIndex, Question: question, Role: "textarea"}}
	text, err := s.ask(ctx, proseSystem, proseUserPrompt(applicant, fields, page), proseAnswersSchema())
	if err != nil {
		return QAResult{}, err
	}
	answers, err := parseProseAnswers(text, map[int]bool{qaFieldIndex: true})
	if err != nil {
		return QAResult{}, err
	}
	answer := strings.TrimSpace(answers[qaFieldIndex])
	if answer == "" {
		return QAResult{}, errors.New("writer returned no answer")
	}
	return QAResult{OK: true, Answer: answer, Model: s.model.Model()}, nil
}

// JDResult says whether a page holds a job posting and, if so, its text.
type JDResult struct {
	OK                bool    `json:"ok"`
	HasJobDescription bool    `json:"hasJobDescription"`
	JobDescription    *string `json:"jobDescription"`
	Reason            string  `json:"reason"`
	Model             string  `json:"model"`
}

const noJDReason = "No job description on this page"

// ExtractJD reads the posting out of page text captured from a browser tab.
func (s *Service) ExtractJD(ctx context.Context, pageText string, meta any) (JDResult, error) {
	pageText = strings.TrimSpace(pageText)
	if pageText == "" {
		pageText = MetaToPageText(meta)
	}
	if pageText == "" {
		return JDResult{}, fmt.Errorf("%w: pageText or meta is required", ErrInvalid)
	}
	ctx, cancel := context.WithTimeout(ctx, extractTimeout)
	defer cancel()
	text, err := s.ask(ctx, extractJDSystem, "Page text:\n\n"+pageText, extractJDSchema())
	if err != nil {
		return JDResult{}, err
	}
	var parsed struct {
		HasJobDescription bool    `json:"hasJobDescription"`
		JobDescription    *string `json:"jobDescription"`
		Reason            string  `json:"reason"`
	}
	if err := decodeObject(text, &parsed); err != nil {
		return JDResult{}, errors.New("JD extract returned invalid JSON")
	}
	reason := strings.TrimSpace(parsed.Reason)
	extracted := ""
	if parsed.JobDescription != nil {
		extracted = strings.TrimSpace(*parsed.JobDescription)
	}
	result := JDResult{OK: true, Model: s.model.Model()}
	if !parsed.HasJobDescription || extracted == "" {
		if reason == "" {
			reason = noJDReason
		}
		result.Reason = reason
		return result, nil
	}
	if reason == "" {
		reason = "Job description found"
	}
	result.HasJobDescription, result.JobDescription, result.Reason = true, &extracted, reason
	return result, nil
}
