package jobs

import (
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"sort"
	"strings"
	"time"
)

const (
	// defaultTitleSimilarity is the fuzzy title cutoff from docs/14 (strictly above).
	defaultTitleSimilarity = 0.9
	// defaultPostedWithin is how close two postings must be to fuzzy-merge.
	defaultPostedWithin = 30 * 24 * time.Hour
	maxFuzzyCandidates  = 50
	dedupeIndexName     = "dedupe_key_active"
	dedupeKeySep        = "\x1f"
	maxApplyURLRunes    = 2048
)

// Query parameters that only track where a click came from. Names are lowercase.
var trackingQueryParams = map[string]struct{}{
	"fbclid": {}, "gclid": {}, "dclid": {}, "msclkid": {}, "twclid": {},
	"gbraid": {}, "wbraid": {}, "igshid": {}, "li_fat_id": {},
	"mc_cid": {}, "mc_eid": {}, "trk": {}, "_ga": {},
	"gh_src": {}, "source": {}, "src": {}, "ref": {}, "referrer": {},
	"lever-source": {}, "lever-origin": {},
	"utm_source": {}, "utm_medium": {}, "utm_campaign": {}, "utm_term": {}, "utm_content": {},
}

// DedupeConfig is the fuzzy-match window and title cutoff. Zero fields mean defaults.
type DedupeConfig struct {
	TitleSimilarity float64
	PostedWithin    time.Duration
}

func DefaultDedupeConfig() DedupeConfig {
	return DedupeConfig{
		TitleSimilarity: defaultTitleSimilarity,
		PostedWithin:    defaultPostedWithin,
	}
}

func (cfg DedupeConfig) withDefaults() DedupeConfig {
	if cfg.TitleSimilarity <= 0 || cfg.TitleSimilarity > 1 {
		cfg.TitleSimilarity = defaultTitleSimilarity
	}
	if cfg.PostedWithin <= 0 {
		cfg.PostedWithin = defaultPostedWithin
	}
	return cfg
}

// DedupeRecord is the fields merge and the dry-run report need.
type DedupeRecord struct {
	ID            string
	JobID         string
	Company       string
	CompanyID     string
	Title         string
	Location      string
	ApplyURL      string
	Source        string
	PostedAt      time.Time
	DedupeKey     string
	ListingStatus string
}

// Key is the stored hash, or a freshly computed one when the row predates dedupe.
func (r DedupeRecord) Key() string {
	if r.DedupeKey != "" {
		return r.DedupeKey
	}
	return DedupeKey(r.Company, r.Title, r.Location, r.ApplyURL)
}

// DedupeKey is hash(company, normalized title, normalized location, canonical apply URL).
func DedupeKey(company, title, location, applyURL string) string {
	payload := strings.Join([]string{
		NormalizeCompany(company),
		NormalizeTitle(title),
		NormalizeLocation(location),
		CanonicalApplyURL(applyURL),
	}, dedupeKeySep)
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}

func NormalizeCompany(value string) string {
	return normalizeText(value)
}

func NormalizeTitle(value string) string {
	return normalizeText(value)
}

func NormalizeLocation(value string) string {
	return normalizeText(value)
}

func normalizeText(value string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(value))), " ")
}

// CanonicalApplyURL strips tracking parameters, lowercases the host, drops the
// fragment, and sorts remaining query keys. Invalid input still collapses case
// and whitespace so the hash stays stable.
func CanonicalApplyURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if runeCount(raw) > maxApplyURLRunes {
		raw = string([]rune(raw)[:maxApplyURLRunes])
	}
	toParse := raw
	if !strings.Contains(toParse, "://") {
		toParse = "https://" + toParse
	}
	parsed, err := url.Parse(toParse)
	if err != nil || parsed.Host == "" {
		return normalizeText(raw)
	}
	host := strings.ToLower(parsed.Hostname())
	host = strings.TrimPrefix(host, "www.")
	if port := parsed.Port(); port != "" && port != "80" && port != "443" {
		host = host + ":" + port
	}
	path := strings.TrimRight(parsed.EscapedPath(), "/")
	query := parsed.Query()
	keys := make([]string, 0, len(query))
	for key := range query {
		if dropTrackingParam(key) {
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

func dropTrackingParam(key string) bool {
	lower := strings.ToLower(strings.TrimSpace(key))
	if _, drop := trackingQueryParams[lower]; drop {
		return true
	}
	return strings.HasPrefix(lower, "utm_")
}

func runeCount(value string) int {
	n := 0
	for range value {
		n++
	}
	return n
}

const (
	sourceRankDirect     = 3
	sourceRankScouted    = 2
	sourceRankAggregated = 1
)

// SourceRank prefers direct over scouted over aggregated (docs/14).
func SourceRank(source string) int {
	switch canonicalizeSource(source) {
	case DirectSource:
		return sourceRankDirect
	case scoutedJobType:
		return sourceRankScouted
	default:
		return sourceRankAggregated
	}
}

func canonicalizeSource(source string) string {
	switch normalizeText(source) {
	case DirectSource:
		return DirectSource
	case ScoutedSource, scoutedJobType:
		return scoutedJobType
	case aggregatedSource:
		return aggregatedSource
	default:
		return normalizeText(source)
	}
}

// PreferIncomingSource is true when the incoming listing should replace the
// existing one. Equal rank keeps the listing already in the pool.
func PreferIncomingSource(incoming, existing string) bool {
	return SourceRank(incoming) > SourceRank(existing)
}

func SameCompany(a, b DedupeRecord) bool {
	if a.CompanyID != "" && b.CompanyID != "" {
		return a.CompanyID == b.CompanyID
	}
	left, right := NormalizeCompany(a.Company), NormalizeCompany(b.Company)
	return left != "" && left == right
}

func SameLocation(a, b DedupeRecord) bool {
	left, right := NormalizeLocation(a.Location), NormalizeLocation(b.Location)
	if left == "" || right == "" {
		return false
	}
	unknown := NormalizeLocation(locationNotListed)
	if left == unknown || right == unknown {
		return false
	}
	return left == right
}

func PostedWithin(a, b time.Time, window time.Duration) bool {
	if a.IsZero() || b.IsZero() || window <= 0 {
		return false
	}
	delta := a.Sub(b)
	if delta < 0 {
		delta = -delta
	}
	return delta <= window
}

// TitleSimilarity is 1 - levenshtein(normalized titles) / max length.
func TitleSimilarity(a, b string) float64 {
	left, right := NormalizeTitle(a), NormalizeTitle(b)
	if left == "" || right == "" {
		return 0
	}
	if left == right {
		return 1
	}
	dist := levenshtein(left, right)
	longer := len([]rune(left))
	if n := len([]rune(right)); n > longer {
		longer = n
	}
	if longer == 0 {
		return 0
	}
	return 1 - float64(dist)/float64(longer)
}

func FuzzyMatch(incoming, existing DedupeRecord, cfg DedupeConfig) bool {
	cfg = cfg.withDefaults()
	if !SameCompany(incoming, existing) || !SameLocation(incoming, existing) {
		return false
	}
	if !PostedWithin(incoming.PostedAt, existing.PostedAt, cfg.PostedWithin) {
		return false
	}
	return TitleSimilarity(incoming.Title, existing.Title) > cfg.TitleSimilarity
}

func levenshtein(a, b string) int {
	left := []rune(a)
	right := []rune(b)
	if len(left) == 0 {
		return len(right)
	}
	if len(right) == 0 {
		return len(left)
	}
	prev := make([]int, len(right)+1)
	curr := make([]int, len(right)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(left); i++ {
		curr[0] = i
		for j := 1; j <= len(right); j++ {
			cost := 1
			if left[i-1] == right[j-1] {
				cost = 0
			}
			del := prev[j] + 1
			ins := curr[j-1] + 1
			sub := prev[j-1] + cost
			curr[j] = minInt(del, ins, sub)
		}
		prev, curr = curr, prev
	}
	return prev[len(right)]
}

func minInt(values ...int) int {
	best := values[0]
	for _, value := range values[1:] {
		if value < best {
			best = value
		}
	}
	return best
}
