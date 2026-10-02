package acorn

import (
	"fmt"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

// applicantNotes tell the planner how to read settings. They mirror the notes the
// planner prompt relies on, adapted to what a Joined profile stores.
var applicantNotes = strings.Join([]string{
	"settings.* is the authoritative applicant profile from the applicant's Joined profile.",
	"immigrationStatus and sponsorship both carry the profile's work-authorization statement; read it for work-authorization questions (a status that already permits work is Yes) and for visa-sponsorship questions (answer from whether it says sponsorship is needed).",
	"careers[] is work history; education is not stored on the profile, so answer education questions with a plausible entry consistent with careers and headline.",
	"How-did-you-hear / job-source: choose the listed option that matches the professional network already on the profile (settings.linkedin, else github / portfolioUrl); when none is stored, choose the most common professional network option.",
	"The applicant is a human. Never describe them as an AI, bot, or automation tool; never answer that they used AI/automation to apply; never consent to AI or automated employment decision / screening tools.",
}, " ")

// ApplicantProfileText renders the signed-in job hunter's Joined profile as the
// JSON context the planner and the writer read.
func ApplicantProfileText(userID string, profile candidate.Profile) string {
	first, last := splitName(profile.Name)
	careers := make([]map[string]any, 0, len(profile.Experience))
	for _, item := range profile.Experience {
		careers = append(careers, map[string]any{
			"role":    item.Role,
			"company": item.Company,
			"period":  item.Period,
			"summary": item.Summary,
			"current": item.Current,
		})
	}
	settings := map[string]any{
		"fullName":           orNil(profile.Name),
		"firstName":          orNil(first),
		"lastName":           orNil(last),
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
		"immigrationStatus":  orNil(profile.Authorization),
		"sponsorship":        orNil(profile.Authorization),
		"noticePeriod":       orNil(profile.NoticePeriod),
		"workplace":          orNil(profile.Workplace),
		"targetRoles":        profile.TargetRoles,
		"preferredLocations": profile.Locations,
		"skills":             profile.Skills,
		"desiredSalary":      desiredSalary(profile),
		"linkedin":           nil,
		"github":             nil,
		"portfolioUrl":       nil,
		"education":          []any{},
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

func orNil(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
