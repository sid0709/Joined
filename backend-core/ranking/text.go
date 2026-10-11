// Package ranking is personalized job search: candidate generation from a vector
// index and in-process filters, a feature-based ranker, re-ranking, caching, and
// precomputed feeds. MongoDB stays the source of truth; everything here is derived
// and can be rebuilt from it.
package ranking

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// minStemLength keeps short words ("bus", "gis", "aws") from losing their last letter.
const minStemLength = 5

// stopwords carry no meaning for matching a job to a query or a profile.
var stopwords = map[string]struct{}{
	"a": {}, "an": {}, "and": {}, "the": {}, "of": {}, "for": {}, "to": {}, "in": {}, "on": {},
	"at": {}, "with": {}, "by": {}, "or": {}, "from": {}, "as": {}, "is": {}, "are": {}, "be": {},
	"we": {}, "you": {}, "our": {}, "your": {}, "this": {}, "that": {}, "it": {}, "its": {},
	"job": {}, "jobs": {}, "role": {}, "position": {}, "opening": {}, "hiring": {}, "career": {},
	"new": {}, "team": {}, "work": {}, "who": {}, "will": {}, "can": {}, "all": {}, "per": {},
}

// singleLetterTerms are the one-letter words worth keeping: programming languages.
var singleLetterTerms = map[string]struct{}{"c": {}, "r": {}}

// abbreviations expand shorthand that job titles and queries use interchangeably.
var abbreviations = map[string]string{
	"sr": "senior", "snr": "senior", "jr": "junior", "jnr": "junior",
	"eng": "engineer", "engr": "engineer", "dev": "developer", "devs": "developer",
	"mgr": "manager", "mgmt": "management", "dir": "director", "vp": "vice president",
	"swe": "software engineer", "sde": "software engineer", "sre": "site reliability engineer",
	"ml": "machine learning", "ai": "artificial intelligence", "llm": "large language model",
	"nlp": "natural language processing", "cv": "computer vision",
	"js": "javascript", "ts": "typescript", "k8s": "kubernetes", "golang": "go",
	"pm": "product manager", "ux": "user experience", "ui": "user interface",
	"qa": "quality assurance", "hr": "human resources", "rn": "registered nurse",
	"fe": "frontend", "be": "backend", "fullstack": "full stack", "devops": "devops",
}

// Fold lowercases, strips accents, and turns separators into spaces, keeping the
// characters that are part of technology names (c++, c#, .net, node.js).
func Fold(text string) string {
	decomposed := norm.NFD.String(strings.ToLower(text))
	var out strings.Builder
	out.Grow(len(decomposed))
	for _, r := range decomposed {
		switch {
		case unicode.Is(unicode.Mn, r):
			// Combining accent: drop it so "é" matches "e".
		case unicode.IsLetter(r) || unicode.IsDigit(r) || r == '+' || r == '#' || r == '.':
			out.WriteRune(r)
		default:
			out.WriteByte(' ')
		}
	}
	return strings.Join(strings.Fields(out.String()), " ")
}

// Tokens splits text into matching terms: folded, abbreviations expanded,
// stopwords dropped, and plurals stemmed. The same function runs on jobs,
// profiles, and queries, so all three land on the same terms.
func Tokens(text string) []string {
	fields := strings.Fields(Fold(text))
	out := make([]string, 0, len(fields))
	for _, field := range fields {
		field = strings.Trim(field, ".")
		if field == "" {
			continue
		}
		if expanded, ok := abbreviations[field]; ok {
			for _, part := range strings.Fields(expanded) {
				out = appendTerm(out, part)
			}
			continue
		}
		out = appendTerm(out, field)
	}
	return out
}

func appendTerm(out []string, term string) []string {
	if _, stop := stopwords[term]; stop {
		return out
	}
	if len(term) == 1 {
		if _, keep := singleLetterTerms[term]; !keep {
			return out
		}
	}
	return append(out, stem(term))
}

// stem removes a plural "s" — enough to match "engineers" with "engineer"
// without a full stemmer's surprises on technology names.
func stem(term string) string {
	if len(term) < minStemLength || !strings.HasSuffix(term, "s") {
		return term
	}
	// Technology names (node.js, c#, s3) are spelled exactly; leave them alone.
	if strings.ContainsAny(term, ".+#0123456789") {
		return term
	}
	for _, keep := range []string{"ss", "us", "is", "os", "ics"} {
		if strings.HasSuffix(term, keep) {
			return term
		}
	}
	if strings.HasSuffix(term, "ies") {
		return term[:len(term)-3] + "y"
	}
	return term[:len(term)-1]
}

// Phrase folds text to its terms joined by single spaces, for phrase matching.
func Phrase(text string) string {
	return strings.Join(Tokens(text), " ")
}

// containsPhrase reports whether needle's terms appear in order and adjacent in hay.
func containsPhrase(hay, needle string) bool {
	if needle == "" || hay == "" {
		return false
	}
	return strings.Contains(" "+hay+" ", " "+needle+" ")
}
