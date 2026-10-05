package fitscore

import (
	"math"
	"strconv"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

type dimension struct {
	criterion Criterion
	weight    float64
	credit    float64
}

// Score compares job to profile. It never errors; missing data lowers
// confidence instead of failing the request.
func Score(job Job, profile Profile) Result {
	dims := collectDimensions(job, profile)
	needsVisa := strings.EqualFold(strings.TrimSpace(profile.Authorization), sponsorshipRequired) && !job.Visa
	confidence := ConfidenceHigh
	if len(dims) < minDimensions {
		confidence = ConfidenceLow
	}

	if len(dims) == 0 {
		return Result{
			Score:        0,
			Reason:       clipReason(emptyReason(needsVisa)),
			Confidence:   ConfidenceLow,
			ModelVersion: ModelVersion,
			Criteria:     []Criterion{},
			NeedsVisa:    needsVisa,
		}
	}

	var weighted, total float64
	criteria := make([]Criterion, 0, len(dims))
	for _, dim := range dims {
		weighted += dim.weight * dim.credit
		total += dim.weight
		criteria = append(criteria, dim.criterion)
	}
	score := int(math.Round(100 * weighted / total))
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return Result{
		Score:        score,
		Reason:       clipReason(buildReason(dims, confidence, needsVisa)),
		Confidence:   confidence,
		ModelVersion: ModelVersion,
		Criteria:     criteria,
		NeedsVisa:    needsVisa,
	}
}

func collectDimensions(job Job, profile Profile) []dimension {
	out := make([]dimension, 0, 5)
	if dim, ok := titleDimension(job, profile); ok {
		out = append(out, dim)
	}
	if dim, ok := skillsDimension(job, profile); ok {
		out = append(out, dim)
	}
	if dim, ok := seniorityDimension(job, profile); ok {
		out = append(out, dim)
	}
	if dim, ok := locationDimension(job, profile); ok {
		out = append(out, dim)
	}
	if dim, ok := salaryDimension(job, profile); ok {
		out = append(out, dim)
	}
	return out
}

func titleDimension(job Job, profile Profile) (dimension, bool) {
	roles := targetRoles(profile)
	if len(roles) == 0 {
		return dimension{}, false
	}
	title := normalize(job.Title)
	var exact, near string
	for _, role := range roles {
		if title == "" {
			break
		}
		folded := normalize(role)
		if folded != "" && strings.Contains(title, folded) {
			exact = role
			break
		}
		noun := headNoun(role)
		if noun != "" && containsWord(title, noun) {
			near = role
		}
	}
	switch {
	case exact != "":
		return scored("title", "Target role", "Matches “"+clipPhrase(exact)+"”", levelYes, weightTitle, 1), true
	case near != "":
		return scored("title", "Target role", "Close to “"+clipPhrase(near)+"”", levelPartial, weightTitle, partialCredit), true
	default:
		return scored("title", "Target role", "Outside your target roles", levelNo, weightTitle, 0), true
	}
}

func skillsDimension(job Job, profile Profile) (dimension, bool) {
	if len(profile.Skills) == 0 || len(job.Skills) == 0 {
		return dimension{}, false
	}
	mine := map[string]struct{}{}
	for _, skill := range profile.Skills {
		if key := normalize(skill); key != "" {
			mine[key] = struct{}{}
		}
	}
	matched := 0
	for _, skill := range job.Skills {
		if _, ok := mine[normalize(skill)]; ok {
			matched++
		}
	}
	total := len(job.Skills)
	ratio := float64(matched) / float64(total)
	level := levelNo
	if ratio >= 1 {
		level = levelYes
	} else if ratio > 0 {
		level = levelPartial
	}
	detail := strconv.Itoa(matched) + " of " + strconv.Itoa(total) + " listed skills"
	return scored("skills", "Skills", detail, level, weightSkills, ratio), true
}

func seniorityDimension(job Job, profile Profile) (dimension, bool) {
	want, ok := profileSeniority(profile)
	if !ok {
		return dimension{}, false
	}
	have, ok := canonicalSeniority(job.Seniority)
	if !ok {
		return dimension{}, false
	}
	delta := seniorityDelta(want, have)
	switch {
	case delta == 0:
		return scored("seniority", "Seniority", "Matches your "+seniorityLabel(have)+" level", levelYes, weightSeniority, 1), true
	case delta == 1:
		return scored("seniority", "Seniority", "Close to your "+seniorityLabel(want)+" level", levelPartial, weightSeniority, partialCredit), true
	default:
		return scored("seniority", "Seniority", "Different seniority than your profile", levelNo, weightSeniority, 0), true
	}
}

func locationDimension(job Job, profile Profile) (dimension, bool) {
	cities, wantsRemote, hasPref := locationPrefs(profile)
	if !hasPref {
		return dimension{}, false
	}
	city := cityOf(job.Location)
	inCity := false
	for _, want := range cities {
		if want != "" && want == city {
			inCity = true
			break
		}
	}
	remoteJob := normalize(job.Workplace) == jobschema.WorkplaceRemote || strings.HasPrefix(normalize(job.Location), remotePrefix)
	switch {
	case remoteJob && wantsRemote:
		return scored("location", "Location", "Remote, as you prefer", levelYes, weightLocation, 1), true
	case inCity:
		return scored("location", "Location", workplaceLabel(job.Workplace)+" in a city you chose", levelYes, weightLocation, 1), true
	case remoteJob:
		return scored("location", "Location", "Remote", levelPartial, weightLocation, partialCredit), true
	default:
		return scored("location", "Location", "Outside your locations", levelNo, weightLocation, 0), true
	}
}

func salaryDimension(job Job, profile Profile) (dimension, bool) {
	if profile.SalaryFloor <= 0 {
		return dimension{}, false
	}
	top := topAnnualPay(job)
	if top <= 0 {
		return dimension{}, false
	}
	floor := profile.SalaryFloor
	switch {
	case top >= floor:
		return scored("salary", "Pay", "Meets your salary floor", levelYes, weightSalary, 1), true
	case float64(top) >= float64(floor)*payTolerance:
		return scored("salary", "Pay", "Just under your salary floor", levelPartial, weightSalary, partialCredit), true
	default:
		return scored("salary", "Pay", "Below your salary floor", levelNo, weightSalary, 0), true
	}
}

func scored(id, label, detail, level string, weight, credit float64) dimension {
	return dimension{
		criterion: Criterion{ID: id, Label: label, Detail: detail, Level: level},
		weight:    float64(weight),
		credit:    credit,
	}
}

func targetRoles(profile Profile) []string {
	roles := make([]string, 0, len(profile.TargetRoles)+len(profile.ExperienceTitles)+1)
	for _, role := range profile.TargetRoles {
		if strings.TrimSpace(role) != "" {
			roles = append(roles, role)
		}
	}
	if len(roles) > 0 {
		return roles
	}
	for _, role := range profile.ExperienceTitles {
		if strings.TrimSpace(role) != "" {
			roles = append(roles, role)
		}
	}
	if headline := strings.TrimSpace(profile.Headline); headline != "" {
		roles = append(roles, headline)
	}
	return roles
}

func locationPrefs(profile Profile) (cities []string, wantsRemote bool, hasPref bool) {
	add := func(place string) {
		place = strings.TrimSpace(place)
		if place == "" {
			return
		}
		hasPref = true
		if strings.HasPrefix(normalize(place), remotePrefix) {
			wantsRemote = true
			return
		}
		if city := cityOf(place); city != "" {
			cities = append(cities, city)
		}
	}
	for _, place := range profile.Locations {
		add(place)
	}
	add(profile.Location)
	if normalize(profile.Workplace) == jobschema.WorkplaceRemote {
		wantsRemote = true
		hasPref = true
	}
	return cities, wantsRemote, hasPref
}

func profileSeniority(profile Profile) (string, bool) {
	candidates := make([]string, 0, 2+len(profile.TargetRoles)+len(profile.ExperienceTitles))
	candidates = append(candidates, profile.Headline)
	candidates = append(candidates, profile.TargetRoles...)
	candidates = append(candidates, profile.ExperienceTitles...)
	for _, text := range candidates {
		if level, ok := seniorityIfSignaled(text); ok {
			return level, true
		}
	}
	return "", false
}

func seniorityIfSignaled(text string) (string, bool) {
	if !hasSenioritySignal(text) {
		return "", false
	}
	return canonicalSeniority(jobschema.SeniorityFromHint(text))
}

func hasSenioritySignal(text string) bool {
	folded := normalize(text)
	if folded == "" {
		return false
	}
	for _, signal := range []string{
		"manager", "director", "head of", "vp ", "vp,", "vice president", "chief",
		"lead", "staff", "principal",
		"junior", "entry", "intern",
		"middle", "mid-level", "mid level", "midlevel",
		"senior",
	} {
		if strings.Contains(folded, signal) {
			return true
		}
	}
	return containsWord(folded, "mid") || containsWord(folded, "vp")
}

func canonicalSeniority(value string) (string, bool) {
	if mapped, ok := jobschema.CanonicalSeniority(value); ok {
		return mapped, true
	}
	trimmed := strings.TrimSpace(value)
	for _, level := range jobschema.Seniorities() {
		if strings.EqualFold(level, trimmed) {
			return level, true
		}
	}
	return "", false
}

func seniorityDelta(want, have string) int {
	order := jobschema.Seniorities()
	wi, hi := -1, -1
	for i, level := range order {
		if level == want {
			wi = i
		}
		if level == have {
			hi = i
		}
	}
	if wi < 0 || hi < 0 {
		return 99
	}
	d := wi - hi
	if d < 0 {
		return -d
	}
	return d
}

func seniorityLabel(level string) string {
	if level == jobschema.SeniorityLeader {
		return "Lead"
	}
	return level
}

func workplaceLabel(workplace string) string {
	switch normalize(workplace) {
	case jobschema.WorkplaceRemote:
		return "Remote"
	case jobschema.WorkplaceHybrid:
		return "Hybrid"
	case jobschema.WorkplaceOnsite:
		return "On-site"
	default:
		return "Based"
	}
}

func topAnnualPay(job Job) int {
	minVal, maxVal := job.PayMin, job.PayMax
	if minVal < 0 {
		minVal = 0
	}
	if maxVal < 0 {
		maxVal = 0
	}
	if maxVal == 0 {
		maxVal = minVal
	}
	if job.PayPeriod == jobschema.PayHour {
		return maxVal * hoursPerYear
	}
	return maxVal
}

func normalize(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func headNoun(role string) string {
	parts := strings.Fields(normalize(role))
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

func containsWord(haystack, word string) bool {
	if word == "" {
		return false
	}
	for _, part := range strings.Fields(haystack) {
		if part == word {
			return true
		}
	}
	return false
}

func cityOf(location string) string {
	trimmed := strings.TrimSpace(location)
	if trimmed == "" {
		return ""
	}
	for _, sep := range []string{",", "—", "–", "(", " - "} {
		if i := strings.Index(trimmed, sep); i >= 0 {
			trimmed = trimmed[:i]
		}
	}
	return normalize(trimmed)
}
