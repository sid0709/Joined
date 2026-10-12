package resumeread

import (
	"strings"
	"testing"
)

// Three common layouts, each with made-up people: the title and dates on one line
// with the employer below; "Title — Company   dates" with a place line below; and
// a numeric "2022.4" date style. None of them is special-cased by the parser.
const (
	titleThenCompany = "\nJORDAN AVERY LEE\nSenior Full-Stack Engineer\nFresno, CA  •  (555) 010-2233  •  jordan.lee@example.com  •  linkedin.com/in/jordan-lee-01\n" +
		"SUMMARY\nEngineer with ten years of experience.\nEXPERIENCE\n" +
		"Senior Full-Stack Engineer\tJan 2022 – Present\nNorthwind\tSan Francisco, CA\n" +
		"Optimized queries to cut p95 latency by 40%.\nShipped real-time notifications.\n" +
		"Software Engineer\tMay 2013 – Dec 2021\nLumen Health Group\tMinnetonka, MN\nBuilt RESTful endpoints.\n" +
		"EDUCATION\nBachelor of Science in Computer Science\tAug 2009 – May 2013\nState University\tBerkeley, CA\n" +
		"SKILLS\nGo, TypeScript\n"

	titleDashCompany = "Casey Morgan\nSenior Automation Engineer\nHouston, Texas | (555) 010-4455 | casey@example.com | linkedin.com/in/casey-morgan\n\n" +
		"PROFESSIONAL SUMMARY\nAutomation engineer.\n\nEXPERIENCE\n\n" +
		"Senior Automation Engineer — Harbor Labs          Mar 2025 – Present\nHouston, Texas\n" +
		" • Built a browser automation framework handling SSO, solving\n   session persistence across runs.\n • Integrated a model to triage failures.\n\n" +
		"Software Development Engineer — Cloud Works (CW)          Sep 2022 – Mar 2025\nSeattle, Washington\n • Wrote Python automation.\n\n" +
		"EDUCATION\nBachelor of Science (B.S.), Computer Science          Aug 2015 – May 2019\nThe University of Texas at Austin          Austin, Texas\n"

	numericDates = "Riley Chen\nGladewater, Texas    ·    riley.chen@example.com    ·    (555) 010-6677    ·    https://www.linkedin.com/in/riley-chen-ab01\n" +
		"SUMMARY\nSenior engineer.\nEXPERIENCE\n" +
		"Senior Full-Stack Engineer\t2022.4 – Present\nAirwave\nRebuilt the search pipeline using queues.\nRe-architected the results page.\n" +
		"Backend Developer\t2016.5 – 2018.11\nTango Health, Inc.\nRefactored the ingestion service.\n" +
		"EDUCATION\nBachelor of Science in Aerospace\t2009.8 – 2014.5\nTexas A&M University\n"
)

func TestLayoutTitleThenCompany(t *testing.T) {
	doc := mustMerge(t, titleThenCompany)
	if doc.FullName != "Jordan Avery Lee" || doc.MiddleName != "Avery" {
		t.Fatalf("name = %q / %q", doc.FullName, doc.MiddleName)
	}
	if doc.City != "Fresno" || doc.State != "CA" || doc.Country != unitedStates {
		t.Fatalf("place = %s %s %s", doc.City, doc.State, doc.Country)
	}
	if doc.Linkedin != linkedinBase+"jordan-lee-01" {
		t.Fatalf("linkedin = %s", doc.Linkedin)
	}
	assertEntry(t, doc.Timeline, 0, Entry{Kind: "role", Title: "Senior Full-Stack Engineer", Org: "Northwind", Location: "San Francisco, CA", StartMonth: "1", StartYear: "2022", Current: true})
	assertEntry(t, doc.Timeline, 1, Entry{Kind: "role", Title: "Software Engineer", Org: "Lumen Health Group", Location: "Minnetonka, MN", StartMonth: "5", StartYear: "2013", EndMonth: "12", EndYear: "2021"})
	assertEntry(t, doc.Timeline, 2, Entry{Kind: "education", Title: "Bachelor of Science in Computer Science", Org: "State University", Location: "Berkeley, CA", StartMonth: "8", StartYear: "2009", EndMonth: "5", EndYear: "2013"})
	if doc.Timeline[0].Summary != "Optimized queries to cut p95 latency by 40%.\nShipped real-time notifications." {
		t.Fatalf("summary = %q", doc.Timeline[0].Summary)
	}
}

func TestLayoutTitleDashCompany(t *testing.T) {
	doc := mustMerge(t, titleDashCompany)
	if doc.City != "Houston" || doc.State != "TX" || doc.Phone != "(555) 010-4455" {
		t.Fatalf("contact = %s %s %s", doc.City, doc.State, doc.Phone)
	}
	assertEntry(t, doc.Timeline, 0, Entry{Kind: "role", Title: "Senior Automation Engineer", Org: "Harbor Labs", Location: "Houston, Texas", StartMonth: "3", StartYear: "2025", Current: true})
	assertEntry(t, doc.Timeline, 1, Entry{Kind: "role", Title: "Software Development Engineer", Org: "Cloud Works (CW)", Location: "Seattle, Washington", StartMonth: "9", StartYear: "2022", EndMonth: "3", EndYear: "2025"})
	assertEntry(t, doc.Timeline, 2, Entry{Kind: "education", Title: "Bachelor of Science (B.S.), Computer Science", Org: "The University of Texas at Austin", Location: "Austin, Texas", StartMonth: "8", StartYear: "2015", EndMonth: "5", EndYear: "2019"})
	want := "Built a browser automation framework handling SSO, solving session persistence across runs.\nIntegrated a model to triage failures."
	if doc.Timeline[0].Summary != want {
		t.Fatalf("wrapped bullets = %q", doc.Timeline[0].Summary)
	}
}

func TestLayoutNumericDates(t *testing.T) {
	doc := mustMerge(t, numericDates)
	if doc.City != "Gladewater" || doc.State != "TX" || doc.Linkedin != linkedinBase+"riley-chen-ab01" || doc.Portfolio != "" {
		t.Fatalf("contact = %s %s %s %q", doc.City, doc.State, doc.Linkedin, doc.Portfolio)
	}
	assertEntry(t, doc.Timeline, 0, Entry{Kind: "role", Title: "Senior Full-Stack Engineer", Org: "Airwave", StartMonth: "4", StartYear: "2022", Current: true})
	assertEntry(t, doc.Timeline, 1, Entry{Kind: "role", Title: "Backend Developer", Org: "Tango Health, Inc.", StartMonth: "5", StartYear: "2016", EndMonth: "11", EndYear: "2018"})
	assertEntry(t, doc.Timeline, 2, Entry{Kind: "education", Title: "Bachelor of Science in Aerospace", Org: "Texas A&M University", StartMonth: "8", StartYear: "2009", EndMonth: "5", EndYear: "2014"})
}

func TestLayoutDegreeUnderDates(t *testing.T) {
	doc := mustMerge(t, "Dev Patel\ndev@example.com\nEDUCATION\nUniversity of Waterloo\n2014 – 2018\nBachelor of Applied Science, Computer Engineering\n")
	assertEntry(t, doc.Timeline, 0, Entry{Kind: "education", Title: "Bachelor of Applied Science, Computer Engineering", Org: "University of Waterloo", StartYear: "2014", EndYear: "2018"})
}

func TestDatesIgnoreYearsInsideBullets(t *testing.T) {
	doc := mustMerge(t, "Sam Park\nsam@example.com\nExperience\nEngineer\tJan 2020 – Present\nAcme\n• Migrated billing 2019 – 2020 to the new ledger service in under a quarter.\n")
	if len(doc.Timeline) != 1 {
		t.Fatalf("timeline = %+v", doc.Timeline)
	}
}

func TestPlaceOutsideUnitedStates(t *testing.T) {
	cases := map[string]place{
		"Toronto, ON, Canada":         {city: "Toronto", state: "ON", country: canada},
		"Waterloo, ON":                {city: "Waterloo", state: "ON", country: canada},
		"Vancouver, British Columbia": {city: "Vancouver", state: "BC", country: canada},
		"London, United Kingdom":      {city: "London", country: unitedKingdom},
		"austin, texas 78701":         {city: "Austin", state: "TX", country: unitedStates, zip: "78701"},
	}
	for input, want := range cases {
		got, ok := parsePlace(input)
		if !ok || got != want {
			t.Fatalf("%s = %+v", input, got)
		}
	}
	if _, ok := parsePlace("Tango Health, Inc."); ok {
		t.Fatal("a company is not a place")
	}
}

func mustMerge(t *testing.T, text string) Resume {
	t.Helper()
	doc, err := fromLayout(text)
	if err != nil {
		t.Fatal(err)
	}
	return doc
}

func assertEntry(t *testing.T, timeline []Entry, index int, want Entry) {
	t.Helper()
	if index >= len(timeline) {
		t.Fatalf("timeline has %d entries, want index %d: %+v", len(timeline), index, timeline)
	}
	got := timeline[index]
	got.ID, got.Summary = "", ""
	if got != want {
		t.Fatalf("entry %d\n got %+v\nwant %+v", index, got, want)
	}
	if strings.TrimSpace(timeline[index].ID) == "" {
		t.Fatalf("entry %d has no id", index)
	}
}
