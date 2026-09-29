package jobs

import (
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/sid0709/OpenSeat/opened-backend/internal/jobschema"
)

const (
	workplaceRemote = jobschema.WorkplaceRemote
	workplaceHybrid = jobschema.WorkplaceHybrid
	workplaceOnsite = jobschema.WorkplaceOnsite

	seniorityJunior  = jobschema.SeniorityJunior
	seniorityMiddle  = jobschema.SeniorityMiddle
	senioritySenior  = jobschema.SenioritySenior
	seniorityLeader  = jobschema.SeniorityLeader
	seniorityManager = jobschema.SeniorityManager

	employmentFullTime = jobschema.EmploymentFullTime
	employmentContract = jobschema.EmploymentContract
	employmentPartTime = jobschema.EmploymentPartTime

	payYear = jobschema.PayYear
	payHour = jobschema.PayHour

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
	Equity           bool     `json:"equity" bson:"equity"`
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
	Description      string   `json:"description,omitempty" bson:"description,omitempty"`
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
	// Salary is the raw, unstructured pay text scraped alongside the listing
	// (e.g. "$120K - $150K a year"). Used only when the LLM extraction found
	// nothing in the description itself.
	Salary string
}

func buildSearchJob(id, companyID, title, company string, posted time.Time, now time.Time, hints listingHints, extracted Extraction) SearchJob {
	job := SearchJob{
		ID:               id,
		CompanyID:        companyID,
		Title:            fallback(strings.TrimSpace(title), "Untitled"),
		Company:          fallback(strings.TrimSpace(company), "Unknown company"),
		Location:         fallback(strings.TrimSpace(extracted.Location), strings.TrimSpace(hints.Location), "Location not listed"),
		Workplace:        oneOf(extracted.Workplace, []string{workplaceRemote, workplaceHybrid, workplaceOnsite}, workplaceFromHint(hints.Remote)),
		Pay:              normalizePay(extracted.Pay, hints.Salary),
		Seniority:        oneOf(extracted.Seniority, []string{seniorityJunior, seniorityMiddle, senioritySenior, seniorityLeader, seniorityManager}, seniorityFromHint(hints.Seniority)),
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

// keepScoutFilled leaves salary and other scout-entered facts on the record.
// The model still writes About / What you'll do / requirements / benefits.
func keepScoutFilled(job SearchJob, listing tempListing) SearchJob {
	if listing.Source != ScoutedSource && listing.CompanyPublicID == "" {
		return job
	}
	details := listing.Metadata.Details
	if loc := strings.TrimSpace(details.Location); loc != "" {
		job.Location = loc
	}
	if hint := strings.TrimSpace(details.Remote); hint != "" {
		job.Workplace = oneOf(hint, []string{workplaceRemote, workplaceHybrid, workplaceOnsite}, workplaceFromHint(hint))
	}
	if hint := strings.TrimSpace(details.Seniority); hint != "" {
		job.Seniority = oneOf(hint, []string{seniorityJunior, seniorityMiddle, senioritySenior, seniorityLeader, seniorityManager}, seniorityFromHint(hint))
	}
	if hint := strings.TrimSpace(details.Time); hint != "" {
		job.Employment = oneOf(hint, []string{employmentFullTime, employmentContract, employmentPartTime}, employmentFromHint(hint))
	}
	if listing.Equity || strings.EqualFold(strings.TrimSpace(details.Salary), "equity") {
		job.Equity = true
		job.Pay = Pay{Currency: jobschema.CurrencyUSD, Period: payYear}
	} else if listing.Pay.Min > 0 || listing.Pay.Max > 0 {
		job.Pay = listing.Pay
		job.Equity = false
	} else if parsed, ok := ParsePayText(details.Salary); ok {
		job.Pay = parsed
		job.Equity = false
	}
	if listing.CompanyPublicID != "" {
		job.CompanyID = listing.CompanyPublicID
	}
	if name := strings.TrimSpace(listing.CompanyName); name != "" {
		job.Company = name
	}
	if title := strings.TrimSpace(listing.Title); title != "" {
		job.Title = title
	}
	if skills := cleanList(listing.Skills, maxSkills); len(skills) > 0 {
		job.Skills = skills
	}
	for _, tag := range listing.Tags {
		if strings.EqualFold(strings.TrimSpace(tag), tagVisa) {
			job.Visa = true
			break
		}
	}
	if listing.Source != "" {
		job.Source = listing.Source
	}
	return job
}

func hoursSince(posted, now time.Time) int {
	if posted.IsZero() || now.Before(posted) {
		return 0
	}
	return int(now.Sub(posted).Hours())
}

// normalizePay prefers the LLM's read of the full description. When that came back
// empty (the description didn't mention pay, or the model missed it), it falls back
// to parsing whatever raw salary text was scraped alongside the listing — so a job
// isn't marked "not listed" just because the description itself was silent on it.
func normalizePay(pay extractedPay, salaryHint string) Pay {
	if pay.Min == 0 && pay.Max == 0 {
		if hinted, ok := payFromHint(salaryHint); ok {
			pay = hinted
		}
	}
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
		currency = jobschema.CurrencyUSD
	}
	period := pay.Period
	if period != payYear && period != payHour {
		period = payYear
	}
	return Pay{Min: minValue, Max: maxValue, Currency: currency, Period: period}
}

var payHintPattern = regexp.MustCompile(
	`(?i)([$€£])?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:-|to|–|—)\s*([$€£])?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(/\s*(?:hr|hour)|per\s*hour|/\s*(?:yr|year))?`,
)

var currencySymbols = map[string]string{"$": "USD", "€": "EUR", "£": "GBP"}

// payFromHint recovers a min/max range from loose scraped text such as
// "$120K - $150K a year" or "$45 - $60 / hr". Returns ok=false when nothing
// resembling a range is found, leaving the job's pay at zero ("not listed").
func payFromHint(text string) (extractedPay, bool) {
	match := payHintPattern.FindStringSubmatch(text)
	if match == nil {
		return extractedPay{}, false
	}
	symbol := fallback(match[1], match[4])
	min := parsePayNumber(match[2], match[3] != "")
	max := parsePayNumber(match[5], match[6] != "")
	if min == 0 && max == 0 {
		return extractedPay{}, false
	}
	period := payYear
	if strings.Contains(strings.ToLower(match[7]), "hr") || strings.Contains(strings.ToLower(match[7]), "hour") {
		period = payHour
	}
	currency, ok := currencySymbols[symbol]
	if !ok {
		currency = jobschema.CurrencyUSD
	}
	return extractedPay{Min: min, Max: max, Currency: currency, Period: period}, true
}

// ParsePayText reads a pay range from loose text ("$120K - $150K a year").
// ok is false when no range is found.
func ParsePayText(text string) (Pay, bool) {
	hinted, ok := payFromHint(text)
	if !ok {
		return Pay{}, false
	}
	return normalizePay(hinted, ""), true
}

func parsePayNumber(raw string, thousands bool) float64 {
	cleaned := strings.ReplaceAll(raw, ",", "")
	value, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0
	}
	if thousands {
		value *= 1000
	}
	return value
}

func workplaceFromHint(remote string) string {
	return jobschema.WorkplaceFromHint(remote)
}

// seniorityFromHint maps a free-text title/level hint onto the five-tier scale.
// Staff and Principal land on Leader, same as Lead. Manager is the people-management tier.
func seniorityFromHint(value string) string {
	return jobschema.SeniorityFromHint(value)
}

func employmentFromHint(value string) string {
	return jobschema.EmploymentFromHint(value)
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
