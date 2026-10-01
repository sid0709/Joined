// Package jobschema is the Go view of packages/job-schema/enums.json.
// Edit that file and these constants together. enums_test.go fails when they differ.
package jobschema

import "strings"

const (
	WorkplaceRemote = "remote"
	WorkplaceHybrid = "hybrid"
	WorkplaceOnsite = "onsite"

	// SeniorityLeader is the lead tier: staff, principal, and lead titles.
	// The label people see is "Lead". The stored value stays Leader so existing jobs match.
	SeniorityJunior  = "Junior"
	SeniorityMiddle  = "Middle"
	SenioritySenior  = "Senior"
	SeniorityLeader  = "Leader"
	SeniorityManager = "Manager"

	EmploymentFullTime = "full-time"
	EmploymentContract = "contract"
	EmploymentPartTime = "part-time"

	PayYear = "year"
	PayHour = "hour"

	CurrencyUSD = "USD"
	CurrencyEUR = "EUR"
	CurrencyGBP = "GBP"
	CurrencyCAD = "CAD"
)

func Workplaces() []string {
	return []string{WorkplaceRemote, WorkplaceHybrid, WorkplaceOnsite}
}

func Seniorities() []string {
	return []string{SeniorityJunior, SeniorityMiddle, SenioritySenior, SeniorityLeader, SeniorityManager}
}

func Employments() []string {
	return []string{EmploymentFullTime, EmploymentContract, EmploymentPartTime}
}

func PayPeriods() []string {
	return []string{PayYear, PayHour}
}

func Currencies() []string {
	return []string{CurrencyUSD, CurrencyEUR, CurrencyGBP, CurrencyCAD}
}

func CanonicalCurrency(value string) string {
	code := strings.ToUpper(strings.TrimSpace(value))
	for _, currency := range Currencies() {
		if currency == code {
			return currency
		}
	}
	return CurrencyUSD
}

// seniorityAliases folds older scout values and any casing onto the job record.
var seniorityAliases = map[string]string{
	"entry":   SeniorityJunior,
	"junior":  SeniorityJunior,
	"mid":     SeniorityMiddle,
	"middle":  SeniorityMiddle,
	"senior":  SenioritySenior,
	"lead":    SeniorityLeader,
	"leader":  SeniorityLeader,
	"manager": SeniorityManager,
}

// CanonicalSeniority maps a free-text or legacy level onto the job-record value.
func CanonicalSeniority(value string) (string, bool) {
	mapped, ok := seniorityAliases[strings.ToLower(strings.TrimSpace(value))]
	return mapped, ok
}

// MaxBenefits is how many benefits a company page lists. Each is its own category with one line.
const MaxBenefits = 12

// Other is the catch-all in every company enum.
const Other = "Other"

// Industries are the company industries a page can pick.
func Industries() []string {
	return []string{
		"Accounting",
		"Advertising",
		"Agriculture",
		"Architecture",
		"Construction",
		"Consulting",
		"Education",
		"Energy",
		"Entertainment",
		"Finance",
		"Food",
		"Government",
		"Healthcare",
		"Hospitality",
		"Insurance",
		"Legal",
		"Manufacturing",
		"Media",
		"Nonprofit",
		"Real estate",
		"Retail",
		"Software",
		"Telecommunications",
		"Transportation",
		"Other",
	}
}

// CompanyTypes are the company types a page can pick.
func CompanyTypes() []string {
	return []string{
		"Private",
		"Public",
		"Nonprofit",
		"Government",
		"Educational",
		"Partnership",
		"Cooperative",
		"Other",
	}
}

// CompanySizes are the headcount bands a page can pick.
func CompanySizes() []string {
	return []string{
		"1–10",
		"11–50",
		"51–200",
		"201–500",
		"501–1,000",
		"1,001–5,000",
		"5,000+",
		"Other",
	}
}

// ValueIcons are the icons a company value can use.
func ValueIcons() []string {
	return []string{
		"heart",
		"star",
		"users",
		"check",
		"sparkle",
		"home",
		"pin",
		"code",
		"seat",
		"chat",
	}
}

// CanonicalChoice returns the listed spelling of value, ignoring case and outer spaces.
func CanonicalChoice(value string, options []string) (string, bool) {
	value = strings.TrimSpace(value)
	for _, option := range options {
		if strings.EqualFold(option, value) {
			return option, true
		}
	}
	return "", false
}

// CanonicalOrOther is CanonicalChoice for the company enums: a blank stays blank and
// anything not on the list becomes Other.
func CanonicalOrOther(value string, options []string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	if choice, ok := CanonicalChoice(value, options); ok {
		return choice
	}
	return Other
}
