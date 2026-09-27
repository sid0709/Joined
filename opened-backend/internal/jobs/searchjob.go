package jobs

import (
	"strings"
	"time"
	"unicode/utf8"
)

const (
	workplaceRemote = "remote"
	workplaceHybrid = "hybrid"
	workplaceOnsite = "onsite"

	seniorityJunior = "Junior"
	seniorityMid    = "Mid"
	senioritySenior = "Senior"
	seniorityLead   = "Lead"

	employmentFullTime = "full-time"
	employmentContract = "contract"
	employmentPartTime = "part-time"

	payYear = "year"
	payHour = "hour"

	aggregatedSource = "aggregated"

	maxSkills           = 12
	maxBullets          = 6
	maxSummaryRunes     = 420
	maxDescriptionRunes = 12_000
)

// SearchJob is the record Opened job search reads.
// Field names match opened-frontend/lib/jobs/types.ts.
type SearchJob struct {
	ID               string   `json:"id" bson:"id"`
	Title            string   `json:"title" bson:"title"`
	Company          string   `json:"company" bson:"company"`
	CompanyID        string   `json:"companyId" bson:"companyId"`
	Location         string   `json:"location" bson:"location"`
	Workplace        string   `json:"workplace" bson:"workplace"`
	Pay              Pay      `json:"pay" bson:"pay"`
	Seniority        string   `json:"seniority" bson:"seniority"`
	Employment       string   `json:"employment" bson:"employment"`
	PostedHoursAgo   int      `json:"postedHoursAgo" bson:"postedHoursAgo"`
	Source           string   `json:"source" bson:"source"`
	Visa             bool     `json:"visa" bson:"visa"`
	Applicants       int      `json:"applicants" bson:"applicants"`
	Team             string   `json:"team" bson:"team"`
	Skills           []string `json:"skills" bson:"skills"`
	Summary          string   `json:"summary" bson:"summary"`
	Responsibilities []string `json:"responsibilities" bson:"responsibilities"`
	Requirements     []string `json:"requirements" bson:"requirements"`
	Benefits         []string `json:"benefits" bson:"benefits"`
}

type Pay struct {
	Min      int    `json:"min" bson:"min"`
	Max      int    `json:"max" bson:"max"`
	Currency string `json:"currency" bson:"currency"`
	Period   string `json:"period" bson:"period"`
}

// Extraction is the part of a search record that comes from the job description.
type Extraction struct {
	Location         string       `json:"location"`
	Workplace        string       `json:"workplace"`
	Pay              extractedPay `json:"pay"`
	Seniority        string       `json:"seniority"`
	Employment       string       `json:"employment"`
	Visa             bool         `json:"visa"`
	Team             string       `json:"team"`
	Skills           []string     `json:"skills"`
	Summary          string       `json:"summary"`
	Responsibilities []string     `json:"responsibilities"`
	Requirements     []string     `json:"requirements"`
	Benefits         []string     `json:"benefits"`
}

type extractedPay struct {
	Min      float64 `json:"min"`
	Max      float64 `json:"max"`
	Currency string  `json:"currency"`
	Period   string  `json:"period"`
}

type listingHints struct {
	Location   string
	Remote     string
	Seniority  string
	Employment string
}

func buildSearchJob(id, companyID, title, company string, posted time.Time, now time.Time, hints listingHints, extracted Extraction) SearchJob {
	job := SearchJob{
		ID:               id,
		CompanyID:        companyID,
		Title:            fallback(strings.TrimSpace(title), "Untitled"),
		Company:          fallback(strings.TrimSpace(company), "Unknown company"),
		Location:         fallback(strings.TrimSpace(extracted.Location), strings.TrimSpace(hints.Location), "Location not listed"),
		Workplace:        oneOf(extracted.Workplace, []string{workplaceRemote, workplaceHybrid, workplaceOnsite}, workplaceFromHint(hints.Remote)),
		Pay:              normalizePay(extracted.Pay),
		Seniority:        oneOf(extracted.Seniority, []string{seniorityJunior, seniorityMid, senioritySenior, seniorityLead}, seniorityFromHint(hints.Seniority)),
		Employment:       oneOf(extracted.Employment, []string{employmentFullTime, employmentContract, employmentPartTime}, employmentFromHint(hints.Employment)),
		PostedHoursAgo:   hoursSince(posted, now),
		Source:           aggregatedSource,
		Visa:             extracted.Visa,
		Applicants:       0,
		Team:             strings.TrimSpace(extracted.Team),
		Skills:           cleanList(extracted.Skills, maxSkills),
		Summary:          truncate(strings.TrimSpace(extracted.Summary), maxSummaryRunes),
		Responsibilities: cleanList(extracted.Responsibilities, maxBullets),
		Requirements:     cleanList(extracted.Requirements, maxBullets),
		Benefits:         cleanList(extracted.Benefits, maxBullets),
	}
	return job
}

func hoursSince(posted, now time.Time) int {
	if posted.IsZero() || now.Before(posted) {
		return 0
	}
	return int(now.Sub(posted).Hours())
}

func normalizePay(pay extractedPay) Pay {
	minValue := int(pay.Min)
	maxValue := int(pay.Max)
	if minValue < 0 {
		minValue = 0
	}
	if maxValue < 0 {
		maxValue = 0
	}
	if minValue > maxValue {
		minValue, maxValue = maxValue, minValue
	}
	currency := strings.ToUpper(strings.TrimSpace(pay.Currency))
	if len(currency) != 3 {
		currency = "USD"
	}
	period := pay.Period
	if period != payYear && period != payHour {
		period = payYear
	}
	return Pay{Min: minValue, Max: maxValue, Currency: currency, Period: period}
}

func workplaceFromHint(remote string) string {
	text := strings.ToLower(remote)
	switch {
	case strings.Contains(text, "hybrid"):
		return workplaceHybrid
	case strings.Contains(text, "remote"):
		return workplaceRemote
	default:
		return workplaceOnsite
	}
}

func seniorityFromHint(value string) string {
	text := strings.ToLower(value)
	switch {
	case strings.Contains(text, "junior"), strings.Contains(text, "entry"), strings.Contains(text, "intern"):
		return seniorityJunior
	case strings.Contains(text, "lead"), strings.Contains(text, "staff"), strings.Contains(text, "principal"), strings.Contains(text, "director"):
		return seniorityLead
	case strings.Contains(text, "mid"):
		return seniorityMid
	default:
		return senioritySenior
	}
}

func employmentFromHint(value string) string {
	text := strings.ToLower(value)
	switch {
	case strings.Contains(text, "part"):
		return employmentPartTime
	case strings.Contains(text, "contract"), strings.Contains(text, "temp"), strings.Contains(text, "intern"):
		return employmentContract
	default:
		return employmentFullTime
	}
}

func oneOf(value string, allowed []string, fallback string) string {
	for _, option := range allowed {
		if value == option {
			return value
		}
	}
	return fallback
}

func cleanList(items []string, limit int) []string {
	if limit < 1 {
		return []string{}
	}
	seen := make(map[string]struct{}, len(items))
	out := make([]string, 0, min(len(items), limit))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		key := strings.ToLower(item)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, item)
		if len(out) == limit {
			break
		}
	}
	return out
}

func fallback(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func truncate(value string, limit int) string {
	if limit < 1 || utf8.RuneCountInString(value) <= limit {
		return value
	}
	runes := []rune(value)
	return strings.TrimSpace(string(runes[:limit]))
}
