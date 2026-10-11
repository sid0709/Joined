package ranking

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

// SyntheticSource generates n plausible jobs for load tests: titles from the
// taxonomy's families, levels, skills, locations, pay, and posting dates spread
// over two months. The same seed always yields the same catalog.
type SyntheticSource struct {
	N    int
	Seed int64
	Now  time.Time
}

var (
	syntheticLevels    = []string{"", "Junior ", "Senior ", "Staff ", "Lead ", "Principal "}
	syntheticLocations = []string{
		"Remote (US)", "New York, NY", "San Francisco, CA", "Austin, TX", "Seattle, WA", "Chicago, IL",
		"Boston, MA", "Denver, CO", "London, UK", "Berlin, Germany", "Toronto, Ontario", "Remote — Worldwide",
		"Bengaluru, India", "Atlanta, GA", "Los Angeles, CA", "Miami, FL",
	}
	syntheticSkills = []string{
		"Python", "Go", "Java", "TypeScript", "React", "Kubernetes", "AWS", "SQL", "Spark", "PyTorch",
		"LLM", "Figma", "SEO", "Salesforce", "Excel", "Terraform", "Kafka", "Swift", "Kotlin", "GAAP",
	}
	syntheticWorkplaces = []string{jobschema.WorkplaceRemote, jobschema.WorkplaceHybrid, jobschema.WorkplaceOnsite}
	syntheticSeniority  = []string{jobschema.SeniorityJunior, jobschema.SeniorityMiddle, jobschema.SenioritySenior, jobschema.SeniorityLeader, jobschema.SeniorityManager}
)

// syntheticSpan spreads posting dates over this window before Now.
const syntheticSpan = 60 * 24 * time.Hour

// ScanRankingDocs streams the synthetic catalog.
func (s SyntheticSource) ScanRankingDocs(_ context.Context, afterID string, fn func(jobs.RankingDoc) error) error {
	r := rand.New(rand.NewSource(s.Seed))
	families := DefaultTaxonomy().Occupations()
	for i := 0; i < s.N; i++ {
		family := families[r.Intn(len(families))]
		title := syntheticLevels[r.Intn(len(syntheticLevels))] + titleCase(family.Aliases[r.Intn(len(family.Aliases))])
		skills := make([]string, 0, 4)
		for k := 0; k < 2+r.Intn(3); k++ {
			skills = append(skills, syntheticSkills[r.Intn(len(syntheticSkills))])
		}
		pay := 50_000 + r.Intn(250_000)
		doc := jobs.RankingDoc{
			JobID:      fmt.Sprintf("synthetic-%07d", i),
			ObjectID:   fmt.Sprintf("%024x", i+1),
			Title:      title,
			Company:    fmt.Sprintf("Company %d", r.Intn(max(s.N/40, 1))),
			CompanyID:  fmt.Sprintf("co-%d", r.Intn(max(s.N/40, 1))),
			Location:   syntheticLocations[r.Intn(len(syntheticLocations))],
			Workplace:  syntheticWorkplaces[r.Intn(len(syntheticWorkplaces))],
			Seniority:  syntheticSeniority[r.Intn(len(syntheticSeniority))],
			Employment: jobschema.EmploymentFullTime,
			Pay:        jobs.Pay{Min: pay, Max: pay + 30_000, Currency: jobschema.CurrencyUSD, Period: jobschema.PayYear},
			Visa:       r.Intn(5) == 0,
			Skills:     skills,
			Summary:    "Build and run " + family.Title + " work with a small, senior team.",
			Applicants: r.Intn(300),
			Source:     "aggregated",
			PostedAt:   s.Now.Add(-time.Duration(r.Int63n(int64(syntheticSpan)))),
		}
		if afterID != "" && doc.ObjectID <= afterID {
			continue
		}
		if err := fn(doc); err != nil {
			return err
		}
	}
	return nil
}

// CompanySignals gives every synthetic company a middling page.
func (s SyntheticSource) CompanySignals(context.Context) (map[string]float32, error) {
	return map[string]float32{}, nil
}

func titleCase(phrase string) string {
	out := []byte(phrase)
	upper := true
	for i, c := range out {
		if upper && c >= 'a' && c <= 'z' {
			out[i] = c - 'a' + 'A'
		}
		upper = c == ' ' || c == '/' || c == '-'
	}
	return string(out)
}
