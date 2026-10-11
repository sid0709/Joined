package jobschema

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

// MaxCleanTitleRunes caps a cleaned title so one posting cannot push a card's layout.
const MaxCleanTitleRunes = 90

// maxTitleSegments is how many " - " / " | " parts of a title survive cleaning.
// The first is the role; the second is often a real team or focus ("- Data Platform").
const maxTitleSegments = 2

var (
	// A run of filler symbols usually glues a second posting onto the first.
	titleGlue = regexp.MustCompile(`\s*[*=#~_]{3,}.*$`)
	// Boilerplate job boards append to the title itself.
	titleBoilerplate = regexp.MustCompile(`(?i)\s*\b(job details|apply now!?|apply today!?|hiring now!?|urgent(ly)? hiring)\b.*$`)
	// Separators between title segments: pipes, bullets, and dashes followed by a space.
	titleSeparator = regexp.MustCompile(`\s+[|•·]\s*|\s*[-–—]+\s+|\s*[|•]\s+`)
	titleParens    = regexp.MustCompile(`\s*\(([^()]*)\)`)
	titleSpaces    = regexp.MustCompile(`\s+`)
	// A segment or parenthetical that only says where, how, or how much — not what the role is.
	titleNoise = regexp.MustCompile(`(?i)^(` +
		`.*\b(remote|hybrid|on-?site|onsite|in-?office|work from home|wfh|telecommute)\b.*|` +
		`.*\blocation:.*|` +
		`.*\$\s?\d.*|.*\d+\s?k\b.*|` +
		`.*\b\d+\+?\s*(years?|yrs?)\b.*|` +
		`.*\b(usc|us citizens?|citizens? only|green card|gc holders?|w2|c2c|c2h|1099|contract to hire|contract-to-hire)\b.*|` +
		`.*\b(full[- ]?time|part[- ]?time|permanent|temporary|temp)\b.*|` +
		`m/w/d|m/f/d|w/m/d|f/m/d|h/f|f/h|all genders?|` +
		`\d+|[A-Z]{2}|` +
		`(usa?|united states|canada|uk|emea|apac|latam|europe|americas|global|worldwide|anywhere)(\s+only)?` +
		`)$`)
	titleEdgePunct = " \t-–—|/,;:.•·"
)

// CleanTitle strips the location, pay, contract, and board boilerplate that
// aggregated postings pack into a job title, keeping the role and an optional
// team or focus. It never returns an empty string for a non-empty title: when
// everything looks like noise, the original (trimmed and capped) is kept.
func CleanTitle(title string) string {
	original := strings.TrimSpace(titleSpaces.ReplaceAllString(title, " "))
	if original == "" {
		return ""
	}
	text := titleGlue.ReplaceAllString(original, "")
	text = titleBoilerplate.ReplaceAllString(text, "")
	text = titleParens.ReplaceAllStringFunc(text, func(group string) string {
		inner := strings.TrimSpace(titleParens.FindStringSubmatch(group)[1])
		if inner == "" || titleNoise.MatchString(inner) {
			return ""
		}
		return group
	})
	text = dropUnbalancedParens(text)

	kept := make([]string, 0, maxTitleSegments)
	for _, segment := range titleSeparator.Split(text, -1) {
		segment = strings.Trim(segment, titleEdgePunct)
		if segment == "" {
			continue
		}
		if titleNoise.MatchString(segment) {
			// Once the title turns into location or pay, what follows is the same.
			if len(kept) > 0 {
				break
			}
			continue
		}
		kept = append(kept, segment)
		if len(kept) == maxTitleSegments {
			break
		}
	}
	cleaned := strings.Trim(titleSpaces.ReplaceAllString(strings.Join(kept, " - "), " "), titleEdgePunct)
	if cleaned == "" {
		cleaned = strings.Trim(original, titleEdgePunct)
	}
	return capRunes(cleaned, MaxCleanTitleRunes)
}

// dropUnbalancedParens removes parentheses that never close or never opened.
func dropUnbalancedParens(text string) string {
	var out strings.Builder
	open := 0
	for _, r := range text {
		switch r {
		case '(':
			open++
		case ')':
			if open == 0 {
				continue
			}
			open--
		}
		out.WriteRune(r)
	}
	result := out.String()
	for open > 0 {
		i := strings.LastIndexByte(result, '(')
		result = result[:i] + result[i+1:]
		open--
	}
	return result
}

// capRunes cuts at the last word boundary within max runes.
func capRunes(text string, max int) string {
	if utf8.RuneCountInString(text) <= max {
		return text
	}
	runes := []rune(text)
	cut := string(runes[:max])
	if i := strings.LastIndexByte(cut, ' '); i > max/2 {
		cut = cut[:i]
	}
	return strings.Trim(cut, titleEdgePunct)
}
