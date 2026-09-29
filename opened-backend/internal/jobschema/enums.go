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
