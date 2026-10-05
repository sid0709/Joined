package jobscam

import "testing"

func TestScorePayToApplyHolds(t *testing.T) {
	result := Score(Input{
		Title:       "Remote assistant",
		Company:     "Quick Hire",
		Description: "Send an application fee of $50 to unlock this role.",
		ApplyURL:    "https://careers.example.com/apply",
		CompanyURL:  "https://example.com",
	}, DefaultHoldThreshold)
	assertReason(t, result, ReasonPayToApply)
	if !result.Hold || result.Score < DefaultHoldThreshold {
		t.Fatalf("pay-to-apply should hold: %+v", result)
	}
}

func TestScoreCryptoWireHolds(t *testing.T) {
	result := Score(Input{
		Title:       "Treasury clerk",
		Company:     "North Labs",
		Description: "Salary paid in bitcoin to your crypto wallet after a wire transfer.",
		ApplyURL:    "https://northlabs.example/jobs/1",
		CompanyURL:  "https://northlabs.example",
	}, DefaultHoldThreshold)
	assertReason(t, result, ReasonCryptoWire)
	if !result.Hold {
		t.Fatalf("crypto/wire should hold: %+v", result)
	}
}

func TestScoreOffPlatformContact(t *testing.T) {
	result := Score(Input{
		Title:       "Support",
		Company:     "Acme",
		Description: "Message me on telegram to start today.",
		ApplyURL:    "https://acme.example/jobs/1",
		CompanyURL:  "https://acme.example",
	}, DefaultHoldThreshold)
	assertReason(t, result, ReasonOffPlatformContact)
	if result.Hold {
		t.Fatalf("off-platform alone is under the default threshold: %+v", result)
	}
}

func TestScoreTooGoodPay(t *testing.T) {
	result := Score(Input{
		Title:       "Intern",
		Company:     "Acme",
		Description: "Join our intern program.",
		ApplyURL:    "https://acme.example/jobs/1",
		CompanyURL:  "https://acme.example",
		Seniority:   "junior",
		PayMin:      500_000,
		PayMax:      600_000,
		PayPeriod:   "year",
	}, DefaultHoldThreshold)
	assertReason(t, result, ReasonTooGoodPay)
}

func TestScoreSuspiciousShortener(t *testing.T) {
	result := Score(Input{
		Title:       "Clerk",
		Company:     "Acme",
		Description: "Apply using the link.",
		ApplyURL:    "https://bit.ly/not-a-job",
		CompanyURL:  "https://acme.example",
	}, DefaultHoldThreshold)
	assertReason(t, result, ReasonSuspiciousURL)
}

func TestScoreMismatchedCompanyDomain(t *testing.T) {
	result := Score(Input{
		Title:       "Engineer",
		Company:     "Acme",
		Description: "Build APIs in Go.",
		ApplyURL:    "https://totally-unrelated.xyz/jobs/1",
		CompanyURL:  "https://acme.example",
	}, DefaultHoldThreshold)
	assertReason(t, result, ReasonMismatchedDomain)
}

func TestScoreMissingCompanyDomain(t *testing.T) {
	result := Score(Input{
		Title:       "Engineer",
		Company:     "Acme",
		Description: "Build APIs in Go.",
		ApplyURL:    "https://random-board.xyz/jobs/1",
	}, DefaultHoldThreshold)
	assertReason(t, result, ReasonMissingDomain)
}

func TestScoreKnownATSIsNotMissingDomain(t *testing.T) {
	result := Score(Input{
		Title:       "Engineer",
		Company:     "Acme",
		Description: "Build APIs in Go. Competitive benefits and a real team.",
		ApplyURL:    "https://boards.greenhouse.io/acme/jobs/1",
	}, DefaultHoldThreshold)
	if hasReason(result, ReasonMissingDomain) || hasReason(result, ReasonMismatchedDomain) {
		t.Fatalf("ATS apply links should not flag domain issues: %+v", result)
	}
	if result.Hold {
		t.Fatalf("clean ATS job should not hold: %+v", result)
	}
}

func TestScoreDuplicateHits(t *testing.T) {
	result := Score(Input{
		Title:         "Engineer",
		Company:       "Acme",
		Description:   "Build APIs in Go. Competitive benefits and a real team.",
		ApplyURL:      "https://boards.greenhouse.io/acme/jobs/1",
		DuplicateHits: 2,
	}, DefaultHoldThreshold)
	assertReason(t, result, ReasonDuplicateSpam)
}

func TestScoreRepeatedBoilerplate(t *testing.T) {
	sentence := "Apply now for unlimited weekly payouts sent worldwide to anyone "
	result := Score(Input{
		Title:       "Assistant",
		Company:     "Acme",
		Description: sentence + sentence + sentence + sentence,
		ApplyURL:    "https://acme.example/jobs/1",
		CompanyURL:  "https://acme.example",
	}, DefaultHoldThreshold)
	assertReason(t, result, ReasonDuplicateSpam)
}

func TestScoreCleanJobStaysPublic(t *testing.T) {
	result := Score(Input{
		Title:       "Staff engineer",
		Company:     "Acme",
		Description: "Build the job search API. Salary listed on the careers page.",
		ApplyURL:    "https://boards.greenhouse.io/acme/jobs/99",
		CompanyURL:  "https://acme.example",
		PayMin:      180_000,
		PayMax:      220_000,
		PayPeriod:   "year",
		Seniority:   "senior",
	}, DefaultHoldThreshold)
	if result.Hold || result.Score != 0 || len(result.Reasons) != 0 {
		t.Fatalf("clean job = %+v", result)
	}
	if result.Fingerprint == "" {
		t.Fatal("fingerprint is required")
	}
}

func TestScoreCombinedSignalsHold(t *testing.T) {
	result := Score(Input{
		Title:       "Helper",
		Company:     "Acme",
		Description: "Message me on telegram. Work from home, $5000 per week.",
		ApplyURL:    "https://bit.ly/job-now",
	}, DefaultHoldThreshold)
	if !result.Hold {
		t.Fatalf("combined signals should hold: %+v", result)
	}
	if result.Score > 100 {
		t.Fatalf("score capped at 100: %d", result.Score)
	}
}

func TestParseThreshold(t *testing.T) {
	if parseThreshold("", DefaultHoldThreshold) != DefaultHoldThreshold {
		t.Fatal("empty keeps default")
	}
	if parseThreshold("25", DefaultHoldThreshold) != 25 {
		t.Fatal("valid override")
	}
	if parseThreshold("0", DefaultHoldThreshold) != 0 {
		t.Fatal("zero is a real threshold")
	}
	if parseThreshold("101", DefaultHoldThreshold) != DefaultHoldThreshold {
		t.Fatal("above 100 is invalid")
	}
	if parseThreshold("nope", DefaultHoldThreshold) != DefaultHoldThreshold {
		t.Fatal("garbage is invalid")
	}
}

func assertReason(t *testing.T, result Result, code string) {
	t.Helper()
	if !hasReason(result, code) {
		t.Fatalf("missing %s in %+v", code, result.Reasons)
	}
}

func hasReason(result Result, code string) bool {
	for _, reason := range result.Reasons {
		if reason.Code == code {
			return true
		}
	}
	return false
}
