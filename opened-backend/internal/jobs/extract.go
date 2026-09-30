package jobs

import (
	"encoding/json"
)

const extractSystemPrompt = `You turn a job description into a structured record for Opened job search.
Use only facts in the listing and description. Do not invent salary, visa sponsorship, benefits, or a team.
Write a short original summary in one or two sentences. Do not paste the description.
Read the whole description for salary, workplace, and location clues, not just a labeled hint field —
a range mentioned in passing ("$120K-$150K"), remote/hybrid/onsite language, or a named city still counts.
Only set pay min and max to 0 when the description truly gives no usable number, even loosely, anywhere.
If visa sponsorship is not explicitly offered, set visa to false.
skills are concrete tools or domains, at most 12.
responsibilities, requirements, and benefits are short phrases, at most 6 each.
team is the hiring team or department, or an empty string.
seniority is a five-tier scale: Junior, Middle, Senior, Leader, Manager.
"Staff" and "Principal" are senior individual-contributor titles one tier above Senior — always Leader, never Senior.
"Manager", "Director", "Head of", and similar people-management titles are Manager, one tier above Leader.`

const extractionSchema = `{
  "type": "object",
  "additionalProperties": false,
  "properties": {
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
    "employment": {"type": "string", "enum": ["full-time", "contract", "part-time"]},
    "visa": {"type": "boolean"},
    "team": {"type": "string"},
    "skills": {"type": "array", "items": {"type": "string"}},
    "summary": {"type": "string"},
    "responsibilities": {"type": "array", "items": {"type": "string"}},
    "requirements": {"type": "array", "items": {"type": "string"}},
    "benefits": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["location", "workplace", "pay", "seniority", "employment", "visa", "team", "skills", "summary", "responsibilities", "requirements", "benefits"]
}`

func listingPrompt(listing tempListing) string {
	var b []byte
	write := func(label, value string) {
		b = append(b, label...)
		b = append(b, value...)
		b = append(b, '\n')
	}
	write("Title: ", listing.Title)
	write("Company: ", listing.CompanyName)
	write("Location hint: ", listing.Metadata.Details.Location)
	write("Workplace hint: ", listing.Metadata.Details.Remote)
	write("Seniority hint: ", listing.Metadata.Details.Seniority)
	write("Employment hint: ", listing.Metadata.Details.Time)
	write("Salary hint: ", listing.Metadata.Details.Salary)
	b = append(b, "\nDescription:\n"...)
	b = append(b, truncate(listing.Description, maxDescriptionRunes)...)
	return string(b)
}

func parseExtraction(payload []byte) (Extraction, error) {
	var extracted Extraction
	if err := json.Unmarshal(payload, &extracted); err != nil {
		return Extraction{}, err
	}
	return extracted, nil
}
