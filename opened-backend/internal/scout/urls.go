package scout

import (
	"errors"
	"net"
	"net/url"
	"sort"
	"strings"
	"unicode"
)

const maxURLLength = 2048

var errBadURL = errors.New("enter a full http(s) link to the job posting")

// Hosts of job boards and aggregators. Submissions must point at the employer's
// own site or its ATS, never at another board.
var jobBoardHosts = []string{
	"linkedin.com",
	"indeed.com",
	"glassdoor.com",
	"ziprecruiter.com",
	"monster.com",
	"simplyhired.com",
	"wellfound.com",
	"angel.co",
	"dice.com",
	"careerbuilder.com",
	"builtin.com",
	"remoteok.com",
	"weworkremotely.com",
	"otta.com",
	"welcometothejungle.com",
	"jooble.org",
	"talent.com",
	"adzuna.com",
}

// atsHost describes a known applicant tracking system and where its board token lives.
type atsHost struct {
	Name string
	// Suffix matches the host exactly or as a subdomain.
	Suffix string
	// Token is "path" when the first path segment is the company board token,
	// "subdomain" when the leftmost host label is.
	Token string
	// Bulk marks ATSs whose forms the router sends to the AI agent (docs/14).
	Bulk bool
}

var atsHosts = []atsHost{
	{Name: "Greenhouse", Suffix: "boards.greenhouse.io", Token: "path", Bulk: true},
	{Name: "Greenhouse", Suffix: "job-boards.greenhouse.io", Token: "path", Bulk: true},
	{Name: "Greenhouse", Suffix: "boards.eu.greenhouse.io", Token: "path", Bulk: true},
	{Name: "Greenhouse", Suffix: "job-boards.eu.greenhouse.io", Token: "path", Bulk: true},
	{Name: "Lever", Suffix: "jobs.lever.co", Token: "path", Bulk: true},
	{Name: "Lever", Suffix: "jobs.eu.lever.co", Token: "path", Bulk: true},
	{Name: "Ashby", Suffix: "jobs.ashbyhq.com", Token: "path", Bulk: true},
	{Name: "SmartRecruiters", Suffix: "jobs.smartrecruiters.com", Token: "path"},
	{Name: "Workable", Suffix: "apply.workable.com", Token: "path"},
	{Name: "Jobvite", Suffix: "jobs.jobvite.com", Token: "path"},
	{Name: "Workday", Suffix: "myworkdayjobs.com", Token: "subdomain"},
	{Name: "BambooHR", Suffix: "bamboohr.com", Token: "subdomain"},
	{Name: "Recruitee", Suffix: "recruitee.com", Token: "subdomain"},
	{Name: "Teamtailor", Suffix: "teamtailor.com", Token: "subdomain"},
	{Name: "Breezy", Suffix: "breezy.hr", Token: "subdomain"},
	{Name: "Personio", Suffix: "jobs.personio.de", Token: "subdomain"},
	{Name: "Personio", Suffix: "jobs.personio.com", Token: "subdomain"},
	{Name: "iCIMS", Suffix: "icims.com", Token: "subdomain"},
}

// Query parameters that only track where a click came from.
var trackingParams = map[string]struct{}{
	"gh_src": {}, "source": {}, "src": {}, "ref": {}, "referrer": {}, "lever-source": {},
	"lever-origin": {}, "utm_source": {}, "utm_medium": {}, "utm_campaign": {}, "utm_term": {},
	"utm_content": {}, "fbclid": {}, "gclid": {}, "mc_cid": {}, "mc_eid": {}, "trk": {},
}

// ParsedURL is a submitted link after normalization.
type ParsedURL struct {
	Raw       string `json:"url"`
	Canonical string `json:"canonical_url"`
	Host      string `json:"host"`
	ATS       string `json:"ats,omitempty"`
	BulkATS   bool   `json:"-"`
	Token     string `json:"-"`
	JobBoard  bool   `json:"job_board"`
}

// ParseJobURL normalizes a submitted link: https, lowercase host without www,
// no fragment, tracking parameters dropped, remaining parameters sorted.
func ParseJobURL(raw string) (ParsedURL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || len(raw) > maxURLLength {
		return ParsedURL{}, errBadURL
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return ParsedURL{}, errBadURL
	}
	if parsed.User != nil {
		return ParsedURL{}, errBadURL
	}
	host := strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
	if !strings.Contains(host, ".") || net.ParseIP(host) != nil {
		return ParsedURL{}, errBadURL
	}
	out := ParsedURL{Raw: parsed.String(), Host: host, JobBoard: isJobBoardHost(host)}
	out.Canonical = canonicalize(parsed, host)
	if ats, ok := atsFor(host); ok {
		out.ATS = ats.Name
		out.BulkATS = ats.Bulk
		out.Token = boardToken(ats, host, parsed.Path)
	}
	return out, nil
}

func canonicalize(parsed *url.URL, host string) string {
	path := strings.TrimRight(parsed.EscapedPath(), "/")
	query := parsed.Query()
	keys := make([]string, 0, len(query))
	for key := range query {
		if _, drop := trackingParams[strings.ToLower(key)]; drop {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	kept := url.Values{}
	for _, key := range keys {
		kept[key] = query[key]
	}
	canonical := "https://" + host + path
	if encoded := kept.Encode(); encoded != "" {
		canonical += "?" + encoded
	}
	return canonical
}

// URLVariants are the spellings of a canonical link an existing job record may
// have stored, so a duplicate check can match them exactly.
func URLVariants(p ParsedURL) []string {
	base := strings.TrimPrefix(p.Canonical, "https://")
	seen := map[string]struct{}{}
	out := []string{}
	add := func(value string) {
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	for _, scheme := range []string{"https://", "http://"} {
		for _, prefix := range []string{"", "www."} {
			add(scheme + prefix + base)
			if !strings.Contains(base, "?") {
				add(scheme + prefix + base + "/")
			}
		}
	}
	add(p.Raw)
	return out
}

func isJobBoardHost(host string) bool {
	for _, board := range jobBoardHosts {
		if matchesHost(host, board) {
			return true
		}
	}
	return false
}

func atsFor(host string) (atsHost, bool) {
	for _, ats := range atsHosts {
		if matchesHost(host, ats.Suffix) {
			return ats, true
		}
	}
	return atsHost{}, false
}

func matchesHost(host, suffix string) bool {
	return host == suffix || strings.HasSuffix(host, "."+suffix)
}

func boardToken(ats atsHost, host, path string) string {
	if ats.Token == "subdomain" {
		label, _, _ := strings.Cut(host, ".")
		label = strings.TrimPrefix(label, "careers-")
		if label == "" || label == "jobs" || label == "careers" || label == "www" {
			return ""
		}
		return label
	}
	segments := strings.Split(strings.Trim(path, "/"), "/")
	if len(segments) == 0 || segments[0] == "" {
		return ""
	}
	if segments[0] == "embed" && len(segments) > 1 {
		return strings.ToLower(segments[1])
	}
	return strings.ToLower(segments[0])
}

// Slug lowercases a name to letters and digits separated by single dashes.
func Slug(name string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(name) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			dash = false
			continue
		}
		if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	return strings.Trim(b.String(), "-")
}

// Words that say nothing about which company a name refers to.
var companyStopwords = map[string]struct{}{
	"inc": {}, "llc": {}, "ltd": {}, "limited": {}, "corp": {}, "corporation": {}, "co": {},
	"company": {}, "the": {}, "group": {}, "holdings": {}, "gmbh": {}, "plc": {}, "sa": {},
	"ag": {}, "bv": {}, "labs": {}, "technologies": {}, "technology": {}, "tech": {}, "hq": {},
	"and": {}, "of": {},
}

// CompanyMatches reports whether a company name plausibly owns a host or ATS
// board token: the squashed name appears in the token or a host label, or a
// distinctive word of the name does.
func CompanyMatches(company string, p ParsedURL) bool {
	words := []string{}
	for _, word := range strings.Split(Slug(company), "-") {
		if _, stop := companyStopwords[word]; stop || len(word) < 3 {
			continue
		}
		words = append(words, word)
	}
	if len(words) == 0 {
		return false
	}
	squashed := strings.Join(words, "")
	haystacks := []string{}
	if p.Token != "" {
		haystacks = append(haystacks, strings.ReplaceAll(p.Token, "-", ""))
	}
	if p.ATS == "" {
		for _, label := range strings.Split(p.Host, ".") {
			haystacks = append(haystacks, strings.ReplaceAll(label, "-", ""))
		}
	}
	for _, hay := range haystacks {
		if hay == "" {
			continue
		}
		if strings.Contains(hay, squashed) || (len(hay) >= 3 && strings.Contains(squashed, hay)) {
			return true
		}
		for _, word := range words {
			if strings.Contains(hay, word) {
				return true
			}
		}
	}
	return false
}

// DedupeKey groups the same role at the same company, so a second link to one
// job is caught even when the URLs differ. Company is the page id when the
// scout picked one, otherwise a slug of the name.
func DedupeKey(companyID, company, title string) string {
	key := strings.TrimSpace(companyID)
	if key == "" {
		key = Slug(company)
	}
	return key + "|" + Slug(title)
}
