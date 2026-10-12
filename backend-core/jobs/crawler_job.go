package jobs

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

const (
	crawlerApplyURLKey    = "applyUrl"
	crawlerApplyLinkKey   = "applyLink"
	crawlerCompanyNameKey = "companyName"
	crawlerCompanyKey     = "company"
	crawlerCompanyLinkKey = "companyLink"
	crawlerMetadataKey    = "metadata"
	crawlerPostedAtKey    = "postedAt"
	crawlerPostedAgoKey   = "postedAgo"
	crawlerCrawledAtKey   = "crawledAt"
	crawlerWebsiteKey     = "companyWebsite"
	crawlerLogoKey        = "companyLogo"
	crawlerLocationKey    = "location"
	crawlerWorkModeKey    = "workMode"
	crawlerEmploymentKey  = "employmentType"
	crawlerSeniorityKey   = "seniority"
	crawlerSalaryKey      = "salary"
	crawlerDetailsKey     = "details"
	crawlerExtraKey       = "extra"

	// maxCrawlerJobMetadataBytes is the most extra metadata one job may store.
	maxCrawlerJobMetadataBytes = 64 << 10
)

var crawledJobJSONKeys = map[string]struct{}{
	"createdBy": {}, "source": {}, crawlerApplyURLKey: {}, crawlerApplyLinkKey: {},
	"title": {}, "description": {}, crawlerCompanyNameKey: {}, crawlerCompanyKey: {},
	crawlerCompanyLinkKey: {}, "duplicateWindowDays": {}, crawlerPostedAtKey: {},
	crawlerPostedAgoKey: {}, crawlerCrawledAtKey: {}, crawlerMetadataKey: {}, "id": {}, "tags": {}, "skills": {},
	crawlerDetailsKey: {}, "applicants": {},
}

var companyMetadataAliases = []struct {
	from, to string
}{
	{crawlerWebsiteKey, "website"},
	{"website", "website"},
	{"companySize", "size"},
	{"size", "size"},
	{"companyHq", "hq"},
	{"hq", "hq"},
	{"companyFounded", "founded"},
	{"founded", "founded"},
	{"companyAbout", "about"},
	{"about", "about"},
	{"companySocial", "social"},
	{"social", "social"},
	{"companySocials", "socials"},
	{"socials", "socials"},
	{"companyProfileUrl", "profileUrl"},
	{"profileUrl", "profileUrl"},
}

// CrawledJob is one job as the crawler extension reads it from a job board.
// Wire keys stay applyLink and company.name; applyUrl and companyName are aliases.
// Unknown fields land in Metadata and are stored at temp_jobs.metadata.extra.
type CrawledJob struct {
	CreatedBy           string            `json:"createdBy"`
	Source              string            `json:"source"`
	ApplyLink           string            `json:"applyLink"`
	Title               string            `json:"title"`
	Description         string            `json:"description"`
	PostedAt            string            `json:"postedAt"`
	PostedAgo           string            `json:"postedAgo"`
	CrawledAt           string            `json:"crawledAt"`
	DuplicateWindowDays int               `json:"duplicateWindowDays"`
	Tags                []string          `json:"tags"`
	Skills              []string          `json:"skills"`
	Details             map[string]string `json:"details"`
	CompanyLink         string            `json:"companyLink"`
	Applicants          struct {
		Count int    `json:"count"`
		Text  string `json:"text"`
	} `json:"applicants"`
	Company  CrawledCompany `json:"company"`
	Metadata map[string]any `json:"metadata"`
}

// UnmarshalJSON keeps applyLink and company.name, accepts aliases, and moves
// unknown fields into Metadata instead of rejecting them.
func (job *CrawledJob) UnmarshalJSON(data []byte) error {
	type crawledJobJSON CrawledJob
	var decoded crawledJobJSON
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*job = CrawledJob(decoded)

	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	normalizeCrawledJob(job, raw)
	return nil
}

func normalizeCrawledJob(job *CrawledJob, raw map[string]any) {
	if raw == nil {
		raw = map[string]any{}
	}
	meta := map[string]any{}
	if existing := mapValue(job.Metadata); existing != nil {
		for key, value := range existing {
			meta[key] = value
		}
	}
	if nested := mapValue(raw[crawlerMetadataKey]); nested != nil {
		for key, value := range nested {
			if _, exists := meta[key]; !exists {
				meta[key] = value
			}
		}
	}
	for key, value := range raw {
		if _, core := crawledJobJSONKeys[key]; core {
			continue
		}
		if _, exists := meta[key]; !exists {
			meta[key] = value
		}
	}
	job.Metadata = meta

	if apply := firstString(job.ApplyLink, raw[crawlerApplyLinkKey], raw[crawlerApplyURLKey]); apply != "" {
		job.ApplyLink = apply
	}
	if name := firstString(job.Company.Name, nestedMapString(raw, crawlerCompanyKey, "name"), raw[crawlerCompanyNameKey]); name != "" {
		job.Company.Name = name
	}
	if logo := firstString(job.Company.Logo, nestedMapString(raw, crawlerCompanyKey, "logo"), raw[crawlerLogoKey], meta[crawlerLogoKey]); logo != "" {
		job.Company.Logo = logo
	}
	if link := firstString(job.CompanyLink, raw[crawlerCompanyLinkKey], raw[crawlerWebsiteKey], meta[crawlerWebsiteKey], nestedMapString(raw, crawlerCompanyKey, "website")); link != "" {
		job.CompanyLink = link
	}
	if posted := firstString(job.PostedAt, raw[crawlerPostedAtKey], meta[crawlerPostedAtKey]); posted != "" {
		job.PostedAt = posted
	}
	if ago := firstString(job.PostedAgo, raw[crawlerPostedAgoKey], meta[crawlerPostedAgoKey]); ago != "" {
		job.PostedAgo = ago
	}
	if crawled := firstString(job.CrawledAt, raw[crawlerCrawledAtKey], meta[crawlerCrawledAtKey]); crawled != "" {
		job.CrawledAt = crawled
	}
	if tags := stringSlice(raw["tags"]); len(tags) > 0 {
		job.Tags = tags
	} else if badges := stringSlice(meta["badges"]); len(job.Tags) == 0 && len(badges) > 0 {
		job.Tags = badges
	}
	if skills := stringSlice(raw["skills"]); len(skills) > 0 {
		job.Skills = skills
	} else if skills := stringSlice(meta["skills"]); len(job.Skills) == 0 && len(skills) > 0 {
		job.Skills = skills
	}
	if job.Applicants.Count == 0 {
		if count := intValue(meta["applicantCount"]); count > 0 {
			job.Applicants.Count = count
		}
	}
	fillAnalyzerDetails(job)
	foldCompanyMetadata(job)
	sanitizeCrawledJob(job)
}

func fillAnalyzerDetails(job *CrawledJob) {
	details := map[string]string{}
	for key, value := range job.Details {
		if text := strings.TrimSpace(value); text != "" {
			details[strings.TrimSpace(key)] = text
		}
	}
	if existing := mapValue(job.Metadata[crawlerDetailsKey]); existing != nil {
		for key, value := range existing {
			if _, ok := details[key]; ok {
				continue
			}
			if text := stringValue(value); text != "" {
				details[key] = text
			}
		}
	}
	set := func(dest string, sources ...any) {
		if strings.TrimSpace(details[dest]) != "" {
			return
		}
		if text := firstString(sources...); text != "" {
			details[dest] = text
		}
	}
	set("location", job.Metadata[crawlerLocationKey], details["location"])
	set("remote", job.Metadata[crawlerWorkModeKey], job.Metadata["remote"], details["remote"])
	set("time", job.Metadata[crawlerEmploymentKey], job.Metadata["time"], details["time"])
	set("seniority", job.Metadata[crawlerSeniorityKey], details["seniority"])
	set("salary", job.Metadata[crawlerSalaryKey], details["salary"])
	job.Details = details
}

func foldCompanyMetadata(job *CrawledJob) {
	if job.Company.Metadata == nil {
		job.Company.Metadata = map[string]any{}
	}
	for _, alias := range companyMetadataAliases {
		if _, exists := job.Company.Metadata[alias.to]; exists {
			continue
		}
		if value, ok := job.Metadata[alias.from]; ok {
			job.Company.Metadata[alias.to] = value
		}
	}
	if _, exists := job.Company.Metadata["website"]; !exists && job.CompanyLink != "" {
		job.Company.Metadata["website"] = job.CompanyLink
	}
}

func crawledApplyURL(job CrawledJob) string {
	return strings.TrimSpace(job.ApplyLink)
}

func crawledCompanyName(job CrawledJob) string {
	return strings.TrimSpace(job.Company.Name)
}

func crawledCompanyLink(job CrawledJob) string {
	return strings.TrimSpace(firstString(job.CompanyLink, job.Company.Metadata["website"], job.Metadata[crawlerWebsiteKey]))
}

func crawledCompanyLogo(job CrawledJob) string {
	return strings.TrimSpace(firstString(job.Company.Logo, job.Metadata[crawlerLogoKey]))
}

func crawlerMetadataBytes(meta map[string]any) int {
	if len(meta) == 0 {
		return 0
	}
	raw, err := json.Marshal(meta)
	if err != nil {
		return maxCrawlerJobMetadataBytes + 1
	}
	return len(raw)
}

func crawlerJobMetadataBytes(job CrawledJob) int {
	combined := map[string]any{}
	if len(job.Metadata) > 0 {
		combined["job"] = job.Metadata
	}
	if len(job.Company.Metadata) > 0 {
		combined["company"] = job.Company.Metadata
	}
	if crawled := strings.TrimSpace(job.CrawledAt); crawled != "" {
		combined[crawlerCrawledAtKey] = crawled
	}
	return crawlerMetadataBytes(combined)
}

func parseCrawledPostedAt(job CrawledJob, now time.Time) time.Time {
	for _, raw := range []string{job.PostedAt, stringValue(job.Metadata[crawlerPostedAtKey])} {
		if parsed, ok := parseFlexibleTime(raw); ok {
			return parsed.UTC()
		}
	}
	if parsed, ok := postedAtFromAgoText(firstString(job.PostedAgo, job.Metadata[crawlerPostedAgoKey]), now); ok {
		return parsed
	}
	return time.Time{}
}

func parseFlexibleTime(raw string) (time.Time, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, false
	}
	layouts := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, true
		}
	}
	return time.Time{}, false
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case json.Number:
		return typed.String()
	case float64:
		if typed == float64(int64(typed)) {
			return strconv.FormatInt(int64(typed), 10)
		}
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case int:
		return strconv.Itoa(typed)
	case bool:
		if typed {
			return "true"
		}
		return "false"
	default:
		return ""
	}
}

func intValue(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case json.Number:
		n, _ := typed.Int64()
		return int(n)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(typed))
		return n
	default:
		return 0
	}
}

func mapValue(value any) map[string]any {
	switch typed := value.(type) {
	case map[string]any:
		return typed
	default:
		return map[string]any{}
	}
}

func stringSlice(value any) []string {
	switch typed := value.(type) {
	case []string:
		return cleanStrings(typed)
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if text := stringValue(item); text != "" {
				out = append(out, text)
			}
		}
		return out
	case string:
		if text := strings.TrimSpace(typed); text != "" {
			return []string{text}
		}
	}
	return nil
}

func firstString(values ...any) string {
	for _, value := range values {
		if text := stringValue(value); text != "" {
			return text
		}
	}
	return ""
}

func nestedMapString(raw map[string]any, objectKey, field string) string {
	return stringValue(mapValue(raw[objectKey])[field])
}
