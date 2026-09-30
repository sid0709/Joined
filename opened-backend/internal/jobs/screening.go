package jobs

import "strings"

const (
	// ScreeningYesNo and ScreeningShortText match opened-frontend/lib/intake.ts.
	ScreeningYesNo     = "yes_no"
	ScreeningShortText = "short_text"
	KnockoutYes        = "yes"
	KnockoutNo         = "no"

	// maxScreeningQuestions matches MAX_SCREENING_QUESTIONS in intake.ts.
	maxScreeningQuestions = 8
	maxScreeningPrompt    = 500
	maxScreeningID        = 80
)

// ScreeningQuestion is one company-authored question on a job.
// JSON matches intake.ts: id, prompt, kind, required, knockoutAnswer?.
type ScreeningQuestion struct {
	ID             string `json:"id" bson:"id"`
	Prompt         string `json:"prompt" bson:"prompt"`
	Kind           string `json:"kind" bson:"kind"`
	Required       bool   `json:"required" bson:"required"`
	KnockoutAnswer string `json:"knockoutAnswer,omitempty" bson:"knockoutAnswer,omitempty"`
}

// NormalizeScreeningQuestions trims and checks a job's questions.
// Empty input is a job with no questions. Ids the client already chose are kept
// so answers can point at them; a blank id gets a new public id.
func NormalizeScreeningQuestions(items []ScreeningQuestion) ([]ScreeningQuestion, error) {
	if len(items) > maxScreeningQuestions {
		return nil, ErrInvalidInput
	}
	out := make([]ScreeningQuestion, 0, len(items))
	seen := map[string]struct{}{}
	for _, item := range items {
		prompt := truncate(strings.TrimSpace(item.Prompt), maxScreeningPrompt)
		if prompt == "" {
			return nil, ErrInvalidInput
		}
		if item.Kind != ScreeningYesNo && item.Kind != ScreeningShortText {
			return nil, ErrInvalidInput
		}
		id := strings.TrimSpace(item.ID)
		if id == "" {
			generated, err := newPublicID()
			if err != nil {
				return nil, err
			}
			id = generated
		}
		if len([]rune(id)) > maxScreeningID {
			return nil, ErrInvalidInput
		}
		if _, ok := seen[id]; ok {
			return nil, ErrInvalidInput
		}
		seen[id] = struct{}{}
		next := ScreeningQuestion{
			ID:       id,
			Prompt:   prompt,
			Kind:     item.Kind,
			Required: item.Required,
		}
		if item.Kind == ScreeningYesNo {
			answer, ok := normalizeKnockoutAnswer(item.KnockoutAnswer)
			if !ok {
				return nil, ErrInvalidInput
			}
			next.KnockoutAnswer = answer
		}
		out = append(out, next)
	}
	return out, nil
}

func normalizeKnockoutAnswer(value string) (string, bool) {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "", KnockoutYes, KnockoutNo:
		return value, true
	default:
		return "", false
	}
}
