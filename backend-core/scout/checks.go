package scout

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

// Check ids, in the order they run.
const (
	CheckReachable    = "reachable"
	CheckOfficial     = "official_source"
	CheckCompanyMatch = "company_match"
	CheckStillOpen    = "still_open"
	CheckDuplicate    = "duplicate"
	CheckScam         = "scam"
	CheckContent      = "content"
	CheckLevel        = "level_policy"
)

const (
	// copiedShareLimit is the share of summary 5-grams found on the page above
	// which a moderator checks the summary is the scout's own words.
	copiedShareLimit = 0.5
	// Pay beyond these is treated as bait.
	maxYearlyPay = 1_500_000
	maxHourlyPay = 750
)

// Facts is everything the evaluator needs, gathered by the store.
type Facts struct {
	Input     SubmissionInput
	URL       ParsedURL
	Page      Page
	Fetched   bool
	Final     *ParsedURL
	Duplicate string
	SimilarTo string
	Level     string
	SpotCheck bool
}

// Decision is the pipeline outcome for one submission.
type Decision struct {
	Status          string
	RejectionCode   string
	RejectionReason string
	Checks          []Check
	HiddenJob       bool
	FinalURL        string
	SpotCheck       bool
}

// Evaluate runs every automatic check from docs/13-platform-scout.md and
// routes the submission: hard failures reject, possible duplicates go to a
// moderator, probation scouts go to a moderator, everything else is approved.
func Evaluate(f Facts) Decision {
	checks := []Check{}
	add := func(id, label, outcome, detail string) {
		checks = append(checks, Check{ID: id, Label: label, Outcome: outcome, Detail: detail})
	}

	effective := f.URL
	if f.Final != nil {
		effective = *f.Final
	}

	// URL reachable.
	reachable := reachability(f)
	add(CheckReachable, "URL reachable", reachable.outcome, reachable.detail)

	// Official source.
	switch {
	case f.URL.JobBoard:
		add(CheckOfficial, "Official source", OutcomeFail, fmt.Sprintf("%s is a job board, not the employer or its ATS", f.URL.Host))
	case f.Final != nil && f.Final.JobBoard:
		add(CheckOfficial, "Official source", OutcomeFail, fmt.Sprintf("Link redirects to %s, another job board", f.Final.Host))
	case effective.ATS != "":
		add(CheckOfficial, "Official source", OutcomePass, fmt.Sprintf("%s board on %s", effective.ATS, effective.Host))
	default:
		add(CheckOfficial, "Official source", OutcomePass, fmt.Sprintf("Company careers site on %s", effective.Host))
	}

	// Company ↔ domain or ATS board token.
	switch {
	case effective.JobBoard:
		add(CheckCompanyMatch, "Company matches link", OutcomeReview, "Skipped: not an official source")
	case CompanyMatches(f.Input.CompanyName, effective):
		add(CheckCompanyMatch, "Company matches link", OutcomePass, fmt.Sprintf("%q matches %s", f.Input.CompanyName, companyTarget(effective)))
	default:
		add(CheckCompanyMatch, "Company matches link", OutcomeReview, fmt.Sprintf("%q does not obviously match %s", f.Input.CompanyName, companyTarget(effective)))
	}

	// Still open.
	switch {
	case !f.Fetched || f.Page.Err != nil || f.Page.Status < 200 || f.Page.Status > 299:
		add(CheckStillOpen, "Still open", OutcomeReview, "Could not read the posting")
	case ClosedMarker(f.Page.Text) != "":
		add(CheckStillOpen, "Still open", OutcomeFail, fmt.Sprintf("Page says %q", ClosedMarker(f.Page.Text)))
	case HasApplyMarker(f.Page.Text):
		add(CheckStillOpen, "Still open", OutcomePass, "Apply option found on the page")
	default:
		add(CheckStillOpen, "Still open", OutcomeReview, "No apply option found; the page may render with JavaScript")
	}

	// Duplicate. Matches are shown to a moderator; they never auto-reject.
	switch {
	case f.Duplicate != "":
		add(CheckDuplicate, "Duplicate", OutcomeReview, "Same link as "+f.Duplicate)
	case f.SimilarTo != "":
		add(CheckDuplicate, "Duplicate", OutcomeReview, "Same company and title as "+f.SimilarTo)
	default:
		add(CheckDuplicate, "Duplicate", OutcomePass, "No active job or submission with this link or role")
	}

	// Scam heuristics.
	scam := scamCheck(f)
	add(CheckScam, "Scam heuristics", scam.outcome, scam.detail)

	// Content is the scout's own words.
	switch {
	case !f.Fetched || f.Page.Text == "":
		add(CheckContent, "Summary in own words", OutcomePass, "Source page text unavailable to compare")
	default:
		share := CopiedShare(f.Input.Summary, f.Page.Text)
		if share >= copiedShareLimit {
			add(CheckContent, "Summary in own words", OutcomeReview, fmt.Sprintf("%.0f%% of the summary matches the posting text", share*100))
		} else {
			add(CheckContent, "Summary in own words", OutcomePass, "Summary reads as original")
		}
	}

	rule := Rule(f.Level)
	decision := Decision{
		Checks:    checks,
		HiddenJob: true,
		SpotCheck: f.SpotCheck,
	}
	if f.Final != nil {
		decision.FinalURL = f.Page.FinalURL
	}

	reject := func(code, reason string) Decision {
		decision.Status = StatusRejected
		decision.RejectionCode = code
		decision.RejectionReason = reason
		decision.HiddenJob = false
		return decision
	}
	switch {
	case failed(checks, CheckOfficial):
		return reject(ReasonNotOfficial, "not an official source")
	case failed(checks, CheckScam):
		return reject(ReasonScam, detail(checks, CheckScam))
	case failed(checks, CheckReachable):
		return reject(ReasonUnreachable, detail(checks, CheckReachable))
	case failed(checks, CheckStillOpen):
		return reject(ReasonClosed, "the posting is closed")
	}

	softFlags := hasOutcome(checks, OutcomeReview)
	switch {
	case !rule.AutoApprove:
		decision.Checks = append(decision.Checks, Check{ID: CheckLevel, Label: "Level policy", Outcome: OutcomeReview, Detail: rule.Label + " scouts: a moderator reviews every submission"})
	case softFlags:
		decision.Checks = append(decision.Checks, Check{ID: CheckLevel, Label: "Level policy", Outcome: OutcomeReview, Detail: "Soft flags above need a moderator"})
	case f.SpotCheck:
		decision.Checks = append(decision.Checks, Check{ID: CheckLevel, Label: "Level policy", Outcome: OutcomeReview, Detail: "Random spot check"})
	default:
		decision.Checks = append(decision.Checks, Check{ID: CheckLevel, Label: "Level policy", Outcome: OutcomePass, Detail: rule.Label + " scout: auto-approved"})
		decision.Status = StatusApproved
		return decision
	}
	decision.Status = StatusNeedsReview
	return decision
}

type result struct {
	outcome string
	detail  string
}

func reachability(f Facts) result {
	if f.URL.JobBoard {
		return result{OutcomeFlag, "Not fetched: job board links are never followed"}
	}
	if !f.Fetched {
		return result{OutcomeReview, "Not fetched"}
	}
	page := f.Page
	if page.Err != nil {
		var dnsErr *net.DNSError
		var netErr net.Error
		switch {
		case errors.Is(page.Err, errBlockedAddress):
			return result{OutcomeFail, "Link points at a private network address"}
		case errors.As(page.Err, &dnsErr) && dnsErr.IsNotFound:
			return result{OutcomeFail, "Domain does not exist"}
		case errors.Is(page.Err, context.DeadlineExceeded) || (errors.As(page.Err, &netErr) && netErr.Timeout()):
			return result{OutcomeReview, "No response within 10 seconds"}
		default:
			return result{OutcomeReview, "Could not connect: " + shortError(page.Err)}
		}
	}
	switch {
	case page.Status >= 200 && page.Status <= 299:
		return result{OutcomePass, fmt.Sprintf("HTTP %d", page.Status)}
	case page.Status == http.StatusNotFound || page.Status == http.StatusGone:
		return result{OutcomeFail, fmt.Sprintf("HTTP %d: posting not found", page.Status)}
	default:
		return result{OutcomeReview, fmt.Sprintf("HTTP %d: the site blocked the automatic check", page.Status)}
	}
}

func scamCheck(f Facts) result {
	if phrase := ScamPhrase(f.Input.Title, f.Input.CompanyName, f.Input.Summary, f.Input.SalaryText); phrase != "" {
		return result{OutcomeFail, fmt.Sprintf("Flagged language: %q", phrase)}
	}
	if pay, ok := jobs.ParsePayText(f.Input.SalaryText); ok {
		if (pay.Period == "year" && pay.Max > maxYearlyPay) || (pay.Period == "hour" && pay.Max > maxHourlyPay) {
			return result{OutcomeFail, "Salary is unrealistic for any role"}
		}
	}
	if phrase := ScamPhrase(f.Page.Text); phrase != "" {
		return result{OutcomeReview, fmt.Sprintf("Posting mentions %q", phrase)}
	}
	return result{OutcomePass, "No payment requests, off-platform chat, or bait pay"}
}

func companyTarget(p ParsedURL) string {
	if p.ATS != "" {
		if p.Token != "" {
			return fmt.Sprintf("%s board %q", p.ATS, p.Token)
		}
		return p.ATS + " board"
	}
	return p.Host
}

func failed(checks []Check, id string) bool {
	for _, check := range checks {
		if check.ID == id {
			return check.Outcome == OutcomeFail
		}
	}
	return false
}

func detail(checks []Check, id string) string {
	for _, check := range checks {
		if check.ID == id {
			return check.Detail
		}
	}
	return ""
}

func hasOutcome(checks []Check, outcome string) bool {
	for _, check := range checks {
		if check.Outcome == outcome {
			return true
		}
	}
	return false
}

func shortError(err error) string {
	message := err.Error()
	if index := strings.LastIndex(message, ": "); index >= 0 && index+2 < len(message) {
		message = message[index+2:]
	}
	if len(message) > 120 {
		message = message[:120]
	}
	return message
}
