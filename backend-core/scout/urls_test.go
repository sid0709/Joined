package scout

import (
	"slices"
	"testing"
)

func TestParseJobURLCanonicalizes(t *testing.T) {
	parsed, err := ParseJobURL("  www.Acme.com/careers/42/?utm_source=x&gh_jid=123#apply ")
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Canonical != "https://acme.com/careers/42?gh_jid=123" {
		t.Fatalf("canonical = %q", parsed.Canonical)
	}
	if parsed.Host != "acme.com" || parsed.ATS != "" || parsed.JobBoard {
		t.Fatalf("parsed = %+v", parsed)
	}
}

func TestParseJobURLRejectsNonWebLinks(t *testing.T) {
	for _, raw := range []string{"", "ftp://acme.com/job", "http://localhost/job", "https://10.0.0.1/job", "https://user:pw@acme.com/job"} {
		if _, err := ParseJobURL(raw); err == nil {
			t.Fatalf("%q parsed", raw)
		}
	}
}

func TestParseJobURLFindsATSAndBoardToken(t *testing.T) {
	cases := []struct {
		raw, ats, token string
		bulk            bool
	}{
		{"https://boards.greenhouse.io/stripe/jobs/5123", "Greenhouse", "stripe", true},
		{"https://job-boards.greenhouse.io/embed/job_app?for=x", "Greenhouse", "", true},
		{"https://jobs.lever.co/Plaid/1d2e", "Lever", "plaid", true},
		{"https://jobs.ashbyhq.com/linear/abc", "Ashby", "linear", true},
		{"https://acme.wd5.myworkdayjobs.com/en-US/External/job/1", "Workday", "acme", false},
		{"https://careers-vanta.icims.com/jobs/1", "iCIMS", "vanta", false},
	}
	for _, tc := range cases {
		parsed, err := ParseJobURL(tc.raw)
		if err != nil {
			t.Fatal(err)
		}
		if parsed.ATS != tc.ats || parsed.BulkATS != tc.bulk {
			t.Fatalf("%s: ats = %q bulk = %v", tc.raw, parsed.ATS, parsed.BulkATS)
		}
		if tc.token != "" && parsed.Token != tc.token {
			t.Fatalf("%s: token = %q", tc.raw, parsed.Token)
		}
	}
}

func TestParseJobURLFlagsJobBoards(t *testing.T) {
	for _, raw := range []string{"https://www.linkedin.com/jobs/view/1", "https://uk.indeed.com/viewjob?jk=1"} {
		parsed, err := ParseJobURL(raw)
		if err != nil {
			t.Fatal(err)
		}
		if !parsed.JobBoard {
			t.Fatalf("%s not flagged", raw)
		}
	}
	parsed, _ := ParseJobURL("https://careers.google.com/jobs/results/1")
	if parsed.JobBoard {
		t.Fatal("an employer's own careers site is not a job board")
	}
}

func TestURLVariantsCoverStoredSpellings(t *testing.T) {
	parsed, _ := ParseJobURL("https://acme.com/jobs/7")
	variants := URLVariants(parsed)
	for _, want := range []string{"https://acme.com/jobs/7", "http://www.acme.com/jobs/7", "https://www.acme.com/jobs/7/"} {
		if !slices.Contains(variants, want) {
			t.Fatalf("missing %q in %v", want, variants)
		}
	}
}

func TestCompanyMatches(t *testing.T) {
	stripe, _ := ParseJobURL("https://boards.greenhouse.io/stripe/jobs/1")
	if !CompanyMatches("Stripe, Inc.", stripe) {
		t.Fatal("Stripe should match its board")
	}
	if CompanyMatches("Plaid", stripe) {
		t.Fatal("Plaid should not match Stripe's board")
	}
	site, _ := ParseJobURL("https://careers.northwind-traders.com/roles/9")
	if !CompanyMatches("Northwind Traders", site) {
		t.Fatal("company should match its own domain")
	}
	if CompanyMatches("The Company Inc", site) {
		t.Fatal("stopwords alone never match")
	}
}

func TestDedupeKeyIgnoresPunctuationAndCase(t *testing.T) {
	a := DedupeKey("", "Acme, Inc.", "Senior  Engineer")
	b := DedupeKey("", "acme inc", "senior engineer")
	if a != b {
		t.Fatalf("%q != %q", a, b)
	}
	if a != "acme-inc|senior-engineer" {
		t.Fatalf("key = %q", a)
	}
}

func TestDedupeKeyPrefersCompanyID(t *testing.T) {
	a := DedupeKey("co_1", "Acme", "Engineer")
	b := DedupeKey("co_1", "ACME Inc", "engineer")
	if a != b || a != "co_1|engineer" {
		t.Fatalf("%q != %q", a, b)
	}
}

func TestDedupeKeyIgnoresLocation(t *testing.T) {
	remote := DedupeKey("", "Acme", "Engineer")
	onsite := DedupeKey("", "Acme", "Engineer")
	if remote != onsite {
		t.Fatalf("%q != %q", remote, onsite)
	}
}
