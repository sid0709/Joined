package ranking

import (
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

// hiddenSource is the API's source value for scouted ("hidden") jobs.
const hiddenSource = jobs.SearchSourceHidden

// FilterFromQuery turns search API parameters into an exact filter. Pay floors in
// another currency are converted to annual USD the same way job pay is.
func FilterFromQuery(q jobs.SearchQuery, now time.Time) Filter {
	f := Filter{VisaOnly: q.Visa}
	for _, value := range splitValues(q.Workplace) {
		if w, ok := ParseWorkplace(value); ok && !containsValue(f.Workplaces, w) {
			f.Workplaces = append(f.Workplaces, w)
		}
	}
	if q.Remote && !containsValue(f.Workplaces, WorkplaceRemote) {
		f.Workplaces = append(f.Workplaces, WorkplaceRemote)
	}
	for _, value := range splitValues(q.Seniority) {
		if level := ParseLevel(value); level != LevelUnknown && !containsValue(f.Seniorities, level) {
			f.Seniorities = append(f.Seniorities, level)
		}
	}
	for _, value := range splitValues(q.Employment) {
		if e, ok := ParseEmployment(value); ok && !containsValue(f.Employments, e) {
			f.Employments = append(f.Employments, e)
		}
	}
	for _, value := range splitValues(q.Region) {
		if r, ok := ParseRegion(value); ok && !containsValue(f.Regions, r) {
			f.Regions = append(f.Regions, r)
		}
	}
	if strings.EqualFold(strings.TrimSpace(q.Source), hiddenSource) {
		f.HiddenOnly = true
	} else {
		for _, value := range splitValues(q.Source) {
			f.Sources = append(f.Sources, strings.ToLower(value))
		}
	}
	f.LocationTerms = LocationTerms(q.Location)
	f.CompanyTerms = LocationTerms(q.Company)
	currency := q.Currency
	if currency == "" {
		currency = jobschema.CurrencyUSD
	}
	if q.SalaryMin > 0 {
		if usd, ok := ToAnnualUSD(q.SalaryMin, jobschema.PayYear, currency); ok {
			f.PayMinUSD = usd
		}
	}
	if q.SalaryMax > 0 {
		if usd, ok := ToAnnualUSD(q.SalaryMax, jobschema.PayYear, currency); ok {
			f.PayMaxUSD = usd
		}
	}
	if q.PostedDays > 0 {
		f.PostedAfter = now.Add(-time.Duration(q.PostedDays) * 24 * time.Hour)
	}
	return f
}

// RequestFromQuery builds a ranked search request. userID is blank for visitors.
func RequestFromQuery(q jobs.SearchQuery, userID string, now time.Time) Request {
	return Request{
		UserID:   userID,
		Query:    q.Keyword,
		Filter:   FilterFromQuery(q, now),
		Sort:     q.SortBy,
		List:     q.List,
		Page:     q.Page,
		PageSize: q.Limit,
		Now:      now,
	}
}

func splitValues(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}
