package resumeread

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// The files in testdata are made-up résumés in two layouts, each saved as a
// browser-printed PDF (embedded CID fonts with ToUnicode maps, no glyph widths)
// and a Word file. inline.html and stacked.html are their sources.
//
//	inline:  "Title, Company    dates" on one line, school above its dates.
//	stacked: company and place, then title and dates, each on its own line.
func readTestFile(t *testing.T, name string) Resume {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	result, err := ReadFile(context.Background(), nil, name, data)
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return result.Resume
}

func TestFilesInlineLayout(t *testing.T) {
	for _, name := range []string{"inline-browser.pdf", "inline-word.docx"} {
		doc := readTestFile(t, name)
		if doc.FullName != "Maria Gonzalez" || doc.Email != "maria.gonzalez@example.com" || doc.Phone != "206.555.0199" {
			t.Fatalf("%s contact = %+v", name, doc)
		}
		if doc.City != "Seattle" || doc.State != "WA" || doc.Linkedin != linkedinBase+"maria-gonzalez" {
			t.Fatalf("%s place/links = %s %s %s", name, doc.City, doc.State, doc.Linkedin)
		}
		if doc.Summary != "Product designer with eight years shipping consumer and B2B tools." {
			t.Fatalf("%s summary = %q", name, doc.Summary)
		}
		if want := []string{"Figma", "Prototyping", "User research", "Design systems", "Accessibility"}; !reflect.DeepEqual(doc.Skills, want) {
			t.Fatalf("%s skills = %v", name, doc.Skills)
		}
		assertEntry(t, doc.Timeline, 0, Entry{Kind: KindRole, Title: "Senior Product Designer", Org: "Brightline Health", StartMonth: "3", StartYear: "2021", Current: true})
		assertEntry(t, doc.Timeline, 1, Entry{Kind: KindRole, Title: "Product Designer", Org: "Cascade Labs", StartMonth: "6", StartYear: "2017", EndMonth: "2", EndYear: "2021"})
		assertEntry(t, doc.Timeline, 2, Entry{Kind: KindEducation, Title: "B.A. Interaction Design", Org: "University of Washington", StartYear: "2013", EndYear: "2017"})
		if doc.Timeline[1].Summary != "Shipped the onboarding flow for 2M users." {
			t.Fatalf("%s bullets = %q", name, doc.Timeline[1].Summary)
		}
	}
}

func TestFilesStackedLayout(t *testing.T) {
	for _, name := range []string{"stacked-browser.pdf", "stacked-word.docx"} {
		doc := readTestFile(t, name)
		if doc.FullName != "Dev Patel" || doc.City != "Toronto" || doc.State != "ON" || doc.Country != canada {
			t.Fatalf("%s contact = %+v", name, doc)
		}
		if doc.Github != githubBase+"devpatel" || len(doc.Skills) != 6 {
			t.Fatalf("%s github/skills = %s %v", name, doc.Github, doc.Skills)
		}
		assertEntry(t, doc.Timeline, 0, Entry{Kind: KindRole, Title: "Staff Software Engineer", Org: "Stripeline", Location: "Toronto, ON", StartMonth: "1", StartYear: "2022", Current: true})
		assertEntry(t, doc.Timeline, 1, Entry{Kind: KindRole, Title: "Software Engineer", Org: "Maple Systems", Location: "Waterloo, ON", StartMonth: "9", StartYear: "2018", EndMonth: "12", EndYear: "2021"})
		assertEntry(t, doc.Timeline, 2, Entry{Kind: KindEducation, Title: "Bachelor of Applied Science, Computer Engineering", Org: "University of Waterloo", StartYear: "2014", EndYear: "2018"})
	}
}
