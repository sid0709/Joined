package resumeread

import (
	"regexp"
	"strings"
)

const (
	// maxSkillRunes and maxSkillWords keep a sentence under a skills heading from reading as a skill.
	maxSkillRunes = 40
	maxSkillWords = 4
	// maxLabelRunes bounds the "Languages:" label a skills line may start with.
	maxLabelRunes = 30
)

// skillSplit separates the skills on one line: commas, bullets, pipes, tabs, wide gaps.
// A slash stays, so "CI/CD" and "UI/UX" read as one skill.
var skillSplit = regexp.MustCompile(`\s*[,;|•·▪●]\s*|\t+|\s{2,}`)

// sectionLines are the lines under every heading of the given kind.
func sectionLines(lines []string, section string) []string {
	var out []string
	current := sectionNone
	for _, line := range lines {
		if found := sectionOf(line); found != sectionNone {
			current = found
			continue
		}
		if current == section {
			out = append(out, line)
		}
	}
	return out
}

// summaryFrom is the text under a summary heading, as one paragraph.
func summaryFrom(lines []string) string {
	var parts []string
	for _, line := range sectionLines(lines, sectionSummary) {
		if text, _ := stripBullet(line); text != "" {
			parts = append(parts, text)
		}
	}
	return clip(strings.Join(parts, " "), maxSummary)
}

// skillsFrom lists the skills under a skills heading. "Languages: Go, Python"
// yields Go and Python; a sentence yields nothing.
func skillsFrom(lines []string) []string {
	var out []string
	for _, line := range sectionLines(lines, sectionSkills) {
		text, _ := stripBullet(line)
		if label, rest, ok := strings.Cut(text, ":"); ok && len([]rune(label)) <= maxLabelRunes {
			text = rest
		}
		for _, part := range skillSplit.Split(text, -1) {
			part = strings.TrimRight(strings.TrimSpace(part), ".")
			if part == "" || len([]rune(part)) > maxSkillRunes || len(strings.Fields(part)) > maxSkillWords {
				continue
			}
			out = append(out, part)
		}
	}
	return dedupeFold(out)
}
