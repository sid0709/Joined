package ranking

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Filter is the exact part of a search: a job either passes every field or it is
// out. It never changes a score. The same definition runs three ways — against
// the in-memory bitmaps (counts, feeds, scans), against one job (Matches), and
// as a Qdrant payload filter (Qdrant) — and tests keep the three in agreement.
type Filter struct {
	Workplaces  []Workplace
	Seniorities []Level
	Employments []Employment
	// Sources keep jobs whose job.source is one of these (aggregated, direct, scouted).
	Sources []string
	// HiddenOnly keeps scouted ("hidden") jobs only.
	HiddenOnly bool
	// LocationTerms must all appear in the job's location; the last may be a prefix.
	LocationTerms []string
	// CompanyTerms must all appear in the company name; the last may be a prefix.
	CompanyTerms []string
	// PayMinUSD keeps jobs whose top annual pay reaches it. Unknown pay is excluded.
	PayMinUSD int32
	// PayMaxUSD keeps jobs whose bottom annual pay is at most it. Unknown pay is excluded.
	PayMaxUSD int32
	// PostedAfter keeps jobs posted at or after it.
	PostedAfter time.Time
	// VisaOnly keeps jobs that say they sponsor visas.
	VisaOnly bool
	// Regions keep jobs hiring in one of these markets.
	Regions []Region
	// Exclude drops these job ids (hidden by the user, already applied).
	Exclude []string
}

// Empty reports whether the filter keeps every public job.
func (f Filter) Empty() bool {
	return len(f.Workplaces) == 0 && len(f.Seniorities) == 0 && len(f.Employments) == 0 &&
		len(f.Sources) == 0 && !f.HiddenOnly && len(f.LocationTerms) == 0 && len(f.CompanyTerms) == 0 &&
		f.PayMinUSD == 0 && f.PayMaxUSD == 0 && f.PostedAfter.IsZero() && !f.VisaOnly &&
		len(f.Regions) == 0 && len(f.Exclude) == 0
}

// Matches reports whether one job passes.
func (f Filter) Matches(job *JobFeatures) bool {
	if len(f.Workplaces) > 0 && !containsValue(f.Workplaces, job.Workplace) {
		return false
	}
	if len(f.Seniorities) > 0 && !containsValue(f.Seniorities, job.Seniority) {
		return false
	}
	if len(f.Employments) > 0 && !containsValue(f.Employments, job.Employment) {
		return false
	}
	if len(f.Sources) > 0 && !containsValue(f.Sources, job.Source) {
		return false
	}
	if f.HiddenOnly && !job.Hidden {
		return false
	}
	if f.VisaOnly && job.Visa != VisaYes {
		return false
	}
	if len(f.Regions) > 0 && !containsValue(f.Regions, job.Region) {
		return false
	}
	// Same resolution as the index: pay in whole thousands, dates in whole days.
	if f.PayMinUSD > 0 && (!job.PayKnown || int64(job.PayMaxUSD/payUnitUSD) < (int64(f.PayMinUSD)+payUnitUSD-1)/payUnitUSD) {
		return false
	}
	if f.PayMaxUSD > 0 && (!job.PayKnown || job.PayMinUSD/payUnitUSD > f.PayMaxUSD/payUnitUSD) {
		return false
	}
	if !f.PostedAfter.IsZero() && dayOf(job.PostedAt) < dayOf(f.PostedAfter) {
		return false
	}
	if len(f.LocationTerms) > 0 && !termsMatch(f.LocationTerms, LocationTerms(job.Location)) {
		return false
	}
	if len(f.CompanyTerms) > 0 && !termsMatch(f.CompanyTerms, LocationTerms(job.Company)) {
		return false
	}
	return !containsValue(f.Exclude, job.JobID)
}

// termsMatch requires every wanted term among have; the last wanted term may be a prefix.
func termsMatch(want, have []string) bool {
	for i, term := range want {
		found := false
		for _, candidate := range have {
			if candidate == term || (i == len(want)-1 && strings.HasPrefix(candidate, term)) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func containsValue[T comparable](values []T, value T) bool {
	for _, v := range values {
		if v == value {
			return true
		}
	}
	return false
}

// Key is a stable fingerprint of the filter for cache keys: field order and value
// order do not change it.
func (f Filter) Key() string {
	parts := []string{
		"w=" + joinSorted(f.Workplaces),
		"s=" + joinSorted(f.Seniorities),
		"e=" + joinSorted(f.Employments),
		"src=" + joinSortedStrings(f.Sources),
		"h=" + strconv.FormatBool(f.HiddenOnly),
		"loc=" + strings.Join(f.LocationTerms, " "),
		"co=" + strings.Join(f.CompanyTerms, " "),
		"pmin=" + strconv.Itoa(int(f.PayMinUSD)),
		"pmax=" + strconv.Itoa(int(f.PayMaxUSD)),
		"v=" + strconv.FormatBool(f.VisaOnly),
		"r=" + joinSorted(f.Regions),
		"x=" + joinSortedStrings(f.Exclude),
	}
	if !f.PostedAfter.IsZero() {
		// Day resolution, so a cache entry lives through the day instead of one request.
		parts = append(parts, "p="+f.PostedAfter.UTC().Format(time.DateOnly))
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(sum[:8])
}

func joinSorted[T ~uint8](values []T) string {
	out := make([]string, len(values))
	for i, v := range values {
		out[i] = strconv.Itoa(int(v))
	}
	sort.Strings(out)
	return strings.Join(out, ",")
}

func joinSortedStrings(values []string) string {
	out := append([]string{}, values...)
	sort.Strings(out)
	return strings.Join(out, ",")
}

// Qdrant builds the payload filter for one Qdrant query. The expansions are the full
// index terms the last location/company term is a prefix of
// (a prefix is not a Qdrant match type), so both sides keep the same jobs.
func (f Filter) Qdrant(locationExpansion, companyExpansion []string) map[string]any {
	must := []map[string]any{{"key": payloadActive, "match": map[string]any{"value": true}}}
	addAny := func(key string, values []any) {
		if len(values) > 0 {
			must = append(must, map[string]any{"key": key, "match": map[string]any{"any": values}})
		}
	}
	addAny(payloadWorkplace, anyInts(f.Workplaces))
	addAny(payloadSeniority, anyInts(f.Seniorities))
	addAny(payloadEmployment, anyInts(f.Employments))
	addAny(payloadRegion, anyInts(f.Regions))
	if len(f.Sources) > 0 {
		values := make([]any, len(f.Sources))
		for i, source := range f.Sources {
			values[i] = source
		}
		addAny(payloadSource, values)
	}
	if f.HiddenOnly {
		must = append(must, map[string]any{"key": payloadHidden, "match": map[string]any{"value": true}})
	}
	if f.VisaOnly {
		must = append(must, map[string]any{"key": payloadVisa, "match": map[string]any{"value": true}})
	}
	// Pay in thousands and dates in days, rounded exactly as the in-memory index rounds.
	if f.PayMinUSD > 0 {
		units := (int64(f.PayMinUSD) + payUnitUSD - 1) / payUnitUSD
		must = append(must, map[string]any{"key": payloadPayMax, "range": map[string]any{"gte": units}})
	}
	if f.PayMaxUSD > 0 {
		must = append(must, map[string]any{"key": payloadPayMin, "range": map[string]any{"lte": int64(f.PayMaxUSD / payUnitUSD)}})
	}
	if f.PayMinUSD > 0 || f.PayMaxUSD > 0 {
		must = append(must, map[string]any{"key": payloadPayKnown, "match": map[string]any{"value": true}})
	}
	if !f.PostedAfter.IsZero() {
		must = append(must, map[string]any{"key": payloadPosted, "range": map[string]any{"gte": dayOf(f.PostedAfter)}})
	}
	must = append(must, termConditions(payloadLocation, f.LocationTerms, locationExpansion)...)
	must = append(must, termConditions(payloadCompany, f.CompanyTerms, companyExpansion)...)
	filter := map[string]any{"must": must}
	if len(f.Exclude) > 0 {
		values := make([]any, len(f.Exclude))
		for i, id := range f.Exclude {
			values[i] = id
		}
		filter["must_not"] = []map[string]any{{"key": payloadJobID, "match": map[string]any{"any": values}}}
	}
	return filter
}

// termConditions requires every exact term, and any of the last term's expansions.
func termConditions(key string, terms, expansion []string) []map[string]any {
	if len(terms) == 0 {
		return nil
	}
	out := make([]map[string]any, 0, len(terms))
	for _, term := range terms[:len(terms)-1] {
		out = append(out, map[string]any{"key": key, "match": map[string]any{"value": term}})
	}
	last := expansion
	if len(last) == 0 {
		last = []string{terms[len(terms)-1]}
	}
	values := make([]any, len(last))
	for i, term := range last {
		values[i] = term
	}
	return append(out, map[string]any{"key": key, "match": map[string]any{"any": values}})
}

func anyInts[T ~uint8](values []T) []any {
	out := make([]any, len(values))
	for i, v := range values {
		out[i] = int(v)
	}
	return out
}

// String is a short human summary for logs.
func (f Filter) String() string {
	return fmt.Sprintf("workplace=%v seniority=%v employment=%v sources=%v hidden=%v loc=%v company=%v pay=%d-%d posted>=%s visa=%v regions=%v exclude=%d",
		f.Workplaces, f.Seniorities, f.Employments, f.Sources, f.HiddenOnly, f.LocationTerms, f.CompanyTerms,
		f.PayMinUSD, f.PayMaxUSD, f.PostedAfter.Format(time.DateOnly), f.VisaOnly, f.Regions, len(f.Exclude))
}
