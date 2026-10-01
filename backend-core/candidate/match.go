package candidate

import "strings"

// MatchOpenApplication returns the single open application an event names.
// Company+role wins when unique; otherwise a unique company or role match.
func MatchOpenApplication(title, description string, apps []Application) (Application, bool) {
	hay := strings.ToLower(strings.TrimSpace(title + " " + description))
	if hay == "" {
		return Application{}, false
	}
	open := openApplications(apps)
	if both := uniqueMatch(open, hay, true); len(both) == 1 {
		return both[0], true
	}
	either := uniqueMatch(open, hay, false)
	if len(either) == 1 {
		return either[0], true
	}
	return Application{}, false
}

func uniqueMatch(apps []Application, hay string, requireBoth bool) []Application {
	var hits []Application
	for _, app := range apps {
		company := strings.ToLower(strings.TrimSpace(app.Company))
		role := strings.ToLower(strings.TrimSpace(app.Title))
		hasCompany := company != "" && strings.Contains(hay, company)
		hasRole := role != "" && strings.Contains(hay, role)
		ok := hasCompany || hasRole
		if requireBoth {
			ok = hasCompany && hasRole
		}
		if ok {
			hits = append(hits, app)
		}
	}
	return hits
}
