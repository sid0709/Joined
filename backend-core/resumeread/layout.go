package resumeread

import (
	"regexp"
	"strings"
	"unicode"
)

// Section kinds a résumé heading can open.
const (
	sectionNone       = ""
	sectionExperience = "role"
	sectionEducation  = "education"
	sectionSummary    = "summary"
	sectionSkills     = "skills"
	sectionOther      = "other"
)

const (
	// maxHeadingWords keeps a sentence that mentions "experience" from reading as a heading.
	maxHeadingWords = 5
	// maxHeaderWords and maxHeaderRunes bound a line that names a role, school, or place.
	maxHeaderWords = 12
	maxHeaderRunes = 100
)

// Heading vocabulary. A short line made of these words opens a section; anything
// else on the page is content.
var (
	experienceHeading = regexp.MustCompile(`(?i)\b(experience|employment|work history|career history|professional background|positions held)\b`)
	educationHeading  = regexp.MustCompile(`(?i)\b(education|academic|academics|qualifications|degrees?)\b`)
	summaryHeading    = regexp.MustCompile(`(?i)\b(summary|profile|objective|about( me)?)\b`)
	skillsHeading     = regexp.MustCompile(`(?i)\b(skills|competencies|technologies|tech stack|toolbox)\b`)
	otherHeading      = regexp.MustCompile(`(?i)\b(projects|certifications?|licenses|awards|honors|publications|languages|interests|hobbies|volunteer(ing)?|contact|references|achievements|highlights|leadership|activities|courses|coursework|training)\b`)
)

// Words that mark a part of an entry header as a job title, a credential, or a school.
var (
	roleWords   = regexp.MustCompile(`(?i)\b(engineer|engineering|developer|programmer|manager|director|lead|architect|analyst|consultant|designer|scientist|intern|specialist|administrator|admin|officer|head|president|vp|founder|co-founder|owner|tester|technician|coordinator|associate|principal|staff|sde|swe|devops|sre|researcher|assistant|contractor|freelancer?|chief|cto|ceo|cfo|coo|supervisor|representative|executive|strategist|advisor|instructor|teacher|professor|fellow|member of technical staff)\b`)
	degreeWords = regexp.MustCompile(`(?i)\b(bachelor'?s?|master'?s?|doctor|doctorate|ph\.?\s?d|mba|diploma|degree|certificate|associate'?s?|major|minor)\b`)
	// degreeShort is "B.S.", "BS", "M.Sc", "BEng": capitals only, so "as" and "me" stay words.
	degreeShort = regexp.MustCompile(`\b[BMA]\.?\s?(?:S|A|Sc|Eng|E|Ed|FA|BA|Tech)\.?(?:[\s,)]|$)`)
	schoolWords = regexp.MustCompile(`(?i)\b(university|universidad|université|universität|college|institute|school|academy|polytechnic|conservatory|iit|mit)\b`)
	bulletLead  = regexp.MustCompile(`^\s*(?:[•●○◦▪▫■□►▸➢➤✓✔·*]|-\s|–\s|o\s)\s*`)
	// partSplit separates the pieces of an entry header: title, organization, place.
	partSplit = regexp.MustCompile(`\t+|\s{2,}|\s+[|•·▪—–]\s+|\s+-\s+|\s+@\s+`)
)

func sectionOf(line string) string {
	trimmed := strings.Trim(strings.TrimSpace(line), ":")
	words := strings.Fields(trimmed)
	// "Languages: Go, Python" is a labeled line, not a heading.
	if len(words) == 0 || len(words) > maxHeadingWords || strings.ContainsAny(trimmed, "0123456789@:") || bulletLead.MatchString(line) {
		return sectionNone
	}
	if !headingCase(words) {
		return sectionNone
	}
	switch {
	case experienceHeading.MatchString(trimmed):
		return sectionExperience
	case educationHeading.MatchString(trimmed):
		return sectionEducation
	case skillsHeading.MatchString(trimmed):
		return sectionSkills
	case summaryHeading.MatchString(trimmed):
		return sectionSummary
	case otherHeading.MatchString(trimmed):
		return sectionOther
	default:
		return sectionNone
	}
}

// headingCase is true for "EXPERIENCE", "Work Experience", and "Education & training":
// every significant word starts with a capital, or the line is all capitals.
func headingCase(words []string) bool {
	for _, word := range words {
		first := []rune(word)[0]
		if unicode.IsLetter(first) && !unicode.IsUpper(first) && !isConnector(word) {
			return false
		}
	}
	return true
}

func isConnector(word string) bool {
	switch strings.ToLower(word) {
	case "and", "of", "&", "the", "in", "for", "at", "to":
		return true
	}
	return false
}

// headerish is a line short enough to name a role, organization, or place,
// not a sentence or a bullet.
func headerish(line string) bool {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || bulletLead.MatchString(line) || emailPattern.MatchString(trimmed) {
		return false
	}
	if strings.HasSuffix(trimmed, ".") && !strings.HasSuffix(trimmed, "Inc.") && !strings.HasSuffix(trimmed, "Ltd.") && !strings.HasSuffix(trimmed, "Co.") {
		return false
	}
	words := strings.Fields(trimmed)
	return len(words) <= maxHeaderWords && len([]rune(strings.Join(words, " "))) <= maxHeaderRunes
}

// headerParts splits an entry header into its pieces. A trailing ", City, ST"
// inside one piece becomes a piece of its own.
func headerParts(line string) []string {
	var out []string
	for _, part := range partSplit.Split(line, -1) {
		part = strings.Trim(strings.TrimSpace(part), ",;|•·")
		if part == "" {
			continue
		}
		head, place := splitTrailingPlace(part)
		if head != "" {
			out = append(out, head)
		}
		if place != "" {
			out = append(out, place)
		}
	}
	return out
}

func splitTrailingPlace(part string) (string, string) {
	if isPlace(part) {
		return "", part
	}
	pieces := strings.Split(part, ",")
	for cut := 1; cut < len(pieces); cut++ {
		tail := strings.TrimSpace(strings.Join(pieces[cut:], ","))
		if isPlace(tail) {
			return strings.TrimSpace(strings.Join(pieces[:cut], ",")), tail
		}
	}
	return part, ""
}

func stripBullet(line string) (string, bool) {
	if loc := bulletLead.FindStringIndex(line); loc != nil {
		return strings.TrimSpace(line[loc[1]:]), true
	}
	return strings.TrimSpace(line), false
}

func isDegree(part string) bool {
	return degreeWords.MatchString(part) || degreeShort.MatchString(part)
}
