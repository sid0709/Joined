package deepseek

import (
	"errors"
	"strings"

	"github.com/sid0709/Joined/backend-core/openai"
)

const (
	// ApproachChat reads and writes JSON over chat completions.
	ApproachChat = "chat"
	// ApproachBatch is the same JSON call on OpenRouter's Batch API.
	ApproachBatch = "batch"
	// ApproachDecisions asks a decision model for typed answers, not a writeup.
	ApproachDecisions = "decisions"
)

// ApproachFor is the lane a model id belongs to when the caller does not name one.
func ApproachFor(model string) string {
	switch {
	case openai.IsBatchCatalog(model):
		return ApproachBatch
	case IsDecisionModel(model):
		return ApproachDecisions
	default:
		return ApproachChat
	}
}

// IsDecisionModel reports a model served by OpenRouter's decisions API.
// Sonar is Perplexity's search model and stays on the chat lane.
func IsDecisionModel(model string) bool {
	base := modelBase(model)
	if strings.HasPrefix(base, "typesafe/") {
		return true
	}
	if strings.Contains(base, "sonar") {
		return false
	}
	return strings.Contains(base, "decision")
}

// IsNativeSearch reports a Perplexity Sonar model. It searches on its own, so the
// OpenRouter web plugin must stay off or Sonar answers someone else's results.
func IsNativeSearch(model string) bool {
	if openai.IsBatchCatalog(model) {
		return false
	}
	base := modelBase(model)
	return strings.HasPrefix(base, "perplexity/") && strings.Contains(base, "sonar")
}

// CheckApproach reports when a model cannot run on the chosen lane.
func CheckApproach(approach, model string) error {
	switch approach {
	case ApproachChat:
		if openai.IsBatchCatalog(model) {
			return errors.New("a batch model runs on the Batch approach")
		}
		if IsDecisionModel(model) {
			return errors.New("a decision model runs on the Decisions approach")
		}
	case ApproachBatch:
		if !openai.IsBatchCatalog(model) {
			return errors.New("the Batch approach needs a model id that includes :batch")
		}
	case ApproachDecisions:
		if openai.IsBatchCatalog(model) {
			return errors.New("a batch model runs on the Batch approach")
		}
		if strings.TrimSpace(model) == "" {
			return errors.New("pick a decision model")
		}
	default:
		return errors.New("approach must be chat, batch, or decisions")
	}
	return nil
}

func modelBase(model string) string {
	base, _, _ := strings.Cut(strings.ToLower(strings.TrimSpace(model)), ":")
	return base
}
