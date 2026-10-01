package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

const (
	// DuplicateTitleTopK is how many existing titles the model may pick before
	// descriptions are compared.
	DuplicateTitleTopK = 5
	duplicateTitlePool = 50
)

// DuplicateHit is a live job the model thinks is the same opening.
type DuplicateHit struct {
	JobID   string `json:"job_id"`
	Title   string `json:"title"`
	Company string `json:"company"`
	Reason  string `json:"reason"`
}

// TitleCandidate is one of the Top-K titles the model picked.
type TitleCandidate struct {
	JobID   string `json:"job_id"`
	Title   string `json:"title"`
	Company string `json:"company"`
}

// AnalyzeScoutedResult is Analyze with AI: either a likely duplicate (no
// search record written) or the extracted listing.
type AnalyzeScoutedResult struct {
	Record    *SearchRecord    `json:"record,omitempty"`
	Duplicate *DuplicateHit    `json:"duplicate,omitempty"`
	TopK      []TitleCandidate `json:"top_k,omitempty"`
}

const titleTopKSystem = `You pick existing job titles that could be the same role as a new title.
Use only the titles. Ignore location. Seniority words (Junior, Senior, Staff) do not by themselves make two titles different roles.
Return the ids of up to 5 existing titles that might be the same position. If none could match, return an empty list.`

const titleTopKSchema = `{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "ids": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["ids"]
}`

const samePositionSystem = `You decide whether a new job posting is the same position as an existing listing.
Same position means the same opening a candidate would apply to, not merely a similar job family or a related role on the same team.
Use the new description and the existing summary, responsibilities, and requirements. Return same_position false when they are different jobs.`

const samePositionSchema = `{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "same_position": {"type": "boolean"},
    "job_id": {"type": "string"},
    "reason": {"type": "string"}
  },
  "required": ["same_position", "job_id", "reason"]
}`

type titleTopKReply struct {
	IDs []string `json:"ids"`
}

type samePositionReply struct {
	SamePosition bool   `json:"same_position"`
	JobID        string `json:"job_id"`
	Reason       string `json:"reason"`
}

func parseTitleTopK(payload []byte, known map[string]JobBrief) []TitleCandidate {
	var reply titleTopKReply
	if err := json.Unmarshal(payload, &reply); err != nil {
		return nil
	}
	out := make([]TitleCandidate, 0, DuplicateTitleTopK)
	seen := map[string]struct{}{}
	for _, id := range reply.IDs {
		id = strings.TrimSpace(id)
		brief, ok := known[id]
		if !ok {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, TitleCandidate{JobID: brief.ID, Title: brief.Title, Company: brief.Company})
		if len(out) == DuplicateTitleTopK {
			break
		}
	}
	return out
}

func parseSamePosition(payload []byte, known map[string]JobBrief) (*DuplicateHit, error) {
	var reply samePositionReply
	if err := json.Unmarshal(payload, &reply); err != nil {
		return nil, fmt.Errorf("read same-position compare: %w", err)
	}
	if !reply.SamePosition {
		return nil, nil
	}
	brief, ok := known[strings.TrimSpace(reply.JobID)]
	if !ok {
		return nil, nil
	}
	return &DuplicateHit{
		JobID:   brief.ID,
		Title:   brief.Title,
		Company: brief.Company,
		Reason:  strings.TrimSpace(reply.Reason),
	}, nil
}

func ListingCopy(summary string, responsibilities, requirements []string) string {
	var b strings.Builder
	b.WriteString(strings.TrimSpace(summary))
	writeLines := func(label string, lines []string) {
		if len(lines) == 0 {
			return
		}
		b.WriteString("\n")
		b.WriteString(label)
		b.WriteString(":\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			b.WriteString("- ")
			b.WriteString(line)
			b.WriteString("\n")
		}
	}
	writeLines("Responsibilities", responsibilities)
	writeLines("Requirements", requirements)
	return b.String()
}

func titleTopKPrompt(title string, pool []JobBrief) string {
	var b strings.Builder
	b.WriteString("New title: ")
	b.WriteString(title)
	b.WriteString("\n\nExisting titles:\n")
	for _, brief := range pool {
		b.WriteString("- ")
		b.WriteString(brief.ID)
		b.WriteString(": ")
		b.WriteString(brief.Title)
		b.WriteString("\n")
	}
	return b.String()
}

func descriptionComparePrompt(listing ScoutedListing, top []JobBrief) string {
	var b strings.Builder
	b.WriteString("New title: ")
	b.WriteString(listing.Title)
	b.WriteString("\nNew company: ")
	b.WriteString(listing.CompanyName)
	b.WriteString("\nNew description:\n")
	b.WriteString(truncate(strings.TrimSpace(listing.Summary), maxDescriptionRunes))
	b.WriteString("\n\nExisting listings:\n")
	for _, brief := range top {
		b.WriteString("id: ")
		b.WriteString(brief.ID)
		b.WriteString("\ntitle: ")
		b.WriteString(brief.Title)
		b.WriteString("\ncompany: ")
		b.WriteString(brief.Company)
		b.WriteString("\n")
		b.WriteString(ListingCopy(brief.Summary, brief.Responsibilities, brief.Requirements))
		b.WriteString("\n---\n")
	}
	return b.String()
}

func pairComparePrompt(newTitle, newCompany, newDesc, existTitle, existCompany, existDesc string) string {
	var b strings.Builder
	b.WriteString("New title: ")
	b.WriteString(newTitle)
	b.WriteString("\nNew company: ")
	b.WriteString(newCompany)
	b.WriteString("\nNew description:\n")
	b.WriteString(truncate(strings.TrimSpace(newDesc), maxDescriptionRunes))
	b.WriteString("\n\nExisting title: ")
	b.WriteString(existTitle)
	b.WriteString("\nExisting company: ")
	b.WriteString(existCompany)
	b.WriteString("\nExisting description:\n")
	b.WriteString(truncate(strings.TrimSpace(existDesc), maxDescriptionRunes))
	return b.String()
}

func (s *Store) screenScouted(ctx context.Context, reader ModelReader, listing ScoutedListing) (AnalyzeScoutedResult, error) {
	pool, err := s.TitlePool(ctx, listing.Title, duplicateTitlePool)
	if err != nil {
		return AnalyzeScoutedResult{}, err
	}
	filtered := make([]JobBrief, 0, len(pool))
	for _, brief := range pool {
		if listing.SubmissionID != "" && (brief.SourceRef == listing.SubmissionID || brief.ID == listing.SubmissionID) {
			continue
		}
		filtered = append(filtered, brief)
	}
	if len(filtered) == 0 {
		return AnalyzeScoutedResult{TopK: []TitleCandidate{}}, nil
	}
	payload, err := reader.JSON(ctx, titleTopKSystem, titleTopKPrompt(listing.Title, filtered), json.RawMessage(titleTopKSchema))
	if err != nil {
		return AnalyzeScoutedResult{}, err
	}
	known := map[string]JobBrief{}
	for _, brief := range filtered {
		known[brief.ID] = brief
	}
	top := parseTitleTopK(payload, known)
	result := AnalyzeScoutedResult{TopK: top}
	if len(top) == 0 {
		return result, nil
	}
	byID := make([]JobBrief, 0, len(top))
	topKnown := map[string]JobBrief{}
	for _, candidate := range top {
		brief := known[candidate.JobID]
		byID = append(byID, brief)
		topKnown[brief.ID] = brief
	}
	compared, err := reader.JSON(ctx, samePositionSystem, descriptionComparePrompt(listing, byID), json.RawMessage(samePositionSchema))
	if err != nil {
		return AnalyzeScoutedResult{}, err
	}
	hit, err := parseSamePosition(compared, topKnown)
	if err != nil {
		return AnalyzeScoutedResult{}, err
	}
	result.Duplicate = hit
	return result, nil
}

// CompareSamePosition asks the model whether two postings are the same opening.
func CompareSamePosition(ctx context.Context, reader ModelReader, newTitle, newCompany, newDesc, existID, existTitle, existCompany, existDesc string) (bool, string, error) {
	if reader == nil {
		return false, "", nil
	}
	payload, err := reader.JSON(ctx, samePositionSystem, pairComparePrompt(newTitle, newCompany, newDesc, existTitle, existCompany, existDesc), json.RawMessage(samePositionSchema))
	if err != nil {
		return false, "", err
	}
	known := map[string]JobBrief{}
	if existID != "" {
		known[existID] = JobBrief{ID: existID, Title: existTitle, Company: existCompany}
	}
	var reply samePositionReply
	if err := json.Unmarshal(payload, &reply); err != nil {
		return false, "", fmt.Errorf("read same-position compare: %w", err)
	}
	return reply.SamePosition, strings.TrimSpace(reply.Reason), nil
}
