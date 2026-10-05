package fitscore

import (
	"strings"
	"unicode/utf8"
)

func emptyReason(needsVisa bool) string {
	text := "Add target roles, skills, and locations to see a fit score"
	if needsVisa {
		return text + ". This job does not offer visa sponsorship"
	}
	return text
}

func buildReason(dims []dimension, confidence string, needsVisa bool) string {
	matches := make([]string, 0, 3)
	misses := make([]string, 0, 3)
	for _, dim := range dims {
		switch dim.criterion.Level {
		case levelYes, levelPartial:
			if len(matches) < 3 {
				matches = append(matches, dim.criterion.Detail)
			}
		default:
			if len(misses) < 3 {
				misses = append(misses, dim.criterion.Detail)
			}
		}
	}

	var parts []string
	if confidence == ConfidenceLow {
		parts = append(parts, "Limited profile data")
	}
	switch {
	case len(matches) > 0:
		parts = append(parts, joinClauses(matches))
	case len(misses) > 0:
		parts = append(parts, joinClauses(misses))
	default:
		parts = append(parts, "Add target roles, skills, and locations to see a fit score")
	}
	if needsVisa {
		parts = append(parts, "this job does not offer visa sponsorship")
	}
	return finishSentence(strings.Join(parts, ". "))
}

func joinClauses(items []string) string {
	switch len(items) {
	case 0:
		return ""
	case 1:
		return items[0]
	case 2:
		return items[0] + " and " + uncapitalize(items[1])
	default:
		return items[0] + ", " + uncapitalize(items[1]) + ", and " + uncapitalize(items[2])
	}
}

func uncapitalize(value string) string {
	if value == "" {
		return value
	}
	runes := []rune(value)
	first := runes[0]
	if first >= 'A' && first <= 'Z' {
		runes[0] = first + ('a' - 'A')
	}
	return string(runes)
}

func finishSentence(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return value
	}
	if strings.HasSuffix(value, ".") {
		return value
	}
	return value + "."
}

func clipReason(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return value
	}
	if utf8.RuneCountInString(value) <= maxReasonRunes {
		return value
	}
	runes := []rune(value)
	clipped := strings.TrimSpace(string(runes[:maxReasonRunes]))
	return strings.TrimRight(clipped, " .,;:") + "…"
}

func clipPhrase(value string) string {
	value = strings.TrimSpace(value)
	const max = 48
	if utf8.RuneCountInString(value) <= max {
		return value
	}
	runes := []rune(value)
	return strings.TrimSpace(string(runes[:max])) + "…"
}

// WithReason replaces Result.Reason when the rewrite is non-empty.
func WithReason(result Result, reason string) Result {
	reason = clipReason(reason)
	if reason == "" {
		return result
	}
	result.Reason = reason
	return result
}
