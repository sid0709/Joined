package ranking

import (
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/fitscore"
)

// Feature indexes. The order is the contract between serving, impression logs,
// training export, and any learned model: append new features at the end and
// bump FeatureVersion; never reorder.
const (
	FQueryTitleSim = iota
	FQueryBodySim
	FLexical
	FFusion
	FExactTitle
	FCompanyMatch
	FQueryOccupation
	FQuerySkills
	FRoleTitleSim
	FProfileBodySim
	FProfileOccupation
	FSkillJaccard
	FSkillCoverage
	FSeniority
	FLocation
	FPay
	FVisa
	FFit
	FRecency
	FApplicants
	FCompany
	FHasPay
	FHasQuery
	FHasProfile
	FeatureCount
)

// FeatureVersion names the feature layout above. Logs and models carry it.
const FeatureVersion = "f1"

// FeatureNames are the column names for training export, in index order.
var FeatureNames = [FeatureCount]string{
	"query_title_sim", "query_body_sim", "lexical", "fusion", "exact_title", "company_match",
	"query_occupation", "query_skills", "role_title_sim", "profile_body_sim", "profile_occupation",
	"skill_jaccard", "skill_coverage", "seniority", "location", "pay", "visa", "fit",
	"recency", "applicants", "company", "has_pay", "has_query", "has_profile",
}

// Feature constants: neutral values for a fact one side does not state, and the
// shapes of the decay curves.
const (
	neutral = 0.5
	// recencyHalfLife: a two-week-old job keeps half the freshness credit of a new one.
	recencyHalfLife = 14 * 24 * time.Hour
	// applicantsPivot: fifty applicants halves the "few applicants" credit.
	applicantsPivot = 50.0
	// payNearFloor: top pay within 85% of the floor earns partial credit (as fitscore does).
	payNearFloor = 0.85
)

// Features is one candidate's feature vector.
type Features [FeatureCount]float32

// signals are the retrieval scores one candidate earned in each channel.
type signals struct {
	queryTitle, queryBody, lexical, fusion, roleTitle, profileBody float32
}

// scoringContext is everything about a request the features read.
type scoringContext struct {
	now        time.Time
	query      Parsed
	hasQuery   bool
	profile    *ProfileFeatures
	fitProfile *fitscore.Profile
	tax        *Taxonomy
	// lexicalMax normalizes BM25 scores into [0, 1] within the candidate set.
	lexicalMax float32
	fusionMax  float32
}

// computeFeatures fills the feature vector for one job. It also returns the
// deterministic fit result, which the UI shows as the match badge.
func computeFeatures(ctx *scoringContext, job *JobFeatures, s signals) (Features, *fitscore.Result) {
	var f Features
	f[FQueryTitleSim] = clamp01(s.queryTitle)
	f[FQueryBodySim] = clamp01(s.queryBody)
	if ctx.lexicalMax > 0 {
		f[FLexical] = s.lexical / ctx.lexicalMax
	}
	if ctx.fusionMax > 0 {
		f[FFusion] = s.fusion / ctx.fusionMax
	}
	if ctx.hasQuery {
		f[FHasQuery] = 1
		if ctx.query.Phrase != "" && containsPhrase(job.TitlePhrase, ctx.query.Phrase) {
			f[FExactTitle] = 1
		}
		company := Phrase(job.Company)
		if company != "" && (company == ctx.query.Phrase || containsPhrase(ctx.query.Phrase, company)) {
			f[FCompanyMatch] = 1
		}
		f[FQueryOccupation] = float32(ctx.tax.OccupationAffinity(ctx.query.Occupations, job.Occupations))
		f[FQuerySkills] = coverage(ctx.query.Skills, job.Skills)
	}

	var fit *fitscore.Result
	if p := ctx.profile; p != nil && !p.Empty() {
		f[FHasProfile] = 1
		f[FRoleTitleSim] = clamp01(s.roleTitle)
		f[FProfileBodySim] = clamp01(s.profileBody)
		f[FProfileOccupation] = float32(ctx.tax.OccupationAffinity(p.Occupations, job.Occupations))
		f[FSkillJaccard] = jaccard(p.Skills, job.Skills)
		f[FSkillCoverage] = coverage(job.Skills, p.Skills)
		f[FSeniority] = seniorityFit(p.Seniority, job.Seniority)
		f[FLocation] = locationFit(p, job)
		f[FPay] = payFit(p.SalaryFloorUSD, job)
		f[FVisa] = visaFit(p.NeedsVisa, job.Visa)
		if ctx.fitProfile != nil {
			result := fitscore.Score(fitJobFromFeatures(job), *ctx.fitProfile)
			fit = &result
			if len(result.Criteria) > 0 {
				f[FFit] = float32(result.Score) / 100
			}
		}
	} else {
		f[FSeniority], f[FLocation], f[FPay], f[FVisa] = neutral, neutral, neutral, 1
	}

	f[FRecency] = recency(ctx.now, job.PostedAt)
	f[FApplicants] = float32(1 / (1 + float64(job.Applicants)/applicantsPivot))
	f[FCompany] = job.CompanyScore
	if job.PayKnown {
		f[FHasPay] = 1
	}
	return f, fit
}

func clamp01(v float32) float32 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}

// coverage is the share of want found in have (0 when want is empty).
func coverage(want, have []string) float32 {
	if len(want) == 0 || len(have) == 0 {
		return 0
	}
	matched := 0
	for _, w := range want {
		if containsValue(have, w) {
			matched++
		}
	}
	return float32(matched) / float32(len(want))
}

func jaccard(a, b []string) float32 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	inter := 0
	for _, x := range a {
		if containsValue(b, x) {
			inter++
		}
	}
	union := len(a) + len(b) - inter
	return float32(inter) / float32(union)
}

func seniorityFit(want, have Level) float32 {
	if want == LevelUnknown || have == LevelUnknown {
		return neutral
	}
	switch d := int(want) - int(have); {
	case d == 0:
		return 1
	case d == 1 || d == -1:
		return neutral
	default:
		return 0
	}
}

func locationFit(p *ProfileFeatures, job *JobFeatures) float32 {
	if !p.WantsRemote && len(p.Cities) == 0 && p.Region == RegionUnknown {
		return neutral
	}
	regionOK := p.Region == RegionUnknown || job.Region == RegionUnknown || job.Region == RegionGlobal || job.Region == p.Region
	if job.Workplace == WorkplaceRemote {
		switch {
		case p.WantsRemote && regionOK:
			return 1
		case regionOK:
			return 0.75
		default:
			return 0.1
		}
	}
	jobCity := cityOf(job.Location)
	for _, city := range p.Cities {
		if city != "" && city == jobCity {
			return 1
		}
	}
	if p.Region != RegionUnknown && job.Region == p.Region && !p.WantsRemote {
		return neutral
	}
	return 0
}

func payFit(floor int32, job *JobFeatures) float32 {
	if floor <= 0 || !job.PayKnown {
		return neutral
	}
	switch {
	case job.PayMaxUSD >= floor:
		return 1
	case float64(job.PayMaxUSD) >= float64(floor)*payNearFloor:
		return neutral
	default:
		return 0
	}
}

func visaFit(needs bool, visa Visa) float32 {
	if !needs || visa == VisaYes {
		return 1
	}
	return 0
}

func recency(now, posted time.Time) float32 {
	if posted.IsZero() {
		return 0
	}
	age := now.Sub(posted)
	if age < 0 {
		age = 0
	}
	return float32(math.Exp2(-float64(age) / float64(recencyHalfLife)))
}

// describe is a compact "name=value" dump of the non-zero features, for debug logs.
func (f Features) describe() string {
	var b strings.Builder
	for i, v := range f {
		if v == 0 {
			continue
		}
		if b.Len() > 0 {
			b.WriteByte(' ')
		}
		b.WriteString(FeatureNames[i])
		b.WriteByte('=')
		b.WriteString(strconv.FormatFloat(float64(v), 'f', 3, 32))
	}
	return b.String()
}
