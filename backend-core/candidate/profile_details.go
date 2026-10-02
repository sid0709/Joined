package candidate

import (
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	maxEducation  = 10
	maxNamePart   = 40
	maxSchool     = 80
	maxChoice     = 40
	maxLink       = 200
	maxPeriodText = 40

	minAge  = 14
	maxAge  = 100
	minYear = 1940
	maxYear = 2100

	// presentLabel ends the period of a role or school that has not ended.
	presentLabel = "Present"
)

func itemID(id string) (string, error) {
	if id != "" {
		return id, nil
	}
	return newPublicID()
}

func normalizeEducation(items []EducationItem) ([]EducationItem, error) {
	if len(items) > maxEducation {
		return nil, ErrInvalidInput
	}
	out := make([]EducationItem, 0, len(items))
	for _, item := range items {
		school := clip(item.School, maxSchool)
		if school == "" {
			return nil, ErrInvalidInput
		}
		id, err := itemID(item.ID)
		if err != nil {
			return nil, err
		}
		dates, err := normalizeRange(item.DateRange)
		if err != nil {
			return nil, err
		}
		out = append(out, EducationItem{
			ID:        id,
			School:    school,
			Degree:    clip(item.Degree, maxSchool),
			Field:     clip(item.Field, maxSchool),
			Period:    periodOf(dates, item.Period),
			Summary:   clip(item.Summary, maxText),
			DateRange: dates,
		})
	}
	return out, nil
}

// normalizeRange checks a date range: months 1-12 with a year, an end no earlier
// than the start, and no end at all while it is current.
func normalizeRange(dates DateRange) (DateRange, error) {
	if dates.Current {
		dates.EndMonth, dates.EndYear = 0, 0
	}
	if !validMonthYear(dates.StartMonth, dates.StartYear) || !validMonthYear(dates.EndMonth, dates.EndYear) {
		return DateRange{}, ErrInvalidInput
	}
	if dates.StartYear > 0 && dates.EndYear > 0 &&
		dates.EndYear*12+dates.EndMonth < dates.StartYear*12+dates.StartMonth {
		return DateRange{}, ErrInvalidInput
	}
	return dates, nil
}

func validMonthYear(month, year int) bool {
	if month < 0 || month > 12 {
		return false
	}
	if year == 0 {
		return month == 0
	}
	return year >= minYear && year <= maxYear
}

// periodOf renders the dates as "Jan 2022 – Present". Without a start year the
// free-text period an older entry was saved with stands.
func periodOf(dates DateRange, fallback string) string {
	if dates.StartYear == 0 {
		return clip(fallback, maxPeriodText)
	}
	start := monthYear(dates.StartMonth, dates.StartYear)
	switch {
	case dates.Current:
		return start + " – " + presentLabel
	case dates.EndYear > 0:
		return start + " – " + monthYear(dates.EndMonth, dates.EndYear)
	default:
		return start
	}
}

func monthYear(month, year int) string {
	if month == 0 {
		return fmt.Sprint(year)
	}
	return time.Month(month).String()[:3] + " " + fmt.Sprint(year)
}

func normalizePersonal(personal Personal) (Personal, error) {
	if personal.Age != 0 && (personal.Age < minAge || personal.Age > maxAge) {
		return Personal{}, ErrInvalidInput
	}
	return Personal{
		FirstName:   clip(personal.FirstName, maxNamePart),
		LastName:    clip(personal.LastName, maxNamePart),
		Age:         personal.Age,
		Gender:      clip(personal.Gender, maxChoice),
		Pronouns:    clip(personal.Pronouns, maxChoice),
		Orientation: clip(personal.Orientation, maxChoice),
		Citizenship: clip(personal.Citizenship, maxChoice),
	}, nil
}

func normalizeLinks(links Links) (Links, error) {
	out := Links{}
	for _, field := range []struct {
		value string
		dest  *string
	}{
		{links.LinkedIn, &out.LinkedIn},
		{links.GitHub, &out.GitHub},
		{links.Portfolio, &out.Portfolio},
	} {
		link, err := normalizeLink(field.value)
		if err != nil {
			return Links{}, err
		}
		*field.dest = link
	}
	return out, nil
}

// normalizeLink accepts an http(s) URL, adding https:// when the scheme is left off.
func normalizeLink(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if !strings.Contains(value, "://") {
		value = "https://" + value
	}
	parsed, err := url.Parse(value)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || len(value) > maxLink {
		return "", ErrInvalidInput
	}
	return value, nil
}

func normalizeDisclosures(disclosures Disclosures) Disclosures {
	return Disclosures{
		HispanicLatino: clip(disclosures.HispanicLatino, maxChoice),
		Race:           clip(disclosures.Race, maxChoice),
		Sponsorship:    clip(disclosures.Sponsorship, maxChoice),
		Disability:     clip(disclosures.Disability, maxChoice),
		Veteran:        clip(disclosures.Veteran, maxChoice),
	}
}
