package scout

import (
	"html"
	"regexp"
	"strings"
	"unicode"
)

var (
	scriptPattern = regexp.MustCompile(`(?is)<(script|style|noscript|svg|template)[^>]*>.*?</(script|style|noscript|svg|template)>`)
	tagPattern    = regexp.MustCompile(`(?s)<[^>]+>`)
	spacePattern  = regexp.MustCompile(`\s+`)
)

// HTMLText flattens a page to visible text.
func HTMLText(page string) string {
	page = scriptPattern.ReplaceAllString(page, " ")
	page = tagPattern.ReplaceAllString(page, " ")
	page = html.UnescapeString(page)
	return strings.TrimSpace(spacePattern.ReplaceAllString(page, " "))
}

// Phrases employers and ATSs show once a posting stops taking applications.
var closedMarkers = []string{
	"no longer accepting applications",
	"position has been filled",
	"this position is filled",
	"job is no longer available",
	"this job is no longer available",
	"posting has been closed",
	"job posting is closed",
	"this job has expired",
	"job has been closed",
	"the job you are looking for is no longer open",
	"this position is no longer open",
	"no longer open for applications",
}

var applyMarkers = []string{"apply", "submit application", "application form", "bewerben", "postuler"}

// ClosedMarker returns the first closed-posting phrase in text, if any.
func ClosedMarker(text string) string {
	lower := strings.ToLower(text)
	for _, marker := range closedMarkers {
		if strings.Contains(lower, marker) {
			return marker
		}
	}
	return ""
}

// HasApplyMarker reports whether the page offers a way to apply.
func HasApplyMarker(text string) bool {
	lower := strings.ToLower(text)
	for _, marker := range applyMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

// Language that shows up in fake postings: payment requests, off-platform chat, crypto.
var scamPhrases = []string{
	"telegram",
	"whatsapp",
	"signal app",
	"crypto wallet",
	"bitcoin",
	"usdt",
	"pay to apply",
	"application fee",
	"registration fee",
	"training fee",
	"wire transfer",
	"western union",
	"gift card",
	"send your bank details",
	"no interview required",
}

// ScamPhrase returns the first scam phrase found in any of the texts.
func ScamPhrase(texts ...string) string {
	for _, text := range texts {
		lower := strings.ToLower(text)
		for _, phrase := range scamPhrases {
			if strings.Contains(lower, phrase) {
				return phrase
			}
		}
	}
	return ""
}

const shingleSize = 5

// CopiedShare is how much of the summary's word 5-grams also appear on the
// source page. Scouts must write their own summary (docs/14 compliance rule).
func CopiedShare(summary, page string) float64 {
	summaryShingles := shingles(summary)
	if len(summaryShingles) == 0 {
		return 0
	}
	pageShingles := shingles(page)
	if len(pageShingles) == 0 {
		return 0
	}
	shared := 0
	for shingle := range summaryShingles {
		if _, ok := pageShingles[shingle]; ok {
			shared++
		}
	}
	return float64(shared) / float64(len(summaryShingles))
}

func shingles(text string) map[string]struct{} {
	words := strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	out := map[string]struct{}{}
	for i := 0; i+shingleSize <= len(words); i++ {
		out[strings.Join(words[i:i+shingleSize], " ")] = struct{}{}
	}
	return out
}
