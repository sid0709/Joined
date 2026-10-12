package ranking

import (
	"testing"
	"time"

	"github.com/sid0709/Joined/backend-core/candidate"
	"github.com/sid0709/Joined/backend-core/jobs"
)

func TestToAnnualUSD(t *testing.T) {
	cases := []struct {
		amount           int
		period, currency string
		want             int32
		ok               bool
	}{
		{150_000, "year", "USD", 150_000, true},
		{75, "hour", "USD", 156_000, true},
		{100_000, "year", "", 100_000, true},
		{100_000, "year", "EUR", 108_000, true},
		{100_000, "year", "XYZ", 0, false},
		{0, "year", "USD", 0, false},
		{12, "year", "USD", 0, false},
		{100_000, "month", "USD", 0, false},
	}
	for _, tc := range cases {
		got, ok := ToAnnualUSD(tc.amount, tc.period, tc.currency)
		if got != tc.want || ok != tc.ok {
			t.Errorf("ToAnnualUSD(%d, %q, %q) = %d, %v; want %d, %v", tc.amount, tc.period, tc.currency, got, ok, tc.want, tc.ok)
		}
	}
}

func TestDetectRegion(t *testing.T) {
	cases := map[string]Region{
		"Eden Prairie, Minnesota, United States (telecommute from anywhere in the U.S.)": RegionUS,
		"Austin, TX":              RegionUS,
		"Remote (US)":             RegionUS,
		"Toronto, Ontario":        RegionCanada,
		"London, UK":              RegionUK,
		"Berlin, Germany":         RegionEurope,
		"Bengaluru, India":        RegionIndia,
		"Remote — Worldwide":      RegionGlobal,
		"Location not listed":     RegionUnknown,
		"São Paulo, Brazil":       RegionLatAm,
		"Sydney, Australia":       RegionAPAC,
		"Eden Prairie, Minnesota": RegionUS,
	}
	for location, want := range cases {
		if got := DetectRegion(location); got != want {
			t.Errorf("DetectRegion(%q) = %v, want %v", location, got, want)
		}
	}
}

func TestNormalizeJob(t *testing.T) {
	posted := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	f := NormalizeJob(jobs.RankingDoc{
		JobID:      "job-1",
		Title:      "Sr. Machine Learning Engineer | Remote | $180K",
		Company:    "Acme",
		Location:   "Remote (US)",
		Workplace:  "remote",
		Seniority:  "Senior",
		Employment: "full-time",
		Pay:        jobs.Pay{Min: 90, Max: 0, Currency: "USD", Period: "hour"},
		Visa:       true,
		Skills:     []string{"PyTorch", "python", "Python3"},
		PostedAt:   posted,
	}, DefaultTaxonomy())
	if f.Title != "Sr. Machine Learning Engineer" {
		t.Fatalf("title = %q", f.Title)
	}
	if f.Workplace != WorkplaceRemote || f.Region != RegionUS || f.Visa != VisaYes {
		t.Fatalf("workplace/region/visa = %v/%v/%v", f.Workplace, f.Region, f.Visa)
	}
	if !f.PayKnown || f.PayMinUSD != 187_200 || f.PayMaxUSD != 187_200 {
		t.Fatalf("pay = %v %d-%d", f.PayKnown, f.PayMinUSD, f.PayMaxUSD)
	}
	if len(f.Occupations) == 0 || f.Occupations[0] != "machine-learning" {
		t.Fatalf("occupations = %v", f.Occupations)
	}
	if len(f.Skills) != 2 || f.Skills[0] != "pytorch" || f.Skills[1] != "python" {
		t.Fatalf("skills = %v", f.Skills)
	}
	if f.Seniority != ParseLevel("Senior") || f.Seniority == LevelUnknown {
		t.Fatalf("seniority = %v", f.Seniority)
	}
}

func TestNormalizeJobUnknownPay(t *testing.T) {
	f := NormalizeJob(jobs.RankingDoc{JobID: "x", Title: "Engineer", Pay: jobs.Pay{Min: 0, Max: 0, Currency: "USD", Period: "year"}}, DefaultTaxonomy())
	if f.PayKnown || f.Workplace != WorkplaceUnknown || f.Visa != VisaUnknown {
		t.Fatalf("unknown fields should stay unknown: %+v", f)
	}
}

func TestNormalizeProfile(t *testing.T) {
	now := time.Date(2026, 10, 11, 0, 0, 0, 0, time.UTC)
	p := NormalizeProfile("u1", candidate.Profile{
		Headline:      "ML engineer",
		TargetRoles:   []string{"AI Engineer", " ", "Marketing Manager", "Data Scientist", "Extra"},
		Locations:     []string{"Remote", "Austin, TX"},
		SalaryFloor:   150_000,
		Currency:      "USD",
		Authorization: "us-sponsor",
		Skills:        []string{"PyTorch", "k8s"},
		Experience: []candidate.ExperienceItem{
			{Role: "Software Engineer", DateRange: candidate.DateRange{StartYear: 2018, StartMonth: 1, EndYear: 2021, EndMonth: 1}},
			{Role: "Senior ML Engineer", DateRange: candidate.DateRange{StartYear: 2021, StartMonth: 1, Current: true}},
		},
	}, now, DefaultTaxonomy())
	if len(p.TargetRoles) != maxTargetRoles || p.TargetRoles[1] != "Marketing Manager" {
		t.Fatalf("target roles = %v", p.TargetRoles)
	}
	if p.CurrentTitle != "Senior ML Engineer" {
		t.Fatalf("current title = %q", p.CurrentTitle)
	}
	if p.ExperienceYears < 8.7 || p.ExperienceYears > 8.8 {
		t.Fatalf("experience years = %v", p.ExperienceYears)
	}
	if p.Seniority != ParseLevel("Senior") {
		t.Fatalf("seniority = %v", p.Seniority)
	}
	if !p.WantsRemote || p.Region != RegionUS || len(p.Cities) != 1 || p.Cities[0] != "austin" {
		t.Fatalf("location prefs = remote %v region %v cities %v", p.WantsRemote, p.Region, p.Cities)
	}
	if !p.NeedsVisa || p.SalaryFloorUSD != 150_000 {
		t.Fatalf("visa/floor = %v/%d", p.NeedsVisa, p.SalaryFloorUSD)
	}
	if len(p.RoleOccupations) != 3 || p.RoleOccupations[0][0] != "machine-learning" || p.RoleOccupations[1][0] != "marketing-management" {
		t.Fatalf("role occupations = %v", p.RoleOccupations)
	}
	again := NormalizeProfile("u1", candidate.Profile{TargetRoles: []string{"AI Engineer"}}, now, DefaultTaxonomy())
	if again.Hash == p.Hash || again.Hash == "" {
		t.Fatal("hash should change with the profile")
	}
}
