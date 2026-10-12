package resumeread

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/sid0709/Joined/backend-core/metrics"
)

// Model is the language model that reads résumés: one JSON object per request, matching a schema.
type Model interface {
	JSON(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error)
}

const (
	// readTimeout bounds one model read of a résumé.
	readTimeout = 60 * time.Second
	// maxReadRunes is the most résumé text sent to the model; a résumé is a few pages.
	maxReadRunes = 40000
	// maxHighlights is the most bullets kept from one role.
	maxHighlights = 20
)

var (
	//go:embed prompts/read_resume_system.txt
	readSystem string
	//go:embed prompts/read_resume_schema.json
	readSchema []byte
)

// read is what the model found in a résumé.
type read struct {
	FullName   string   `json:"fullName"`
	FirstName  string   `json:"firstName"`
	MiddleName string   `json:"middleName"`
	LastName   string   `json:"lastName"`
	Headline   string   `json:"headline"`
	Summary    string   `json:"summary"`
	Skills     []string `json:"skills"`
	Email      string   `json:"email"`
	Phone      string   `json:"phone"`
	City       string   `json:"city"`
	State      string   `json:"state"`
	Country    string   `json:"country"`
	Linkedin   string   `json:"linkedin"`
	Github     string   `json:"github"`
	Portfolio  string   `json:"portfolio"`
	Experience []struct {
		Title      string   `json:"title"`
		Company    string   `json:"company"`
		Location   string   `json:"location"`
		StartMonth string   `json:"startMonth"`
		StartYear  string   `json:"startYear"`
		EndMonth   string   `json:"endMonth"`
		EndYear    string   `json:"endYear"`
		Current    bool     `json:"current"`
		Highlights []string `json:"highlights"`
	} `json:"experience"`
	Education []struct {
		Degree     string `json:"degree"`
		Field      string `json:"field"`
		School     string `json:"school"`
		Location   string `json:"location"`
		StartMonth string `json:"startMonth"`
		StartYear  string `json:"startYear"`
		EndMonth   string `json:"endMonth"`
		EndYear    string `json:"endYear"`
	} `json:"education"`
}

// readResume asks the model for the résumé's facts.
func readResume(ctx context.Context, model Model, text string) (read, error) {
	ctx, cancel := context.WithTimeout(ctx, readTimeout)
	defer cancel()
	runes := []rune(strings.TrimSpace(text))
	if len(runes) > maxReadRunes {
		runes = runes[:maxReadRunes]
	}
	raw, err := model.JSON(metrics.EnsureFeature(ctx, metrics.FeatureResume), readSystem, "Résumé:\n\n"+string(runes), readSchema)
	if err != nil {
		return read{}, fmt.Errorf("read résumé: %w", err)
	}
	var out read
	if err := json.Unmarshal(raw, &out); err != nil {
		return read{}, fmt.Errorf("read résumé: model returned non-JSON output: %w", err)
	}
	return out, nil
}

// apply lays what the model read over the layout parser's result. The model wins
// where it found something. Contact details it returns that the text does not
// contain are dropped, so a guessed email or phone never reaches an application.
func (r read) apply(doc Resume, text string) Resume {
	flat := strings.ToLower(strings.Join(strings.Fields(text), " "))
	if r.FullName != "" || r.FirstName != "" {
		full := r.FullName
		if full == "" {
			full = strings.Join(strings.Fields(r.FirstName+" "+r.MiddleName+" "+r.LastName), " ")
		}
		doc = withName(doc, full, r.FirstName, r.MiddleName, r.LastName)
	}
	setIf(&doc.Headline, r.Headline)
	setIf(&doc.Summary, r.Summary)
	if skills := dedupeFold(r.Skills); len(skills) > 0 {
		doc.Skills = skills
	}
	if r.Email != "" && strings.Contains(flat, strings.ToLower(r.Email)) {
		doc.Email = r.Email
	}
	if r.Phone != "" && strings.Contains(digits(text), digits(r.Phone)) {
		doc.Phone = r.Phone
	}
	setIf(&doc.City, r.City)
	if r.State != "" {
		doc.State = stateChoice(r.State)
	}
	if r.Country != "" {
		doc.Country = countryAsWritten(r.Country)
	} else if r.City != "" && len(doc.State) == 2 {
		doc.Country = unitedStates
	}
	if found := linkedinURL(r.Linkedin); found != "" {
		doc.Linkedin = found
	}
	if found := githubURL(r.Github); found != "" {
		doc.Github = found
	}
	if site := otherURL(withScheme(r.Portfolio)); site != "" {
		doc.Portfolio = site
	}
	if timeline := r.timeline(); len(timeline) > 0 {
		doc.Timeline = timeline
	}
	return doc
}

func (r read) timeline() []Entry {
	var entries []Entry
	for _, job := range r.Experience {
		if strings.TrimSpace(job.Title) == "" && strings.TrimSpace(job.Company) == "" {
			continue
		}
		highlights := job.Highlights
		if len(highlights) > maxHighlights {
			highlights = highlights[:maxHighlights]
		}
		entry := Entry{
			Kind: sectionExperience, Title: job.Title, Org: job.Company, Location: job.Location,
			Summary:    strings.Join(trimAll(highlights), "\n"),
			StartMonth: month(job.StartMonth), StartYear: year(job.StartYear), Current: job.Current,
		}
		if !job.Current {
			entry.EndMonth, entry.EndYear = month(job.EndMonth), year(job.EndYear)
		}
		entries = append(entries, entry)
	}
	for _, school := range r.Education {
		if strings.TrimSpace(school.School) == "" && strings.TrimSpace(school.Degree) == "" {
			continue
		}
		entries = append(entries, Entry{
			Kind: sectionEducation, Title: strings.TrimSpace(school.Degree), Field: credentialField(school.Degree, school.Field),
			Org: school.School, Location: school.Location,
			StartMonth: month(school.StartMonth), StartYear: year(school.StartYear),
			EndMonth: month(school.EndMonth), EndYear: year(school.EndYear),
		})
	}
	for i := range entries {
		entries[i].ID = fmt.Sprintf("resume-%d", i)
	}
	if len(entries) > maxTimeline {
		entries = entries[:maxTimeline]
	}
	return entries
}

// credentialField is the subject, unless the degree already names it ("BS Computer Science").
func credentialField(degree, field string) string {
	field = strings.TrimSpace(field)
	if field == "" || strings.Contains(strings.ToLower(degree), strings.ToLower(field)) {
		return ""
	}
	return field
}

func month(value string) string { return trimMonth(strings.TrimSpace(value)) }

func year(value string) string {
	value = strings.TrimSpace(value)
	if n, err := strconv.Atoi(value); err != nil || n < 1900 || n > 2100 {
		return ""
	}
	return value
}

func setIf(target *string, value string) {
	if value = strings.TrimSpace(value); value != "" {
		*target = value
	}
}

func trimAll(values []string) []string {
	var out []string
	for _, value := range values {
		if text, _ := stripBullet(value); text != "" {
			out = append(out, text)
		}
	}
	return out
}

func digits(value string) string {
	return strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, value)
}

func withScheme(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || strings.HasPrefix(strings.ToLower(value), "http") {
		return value
	}
	return "https://" + value
}
