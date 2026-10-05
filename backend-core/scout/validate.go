package scout

import (
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

// Input limits for a submission. The description is the posting text staff
// analyze into a search record. It matches the description length the job
// analyzer reads (backend-core/jobs maxDescriptionRunes).
const (
	MinSummaryChars  = 40
	MaxSummaryChars  = 12_000
	minNameChars     = 2
	maxCompanyChars  = 120
	maxTitleChars    = 160
	maxLocationChars = 120
	maxSalaryChars   = 80
	maxBoardChars    = 80
	maxExternalRef   = 120
)

var externalRefPattern = regexp.MustCompile(`^[A-Za-z0-9._:\-/]+$`)

// Limits is published to clients so forms and docs never hardcode them.
type Limits struct {
	MinSummaryChars int      `json:"min_summary_chars"`
	MaxSummaryChars int      `json:"max_summary_chars"`
	MaxBatch        int      `json:"max_batch"`
	Workplaces      []string `json:"workplaces"`
	Employments     []string `json:"employments"`
	Seniorities     []string `json:"seniorities"`
}

// InputLimits returns the submission limits.
func InputLimits() Limits {
	return Limits{
		MinSummaryChars: MinSummaryChars,
		MaxSummaryChars: MaxSummaryChars,
		MaxBatch:        MaxBatchSize,
		Workplaces:      jobschema.Workplaces(),
		Employments:     jobschema.Employments(),
		Seniorities:     jobschema.Seniorities(),
	}
}

// NormalizeInput trims and validates a submission, filling defaults the
// structured job record needs. It returns every field problem at once.
func NormalizeInput(in SubmissionInput) (SubmissionInput, ParsedURL, error) {
	problems := &ValidationError{}
	in.URL = strings.TrimSpace(in.URL)
	parsed, err := ParseJobURL(in.URL)
	if err != nil {
		problems.add("url", err.Error())
	}

	in.CompanyName = clean(in.CompanyName)
	in.CompanyID = strings.TrimSpace(in.CompanyID)
	in.Title = clean(in.Title)
	in.LocationText = clean(in.LocationText)
	in.SalaryText = clean(in.SalaryText)
	in.Summary = strings.TrimSpace(in.Summary)
	in.Pay = canonicalPay(in.Pay, in.SalaryText)
	if in.Equity {
		in.Pay.Min = 0
		in.Pay.Max = 0
		in.SalaryText = ""
	} else {
		switch {
		case in.Pay.Min <= 0 || in.Pay.Max <= 0:
			problems.add("pay", "salary from and salary to are required")
		case in.Pay.Min > in.Pay.Max:
			problems.add("pay", "the maximum must be at least the minimum")
		default:
			in.SalaryText = salaryLabel(in.Pay)
		}
	}
	in.ExternalRef = strings.TrimSpace(in.ExternalRef)

	lengthRule(problems, "company_name", in.CompanyName, minNameChars, maxCompanyChars)
	lengthRule(problems, "title", in.Title, minNameChars, maxTitleChars)
	lengthRule(problems, "location_text", in.LocationText, minNameChars, maxLocationChars)
	lengthRule(problems, "salary", in.SalaryText, 0, maxSalaryChars)
	lengthRule(problems, "summary", in.Summary, MinSummaryChars, MaxSummaryChars)
	if in.ExternalRef != "" && (len(in.ExternalRef) > maxExternalRef || !externalRefPattern.MatchString(in.ExternalRef)) {
		problems.add("external_ref", "use up to 120 letters, digits, and . _ : - /")
	}

	in.Workplace = requireOne(problems, "workplace", in.Workplace, InputLimits().Workplaces)
	in.Employment = requireOne(problems, "employment", in.Employment, InputLimits().Employments)
	in.Seniority = pickSeniority(problems, in.Seniority, jobschema.SeniorityFromHint(in.Title))

	return in, parsed, problems.orNil()
}

// NormalizeExtensionInput validates and normalizes the step-13 captured job shape from the Scout extension.
func NormalizeExtensionInput(in ExtensionSubmissionInput) (ExtensionSubmissionInput, error) {
	problems := &ValidationError{}
	in.Title = clean(in.Title)
	in.Company = clean(in.Company)
	in.Location = clean(in.Location)
	in.ApplyURL = strings.TrimSpace(in.ApplyURL)
	in.Description = strings.TrimSpace(in.Description)
	in.Board = strings.TrimSpace(in.Board)

	if _, err := ParseJobURL(in.ApplyURL); err != nil {
		problems.add("apply_url", err.Error())
	}

	lengthRule(problems, "title", in.Title, minNameChars, maxTitleChars)
	lengthRule(problems, "company", in.Company, minNameChars, maxCompanyChars)
	lengthRule(problems, "location", in.Location, minNameChars, maxLocationChars)
	lengthRule(problems, "description", in.Description, MinSummaryChars, MaxSummaryChars)
	if in.Board != "" {
		lengthRule(problems, "board", in.Board, 0, maxBoardChars)
	}

	return in, problems.orNil()
}

func clean(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func lengthRule(problems *ValidationError, field, value string, minChars, maxChars int) {
	count := utf8.RuneCountInString(value)
	switch {
	case minChars > 0 && count == 0:
		problems.add(field, "required")
	case count < minChars:
		problems.add(field, "must be at least "+strconv.Itoa(minChars)+" characters")
	case count > maxChars:
		problems.add(field, "must be at most "+strconv.Itoa(maxChars)+" characters")
	}
}

func requireOne(problems *ValidationError, field, value string, allowed []string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		problems.add(field, "required")
		return ""
	}
	for _, option := range allowed {
		if value == option {
			return value
		}
	}
	problems.add(field, "must be one of "+strings.Join(allowed, ", "))
	return ""
}

func pickSeniority(problems *ValidationError, value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	if canonical, ok := jobschema.CanonicalSeniority(value); ok {
		return canonical
	}
	problems.add("seniority", "must be one of "+strings.Join(jobschema.Seniorities(), ", "))
	return fallback
}
