package ranking

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/sid0709/Joined/backend-core/candidate"
	"github.com/sid0709/Joined/backend-core/jobschema"
)

// maxTargetRoles is how many target roles get their own retrieval channel.
const maxTargetRoles = 3

// Years of experience that place a profile at each seniority when its titles say nothing.
const (
	yearsMiddle = 2
	yearsSenior = 5
	yearsLeader = 9
)

// authorizationNeedsSponsor matches the profile choice that requires visa sponsorship.
const authorizationNeedsSponsor = "us-sponsor"

// ProfileFeatures is a normalized job hunter: what retrieval and the ranker read.
type ProfileFeatures struct {
	UserID          string
	TargetRoles     []string
	RoleOccupations [][]string
	Occupations     []string
	CurrentTitle    string
	ExperienceYears float32
	Seniority       Level
	Skills          []string
	Cities          []string
	WantsRemote     bool
	Region          Region
	Workplace       Workplace
	SalaryFloorUSD  int32
	NeedsVisa       bool
	// Hash changes whenever any input above changes, so cached vectors know they are stale.
	Hash string
}

// Empty reports whether the profile has nothing to personalize with.
func (p ProfileFeatures) Empty() bool {
	return len(p.TargetRoles) == 0 && p.CurrentTitle == "" && len(p.Skills) == 0
}

// RoleTexts are the embedding inputs for each target role, falling back to the current title.
func (p ProfileFeatures) RoleTexts() []string {
	if len(p.TargetRoles) > 0 {
		return p.TargetRoles
	}
	if p.CurrentTitle != "" {
		return []string{p.CurrentTitle}
	}
	return nil
}

// ProfileText is one embedding input for the whole profile.
func (p ProfileFeatures) ProfileText() string {
	parts := make([]string, 0, 4)
	if len(p.TargetRoles) > 0 {
		parts = append(parts, "Target roles: "+strings.Join(p.TargetRoles, ", "))
	}
	if p.CurrentTitle != "" {
		parts = append(parts, "Current title: "+p.CurrentTitle)
	}
	if len(p.Skills) > 0 {
		parts = append(parts, "Skills: "+strings.Join(p.Skills, ", "))
	}
	if p.ExperienceYears > 0 {
		parts = append(parts, fmt.Sprintf("Experience: %.0f years", p.ExperienceYears))
	}
	return strings.Join(parts, ". ")
}

// NormalizeProfile turns a stored profile into ranking features.
func NormalizeProfile(userID string, profile candidate.Profile, now time.Time, tax *Taxonomy) ProfileFeatures {
	p := ProfileFeatures{UserID: userID}
	for _, role := range profile.TargetRoles {
		role = strings.TrimSpace(role)
		if role == "" {
			continue
		}
		p.TargetRoles = append(p.TargetRoles, role)
		if len(p.TargetRoles) == maxTargetRoles {
			break
		}
	}
	titles := make([]string, 0, len(profile.Experience))
	for _, item := range profile.Experience {
		if role := strings.TrimSpace(item.Role); role != "" {
			titles = append(titles, role)
		}
	}
	p.CurrentTitle = currentTitle(profile.Experience)
	if p.CurrentTitle == "" {
		p.CurrentTitle = strings.TrimSpace(profile.Headline)
	}
	p.ExperienceYears = experienceYears(profile.Experience, now)

	seen := map[string]struct{}{}
	for _, role := range p.RoleTexts() {
		families := tax.ClassifyTitle(role)
		p.RoleOccupations = append(p.RoleOccupations, families)
		for _, family := range families {
			if _, dup := seen[family]; !dup {
				seen[family] = struct{}{}
				p.Occupations = append(p.Occupations, family)
			}
		}
	}

	// What someone does now says more about their level than where they want to go.
	levelTitles := append([]string{p.CurrentTitle, profile.Headline}, titles...)
	p.Seniority = profileLevel(append(levelTitles, p.TargetRoles...), p.ExperienceYears)
	p.Skills = tax.SkillIDs(profile.Skills)

	for _, place := range append(append([]string{}, profile.Locations...), profile.Location) {
		place = strings.TrimSpace(place)
		if place == "" {
			continue
		}
		if strings.HasPrefix(strings.ToLower(place), "remote") {
			p.WantsRemote = true
		} else if city := cityOf(place); city != "" {
			p.Cities = append(p.Cities, city)
		}
		if region := DetectRegion(place); region != RegionUnknown && p.Region == RegionUnknown {
			p.Region = region
		}
	}
	p.Workplace = parseWorkplace(profile.Workplace)
	if p.Workplace == WorkplaceRemote {
		p.WantsRemote = true
	}
	if floor, ok := ToAnnualUSD(profile.SalaryFloor, jobschema.PayYear, profile.Currency); ok {
		p.SalaryFloorUSD = floor
	}
	p.NeedsVisa = strings.EqualFold(strings.TrimSpace(profile.Authorization), authorizationNeedsSponsor)
	p.Hash = profileHash(p)
	return p
}

// currentTitle is the role marked current, else the one that ended most recently.
func currentTitle(items []candidate.ExperienceItem) string {
	best, bestKey := "", -1
	for _, item := range items {
		role := strings.TrimSpace(item.Role)
		if role == "" {
			continue
		}
		key := item.EndYear*12 + item.EndMonth
		if item.Current || (item.EndYear == 0 && item.StartYear > 0) {
			key = 1 << 30
		}
		if key > bestKey {
			best, bestKey = role, key
		}
	}
	return best
}

// experienceYears sums dated roles, merging overlaps so two parallel jobs count once.
func experienceYears(items []candidate.ExperienceItem, now time.Time) float32 {
	type span struct{ start, end int }
	spans := make([]span, 0, len(items))
	nowMonth := now.Year()*12 + int(now.Month()) - 1
	for _, item := range items {
		if item.StartYear <= 0 {
			continue
		}
		start := item.StartYear*12 + max(item.StartMonth, 1) - 1
		end := nowMonth
		if !item.Current && item.EndYear > 0 {
			end = item.EndYear*12 + max(item.EndMonth, 1) - 1
		}
		if end > start {
			spans = append(spans, span{start, min(end, nowMonth)})
		}
	}
	sort.Slice(spans, func(i, j int) bool { return spans[i].start < spans[j].start })
	months, cursor := 0, -1
	for _, s := range spans {
		if s.end <= cursor {
			continue
		}
		start := max(s.start, cursor)
		months += s.end - start
		cursor = s.end
	}
	return float32(months) / 12
}

// profileLevel reads seniority from the titles first, then from years of experience.
func profileLevel(titles []string, years float32) Level {
	for _, title := range titles {
		if strings.TrimSpace(title) == "" {
			continue
		}
		if level := ParseLevel(jobschema.SeniorityFromHint(title)); level != LevelUnknown && senioritySignaled(title) {
			return level
		}
	}
	switch {
	case years >= yearsLeader:
		return ParseLevel(jobschema.SeniorityLeader)
	case years >= yearsSenior:
		return ParseLevel(jobschema.SenioritySenior)
	case years >= yearsMiddle:
		return ParseLevel(jobschema.SeniorityMiddle)
	case years > 0:
		return ParseLevel(jobschema.SeniorityJunior)
	default:
		return LevelUnknown
	}
}

// senioritySignals are the words that actually state a level; a bare title does not.
var senioritySignals = []string{
	"manager", "director", "head of", "vp", "vice president", "chief", "lead", "staff", "principal",
	"junior", "entry", "intern", "graduate", "mid", "middle", "senior", "sr",
}

func senioritySignaled(title string) bool {
	folded := " " + Fold(title) + " "
	for _, signal := range senioritySignals {
		if strings.Contains(folded, " "+signal+" ") {
			return true
		}
	}
	return false
}

// cityOf is the part of a location before the first separator, folded.
func cityOf(location string) string {
	for _, sep := range []string{",", "—", "–", "(", " - "} {
		if i := strings.Index(location, sep); i > 0 {
			location = location[:i]
		}
	}
	return Fold(location)
}

func profileHash(p ProfileFeatures) string {
	h := sha256.New()
	write := func(parts ...string) {
		for _, part := range parts {
			h.Write([]byte(part))
			h.Write([]byte{0})
		}
	}
	write(p.TargetRoles...)
	write(p.CurrentTitle, fmt.Sprint(p.ExperienceYears), fmt.Sprint(p.Seniority))
	write(p.Skills...)
	write(p.Cities...)
	write(fmt.Sprint(p.WantsRemote, p.Region, p.Workplace, p.SalaryFloorUSD, p.NeedsVisa))
	return hex.EncodeToString(h.Sum(nil))[:16]
}
