package candidate

import (
	"testing"

	"github.com/sid0709/Joined/backend-core/resumeread"
)

func TestResumePatchFillsProfile(t *testing.T) {
	current := emptyProfile("Account Name", "a@example.com", testTime)
	current.Links.Portfolio = "https://kept.dev"
	current.Authorization = "us-sponsor"
	found := resumeread.Resume{
		FullName: "Jordan Avery Lee", FirstName: "Jordan", LastName: "Lee",
		Headline: "Senior Engineer", Summary: "Builds hiring tools.",
		Phone: "415.555.0148", City: "Austin", State: "TX", Country: unitedStates,
		Linkedin: "https://www.linkedin.com/in/jordan", Github: "not a url at all",
		Skills: []string{"Go", "TypeScript"},
		Timeline: []resumeread.Entry{
			{Kind: resumeread.KindRole, Title: "Senior Engineer", Org: "Northwind", Summary: "Shipped search.", StartMonth: "1", StartYear: "2022", Current: true},
			{Kind: resumeread.KindRole, Title: "Engineer", Org: "Lumen", StartYear: "2021", EndYear: "2018"},
			{Kind: resumeread.KindRole, Title: "No employer"},
			{Kind: resumeread.KindEducation, Title: "Bachelor of Science", Field: "Computer Science", Org: "State University", EndYear: "2015"},
		},
	}
	next, name, err := applyProfilePatch(current, resumePatch(current, found))
	if err != nil {
		t.Fatal(err)
	}
	if name != "Jordan Avery Lee" || next.Personal.FirstName != "Jordan" || next.Personal.LastName != "Lee" {
		t.Errorf("name = %q %+v", name, next.Personal)
	}
	if next.Phone != "415-555-0148" || next.Location != "Austin, TX" || next.Headline != "Senior Engineer" || next.About != "Builds hiring tools." {
		t.Errorf("contact = %q %q %q %q", next.Phone, next.Location, next.Headline, next.About)
	}
	if next.Links.LinkedIn != "https://www.linkedin.com/in/jordan" || next.Links.GitHub != "" || next.Links.Portfolio != "https://kept.dev" {
		t.Errorf("links = %+v", next.Links)
	}
	if len(next.Skills) != 2 || next.Authorization != "us-sponsor" {
		t.Errorf("skills/authorization = %v %q", next.Skills, next.Authorization)
	}
	if len(next.Experience) != 2 || next.Experience[0].Period != "Jan 2022 – Present" || next.Experience[1].StartYear != 0 {
		t.Errorf("experience = %+v", next.Experience)
	}
	if len(next.Education) != 1 || next.Education[0].Field != "Computer Science" || next.Education[0].EndYear != 2015 {
		t.Errorf("education = %+v", next.Education)
	}
}

func TestResumePatchKeepsUnmentionedFields(t *testing.T) {
	current := emptyProfile("Account Name", "a@example.com", testTime)
	current.Phone = "+1 312 555 0100"
	current.Experience = []ExperienceItem{{ID: "kept", Role: "Designer", Company: "Acme"}}
	next, name, err := applyProfilePatch(current, resumePatch(current, resumeread.Resume{Country: "Canada"}))
	if err != nil {
		t.Fatal(err)
	}
	if name != "Account Name" || next.Phone != "+1 312 555 0100" || len(next.Experience) != 1 || next.Location != "Canada" {
		t.Errorf("profile = %q %+v", name, next)
	}
}
