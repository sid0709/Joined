package jobs

import "strings"

// Filtered applies optional careers query params to the open roles already
// returned by GET /v1/search/companies/:id. department matches job.team.
// Blank filters are ignored. Matching is trimmed and case-insensitive.
func (page CompanyPage) Filtered(department, location string) CompanyPage {
	department = strings.TrimSpace(department)
	location = strings.TrimSpace(location)
	if department == "" && location == "" {
		return page
	}
	page.Jobs = filterCatalogJobs(page.Jobs, department, location)
	return page
}

func filterCatalogJobs(items []catalogJob, department, location string) []catalogJob {
	out := make([]catalogJob, 0, len(items))
	for _, item := range items {
		if department != "" && !strings.EqualFold(strings.TrimSpace(item.Team), department) {
			continue
		}
		if location != "" && !strings.EqualFold(strings.TrimSpace(item.Location), location) {
			continue
		}
		out = append(out, item)
	}
	return out
}
