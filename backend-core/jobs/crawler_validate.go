package jobs

import (
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	maxCrawlerURLRunes         = 2048
	maxCrawlerCompanyTextRunes = 512
	maxCrawlerSocials          = 5
	crawlerBuiltinHost         = "builtin.com"
	crawlerCompanyWebsiteKey   = "website"
	crawlerCompanyProfileKey   = "profileUrl"
	crawlerCompanySocialsKey   = "socials"
	crawlerCompanySocialKey    = "social"
)

var crawlerSocialHosts = map[string][]string{
	"linkedin":  {"linkedin.com"},
	"x":         {"x.com", "twitter.com"},
	"facebook":  {"facebook.com"},
	"instagram": {"instagram.com"},
	"github":    {"github.com"},
}

var crawlerSocialKeyAliases = map[string]string{
	"twitter": "x",
}

var crawlerCompanyTextKeys = []string{"size", "hq", "founded", "about"}

func sanitizeCrawledJob(job *CrawledJob) {
	if job == nil {
		return
	}
	if job.Company.Metadata == nil {
		job.Company.Metadata = map[string]any{}
	}
	sanitizeCrawledCompanyFields(job)
	job.CrawledAt = crawledAtRFC3339(*job)
	if job.Metadata != nil {
		delete(job.Metadata, crawlerCrawledAtKey)
	}
}

func sanitizeCrawledCompanyFields(job *CrawledJob) {
	website := ""
	for _, candidate := range []string{
		stringValue(job.Company.Metadata[crawlerCompanyWebsiteKey]),
		job.CompanyLink,
		stringValue(job.Metadata[crawlerWebsiteKey]),
	} {
		if clean, ok := crawlerCompanyWebsite(candidate); ok {
			website = clean
			break
		}
	}
	if website != "" {
		job.Company.Metadata[crawlerCompanyWebsiteKey] = website
		job.CompanyLink = website
	} else {
		delete(job.Company.Metadata, crawlerCompanyWebsiteKey)
		job.CompanyLink = ""
	}

	if clean, ok := crawlerHTTPURL(stringValue(job.Company.Metadata[crawlerCompanyProfileKey])); ok {
		job.Company.Metadata[crawlerCompanyProfileKey] = clean
	} else {
		delete(job.Company.Metadata, crawlerCompanyProfileKey)
	}

	socials := sanitizeCrawlerSocials(job.Company.Metadata[crawlerCompanySocialsKey], job.Company.Metadata[crawlerCompanySocialKey])
	if len(socials) == 0 {
		delete(job.Company.Metadata, crawlerCompanySocialsKey)
	} else {
		asAny := make(map[string]any, len(socials))
		for key, value := range socials {
			asAny[key] = value
		}
		job.Company.Metadata[crawlerCompanySocialsKey] = asAny
	}
	delete(job.Company.Metadata, crawlerCompanySocialKey)

	for _, key := range crawlerCompanyTextKeys {
		text := stringValue(job.Company.Metadata[key])
		if text == "" || utf8.RuneCountInString(text) > maxCrawlerCompanyTextRunes {
			delete(job.Company.Metadata, key)
			continue
		}
		job.Company.Metadata[key] = text
	}
}

func crawlerHTTPURL(raw string) (string, bool) {
	value := strings.TrimSpace(raw)
	if value == "" || utf8.RuneCountInString(value) > maxCrawlerURLRunes {
		return "", false
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.User != nil || parsed.Host == "" {
		return "", false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", false
	}
	return value, true
}

func crawlerCompanyWebsite(raw string) (string, bool) {
	clean, ok := crawlerHTTPURL(raw)
	if !ok {
		return "", false
	}
	parsed, err := url.Parse(clean)
	if err != nil || isCrawlerBuiltinHost(parsed.Hostname()) {
		return "", false
	}
	return clean, true
}

func isCrawlerBuiltinHost(host string) bool {
	host = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(host)), "www.")
	return host == crawlerBuiltinHost || strings.HasSuffix(host, "."+crawlerBuiltinHost)
}

func crawlerHostMatches(host string, suffixes []string) bool {
	host = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(host)), "www.")
	if host == "" {
		return false
	}
	for _, suffix := range suffixes {
		if host == suffix || strings.HasSuffix(host, "."+suffix) {
			return true
		}
	}
	return false
}

func socialNetworkKey(raw string) string {
	key := strings.ToLower(strings.TrimSpace(raw))
	if alias, ok := crawlerSocialKeyAliases[key]; ok {
		key = alias
	}
	if _, ok := crawlerSocialHosts[key]; ok {
		return key
	}
	return ""
}

func sanitizeCrawlerSocials(values ...any) map[string]string {
	out := map[string]string{}
	for _, value := range values {
		for key, item := range mapValue(value) {
			network := socialNetworkKey(key)
			if network == "" || out[network] != "" {
				continue
			}
			clean, ok := crawlerHTTPURL(stringValue(item))
			if !ok {
				continue
			}
			parsed, err := url.Parse(clean)
			if err != nil || !crawlerHostMatches(parsed.Hostname(), crawlerSocialHosts[network]) {
				continue
			}
			out[network] = clean
			if len(out) == maxCrawlerSocials {
				return out
			}
		}
	}
	return out
}

func crawledAtRFC3339(job CrawledJob) string {
	raw := firstString(job.CrawledAt, job.Metadata[crawlerCrawledAtKey])
	if raw == "" {
		return ""
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339} {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return parsed.UTC().Format(time.RFC3339)
		}
	}
	return ""
}
