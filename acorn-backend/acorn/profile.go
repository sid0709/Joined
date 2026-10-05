package acorn

import (
	"fmt"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

// applicantNotes tell the planner how to read settings. They mirror the notes the
// planner prompt relies on, adapted to what a Joined profile stores.
var applicantNotes = strings.Join([]string{
	"settings.* is the authoritative applicant profile from the applicant's Acorn account.",
	"immigrationStatus and sponsorship both carry the profile's work-authorization statement; read it for work-authorization questions (a status that already permits work is Yes) and for visa-sponsorship questions (answer from whether it says sponsorship is needed).",
	"careers[] is work history and education[] is schooling, both most recent first; start/end are YYYY-MM (YYYY when the month is unknown) and current entries have no end. When education[] is empty, answer education questions with a plausible entry consistent with careers and headline.",
	"Demographic and voluntary self-identification answers (gender, pronouns, sexualOrientation, hispanicOrLatino, race, disability, veteranStatus) are the applicant's own; \"decline\" means choose that question's own decline / prefer-not-to-say option. A null one is unanswered.",
	"How-did-you-hear / job-source: choose the listed option that matches the professional network already on the profile (settings.linkedin, else github / portfolioUrl); when none is stored, choose the most common professional network option.",
	"The applicant is a human. Never describe them as an AI, bot, or automation tool; never answer that they used AI/automation to apply; never consent to AI or automated employment decision / screening tools.",
}, " ")

// ApplicantProfileText renders the signed-in Acorn account as the JSON context
// the planner and the writer read.
func ApplicantProfileText(userID string, profile candidate.Profile) string {
	first, last := splitName(profile.Name)
	personal := profile.Personal
	careers := make([]map[string]any, 0, len(profile.Experience))
	for _, item := range profile.Experience {
		careers = append(careers, withDates(map[string]any{
			"role":    item.Role,
			"company": item.Company,
			"period":  orNil(item.Period),
			"summary": orNil(item.Summary),
		}, item.DateRange))
	}
	education := make([]map[string]any, 0, len(profile.Education))
	for _, item := range profile.Education {
		education = append(education, withDates(map[string]any{
			"school":  item.School,
			"degree":  orNil(item.Degree),
			"field":   orNil(item.Field),
			"period":  orNil(item.Period),
			"summary": orNil(item.Summary),
		}, item.DateRange))
	}
	settings := map[string]any{
		"fullName":           orNil(profile.Name),
		"firstName":          orNil(firstText(personal.FirstName, first)),
		"lastName":           orNil(firstText(personal.LastName, last)),
		"age":                orZero(personal.Age),
		"gender":             orNil(personal.Gender),
		"pronouns":           orNil(personal.Pronouns),
		"sexualOrientation":  orNil(personal.Orientation),
		"citizenship":        orNil(personal.Citizenship),
		"email":              orNil(profile.Email),
		"phone":              orNil(profile.Phone),
		"headline":           orNil(profile.Headline),
		"about":              orNil(profile.About),
		"location":           orNil(profile.Location),
		"address":            orNil(profile.HomeAddress.Line),
		"city":               orNil(profile.HomeAddress.City),
		"state":              orNil(profile.HomeAddress.Region),
		"zipCode":            orNil(profile.HomeAddress.PostalCode),
		"country":            orNil(profile.HomeAddress.Country),
		"immigrationStatus":  orNil(firstText(personal.Citizenship, profile.Authorization)),
		"sponsorship":        orNil(firstText(profile.Disclosures.Sponsorship, profile.Authorization)),
		"hispanicOrLatino":   orNil(profile.Disclosures.HispanicLatino),
		"race":               orNil(profile.Disclosures.Race),
		"disability":         orNil(profile.Disclosures.Disability),
		"veteranStatus":      orNil(profile.Disclosures.Veteran),
		"noticePeriod":       orNil(profile.NoticePeriod),
		"workplace":          orNil(profile.Workplace),
		"targetRoles":        profile.TargetRoles,
		"preferredLocations": profile.Locations,
		"skills":             profile.Skills,
		"desiredSalary":      desiredSalary(profile),
		"linkedin":           orNil(profile.Links.LinkedIn),
		"github":             orNil(profile.Links.GitHub),
		"portfolioUrl":       orNil(profile.Links.Portfolio),
		"education":          education,
		"careers":            careers,
	}
	return indentedJSON(map[string]any{
		"source":   "Joined profile",
		"account":  map[string]any{"id": userID, "name": orNil(profile.Name)},
		"settings": settings,
		"note":     applicantNotes,
	})
}

func desiredSalary(profile candidate.Profile) any {
	if profile.SalaryFloor <= 0 {
		return nil
	}
	return strings.TrimSpace(fmt.Sprintf("%d %s", profile.SalaryFloor, profile.Currency))
}

func splitName(name string) (string, string) {
	fields := strings.Fields(name)
	switch len(fields) {
	case 0:
		return "", ""
	case 1:
		return fields[0], ""
	default:
		return fields[0], fields[len(fields)-1]
	}
}

// withDates adds a role's or school's start, end, and current flag to its entry.
func withDates(entry map[string]any, dates candidate.DateRange) map[string]any {
	entry["start"] = orNil(yearMonth(dates.StartMonth, dates.StartYear))
	entry["end"] = orNil(yearMonth(dates.EndMonth, dates.EndYear))
	entry["current"] = dates.Current
	return entry
}

func yearMonth(month, year int) string {
	switch {
	case year == 0:
		return ""
	case month == 0:
		return fmt.Sprintf("%04d", year)
	default:
		return fmt.Sprintf("%04d-%02d", year, month)
	}
}

func firstText(values ...string) string {
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return ""
}

func orZero(value int) any {
	if value == 0 {
		return nil
	}
	return value
}

func orNil(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
