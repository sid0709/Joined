package candidate

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/sid0709/Joined/backend-core/resumeread"
)

// maxName is the longest account name a profile accepts.
const maxName = 80

// unitedStates is the country a US location leaves off ("Austin, TX").
const unitedStates = "United States"

// FillFromResume lays what a résumé says over the stored profile and saves it.
// A field the résumé fills replaces the profile's; one it leaves blank keeps
// the profile's. Experience and education are replaced when the résumé lists any.
func (s *Store) FillFromResume(ctx context.Context, userID string, found resumeread.Resume, now time.Time) (Profile, error) {
	current, err := s.GetProfile(ctx, userID, now)
	if err != nil {
		return Profile{}, err
	}
	return s.PatchProfile(ctx, userID, resumePatch(current, found), now)
}

// resumePatch is the profile patch a résumé makes. Every value is one the patch
// accepts, so an odd phone, link, or date drops that value rather than the fill.
func resumePatch(current Profile, found resumeread.Resume) ProfilePatch {
	var patch ProfilePatch
	if name := clip(found.FullName, maxName); name != "" {
		patch.Name = &name
	}
	if found.FirstName != "" || found.LastName != "" {
		personal := Personal{FirstName: found.FirstName, LastName: found.LastName}
		patch.Personal = &personal
	}
	if phone := resumePhone(found.Phone); phone != "" {
		patch.Phone = &phone
	}
	if headline := clip(found.Headline, maxHeadline); headline != "" {
		patch.Headline = &headline
	}
	if location := clip(resumeLocation(found), maxLocation); location != "" {
		patch.Location = &location
	}
	if about := clip(found.Summary, maxAbout); about != "" {
		patch.About = &about
	}
	if skills := clipList(found.Skills, maxSkills, maxSkill); len(skills) > 0 {
		patch.Skills = &skills
	}
	if links, changed := resumeLinks(current.Links, found); changed {
		patch.Links = &links
	}
	experience, education := resumeTimeline(found.Timeline)
	if len(experience) > 0 {
		patch.Experience = &experience
	}
	if len(education) > 0 {
		patch.Education = &education
	}
	return patch
}

// resumePhone is the phone as written, with dots read as dashes ("415.555.0148").
func resumePhone(value string) string {
	value = strings.ReplaceAll(strings.TrimSpace(value), ".", "-")
	if value == "" || !validPhone(value) {
		return ""
	}
	return value
}

// resumeLocation is "Austin, TX" in the United States and "Toronto, ON, Canada" elsewhere.
func resumeLocation(found resumeread.Resume) string {
	parts := []string{}
	for _, part := range []string{found.City, found.State} {
		if part = strings.TrimSpace(part); part != "" {
			parts = append(parts, part)
		}
	}
	if country := strings.TrimSpace(found.Country); country != "" && (country != unitedStates || len(parts) == 0) {
		parts = append(parts, country)
	}
	return strings.Join(parts, ", ")
}

func resumeLinks(current Links, found resumeread.Resume) (Links, bool) {
	next := current
	changed := false
	for _, field := range []struct {
		value string
		dest  *string
	}{
		{found.Linkedin, &next.LinkedIn},
		{found.Github, &next.GitHub},
		{found.Portfolio, &next.Portfolio},
	} {
		link, err := normalizeLink(field.value)
		if err != nil || link == "" {
			continue
		}
		*field.dest = link
		changed = true
	}
	return next, changed
}

// resumeTimeline splits résumé entries into roles and schools the profile can
// save: a role needs a title and an employer, a school needs its name.
func resumeTimeline(entries []resumeread.Entry) ([]ExperienceItem, []EducationItem) {
	experience := []ExperienceItem{}
	education := []EducationItem{}
	for _, entry := range entries {
		dates := resumeDates(entry)
		if entry.Kind == resumeread.KindEducation {
			school := clip(entry.Org, maxSchool)
			if school == "" || len(education) == maxEducation {
				continue
			}
			education = append(education, EducationItem{
				School:    school,
				Degree:    clip(entry.Title, maxSchool),
				Field:     clip(entry.Field, maxSchool),
				Summary:   clip(entry.Summary, maxText),
				DateRange: dates,
			})
			continue
		}
		role, company := clip(entry.Title, maxEntryName), clip(entry.Org, maxEntryName)
		if role == "" || company == "" || len(experience) == maxExperience {
			continue
		}
		experience = append(experience, ExperienceItem{
			Role:      role,
			Company:   company,
			Summary:   clip(entry.Summary, maxText),
			DateRange: dates,
		})
	}
	return experience, education
}

// resumeDates is the entry's dates, or none when they do not form a valid range.
func resumeDates(entry resumeread.Entry) DateRange {
	dates, err := normalizeRange(DateRange{
		StartMonth: atoi(entry.StartMonth), StartYear: atoi(entry.StartYear),
		EndMonth: atoi(entry.EndMonth), EndYear: atoi(entry.EndYear),
		Current: entry.Current,
	})
	if err != nil {
		return DateRange{Current: entry.Current}
	}
	return dates
}

func atoi(value string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(value))
	return n
}
