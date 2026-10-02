package candidate

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

var testTime = time.Date(2024, time.March, 1, 0, 0, 0, 0, time.UTC)

func TestPeriodOfRendersDates(t *testing.T) {
	cases := []struct {
		dates    DateRange
		fallback string
		want     string
	}{
		{DateRange{StartMonth: 1, StartYear: 2022, Current: true}, "", "Jan 2022 – Present"},
		{DateRange{StartMonth: 1, StartYear: 2015, EndMonth: 12, EndYear: 2021}, "", "Jan 2015 – Dec 2021"},
		{DateRange{StartYear: 2011, EndYear: 2015}, "", "2011 – 2015"},
		{DateRange{}, "2019 — 2020", "2019 — 2020"},
	}
	for _, c := range cases {
		if got := periodOf(c.dates, c.fallback); got != c.want {
			t.Errorf("periodOf(%+v) = %q, want %q", c.dates, got, c.want)
		}
	}
}

func TestNormalizeRangeRejectsBadDates(t *testing.T) {
	bad := []DateRange{
		{StartMonth: 13, StartYear: 2020},
		{StartMonth: 3},
		{StartYear: 1800},
		{StartMonth: 5, StartYear: 2021, EndMonth: 4, EndYear: 2021},
	}
	for _, dates := range bad {
		if _, err := normalizeRange(dates); err == nil {
			t.Errorf("normalizeRange(%+v) accepted", dates)
		}
	}
	got, err := normalizeRange(DateRange{StartMonth: 1, StartYear: 2022, EndMonth: 1, EndYear: 2000, Current: true})
	if err != nil || got.EndYear != 0 || got.EndMonth != 0 {
		t.Errorf("current range should drop its end: %+v, %v", got, err)
	}
}

func TestApplyProfilePatchSavesDetails(t *testing.T) {
	current := emptyProfile("Stanley Wang", "s@example.com", testTime)
	personal := Personal{FirstName: " Stanley ", LastName: "Wang", Age: 35, Gender: "male"}
	links := Links{LinkedIn: "linkedin.com/in/stan", GitHub: "https://github.com/stan"}
	education := []EducationItem{{School: "UC Berkeley", Degree: "BS", Field: "Computer Science", DateRange: DateRange{StartYear: 2009, EndYear: 2013}}}
	roles := []ExperienceItem{{Role: "Senior Software Engineer", Company: "Uber", DateRange: DateRange{StartMonth: 1, StartYear: 2022, Current: true}}}
	next, _, err := applyProfilePatch(current, ProfilePatch{
		Personal: &personal, Links: &links, Education: &education, Experience: &roles,
		Disclosures: &Disclosures{Race: "asian", Veteran: "not-protected-veteran"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if next.Personal.FirstName != "Stanley" || next.Personal.Age != 35 {
		t.Errorf("personal = %+v", next.Personal)
	}
	if next.Links.LinkedIn != "https://linkedin.com/in/stan" {
		t.Errorf("links = %+v", next.Links)
	}
	if len(next.Education) != 1 || next.Education[0].ID == "" || next.Education[0].Period != "2009 – 2013" {
		t.Errorf("education = %+v", next.Education)
	}
	if next.Experience[0].Period != "Jan 2022 – Present" || !next.Experience[0].Current {
		t.Errorf("experience = %+v", next.Experience[0])
	}
	if next.Disclosures.Race != "asian" {
		t.Errorf("disclosures = %+v", next.Disclosures)
	}
}

func TestApplyProfilePatchRejectsBadDetails(t *testing.T) {
	current := emptyProfile("A", "a@example.com", testTime)
	for name, patch := range map[string]ProfilePatch{
		"age":       {Personal: &Personal{Age: 7}},
		"link":      {Links: &Links{Portfolio: "javascript:alert(1)"}},
		"no school": {Education: &[]EducationItem{{Degree: "BS"}}},
	} {
		if _, _, err := applyProfilePatch(current, patch); err == nil {
			t.Errorf("%s: patch accepted", name)
		}
	}
}

func TestProfilePatchDecodesFlatDates(t *testing.T) {
	var patch ProfilePatch
	body := `{"education":[{"school":"MIT","startMonth":9,"startYear":2010,"endMonth":6,"endYear":2014}],
		"experience":[{"role":"Engineer","company":"Uber","startMonth":1,"startYear":2022,"current":true}]}`
	if err := json.Unmarshal([]byte(body), &patch); err != nil {
		t.Fatal(err)
	}
	school := (*patch.Education)[0]
	role := (*patch.Experience)[0]
	if school.StartMonth != 9 || school.EndYear != 2014 || role.StartYear != 2022 || !role.Current {
		t.Errorf("education = %+v, experience = %+v", school, role)
	}
	out, err := json.Marshal(role)
	if err != nil || !strings.Contains(string(out), `"startYear":2022`) {
		t.Errorf("dates must serialize flat: %s", out)
	}
}
