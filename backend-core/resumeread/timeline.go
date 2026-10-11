package resumeread

import (
	"fmt"
	"strings"
)

const (
	// maxBeforeLines and maxAfterLines bound how far an entry header reaches from its dates.
	maxBeforeLines = 3
	maxAfterLines  = 2
	// headerPieces is a title and an organization; a place rides along on top.
	headerPieces = 2
)

// anchor is a dated line: the start of one role or school.
type anchor struct {
	index   int
	dates   dates
	parts   []string
	section string
	block   int
	first   int // first line of the header, which may sit above the dates
	last    int // last line of the header, which may sit below the dates
}

// block is the run of lines under one heading.
type block struct {
	start, end int
	section    string
}

// timelineFrom reads roles and schools without assuming one résumé layout. Each
// dated line anchors an entry; the section's first entry shows whether titles and
// organizations sit on, above, or below the dates, and the rest follow that layout.
func timelineFrom(lines []string) []Entry {
	blocks := blocksOf(lines)
	anchors := anchorsIn(lines, blocks)
	if len(anchors) == 0 {
		return nil
	}
	claimed := map[int]bool{}
	above := map[int]bool{}
	for b := range blocks {
		above[b] = layoutAbove(lines, blocks[b], anchors)
	}
	for i := range anchors {
		a := &anchors[i]
		claimed[a.index] = true
		if above[a.block] {
			reachAbove(lines, blocks[a.block], a, claimed)
		}
	}
	for i := range anchors {
		reachBelow(lines, blocks[anchors[i].block], &anchors[i], claimed, above[anchors[i].block])
	}
	var entries []Entry
	for i, a := range anchors {
		end := blocks[a.block].end
		if i+1 < len(anchors) && anchors[i+1].block == a.block {
			end = anchors[i+1].first
		}
		entry := entryFrom(a, bodyText(lines[a.last+1:max(a.last+1, end)]))
		if entry.Title == "" && entry.Org == "" {
			continue
		}
		entry.ID = fmt.Sprintf("resume-%d", len(entries))
		entries = append(entries, entry)
		if len(entries) == maxTimeline {
			break
		}
	}
	return entries
}

// blocksOf cuts the page at its headings. With no experience or education heading
// the whole page is one block, so a plain list of jobs still reads.
func blocksOf(lines []string) []block {
	var blocks []block
	current := block{start: 0, section: sectionNone}
	found := false
	for i, line := range lines {
		section := sectionOf(line)
		if section == sectionNone {
			continue
		}
		current.end = i
		blocks = append(blocks, current)
		current = block{start: i + 1, section: section}
		if section == sectionExperience || section == sectionEducation {
			found = true
		}
	}
	current.end = len(lines)
	blocks = append(blocks, current)
	if !found {
		return []block{{start: 0, end: len(lines), section: sectionNone}}
	}
	return blocks
}

func anchorsIn(lines []string, blocks []block) []anchor {
	var out []anchor
	for b, bl := range blocks {
		if !datedSection(bl.section) || (len(blocks) > 1 && bl.section == sectionNone) {
			continue
		}
		for i := bl.start; i < bl.end; i++ {
			dated, rest, ok := findDates(lines[i], bl.section == sectionEducation)
			// A year inside a bullet or a sentence is not an entry.
			if !ok || bulletLead.MatchString(lines[i]) || len(strings.Fields(rest)) > maxHeaderWords {
				continue
			}
			out = append(out, anchor{index: i, dates: dated, parts: headerParts(rest), section: bl.section, block: b, first: i, last: i})
		}
	}
	return out
}

// datedSection is a section whose dated lines open roles or schools.
func datedSection(section string) bool {
	return section == sectionExperience || section == sectionEducation || section == sectionNone
}

// layoutAbove is true when the block's first entry names its role or school on
// the lines above its dates ("Company / Title / Jan 2020 – Present").
func layoutAbove(lines []string, bl block, anchors []anchor) bool {
	for _, a := range anchors {
		if a.index < bl.start || a.index >= bl.end {
			continue
		}
		return missing(a.parts) > 0 && a.index-1 >= bl.start && headerish(lines[a.index-1])
	}
	return false
}

func reachAbove(lines []string, bl block, a *anchor, claimed map[int]bool) {
	for j := a.index - 1; j >= bl.start && a.index-j <= maxBeforeLines && missing(a.parts) > 0; j-- {
		if claimed[j] || !headerish(lines[j]) {
			return
		}
		a.parts = append(headerParts(lines[j]), a.parts...)
		a.first = j
		claimed[j] = true
	}
}

// reachBelow takes the lines under the dates that finish the header: the
// organization when the dates line had only a title, and a place line.
func reachBelow(lines []string, bl block, a *anchor, claimed map[int]bool, above bool) {
	for k := a.index + 1; k < bl.end && k-a.index <= maxAfterLines; k++ {
		if claimed[k] || !headerish(lines[k]) {
			return
		}
		parts := headerParts(lines[k])
		// A school's degree may sit under its dates ("School / 2014 – 2018 / B.S.").
		degree := a.section == sectionEducation && missing(a.parts) > 0 && isDegree(lines[k])
		if !allPlaces(parts) && !degree && (above || missing(a.parts) == 0) {
			return
		}
		a.parts = append(a.parts, parts...)
		a.last = k
		claimed[k] = true
	}
}

func missing(parts []string) int {
	named := 0
	for _, part := range parts {
		if !isPlace(part) {
			named++
		}
	}
	return max(0, headerPieces-named)
}

func allPlaces(parts []string) bool {
	if len(parts) == 0 {
		return false
	}
	for _, part := range parts {
		if !isPlace(part) {
			return false
		}
	}
	return true
}

func entryFrom(a anchor, summary string) Entry {
	var named, places []string
	for _, part := range a.parts {
		if isPlace(part) {
			places = append(places, part)
		} else {
			named = append(named, part)
		}
	}
	kind := a.section
	if kind != sectionExperience && kind != sectionEducation {
		kind = sectionExperience
		for _, part := range named {
			if schoolWords.MatchString(part) {
				kind = sectionEducation
			}
		}
	}
	entry := Entry{
		Kind:       kind,
		Summary:    summary,
		StartMonth: a.dates.startMonth,
		StartYear:  a.dates.startYear,
		EndMonth:   a.dates.endMonth,
		EndYear:    a.dates.endYear,
		Current:    a.dates.current,
	}
	if len(places) > 0 {
		entry.Location = places[0]
	}
	if kind == sectionEducation {
		entry.Title, entry.Org = credentialAndSchool(named)
	} else {
		entry.Title, entry.Org = titleAndOrg(splitTitleComma(named))
	}
	return entry
}

// splitTitleComma reads a lone "Senior Designer, Brightline Health" as a title
// and an employer. A comma that does not follow a job title ("Tango Health, Inc.") stays.
func splitTitleComma(named []string) []string {
	if len(named) != 1 {
		return named
	}
	title, org, ok := strings.Cut(named[0], ",")
	title, org = strings.TrimSpace(title), strings.TrimSpace(org)
	if !ok || title == "" || org == "" || !roleWords.MatchString(title) {
		return named
	}
	return []string{title, org}
}

// titleAndOrg picks the piece that reads like a job title; the other names the employer.
// With no title words, the first piece is the title, the usual résumé order.
func titleAndOrg(named []string) (string, string) {
	title := -1
	for i, part := range named {
		if roleWords.MatchString(part) {
			title = i
			break
		}
	}
	if title < 0 && len(named) > 0 {
		title = 0
	}
	org := ""
	for i, part := range named {
		if i != title {
			org = part
			break
		}
	}
	if title < 0 {
		return "", org
	}
	return named[title], org
}

func credentialAndSchool(named []string) (string, string) {
	school := -1
	for i, part := range named {
		if schoolWords.MatchString(part) && !isDegree(part) {
			school = i
			break
		}
	}
	var credential []string
	for i, part := range named {
		if i == school {
			continue
		}
		if school < 0 && !isDegree(part) && len(named) > 1 {
			school = i
			continue
		}
		credential = append(credential, part)
	}
	org := ""
	if school >= 0 {
		org = named[school]
	}
	return strings.Join(credential, ", "), org
}

// bodyText is an entry's bullets, one per line. When bullets carry a glyph, an
// unmarked line continues the bullet above it (a wrapped PDF line).
func bodyText(lines []string) string {
	marked := false
	for _, line := range lines {
		if bulletLead.MatchString(line) {
			marked = true
			break
		}
	}
	var out []string
	for _, line := range lines {
		text, isBullet := stripBullet(line)
		if text == "" || sectionOf(line) != sectionNone {
			continue
		}
		if marked && !isBullet && len(out) > 0 {
			out[len(out)-1] += " " + text
			continue
		}
		out = append(out, text)
	}
	return clip(strings.Join(out, "\n"), maxSummary)
}
