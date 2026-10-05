package fitscore

import (
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

func designerProfile() Profile {
	return Profile{
		TargetRoles:   []string{"Product designer"},
		Locations:     []string{"Chicago", "Remote (US)"},
		SalaryFloor:   140_000,
		Skills:        []string{"Figma", "Prototyping", "User research"},
		Authorization: "us-citizen",
	}
}

func productDesigner() Job {
	return Job{
		ID:        "product-designer-northwind",
		Title:     "Product Designer",
		Location:  "Chicago, IL",
		Workplace: jobschema.WorkplaceHybrid,
		Seniority: jobschema.SenioritySenior,
		Skills:    []string{"Product strategy", "Prototyping", "User research", "Figma", "Design systems", "Interaction design"},
		PayMin:    140_000,
		PayMax:    170_000,
		PayPeriod: jobschema.PayYear,
		Currency:  jobschema.CurrencyUSD,
	}
}

func TestScoreExplainsAStrongMatch(t *testing.T) {
	got := Score(productDesigner(), designerProfile())
	if got.Score < 70 {
		t.Fatalf("score = %d, want at least 70", got.Score)
	}
	if got.Confidence != ConfidenceHigh {
		t.Fatalf("confidence = %q", got.Confidence)
	}
	if got.ModelVersion != ModelVersion {
		t.Fatalf("model = %q", got.ModelVersion)
	}
	if got.NeedsVisa {
		t.Fatal("citizen should not need sponsorship")
	}
	levels := criterionLevels(got)
	if levels["title"] != levelYes || levels["salary"] != levelYes || levels["location"] != levelYes {
		t.Fatalf("criteria = %+v", got.Criteria)
	}
	if levels["skills"] != levelPartial {
		t.Fatalf("skills = %q", levels["skills"])
	}
	if _, ok := levels["seniority"]; ok {
		t.Fatal("no seniority on the profile should skip that dimension")
	}
	if !strings.Contains(got.Reason, "Product designer") {
		t.Fatalf("reason = %q", got.Reason)
	}
}

func TestScorePartialRoleAndNearPay(t *testing.T) {
	interaction := Job{
		ID:        "interaction-designer-northwind",
		Title:     "Interaction Designer",
		Location:  "Chicago, IL",
		Workplace: jobschema.WorkplaceOnsite,
		Seniority: jobschema.SeniorityMiddle,
		Skills:    []string{"Prototyping", "Motion", "Figma", "User research"},
		PayMin:    70,
		PayMax:    90,
		PayPeriod: jobschema.PayHour,
		Currency:  jobschema.CurrencyUSD,
	}
	got := Score(interaction, designerProfile())
	if criterionLevels(got)["title"] != levelPartial {
		t.Fatalf("title = %q, want partial", criterionLevels(got)["title"])
	}

	nearPay := Job{
		ID:        "content-designer-fieldnote",
		Title:     "Content Designer",
		Location:  "Remote",
		Workplace: jobschema.WorkplaceRemote,
		Skills:    []string{"UX writing", "Content strategy", "User research", "Figma"},
		PayMin:    110_000,
		PayMax:    130_000,
		PayPeriod: jobschema.PayYear,
		Currency:  jobschema.CurrencyUSD,
	}
	profile := designerProfile()
	profile.SalaryFloor = 150_000
	got = Score(nearPay, profile)
	if criterionLevels(got)["salary"] != levelPartial {
		t.Fatalf("salary = %q, want partial", criterionLevels(got)["salary"])
	}
}

func TestScoreFlagsMissesAndVisaNeed(t *testing.T) {
	job := Job{
		ID:        "recruiter-lumen",
		Title:     "Technical Recruiter",
		Location:  "Austin, TX",
		Workplace: jobschema.WorkplaceOnsite,
		Seniority: jobschema.SeniorityMiddle,
		Skills:    []string{"Recruiting", "Sourcing", "Stakeholder management"},
		PayMin:    90_000,
		PayMax:    110_000,
		PayPeriod: jobschema.PayYear,
		Currency:  jobschema.CurrencyUSD,
		Visa:      false,
	}
	profile := designerProfile()
	profile.Authorization = sponsorshipRequired
	got := Score(job, profile)
	if got.Score != 0 {
		t.Fatalf("score = %d, want 0", got.Score)
	}
	if !got.NeedsVisa {
		t.Fatal("expected needsVisa")
	}
	if !strings.Contains(strings.ToLower(got.Reason), "visa") {
		t.Fatalf("reason = %q", got.Reason)
	}
	levels := criterionLevels(got)
	for _, id := range []string{"title", "skills", "salary", "location"} {
		if levels[id] != levelNo {
			t.Fatalf("%s = %q, want no", id, levels[id])
		}
	}
}

func TestScoreRemotePartialWhenNotPreferred(t *testing.T) {
	job := Job{
		ID:        "support-lead-harbor",
		Title:     "Support Lead",
		Location:  "Remote",
		Workplace: jobschema.WorkplaceRemote,
		Skills:    []string{"Customer support", "Writing", "Process design"},
		PayMin:    75_000,
		PayMax:    95_000,
		PayPeriod: jobschema.PayYear,
	}
	profile := designerProfile()
	profile.Locations = []string{"Chicago"}
	got := Score(job, profile)
	if criterionLevels(got)["location"] != levelPartial {
		t.Fatalf("location = %q", criterionLevels(got)["location"])
	}
}

func TestScoreEmptyProfileIsLowConfidenceNotPanic(t *testing.T) {
	got := Score(productDesigner(), Profile{})
	if got.Score != 0 {
		t.Fatalf("score = %d", got.Score)
	}
	if got.Confidence != ConfidenceLow {
		t.Fatalf("confidence = %q", got.Confidence)
	}
	if got.Reason == "" {
		t.Fatal("expected a reason")
	}
	if len(got.Criteria) != 0 {
		t.Fatalf("criteria = %+v", got.Criteria)
	}
}

func TestScoreDefaultHybridWorkplaceIsNotAPreference(t *testing.T) {
	got := Score(productDesigner(), Profile{Workplace: jobschema.WorkplaceHybrid})
	if got.Score != 0 || got.Confidence != ConfidenceLow {
		t.Fatalf("default hybrid must not count as a location pref: %+v", got)
	}
}

func TestScoreRemoteWorkplacePreference(t *testing.T) {
	job := Job{Title: "Support", Workplace: jobschema.WorkplaceRemote, Location: "Remote"}
	got := Score(job, Profile{Workplace: jobschema.WorkplaceRemote})
	if got.Confidence != ConfidenceLow {
		t.Fatalf("one dimension should be low confidence, got %q", got.Confidence)
	}
	if criterionLevels(got)["location"] != levelYes {
		t.Fatalf("criteria = %+v", got.Criteria)
	}
	if got.Score != 100 {
		t.Fatalf("single matching dimension should scale to 100, got %d", got.Score)
	}
	if !strings.Contains(got.Reason, "Limited profile data") {
		t.Fatalf("reason = %q", got.Reason)
	}
}

func TestScoreSeniorityExactAndAdjacent(t *testing.T) {
	job := productDesigner()
	profile := designerProfile()
	profile.Headline = "Senior Product Designer"
	got := Score(job, profile)
	if criterionLevels(got)["seniority"] != levelYes {
		t.Fatalf("seniority = %q", criterionLevels(got)["seniority"])
	}

	profile.Headline = "Junior Designer"
	got = Score(job, profile)
	if criterionLevels(got)["seniority"] != levelNo {
		t.Fatalf("junior vs senior should be no, got %q", criterionLevels(got)["seniority"])
	}

	profile.Headline = "Lead Product Designer"
	got = Score(job, profile)
	if criterionLevels(got)["seniority"] != levelPartial {
		t.Fatalf("lead vs senior should be partial, got %q", criterionLevels(got)["seniority"])
	}
}

func TestWithReasonIgnoresBlank(t *testing.T) {
	base := Score(productDesigner(), designerProfile())
	got := WithReason(base, "   ")
	if got.Reason != base.Reason {
		t.Fatalf("blank rewrite must keep deterministic reason")
	}
	got = WithReason(base, "Strong overlap on product design skills.")
	if got.Reason != "Strong overlap on product design skills." {
		t.Fatalf("reason = %q", got.Reason)
	}
}

func criterionLevels(result Result) map[string]string {
	out := map[string]string{}
	for _, item := range result.Criteria {
		out[item.ID] = item.Level
	}
	return out
}
