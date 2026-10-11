package ranking

import (
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/fitscore"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

// GoodFit is the fit score a job needs to appear under "For you". It matches
// GOOD_MATCH in joined-frontend/lib/jobs.
const GoodFit = 50

// FitJob builds the fit scorer's view of a job, with canonical skills so the
// list and the job page score skills the same way.
func FitJob(job jobs.SearchJob, tax *Taxonomy) fitscore.Job {
	return fitscore.Job{
		ID:        job.ID,
		Title:     jobschema.CleanTitle(job.Title),
		Location:  job.Location,
		Workplace: job.Workplace,
		Seniority: job.Seniority,
		Skills:    tax.SkillIDs(job.Skills),
		PayMin:    job.Pay.Min,
		PayMax:    job.Pay.Max,
		PayPeriod: job.Pay.Period,
		Currency:  job.Pay.Currency,
		Visa:      job.Visa,
	}
}

// fitJobFromFeatures is FitJob for an indexed job: pay is already annual USD.
func fitJobFromFeatures(job *JobFeatures) fitscore.Job {
	out := fitscore.Job{
		ID:        job.JobID,
		Title:     job.Title,
		Location:  job.Location,
		Workplace: workplaceName(job.Workplace),
		Seniority: levelName(job.Seniority),
		Skills:    job.Skills,
		Visa:      job.Visa == VisaYes,
	}
	if job.PayKnown {
		out.PayMin, out.PayMax = int(job.PayMinUSD), int(job.PayMaxUSD)
		out.PayPeriod, out.Currency = jobschema.PayYear, jobschema.CurrencyUSD
	}
	return out
}

// FitProfile builds the fit scorer's view of a profile, with canonical skills.
func FitProfile(profile candidate.Profile, tax *Taxonomy) fitscore.Profile {
	titles := make([]string, 0, len(profile.Experience))
	for _, item := range profile.Experience {
		if role := strings.TrimSpace(item.Role); role != "" {
			titles = append(titles, role)
		}
	}
	floor := profile.SalaryFloor
	if usd, ok := ToAnnualUSD(profile.SalaryFloor, jobschema.PayYear, profile.Currency); ok {
		floor = int(usd)
	}
	return fitscore.Profile{
		Headline:         profile.Headline,
		TargetRoles:      profile.TargetRoles,
		Locations:        append([]string{}, profile.Locations...),
		Location:         profile.Location,
		Workplace:        profile.Workplace,
		SalaryFloor:      floor,
		Skills:           tax.SkillIDs(profile.Skills),
		Authorization:    profile.Authorization,
		ExperienceTitles: titles,
	}
}

func workplaceName(w Workplace) string {
	switch w {
	case WorkplaceRemote:
		return jobschema.WorkplaceRemote
	case WorkplaceHybrid:
		return jobschema.WorkplaceHybrid
	case WorkplaceOnsite:
		return jobschema.WorkplaceOnsite
	default:
		return ""
	}
}

func levelName(l Level) string {
	levels := jobschema.Seniorities()
	if l == LevelUnknown || int(l) > len(levels) {
		return ""
	}
	return levels[l-1]
}
