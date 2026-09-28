package scout

import (
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/sid0709/OpenSeat/opened-backend/internal/jobschema"
)

// Input limits for a submission. The summary is a short structured note in the
// scout's words, never the copied description (docs/14 compliance rule).
const (
	MinSummaryChars  = 40
	MaxSummaryChars  = 420
	minNameChars     = 2
	maxCompanyChars  = 120
	maxTitleChars    = 160
	maxLocationChars = 120
	maxSalaryChars   = 80
	maxTags          = 8
	maxTagChars      = 24
	maxSkills        = 12
	maxSkillChars    = 40
	maxExternalRef   = 120
)

var externalRefPattern = regexp.MustCompile(`^[A-Za-z0-9._:\-/]+$`)

// Limits is published to clients so forms and docs never hardcode them.
type Limits struct {
	MinSummaryChars int      `json:"min_summary_chars"`
	MaxSummaryChars int      `json:"max_summary_chars"`
	MaxTags         int      `json:"max_tags"`
	MaxSkills       int      `json:"max_skills"`
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
		MaxTags:         maxTags,
		MaxSkills:       maxSkills,
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
	if in.Pay.Max > 0 && in.Pay.Min > in.Pay.Max {
		problems.add("pay", "the maximum must be at least the minimum")
	}
	if label := salaryLabel(in.Pay); label != "" {
		in.SalaryText = label
	}
	in.ExternalRef = strings.TrimSpace(in.ExternalRef)

	lengthRule(problems, "company_name", in.CompanyName, minNameChars, maxCompanyChars)
	lengthRule(problems, "title", in.Title, minNameChars, maxTitleChars)
	lengthRule(problems, "location_text", in.LocationText, 0, maxLocationChars)
	lengthRule(problems, "salary", in.SalaryText, 0, maxSalaryChars)
	lengthRule(problems, "summary", in.Summary, MinSummaryChars, MaxSummaryChars)
	if in.ExternalRef != "" && (len(in.ExternalRef) > maxExternalRef || !externalRefPattern.MatchString(in.ExternalRef)) {
		problems.add("external_ref", "use up to 120 letters, digits, and . _ : - /")
	}

	in.Tags = cleanTags(problems, in.Tags)
	in.Skills = cleanSkills(problems, in.Skills)

	hints := in.LocationText + " " + strings.Join(in.Tags, " ")
	in.Workplace = pick(problems, "workplace", in.Workplace, InputLimits().Workplaces, jobschema.WorkplaceFromHint(hints))
	in.Employment = pick(problems, "employment", in.Employment, InputLimits().Employments, jobschema.EmploymentFromHint(hints+" "+in.Title))
	in.Seniority = pickSeniority(problems, in.Seniority, jobschema.SeniorityFromHint(in.Title))

	return in, parsed, problems.orNil()
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

func pick(problems *ValidationError, field, value string, allowed []string, fallback string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return fallback
	}
	for _, option := range allowed {
		if value == option {
			return value
		}
	}
	problems.add(field, "must be one of "+strings.Join(allowed, ", "))
	return fallback
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

func cleanTags(problems *ValidationError, tags []string) []string {
	out := []string{}
	seen := map[string]struct{}{}
	for _, tag := range tags {
		tag = Slug(tag)
		if tag == "" {
			continue
		}
		if utf8.RuneCountInString(tag) > maxTagChars {
			problems.add("tags", "each tag must be at most "+strconv.Itoa(maxTagChars)+" characters")
			return out
		}
		if _, ok := seen[tag]; ok {
			continue
		}
		seen[tag] = struct{}{}
		out = append(out, tag)
	}
	if len(out) > maxTags {
		problems.add("tags", "use at most "+strconv.Itoa(maxTags)+" tags")
		return out[:maxTags]
	}
	return out
}

func cleanSkills(problems *ValidationError, skills []string) []string {
	out := []string{}
	seen := map[string]struct{}{}
	for _, skill := range skills {
		skill = clean(skill)
		if skill == "" {
			continue
		}
		if utf8.RuneCountInString(skill) > maxSkillChars {
			problems.add("skills", "each skill must be at most "+strconv.Itoa(maxSkillChars)+" characters")
			return out
		}
		key := strings.ToLower(skill)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, skill)
	}
	if len(out) > maxSkills {
		problems.add("skills", "use at most "+strconv.Itoa(maxSkills)+" skills")
		return out[:maxSkills]
	}
	return out
}
