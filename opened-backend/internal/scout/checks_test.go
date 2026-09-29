package scout

import (
	"context"
	"errors"
	"net"
	"testing"
)

const openPage = "Senior Platform Engineer. Build the payments platform. Apply for this job."

func facts(t *testing.T, raw, level string, page Page) Facts {
	t.Helper()
	parsed, err := ParseJobURL(raw)
	if err != nil {
		t.Fatal(err)
	}
	return Facts{
		Input: SubmissionInput{
			CompanyName: "Stripe",
			Title:       "Senior Platform Engineer",
			Summary:     "Owns reliability for the card network team; hybrid in Dublin with on-call rotation.",
			SalaryText:  "$150k - $190k a year",
		},
		URL:     parsed,
		Page:    page,
		Fetched: !parsed.JobBoard,
		Level:   level,
	}
}

func outcome(d Decision, id string) string {
	for _, check := range d.Checks {
		if check.ID == id {
			return check.Outcome
		}
	}
	return ""
}

func TestEvaluateRejectsJobBoards(t *testing.T) {
	d := Evaluate(facts(t, "https://www.linkedin.com/jobs/view/1", LevelExpert, Page{}))
	if d.Status != StatusRejected || d.RejectionCode != ReasonNotOfficial || d.RejectionReason != "not an official source" {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateRejectsRedirectToJobBoard(t *testing.T) {
	f := facts(t, "https://acme.com/jobs/1", LevelTrusted, Page{Status: 200, Text: openPage})
	final, _ := ParseJobURL("https://www.indeed.com/viewjob?jk=1")
	f.Final = &final
	if d := Evaluate(f); d.RejectionCode != ReasonNotOfficial {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateAutoApprovesTrustedCleanSubmission(t *testing.T) {
	d := Evaluate(facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelTrusted, Page{Status: 200, Text: openPage}))
	if d.Status != StatusApproved || !d.HiddenJob {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateSendsProbationToReview(t *testing.T) {
	d := Evaluate(facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelProbation, Page{Status: 200, Text: openPage}))
	if d.Status != StatusNeedsReview || outcome(d, CheckLevel) != OutcomeReview {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateSpotChecksExperts(t *testing.T) {
	f := facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelExpert, Page{Status: 200, Text: openPage})
	f.SpotCheck = true
	if d := Evaluate(f); d.Status != StatusNeedsReview || !d.SpotCheck {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateReviewsLinkMatchesWithoutAutoRejecting(t *testing.T) {
	f := facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelExpert, Page{Status: 200, Text: openPage})
	f.Duplicate = "submission 64f"
	d := Evaluate(f)
	if d.Status != StatusNeedsReview || d.RejectionCode != "" || outcome(d, CheckDuplicate) != OutcomeReview || !d.HiddenJob {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateReviewsSoftDuplicates(t *testing.T) {
	f := facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelExpert, Page{Status: 200, Text: openPage})
	f.SimilarTo = "submission 64f"
	if d := Evaluate(f); d.Status != StatusNeedsReview || outcome(d, CheckDuplicate) != OutcomeReview {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateRejectsClosedPostings(t *testing.T) {
	d := Evaluate(facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelExpert, Page{Status: 200, Text: "Sorry, this position has been filled."}))
	if d.Status != StatusRejected || d.RejectionCode != ReasonClosed {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateRejectsMissingPages(t *testing.T) {
	d := Evaluate(facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelExpert, Page{Status: 404}))
	if d.Status != StatusRejected || d.RejectionCode != ReasonUnreachable {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateReviewsBlockedFetches(t *testing.T) {
	d := Evaluate(facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelExpert, Page{Status: 403}))
	if d.Status != StatusNeedsReview || outcome(d, CheckReachable) != OutcomeReview {
		t.Fatalf("decision = %+v", d)
	}
	timeout := Evaluate(facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelExpert, Page{Err: context.DeadlineExceeded}))
	if timeout.Status != StatusNeedsReview {
		t.Fatalf("timeout decision = %+v", timeout)
	}
}

func TestEvaluateRejectsUnknownDomainsAndPrivateAddresses(t *testing.T) {
	missing := Evaluate(facts(t, "https://acme-nope.com/jobs/1", LevelExpert, Page{Err: &net.DNSError{IsNotFound: true}}))
	if missing.RejectionCode != ReasonUnreachable {
		t.Fatalf("missing = %+v", missing)
	}
	private := Evaluate(facts(t, "https://acme.com/jobs/1", LevelExpert, Page{Err: errors.Join(errors.New("dial"), errBlockedAddress)}))
	if private.RejectionCode != ReasonUnreachable {
		t.Fatalf("private = %+v", private)
	}
}

func TestEvaluateRejectsScamLanguageAndBaitPay(t *testing.T) {
	f := facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelExpert, Page{Status: 200, Text: openPage})
	f.Input.Summary = "Message the recruiter on Telegram to start today, no experience needed at all."
	if d := Evaluate(f); d.RejectionCode != ReasonScam {
		t.Fatalf("scam = %+v", d)
	}
	f = facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelExpert, Page{Status: 200, Text: openPage})
	f.Input.SalaryText = "$900k - $4,000k a year"
	if d := Evaluate(f); d.RejectionCode != ReasonScam {
		t.Fatalf("bait pay = %+v", d)
	}
}

func TestEvaluateReviewsCopiedSummary(t *testing.T) {
	page := "We are hiring a senior platform engineer to own reliability for the card network team in Dublin. Apply now."
	f := facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelExpert, Page{Status: 200, Text: page})
	f.Input.Summary = "We are hiring a senior platform engineer to own reliability for the card network team in Dublin."
	d := Evaluate(f)
	if d.Status != StatusNeedsReview || outcome(d, CheckContent) != OutcomeReview {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateKeepsScoutedJobsHidden(t *testing.T) {
	d := Evaluate(facts(t, "https://boards.greenhouse.io/stripe/jobs/1", LevelTrusted, Page{Status: 200, Text: openPage}))
	if d.Status != StatusApproved || !d.HiddenJob {
		t.Fatalf("decision = %+v", d)
	}
}

func TestEvaluateReviewsCompanyMismatch(t *testing.T) {
	f := facts(t, "https://boards.greenhouse.io/plaid/jobs/1", LevelExpert, Page{Status: 200, Text: openPage})
	if d := Evaluate(f); d.Status != StatusNeedsReview || outcome(d, CheckCompanyMatch) != OutcomeReview {
		t.Fatalf("decision = %+v", d)
	}
}
