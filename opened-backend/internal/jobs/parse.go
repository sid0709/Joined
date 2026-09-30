package jobs

import (
	"context"
	"encoding/json"
	"strings"
	"unicode/utf8"

	"github.com/sid0709/OpenSeat/opened-backend/internal/jobschema"
	"github.com/sid0709/OpenSeat/opened-backend/internal/openai"
)

const minPostedDescription = 40

const postedParsePrompt = `You turn a pasted job description into a structured Opened job draft.
Use only facts in the text. Do not invent salary, visa sponsorship, a team, or a location.
Write a short original summary in one or two sentences. Do not paste the description.
title is the role title.
team is the hiring team or department, or an empty string.
skills are concrete tools or domains, at most 12.
responsibilities and requirements are short phrases, at most 6 each.
If visa sponsorship is not explicitly offered, set visa to false.
Only set pay min and max to 0 when the description gives no usable number.`

const postedParseSchema = `{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "title": {"type": "string"},
    "location": {"type": "string"},
    "workplace": {"type": "string", "enum": ["remote", "hybrid", "onsite"]},
    "pay": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "min": {"type": "number"},
        "max": {"type": "number"},
        "currency": {"type": "string"},
        "period": {"type": "string", "enum": ["year", "hour"]}
      },
      "required": ["min", "max", "currency", "period"]
    },
    "seniority": {"type": "string", "enum": ["Junior", "Middle", "Senior", "Leader", "Manager"]},
    "visa": {"type": "boolean"},
    "team": {"type": "string"},
    "skills": {"type": "array", "items": {"type": "string"}},
    "summary": {"type": "string"},
    "responsibilities": {"type": "array", "items": {"type": "string"}},
    "requirements": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["title", "location", "workplace", "pay", "seniority", "visa", "team", "skills", "summary", "responsibilities", "requirements"]
}`

// PostedJobDraft is a company job filled from a pasted description. Nothing is published.
type PostedJobDraft struct {
	Title            string   `json:"title"`
	Team             string   `json:"team"`
	Seniority        string   `json:"seniority"`
	Location         string   `json:"location"`
	Workplace        string   `json:"workplace"`
	PayMin           int      `json:"payMin"`
	PayMax           int      `json:"payMax"`
	Currency         string   `json:"currency"`
	Visa             bool     `json:"visa"`
	Summary          string   `json:"summary"`
	Skills           []string `json:"skills"`
	Responsibilities []string `json:"responsibilities"`
	Requirements     []string `json:"requirements"`
	Description      string   `json:"description"`
}

type postedParse struct {
	Title            string       `json:"title"`
	Location         string       `json:"location"`
	Workplace        string       `json:"workplace"`
	Pay              extractedPay `json:"pay"`
	Seniority        string       `json:"seniority"`
	Visa             bool         `json:"visa"`
	Team             string       `json:"team"`
	Skills           []string     `json:"skills"`
	Summary          string       `json:"summary"`
	Responsibilities []string     `json:"responsibilities"`
	Requirements     []string     `json:"requirements"`
}

// ParsePostedJob fills a company job draft from a pasted description.
func ParsePostedJob(ctx context.Context, reader ModelReader, companyName, text string) (PostedJobDraft, error) {
	description := truncate(strings.TrimSpace(text), maxDescriptionRunes)
	if utf8.RuneCountInString(description) < minPostedDescription {
		return PostedJobDraft{}, ErrInvalidInput
	}
	if reader == nil {
		return PostedJobDraft{}, openai.ErrMissingAPIKey
	}
	payload, err := reader.JSON(ctx, postedParsePrompt, postedParseUser(companyName, description), json.RawMessage(postedParseSchema))
	if err != nil {
		return PostedJobDraft{}, err
	}
	var parsed postedParse
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return PostedJobDraft{}, err
	}
	pay := normalizePay(parsed.Pay, "")
	return PostedJobDraft{
		Title:            strings.TrimSpace(parsed.Title),
		Team:             strings.TrimSpace(parsed.Team),
		Seniority:        oneOf(parsed.Seniority, []string{seniorityJunior, seniorityMiddle, senioritySenior, seniorityLeader, seniorityManager}, seniorityMiddle),
		Location:         strings.TrimSpace(parsed.Location),
		Workplace:        oneOf(parsed.Workplace, []string{workplaceRemote, workplaceHybrid, workplaceOnsite}, workplaceHybrid),
		PayMin:           pay.Min,
		PayMax:           pay.Max,
		Currency:         jobschema.CanonicalCurrency(pay.Currency),
		Visa:             parsed.Visa,
		Summary:          truncate(strings.TrimSpace(parsed.Summary), maxSummaryRunes),
		Skills:           cleanList(parsed.Skills, maxSkills),
		Responsibilities: cleanList(parsed.Responsibilities, maxBullets),
		Requirements:     cleanList(parsed.Requirements, maxBullets),
		Description:      description,
	}, nil
}

func postedParseUser(companyName, description string) string {
	var b []byte
	b = append(b, "Company: "...)
	b = append(b, strings.TrimSpace(companyName)...)
	b = append(b, "\n\nDescription:\n"...)
	b = append(b, description...)
	return string(b)
}
