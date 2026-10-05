package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

type fakeResearcher struct {
	answer   string
	sources  []string
	err      error
	gotUser  string
	searches int
	plain    int
}

func (f *fakeResearcher) JSONWebSearch(_ context.Context, _, user string, _ json.RawMessage) ([]byte, []string, error) {
	f.searches++
	f.gotUser = user
	return []byte(f.answer), f.sources, f.err
}

func (f *fakeResearcher) JSON(_ context.Context, system, user string, _ json.RawMessage) ([]byte, error) {
	f.plain++
	f.gotUser = system + "\n" + user
	return []byte(f.answer), f.err
}

const researchedAnswer = `{
  "name": "G2i Inc.",
  "website": "https://g2i.example",
  "taglinePhrases": ["Engineering talent", " engineering talent ", "Remote-first", "` + "a very long phrase that goes on and on and on past the limit" + `"],
  "about": "  G2i connects companies with engineers.  ",
  "industry": "software",
  "companyType": "Venture studio",
  "size": "11–50",
  "founded": 2016,
  "headquarters": {"line1": "500 Pine St, Suite 300", "city": "Seattle", "state": "WA", "postalCode": "98101", "country": "USA"},
  "offices": ["Austin, TX", "austin, tx", "Lisbon, Portugal"],
  "specialties": ["Hiring", "React"],
  "mission": "Make hiring fair.",
  "values": [{"icon": "rocket", "title": "Ship it", "description": "Move fast."}, {"icon": "heart", "title": " ", "description": "dropped"}],
  "benefits": [{"category": "Health insurance", "item": "Medical, dental,\n and vision"}, {"category": "Parental leave", "item": "16 weeks paid"}, {"category": "health INSURANCE", "item": "a repeat"}, {"category": "", "item": "no category"}, {"category": "Learning budget", "item": "  "}]
}`

func TestResearchCompanyFillsTheFormAndFollowsTheEnums(t *testing.T) {
	fake := &fakeResearcher{answer: researchedAnswer, sources: []string{"https://g2i.example/about"}}
	got, err := ResearchCompany(context.Background(), fake, "g2i", "https://www.g2i.co")
	if err != nil {
		t.Fatal(err)
	}
	c := got.Company
	if !strings.Contains(fake.gotUser, "g2i") || !strings.Contains(fake.gotUser, "https://www.g2i.co") {
		t.Fatalf("prompt = %q", fake.gotUser)
	}
	if c.URL != "https://www.g2i.co" {
		t.Fatalf("the website the admin entered must stay: %q", c.URL)
	}
	if c.Name != "G2i Inc." || c.About != "G2i connects companies with engineers." || c.Founded != 2016 {
		t.Fatalf("basics = %+v", c)
	}
	if c.Industry != "Software" {
		t.Fatalf("industry = %q", c.Industry)
	}
	if c.CompanyType != jobschema.Other {
		t.Fatalf("an unlisted type should become Other, got %q", c.CompanyType)
	}
	if c.Size != "11–50" {
		t.Fatalf("size = %q", c.Size)
	}
	if c.Tagline != "Engineering talent · Remote-first" {
		t.Fatalf("tagline = %q", c.Tagline)
	}
	if c.Headquarters != "500 Pine St, Suite 300, Seattle, WA 98101, United States" {
		t.Fatalf("headquarters = %q", c.Headquarters)
	}
	if c.Locations != "Seattle, WA · Austin, TX · Lisbon, Portugal" {
		t.Fatalf("locations = %q", c.Locations)
	}
	if len(c.Values) != 1 || c.Values[0].Icon != "star" || c.Values[0].Title != "Ship it" {
		t.Fatalf("values = %+v", c.Values)
	}
	var groups []string
	for _, group := range c.BenefitCategories {
		groups = append(groups, group.Label+": "+strings.Join(group.Items, "|"))
	}
	want := "Health insurance: Medical, dental, and vision; Parental leave: 16 weeks paid"
	if got := strings.Join(groups, "; "); got != want {
		t.Fatalf("benefits = %q\nwant      %q", got, want)
	}
	if len(got.Sources) != 1 {
		t.Fatalf("sources = %v", got.Sources)
	}
	if _, err := overridesFrom(c); err != nil {
		t.Fatalf("the draft must be saveable as is: %v", err)
	}
}

func TestResearchCompanyLeavesUnknownAnswersBlank(t *testing.T) {
	fake := &fakeResearcher{answer: `{"name":"","website":"nope","taglinePhrases":[],"about":"","industry":"","companyType":"","size":"1000 people","founded":99,"headquarters":{"line1":"","city":"","state":"","postalCode":"","country":""},"offices":[],"specialties":[],"mission":"","values":[],"benefits":[]}`}
	got, err := ResearchCompany(context.Background(), fake, "Acme", "")
	if err != nil {
		t.Fatal(err)
	}
	c := got.Company
	if c.Name != "Acme" || c.Industry != "" || c.CompanyType != "" || c.Size != "" || c.Founded != 0 || c.URL != "" || c.Headquarters != "" {
		t.Fatalf("draft = %+v", c)
	}
}

func TestResearchCompanyChecksItsInputAndPassesErrorsOn(t *testing.T) {
	if _, err := ResearchCompany(context.Background(), &fakeResearcher{}, "  ", ""); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("blank input: %v", err)
	}
	if _, err := ResearchCompany(context.Background(), &fakeResearcher{}, "Acme", "not a link"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad website: %v", err)
	}
	if _, err := ResearchCompany(context.Background(), nil, "Acme", ""); !errors.Is(err, ErrMissingResearcher) {
		t.Fatalf("no researcher: %v", err)
	}
	boom := errors.New("boom")
	if _, err := ResearchCompany(context.Background(), &fakeResearcher{err: boom}, "Acme", ""); !errors.Is(err, boom) {
		t.Fatalf("model error: %v", err)
	}
	if _, err := ResearchCompany(context.Background(), &fakeResearcher{answer: "not json"}, "Acme", ""); err == nil {
		t.Fatal("bad JSON was accepted")
	}
}

func TestCompanyResearchSchemaOnlyOffersTheFormsChoices(t *testing.T) {
	var schema struct {
		Required   []string `json:"required"`
		Properties map[string]struct {
			Enum []string `json:"enum"`
		} `json:"properties"`
	}
	if err := json.Unmarshal(companyResearchSchema(), &schema); err != nil {
		t.Fatal(err)
	}
	if len(schema.Required) != len(schema.Properties) {
		t.Fatalf("strict mode needs every property required: %v vs %d", schema.Required, len(schema.Properties))
	}
	want := append([]string{""}, jobschema.Industries()...)
	if got := schema.Properties["industry"].Enum; strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("industry enum = %v", got)
	}
}

func TestResearchCompanyWithoutWebSearchDoesNotSearch(t *testing.T) {
	fake := &fakeResearcher{answer: `{"name":"Acme","website":"","taglinePhrases":[],"about":"Acme builds tools.","industry":"","companyType":"","size":"","founded":0,"headquarters":{"line1":"","city":"","state":"","postalCode":"","country":""},"offices":[],"specialties":[],"mission":"","values":[],"benefits":[]}`}
	got, err := researchCompany(context.Background(), fake, "Acme", "https://acme.example", false)
	if err != nil {
		t.Fatal(err)
	}
	if fake.searches != 0 || fake.plain != 1 {
		t.Fatalf("searches=%d plain=%d", fake.searches, fake.plain)
	}
	if !strings.Contains(fake.gotUser, "Do not browse the web") || strings.Contains(fake.gotUser, "Use web search") {
		t.Fatalf("prompt = %q", fake.gotUser)
	}
	if got.Company.About != "Acme builds tools." || len(got.Sources) != 0 {
		t.Fatalf("draft = %+v", got)
	}
	if got.Company.URL != "https://acme.example" {
		t.Fatalf("url = %q", got.Company.URL)
	}
}

func TestCleanBenefitsGivesEachBenefitItsOwnCategory(t *testing.T) {
	got := cleanBenefits([]benefitCategory{
		{Label: "Talent community", Items: []string{"Mentorship", "Burnout coaching", "mentorship"}},
		{Label: "Health", Items: []string{"Medical"}},
		{Label: " ", Items: []string{"unlabelled"}},
	})
	if len(got) != 3 {
		t.Fatalf("got %+v", got)
	}
	for _, group := range got {
		if len(group.Items) != 1 {
			t.Fatalf("a category holds %d items: %+v", len(group.Items), group)
		}
	}
	if got[0].Label != "Talent community" || got[1].Items[0] != "Burnout coaching" || got[2].Label != "Health" {
		t.Fatalf("got %+v", got)
	}
}
