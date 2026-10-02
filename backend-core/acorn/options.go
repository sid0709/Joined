package acorn

import (
	"regexp"
	"slices"
	"strings"
)

var (
	dashes       = regexp.MustCompile(`[–—]`)
	spaces       = regexp.MustCompile(`\s+`)
	letterMarker = regexp.MustCompile(`^[a-z]\s*[.)]\s+`)
	digitMarker  = regexp.MustCompile(`^\d+\s*[.)]\s+`)
	nonWord      = regexp.MustCompile(`[^\p{L}\p{N}+]+`)
)

func contains(list []string, value string) bool { return slices.Contains(list, value) }

// optionKey reduces an option to its meaning: no list marker, case, or punctuation.
func optionKey(text string) string {
	text = spaces.ReplaceAllString(text, " ")
	text = dashes.ReplaceAllString(text, "-")
	text = strings.ToLower(strings.TrimSpace(text))
	text = letterMarker.ReplaceAllString(text, "")
	text = digitMarker.ReplaceAllString(text, "")
	text = nonWord.ReplaceAllString(text, " ")
	return strings.TrimSpace(spaces.ReplaceAllString(text, " "))
}

// recoverListedOption maps a near-miss pick back onto the exact listed string, or "".
func recoverListedOption(picked string, list []string) string {
	for _, option := range list {
		if strings.EqualFold(option, picked) {
			return option
		}
	}
	want := optionKey(picked)
	if want == "" {
		return ""
	}
	for _, option := range list {
		if optionKey(option) == want {
			return option
		}
	}
	return ""
}
