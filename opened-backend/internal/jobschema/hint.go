package jobschema

import "strings"

// WorkplaceFromHint reads remote, hybrid, or onsite out of a location or tag.
func WorkplaceFromHint(remote string) string {
	text := strings.ToLower(remote)
	switch {
	case strings.Contains(text, "hybrid"):
		return WorkplaceHybrid
	case strings.Contains(text, "remote"):
		return WorkplaceRemote
	default:
		return WorkplaceOnsite
	}
}

// SeniorityFromHint maps a title or level hint onto the five-tier scale.
// Staff and Principal are individual-contributor titles above Senior, so they
// land on Leader, same as Lead. Manager, Director, and Head of are people-management.
func SeniorityFromHint(value string) string {
	text := strings.ToLower(value)
	switch {
	case strings.Contains(text, "manager"), strings.Contains(text, "director"), strings.Contains(text, "head of"), strings.Contains(text, "vp "), strings.Contains(text, "chief"):
		return SeniorityManager
	case strings.Contains(text, "lead"), strings.Contains(text, "staff"), strings.Contains(text, "principal"):
		return SeniorityLeader
	case strings.Contains(text, "junior"), strings.Contains(text, "entry"), strings.Contains(text, "intern"):
		return SeniorityJunior
	case strings.Contains(text, "mid"), strings.Contains(text, "middle"):
		return SeniorityMiddle
	default:
		return SenioritySenior
	}
}

// EmploymentFromHint maps a free-text employment hint onto the job record.
func EmploymentFromHint(value string) string {
	text := strings.ToLower(value)
	switch {
	case strings.Contains(text, "part"):
		return EmploymentPartTime
	case strings.Contains(text, "contract"), strings.Contains(text, "freelance"), strings.Contains(text, "temp"), strings.Contains(text, "intern"):
		return EmploymentContract
	default:
		return EmploymentFullTime
	}
}
