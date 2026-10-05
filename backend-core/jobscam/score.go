package jobscam

import (
	"crypto/sha256"
	"encoding/hex"
	"net"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

const (
	weightPayToApply       = 40
	weightCryptoWire       = 40
	weightSuspiciousURL    = 30
	weightOffPlatform      = 25
	weightTooGoodPay       = 25
	weightMismatchedDomain = 20
	weightDuplicateSpam    = 20
	weightMissingDomain    = 15

	maxYearlyPay        = 1_500_000
	maxHourlyPay        = 750
	juniorYearlyPayCap  = 400_000
	textWeeklyPayCap    = 3000
	textDailyPayCap     = 800
	textHourlyPayCap    = 200
	minCompanyTokenLen  = 4
	shortDescriptionLen = 80
	repeatShingleWords  = 8
	repeatShingleTimes  = 3
	maxScore            = 100
	snippetRunes        = 80
)

var (
	spacePattern   = regexp.MustCompile(`\s+`)
	urlPattern     = regexp.MustCompile(`(?i)\b(?:https?://[^\s<>"'()]+|t\.me/[^\s<>"'()]+|wa\.me/[^\s<>"'()]+)`)
	payTextPattern = regexp.MustCompile(
		`(?i)(?:\$|usd)\s*(\d[\d,]*)\s*(k)?\s*(?:/|per)\s*(week|weekly|day|daily|hour|hr|hourly)`,
	)
)

type phraseRule struct {
	code    string
	weight  int
	phrases []string
	label   string
}

var textRules = []phraseRule{
	{
		code:   ReasonPayToApply,
		weight: weightPayToApply,
		label:  "asks for a fee to apply",
		phrases: []string{
			"pay to apply",
			"pay-to-apply",
			"application fee",
			"registration fee",
			"training fee",
			"processing fee",
			"fee to apply",
			"send payment to apply",
			"deposit to apply",
			"starter kit fee",
		},
	},
	{
		code:   ReasonCryptoWire,
		weight: weightCryptoWire,
		label:  "asks for crypto or a wire",
		phrases: []string{
			"crypto wallet",
			"cryptocurrency",
			"bitcoin",
			" usdt",
			"usdt ",
			" usdc",
			"wire transfer",
			"western union",
			"moneygram",
			"money gram",
			"gift card",
			"send your bank",
			"bank details",
			"routing number",
			"pay with crypto",
			"btc wallet",
		},
	},
	{
		code:   ReasonOffPlatformContact,
		weight: weightOffPlatform,
		label:  "asks to move off the platform",
		phrases: []string{
			"telegram",
			"t.me/",
			"whatsapp",
			"whats app",
			"wa.me/",
			"signal app",
			"message me on",
			"contact me on",
			"dm me on",
			"text me at",
			"wechat",
			"wickr",
		},
	},
}

var knownATSHosts = map[string]struct{}{
	"greenhouse.io":        {},
	"boards.greenhouse.io": {},
	"lever.co":             {},
	"jobs.lever.co":        {},
	"ashbyhq.com":          {},
	"jobs.ashbyhq.com":     {},
	"myworkdayjobs.com":    {},
	"workday.com":          {},
	"smartrecruiters.com":  {},
	"icims.com":            {},
	"jobvite.com":          {},
	"lever.co.uk":          {},
	"indeed.com":           {},
	"linkedin.com":         {},
	"glassdoor.com":        {},
	"jobs.apple.com":       {},
	"careers.google.com":   {},
	"amazon.jobs":          {},
}

var urlShorteners = map[string]struct{}{
	"bit.ly": {}, "bitly.com": {}, "tinyurl.com": {}, "t.co": {},
	"goo.gl": {}, "ow.ly": {}, "is.gd": {}, "buff.ly": {},
	"cutt.ly": {}, "rebrand.ly": {}, "lnkd.in": {}, "t.me": {},
	"wa.me": {}, "bit.do": {}, "rb.gy": {},
}

var freeEmailHosts = map[string]struct{}{
	"gmail.com": {}, "yahoo.com": {}, "hotmail.com": {}, "outlook.com": {},
	"proton.me": {}, "protonmail.com": {}, "icloud.com": {}, "aol.com": {},
}

var companySuffixes = map[string]struct{}{
	"inc": {}, "llc": {}, "ltd": {}, "corp": {}, "co": {}, "gmbh": {},
	"plc": {}, "limited": {}, "company": {}, "incorporated": {},
}

// Score applies the deterministic rules. DuplicateHits is counted by the store.
func Score(in Input, threshold int) Result {
	if threshold < 0 || threshold > maxHoldThreshold {
		threshold = DefaultHoldThreshold
	}
	blob := combinedText(in)
	lower := strings.ToLower(blob)
	var reasons []Reason
	seen := map[string]struct{}{}

	add := func(reason Reason) {
		if reason.Code == "" || reason.Weight < 1 {
			return
		}
		if _, ok := seen[reason.Code]; ok {
			return
		}
		seen[reason.Code] = struct{}{}
		reasons = append(reasons, reason)
	}

	for _, rule := range textRules {
		if phrase, ok := firstPhrase(lower, rule.phrases); ok {
			add(Reason{Code: rule.code, Detail: rule.label + `: "` + strings.TrimSpace(phrase) + `"`, Weight: rule.weight, Snippet: snippetAround(blob, phrase)})
		}
	}
	if reason, ok := tooGoodPay(in, lower, blob); ok {
		add(reason)
	}
	for _, raw := range collectURLs(in) {
		if reason, ok := suspiciousURL(raw); ok {
			add(reason)
			break
		}
	}
	if reason, ok := domainSignal(in); ok {
		add(reason)
	}
	if in.DuplicateHits > 0 {
		add(Reason{
			Code:   ReasonDuplicateSpam,
			Detail: "same posting text already appeared on another job",
			Weight: weightDuplicateSpam,
		})
	} else if repeated, ok := repeatedShingle(lower); ok {
		add(Reason{
			Code:    ReasonDuplicateSpam,
			Detail:  "posting repeats the same boilerplate",
			Weight:  weightDuplicateSpam,
			Snippet: truncateRunes(repeated, snippetRunes),
		})
	} else if utf8SafeLen(strings.TrimSpace(in.Description)) > 0 && utf8SafeLen(strings.TrimSpace(in.Description)) < shortDescriptionLen {
		if _, hit := firstPhrase(lower, append(textRules[0].phrases, textRules[1].phrases...)); hit {
			add(Reason{
				Code:   ReasonDuplicateSpam,
				Detail: "very short posting that also asks for money",
				Weight: weightDuplicateSpam,
			})
		}
	}

	score := 0
	for _, reason := range reasons {
		score += reason.Weight
	}
	if score > maxScore {
		score = maxScore
	}
	if reasons == nil {
		reasons = []Reason{}
	}
	return Result{
		Score:       score,
		Threshold:   threshold,
		Hold:        score >= threshold,
		Reasons:     reasons,
		Fingerprint: Fingerprint(in.Title, in.Company, in.Description),
	}
}

// Fingerprint is a stable hash of title, company, and description.
func Fingerprint(title, company, description string) string {
	norm := spacePattern.ReplaceAllString(strings.ToLower(strings.TrimSpace(title+"\n"+company+"\n"+description)), " ")
	sum := sha256.Sum256([]byte(norm))
	return hex.EncodeToString(sum[:])
}

func combinedText(in Input) string {
	parts := []string{in.Title, in.Company, in.Summary, in.Description, in.ApplyURL, in.CompanyURL}
	return strings.Join(parts, "\n")
}

func firstPhrase(lower string, phrases []string) (string, bool) {
	for _, phrase := range phrases {
		if phrase != "" && strings.Contains(lower, phrase) {
			return phrase, true
		}
	}
	return "", false
}

func tooGoodPay(in Input, lower, blob string) (Reason, bool) {
	maxPay := in.PayMax
	if in.PayMin > maxPay {
		maxPay = in.PayMin
	}
	period := strings.ToLower(strings.TrimSpace(in.PayPeriod))
	switch {
	case period == "year" && maxPay > maxYearlyPay:
		return Reason{Code: ReasonTooGoodPay, Detail: "yearly pay is above any realistic role", Weight: weightTooGoodPay}, true
	case period == "hour" && maxPay > maxHourlyPay:
		return Reason{Code: ReasonTooGoodPay, Detail: "hourly pay is above any realistic role", Weight: weightTooGoodPay}, true
	case period == "year" && maxPay > juniorYearlyPayCap && (in.Seniority == "" || in.Seniority == "junior"):
		return Reason{Code: ReasonTooGoodPay, Detail: "pay is far above a junior or unleveled role", Weight: weightTooGoodPay}, true
	}
	if match := payTextPattern.FindStringSubmatch(lower); match != nil {
		amount := parseMoney(match[1], match[2] != "")
		unit := match[3]
		switch {
		case strings.HasPrefix(unit, "week") && amount >= textWeeklyPayCap:
			return Reason{Code: ReasonTooGoodPay, Detail: "advertised weekly pay is too high to be real", Weight: weightTooGoodPay, Snippet: snippetAround(blob, match[0])}, true
		case strings.HasPrefix(unit, "day") && amount >= textDailyPayCap:
			return Reason{Code: ReasonTooGoodPay, Detail: "advertised daily pay is too high to be real", Weight: weightTooGoodPay, Snippet: snippetAround(blob, match[0])}, true
		case (strings.HasPrefix(unit, "hour") || unit == "hr") && amount >= textHourlyPayCap:
			return Reason{Code: ReasonTooGoodPay, Detail: "advertised hourly pay is too high to be real", Weight: weightTooGoodPay, Snippet: snippetAround(blob, match[0])}, true
		}
	}
	if strings.Contains(lower, "no interview required") && maxPay > 0 {
		return Reason{Code: ReasonTooGoodPay, Detail: "high pay with no interview required", Weight: weightTooGoodPay}, true
	}
	return Reason{}, false
}

func parseMoney(raw string, thousands bool) int {
	cleaned := strings.ReplaceAll(raw, ",", "")
	value, err := strconv.Atoi(cleaned)
	if err != nil {
		return 0
	}
	if thousands {
		value *= 1000
	}
	return value
}

func collectURLs(in Input) []string {
	seen := map[string]struct{}{}
	var out []string
	add := func(raw string) {
		raw = strings.TrimRight(strings.TrimSpace(raw), ".,);]")
		if raw == "" {
			return
		}
		if _, ok := seen[raw]; ok {
			return
		}
		seen[raw] = struct{}{}
		out = append(out, raw)
	}
	add(in.ApplyURL)
	add(in.CompanyURL)
	for _, match := range urlPattern.FindAllString(combinedText(in), -1) {
		add(match)
	}
	return out
}

func suspiciousURL(raw string) (Reason, bool) {
	parsed, host, err := parseHost(raw)
	if err != nil {
		if looksLikeBareHost(raw) {
			return Reason{}, false
		}
		return Reason{Code: ReasonSuspiciousURL, Detail: "apply link is not a usable URL", Weight: weightSuspiciousURL, Snippet: truncateRunes(raw, snippetRunes)}, true
	}
	if parsed != nil && parsed.User != nil {
		return Reason{Code: ReasonSuspiciousURL, Detail: "URL embeds a username or password", Weight: weightSuspiciousURL, Snippet: host}, true
	}
	if parsed != nil && parsed.Scheme != "" && parsed.Scheme != "http" && parsed.Scheme != "https" {
		return Reason{Code: ReasonSuspiciousURL, Detail: "URL uses a scheme other than http(s)", Weight: weightSuspiciousURL, Snippet: parsed.Scheme}, true
	}
	if ip := net.ParseIP(strings.Trim(host, "[]")); ip != nil {
		return Reason{Code: ReasonSuspiciousURL, Detail: "apply link points at a raw IP address", Weight: weightSuspiciousURL, Snippet: host}, true
	}
	root := registrableDomain(host)
	if _, ok := urlShorteners[host]; ok || (root != "" && containsHost(urlShorteners, host, root)) {
		return Reason{Code: ReasonSuspiciousURL, Detail: "apply link is a URL shortener or chat app", Weight: weightSuspiciousURL, Snippet: host}, true
	}
	if containsHost(freeEmailHosts, host, root) {
		return Reason{Code: ReasonSuspiciousURL, Detail: "apply link is a personal email host", Weight: weightSuspiciousURL, Snippet: host}, true
	}
	return Reason{}, false
}

func domainSignal(in Input) (Reason, bool) {
	applyHost, applyRoot := hostOf(in.ApplyURL)
	companyHost, companyRoot := hostOf(in.CompanyURL)
	if applyHost == "" {
		return Reason{}, false
	}
	if isATSHost(applyHost, applyRoot) {
		return Reason{}, false
	}
	if companyRoot != "" && applyRoot != "" && companyRoot != applyRoot && !isATSHost(applyHost, applyRoot) {
		if !companyNameInHost(in.Company, applyHost) {
			return Reason{
				Code:    ReasonMismatchedDomain,
				Detail:  "apply link domain does not match the company site",
				Weight:  weightMismatchedDomain,
				Snippet: applyHost,
			}, true
		}
	}
	if companyHost == "" && !isATSHost(applyHost, applyRoot) && !companyNameInHost(in.Company, applyHost) {
		return Reason{
			Code:    ReasonMissingDomain,
			Detail:  "no company website, and the apply link is not a known careers host",
			Weight:  weightMissingDomain,
			Snippet: applyHost,
		}, true
	}
	return Reason{}, false
}

func isATSHost(host, root string) bool {
	return containsHost(knownATSHosts, host, root)
}

func containsHost(set map[string]struct{}, host, root string) bool {
	if _, ok := set[host]; ok {
		return true
	}
	if root != "" {
		if _, ok := set[root]; ok {
			return true
		}
	}
	for name := range set {
		if host == name || strings.HasSuffix(host, "."+name) {
			return true
		}
	}
	return false
}

func hostOf(raw string) (string, string) {
	_, host, err := parseHost(raw)
	if err != nil {
		return "", ""
	}
	return host, registrableDomain(host)
}

func parseHost(raw string) (*url.URL, string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, "", errEmptyURL
	}
	if !strings.Contains(raw, "://") {
		if strings.HasPrefix(strings.ToLower(raw), "t.me/") || strings.HasPrefix(strings.ToLower(raw), "wa.me/") {
			raw = "https://" + raw
		} else if looksLikeBareHost(raw) {
			raw = "https://" + raw
		}
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return nil, "", err
	}
	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	host = strings.TrimPrefix(host, "www.")
	if host == "" {
		return parsed, "", errEmptyURL
	}
	return parsed, host, nil
}

var errEmptyURL = errString("empty url")

type errString string

func (e errString) Error() string { return string(e) }

func looksLikeBareHost(raw string) bool {
	raw = strings.ToLower(strings.TrimSpace(raw))
	if strings.ContainsAny(raw, " /?#") {
		return false
	}
	return strings.Contains(raw, ".")
}

func registrableDomain(host string) string {
	host = strings.ToLower(strings.TrimSpace(host))
	host = strings.TrimPrefix(host, "www.")
	if host == "" {
		return ""
	}
	if net.ParseIP(strings.Trim(host, "[]")) != nil {
		return host
	}
	parts := strings.Split(host, ".")
	if len(parts) < 2 {
		return host
	}
	if len(parts) >= 3 {
		tld := parts[len(parts)-1]
		sld := parts[len(parts)-2]
		if len(tld) == 2 && (sld == "co" || sld == "com" || sld == "org" || sld == "net" || sld == "ac") {
			return strings.Join(parts[len(parts)-3:], ".")
		}
	}
	return strings.Join(parts[len(parts)-2:], ".")
}

func companyNameInHost(name, host string) bool {
	host = strings.ToLower(host)
	for _, token := range companyTokens(name) {
		if strings.Contains(host, token) {
			return true
		}
	}
	return false
}

func companyTokens(name string) []string {
	fields := strings.FieldsFunc(strings.ToLower(name), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	out := make([]string, 0, len(fields))
	for _, field := range fields {
		if _, skip := companySuffixes[field]; skip {
			continue
		}
		if len(field) < minCompanyTokenLen {
			continue
		}
		out = append(out, field)
	}
	return out
}

func repeatedShingle(lower string) (string, bool) {
	words := strings.FieldsFunc(lower, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	if len(words) < repeatShingleWords*repeatShingleTimes {
		return "", false
	}
	counts := map[string]int{}
	for i := 0; i+repeatShingleWords <= len(words); i++ {
		key := strings.Join(words[i:i+repeatShingleWords], " ")
		counts[key]++
		if counts[key] >= repeatShingleTimes {
			return key, true
		}
	}
	return "", false
}

func snippetAround(text, needle string) string {
	if needle == "" {
		return ""
	}
	lower := strings.ToLower(text)
	index := strings.Index(lower, strings.ToLower(needle))
	if index < 0 {
		return truncateRunes(needle, snippetRunes)
	}
	runes := []rune(text)
	start := len([]rune(text[:index]))
	if start > 20 {
		start -= 20
	} else {
		start = 0
	}
	end := start + snippetRunes
	if end > len(runes) {
		end = len(runes)
	}
	return strings.TrimSpace(string(runes[start:end]))
}

func truncateRunes(value string, limit int) string {
	if limit < 1 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return strings.TrimSpace(string(runes[:limit]))
}

func utf8SafeLen(value string) int {
	return len([]rune(value))
}
