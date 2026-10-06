package scout

import (
	"net/netip"
	"strings"
	"testing"
	"time"
)

func rows(approved, rejected, duplicate, withInterview int) []metricRow {
	out := []metricRow{}
	old := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for i := range approved {
		interviews := 0
		if i < withInterview {
			interviews = 1
		}
		out = append(out, metricRow{Status: StatusApproved, Interviews: interviews, SubmittedAt: old})
	}
	for range rejected {
		out = append(out, metricRow{Status: StatusRejected, SubmittedAt: old})
	}
	for range duplicate {
		out = append(out, metricRow{Status: StatusDuplicate, SubmittedAt: old})
	}
	return out
}

func TestComputeMetricsCountsTodayAgainstTheLimit(t *testing.T) {
	now := time.Date(2026, 9, 28, 15, 0, 0, 0, time.UTC)
	data := append(rows(1, 1, 0, 0), metricRow{Status: StatusNeedsReview, SubmittedAt: now.Add(-time.Hour)})
	m := ComputeMetrics(LevelProbation, data, now)
	if m.SubmittedToday != 1 || m.DailyLimit != 10 || m.RemainingToday != 9 || m.Pending != 1 {
		t.Fatalf("metrics = %+v", m)
	}
	if m.ApprovalRate != 0.5 || m.ResetsAt != "2026-09-29T00:00:00Z" {
		t.Fatalf("metrics = %+v", m)
	}
}

func TestRecomputeLevelPromotesOneStep(t *testing.T) {
	now := time.Now()
	good := ComputeMetrics(LevelProbation, rows(30, 1, 0, 5), now)
	if !MeetsPromotion(good) {
		t.Fatalf("expected promotion: %+v", good)
	}
	if next := RecomputeLevel(LevelProbation, good); next != LevelTrusted {
		t.Fatalf("probation -> %s", next)
	}
	if next := RecomputeLevel(LevelTrusted, good); next != LevelExpert {
		t.Fatalf("trusted -> %s", next)
	}
}

func TestRecomputeLevelDemotes(t *testing.T) {
	now := time.Now()
	thin := ComputeMetrics(LevelExpert, rows(10, 0, 0, 0), now)
	if next := RecomputeLevel(LevelExpert, thin); next != LevelTrusted {
		t.Fatalf("expert below thresholds -> %s", next)
	}
	poor := ComputeMetrics(LevelTrusted, rows(4, 8, 0, 0), now)
	if next := RecomputeLevel(LevelTrusted, poor); next != LevelProbation {
		t.Fatalf("trusted under 60%% approval -> %s", next)
	}
	few := ComputeMetrics(LevelTrusted, rows(2, 3, 0, 0), now)
	if next := RecomputeLevel(LevelTrusted, few); next != LevelTrusted {
		t.Fatalf("too few decisions to demote -> %s", next)
	}
}

func TestRewards(t *testing.T) {
	if got := ApprovalReward(LevelProbation).AmountCents; got != 0 {
		t.Fatalf("probation approval = %d", got)
	}
	if got := ApprovalReward(LevelTrusted).AmountCents; got != 150 {
		t.Fatalf("trusted approval = %d", got)
	}
	if got := InterviewReward(LevelExpert, SenioritySenior).AmountCents; got != 1875 {
		t.Fatalf("expert senior interview = %d", got)
	}
	if got := HireReward("unknown").AmountCents; got != 5000 {
		t.Fatalf("unknown seniority hire = %d", got)
	}
}

func TestComputeBalanceAndPayoutReadiness(t *testing.T) {
	balance := ComputeBalance([]Earning{
		{Status: EarningHeld, Amount: cents(150)},
		{Status: EarningReleased, Amount: cents(2600)},
		{Status: EarningProcessing, Amount: cents(100)},
		{Status: EarningPaid, Amount: cents(900)},
		{Status: EarningClawedBack, Amount: cents(50)},
	})
	if balance.Released.AmountCents != 2600 || balance.Lifetime.AmountCents != 3750 || balance.ClawedBack.AmountCents != 50 {
		t.Fatalf("balance = %+v", balance)
	}
	blocked := CheckPayout(Profile{}, balance.Released.AmountCents, false)
	if blocked.Ready || len(blocked.Blockers) != 3 {
		t.Fatalf("readiness = %+v", blocked)
	}
	certified := time.Unix(1_700_000_000, 0).UTC()
	readyTax := &TaxInfo{Country: "US", FormType: TaxFormW9, CertifiedAt: certified, ScreeningStatus: ScreeningClear}
	ready := CheckPayout(Profile{Verification: VerificationVerified, TaxInfo: readyTax, PayoutMethod: &PayoutMethod{}}, balance.Released.AmountCents, true)
	if !ready.Ready {
		t.Fatalf("readiness = %+v", ready)
	}
	first := CheckPayout(Profile{Verification: VerificationVerified, TaxInfo: &TaxInfo{}, PayoutMethod: &PayoutMethod{HolderName: "Ada"}, LegalName: "Ada Lovelace", Country: "GB", DateOfBirth: "1990-01-01"}, balance.Released.AmountCents, false)
	if first.Ready {
		t.Fatalf("name mismatch should block first payout: %+v", first)
	}
}

func TestTier(t *testing.T) {
	now := time.Now()
	if Tier(Profile{}) != 0 || Tier(Profile{TermsAcceptedAt: &now}) != 1 || Tier(Profile{Verification: VerificationVerified}) != 2 {
		t.Fatal("tiers")
	}
}

func TestNormalizeInputDefaultsAndErrors(t *testing.T) {
	in, parsed, err := NormalizeInput(SubmissionInput{
		URL:          "jobs.lever.co/plaid/1",
		CompanyName:  "  Plaid ",
		Title:        "Staff  Engineer",
		LocationText: "Remote (US)",
		Workplace:    WorkplaceRemote,
		Employment:   EmploymentFullTime,
		Pay:          Pay{Min: 180000, Max: 220000},
		Summary:      strings.Repeat("a", MinSummaryChars),
	})
	if err != nil {
		t.Fatal(err)
	}
	if in.CompanyName != "Plaid" || in.Title != "Staff Engineer" || in.Workplace != WorkplaceRemote || in.Seniority != SeniorityLeader {
		t.Fatalf("input = %+v", in)
	}
	if in.Pay.Min != 180000 || in.Pay.Max != 220000 || in.Pay.Currency != "USD" || in.SalaryText == "" {
		t.Fatalf("pay = %+v salary = %q", in.Pay, in.SalaryText)
	}
	if parsed.ATS != "Lever" {
		t.Fatalf("ats = %q", parsed.ATS)
	}

	_, _, err = NormalizeInput(SubmissionInput{URL: "nope", Summary: "short", Workplace: "moon", ExternalRef: "bad ref!"})
	fields, ok := err.(*ValidationError)
	if !ok {
		t.Fatalf("err = %v", err)
	}
	got := map[string]bool{}
	for _, f := range fields.Fields {
		got[f.Field] = true
	}
	for _, want := range []string{"url", "company_name", "title", "location_text", "summary", "workplace", "employment", "pay", "external_ref"} {
		if !got[want] {
			t.Fatalf("missing %s in %+v", want, fields.Fields)
		}
	}
}

func TestPublicAddress(t *testing.T) {
	for _, raw := range []string{"127.0.0.1", "10.1.2.3", "192.168.0.1", "169.254.169.254", "::1", "fc00::1", "100.64.0.1", "0.0.0.0"} {
		if PublicAddress(netip.MustParseAddr(raw)) {
			t.Fatalf("%s treated as public", raw)
		}
	}
	for _, raw := range []string{"8.8.8.8", "2606:4700:4700::1111"} {
		if !PublicAddress(netip.MustParseAddr(raw)) {
			t.Fatalf("%s treated as private", raw)
		}
	}
}

func TestTextHelpers(t *testing.T) {
	text := HTMLText(`<html><style>.a{}</style><script>var x</script><h1>Role &amp; team</h1><p>Apply now</p></html>`)
	if text != "Role & team Apply now" {
		t.Fatalf("text = %q", text)
	}
	if !HasApplyMarker(text) || ClosedMarker(text) != "" {
		t.Fatal("markers")
	}
	if share := CopiedShare("one two three four five six", "zero one two three four five six seven"); share != 1 {
		t.Fatalf("share = %v", share)
	}
	if share := CopiedShare("short text", "short text"); share != 0 {
		t.Fatalf("too short to shingle = %v", share)
	}
}

func TestAPIKeyShape(t *testing.T) {
	secret, err := newKeySecret()
	if err != nil {
		t.Fatal(err)
	}
	if !IsAPIKey(secret) || IsAPIKey("abcdef") || len(hashKey(secret)) != 64 {
		t.Fatalf("secret = %q", secret)
	}
}

func TestNormalizeInputRequiresRoleAndClearsEquityPay(t *testing.T) {
	_, _, err := NormalizeInput(SubmissionInput{
		URL:          "https://acme.com/jobs/1",
		CompanyName:  "Acme",
		Title:        "Designer",
		LocationText: "Berlin",
		Summary:      strings.Repeat("b", MinSummaryChars),
	})
	fields, ok := err.(*ValidationError)
	if !ok {
		t.Fatalf("err = %v", err)
	}
	got := map[string]bool{}
	for _, f := range fields.Fields {
		got[f.Field] = true
	}
	for _, want := range []string{"workplace", "employment", "pay"} {
		if !got[want] {
			t.Fatalf("missing %s in %+v", want, fields.Fields)
		}
	}

	in, _, err := NormalizeInput(SubmissionInput{
		URL:          "https://acme.com/jobs/1",
		CompanyName:  "Acme",
		Title:        "Designer",
		LocationText: "Berlin",
		Workplace:    WorkplaceHybrid,
		Employment:   EmploymentContract,
		Equity:       true,
		Pay:          Pay{Min: 100, Max: 200},
		SalaryText:   "$100 - $200 a year",
		Summary:      strings.Repeat("b", MinSummaryChars),
	})
	if err != nil {
		t.Fatal(err)
	}
	if !in.Equity || in.Pay.Min != 0 || in.Pay.Max != 0 || in.SalaryText != "" {
		t.Fatalf("input = %+v", in)
	}
	if in.Workplace != WorkplaceHybrid || in.Employment != EmploymentContract {
		t.Fatalf("input = %+v", in)
	}
}
