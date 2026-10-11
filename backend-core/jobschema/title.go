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
	// A role's head noun. A bare workplace word between two phrases that each
	// carry one is where a scraper glued the next posting on.
	titleRoleHead = regexp.MustCompile(`(?i)\b(engineer|developer|manager|designer|scientist|analyst|architect|lead|specialist|consultant|director|administrator|nurse|representative|executive|technician|coordinator|officer|associate|intern)s?\b`)
	// A bare workplace word right after the head noun ends the role too
	// ("Staff Engineer Remote").
	titleEndsWithRole = regexp.MustCompile(`(?i)\b(engineer|developer|manager|designer|scientist|analyst|architect|lead|specialist|consultant|director|administrator|nurse|representative|executive|technician|coordinator|officer|associate|intern)s?$`)
	titleWorkplace    = regexp.MustCompile(`(?i)\s+(remote|hybrid|on-?site)\b`)
	// Postings glued without a space: a head noun or workplace word running
	// straight into a capitalized word ("EngineerPython/Typescript", "FDEHybridGolang").
	titleCamelGlue = regexp.MustCompile(`(?i:engineer|developer|manager|designer|scientist|analyst|architect|specialist|consultant|director)s?[A-Z]|[a-zA-Z](Remote|Hybrid|Onsite)`)
	titleGenderTag = regexp.MustCompile(`(?i)\s*\(?\b[mwfdhx]/[mwfdhx](/[mwfdhx])?\b\)?`)
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
	if clean, ok := plainTitle(title); ok {
		return clean
	}
	return cleanTitleRules(title)
}

// cleanTitleRules is the full rule set behind CleanTitle.
func cleanTitleRules(title string) string {
	original := strings.TrimSpace(titleSpaces.ReplaceAllString(title, " "))
	if original == "" {
		return ""
	}
	text := titleGlue.ReplaceAllString(original, "")
	text = titleBoilerplate.ReplaceAllString(text, "")
	segments := maxTitleSegments
	if unglued := cutGluedPosting(cutAtStrayParen(cutCamelGlue(text))); unglued != text {
		// A glued posting leaves junk in every later segment: keep the role alone.
		text, segments = unglued, 1
	}
	text = titleGenderTag.ReplaceAllString(text, "")
	text = titleParens.ReplaceAllStringFunc(text, func(group string) string {
		inner := strings.TrimSpace(titleParens.FindStringSubmatch(group)[1])
		if inner == "" || titleNoise.MatchString(inner) {
			return ""
		}
		return group
	})
	text = dropUnbalancedParens(text)

	kept := make([]string, 0, segments)
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
		if len(kept) == segments {
			break
		}
	}
	cleaned := strings.Trim(titleSpaces.ReplaceAllString(strings.Join(kept, " - "), " "), titleEdgePunct)
	if cleaned == "" {
		cleaned = strings.Trim(original, titleEdgePunct)
	}
	return capRunes(cleaned, MaxCleanTitleRunes)
}

// titleSpecials are the characters every cleaning rule keys on.
const titleSpecials = "|•·-–—()*=#~_$:/\t\n"

// titleBoilerplateWords start the board boilerplate CleanTitle strips, and
// titleWorkplaceWords the glued postings titleRoleThenWorkplace cuts.
var (
	titleBoilerplateWords = []string{"job details", "apply now", "apply today", "hiring now", "urgent"}
	titleWorkplaceWords   = []string{" remote", " hybrid", " onsite", " on-site"}
)

// plainTitle is the fast path for a title with nothing to clean: no separators,
// parentheses, symbols, or boilerplate, and short enough. Most titles are; they
// skip every regex. ok is false when the full rules must run.
func plainTitle(title string) (string, bool) {
	trimmed := strings.TrimSpace(title)
	if strings.ContainsAny(trimmed, titleSpecials) || strings.Contains(trimmed, "  ") ||
		utf8.RuneCountInString(trimmed) > MaxCleanTitleRunes || hasCamelJoin(trimmed) {
		return "", false
	}
	lower := strings.ToLower(trimmed)
	for _, words := range [][]string{titleBoilerplateWords, titleWorkplaceWords} {
		for _, word := range words {
			if strings.Contains(lower, word) {
				return "", false
			}
		}
	}
	return strings.Trim(trimmed, titleEdgePunct), true
}

// cutGluedPosting ends the title at a bare workplace word that joins two
// postings: the role before it ends there, or another role follows it
// ("Senior Software Engineer, Growth Remote Software Engineer React …").
// "Geospatial Remote Sensing Analyst" has no role before the word and is kept.
func cutGluedPosting(text string) string {
	for _, loc := range titleWorkplace.FindAllStringIndex(text, -1) {
		prefix, suffix := text[:loc[0]], text[loc[1]:]
		if strings.Count(prefix, "(") != strings.Count(prefix, ")") || !titleRoleHead.MatchString(prefix) {
			continue
		}
		if titleEndsWithRole.MatchString(prefix) || titleRoleHead.MatchString(suffix) {
			return prefix
		}
	}
	return text
}

// hasCamelJoin reports a lowercase letter followed by a capital, the mark of
// postings glued without a space ("iOS" and "DevOps" also qualify; the full
// rules keep them).
func hasCamelJoin(text string) bool {
	for i := 1; i < len(text); i++ {
		if text[i] >= 'A' && text[i] <= 'Z' && text[i-1] >= 'a' && text[i-1] <= 'z' {
			return true
		}
	}
	return false
}

// cutCamelGlue ends the title where a posting runs into the next with no space.
func cutCamelGlue(text string) string {
	loc := titleCamelGlue.FindStringSubmatchIndex(text)
	if loc == nil {
		return text
	}
	if loc[2] >= 0 {
		// Workplace word glued on: cut before it.
		return strings.TrimSpace(text[:loc[2]])
	}
	// Head noun followed by a capital: keep the noun, cut the capital.
	return strings.TrimSpace(text[:loc[1]-1])
}

// cutAtStrayParen ends the title at a ")" that never opened: past it is the tail
// of another posting, glued on by a scraper.
func cutAtStrayParen(text string) string {
	open := 0
	for i, r := range text {
		switch r {
		case '(':
			open++
		case ')':
			if open == 0 {
				return strings.TrimSpace(text[:i])
			}
			open--
		}
	}
	return text
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
