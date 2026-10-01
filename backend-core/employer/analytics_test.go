package employer

import (
	"encoding/json"
	"errors"
	"net/url"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

func TestAggregateAnalyticsHappyPath(t *testing.T) {
	now := time.Date(2026, 9, 29, 15, 0, 0, 0, time.UTC)
	loc := time.UTC
	entered := func(day int) time.Time {
		return time.Date(2026, 9, day, 12, 0, 0, 0, time.UTC)
	}
	applied := func(month time.Month, day int) time.Time {
		return time.Date(2026, month, day, 12, 0, 0, 0, time.UTC)
	}
	jobs := []Job{
		{ID: "j1", Views: 10},
		{ID: "j2", Views: 5},
		{ID: "j3", Views: 100},
	}
	applicants := []Applicant{
		{ID: "a1", JobID: "j1", ColumnID: stageNew, Assisted: "direct", AppliedOn: applied(time.September, 20), StageEnteredAt: entered(27)},
		{ID: "a2", JobID: "j1", ColumnID: stageScreening, Assisted: "bidder", AppliedOn: applied(time.September, 2), StageEnteredAt: entered(25)},
		{ID: "a3", JobID: "j1", ColumnID: stageInterview, Assisted: "agent", AppliedOn: applied(time.September, 3), StageEnteredAt: entered(19)},
		{ID: "a4", JobID: "j1", ColumnID: stageOffer, Assisted: "direct", ReferralSource: "ada", AppliedOn: applied(time.September, 10), StageEnteredAt: entered(28)},
		{ID: "a5", JobID: "j1", ColumnID: stageHired, Assisted: "direct", AppliedOn: applied(time.September, 15), StageEnteredAt: entered(29)},
		{ID: "a6", JobID: "j1", ColumnID: stageRejected, Assisted: "direct", AppliedOn: applied(time.September, 15), StageEnteredAt: entered(20)},
		{ID: "a7", JobID: "j1", ColumnID: stageNew, Assisted: "direct", AppliedOn: applied(time.September, 19)},
		{ID: "a8", JobID: "j2", ColumnID: stageScreening, Assisted: "direct", AppliedOn: applied(time.September, 22), StageEnteredAt: entered(22)},
		{ID: "a9", JobID: "j1", ColumnID: stageScreening, Assisted: "direct", AppliedOn: applied(time.August, 1), StageEnteredAt: entered(1)},
		{ID: "a10", JobID: "j3", ColumnID: stageHired, Assisted: "agent", AppliedOn: applied(time.September, 10), StageEnteredAt: entered(10)},
		{ID: "a11", JobID: "j1", ColumnID: "phone-screen", Assisted: "other", AppliedOn: applied(time.September, 28), StageEnteredAt: entered(28)},
	}
	interviews := []Interview{
		{ID: "i1", JobID: "j1", Status: "attended", Date: "2026-09-10"},
		{ID: "i2", JobID: "j1", Status: "no-show", Date: "2026-09-11"},
		{ID: "i3", JobID: "j1", Status: "scheduled", Date: "2026-09-12"},
		{ID: "i4", JobID: "j1", Status: "attended", Date: "2026-08-01"},
		{ID: "i5", JobID: "j3", Status: "attended", Date: "2026-09-10"},
	}
	idx := NewAccessIndex(map[string][]JobAccessAssignment{
		"j3": {{MemberID: "user", Permissions: []string{PermJobsView}}},
	})
	query := url.Values{}
	query.Set("from", "2026-09-01")
	query.Set("to", "2026-09-29")

	snap, err := AggregateAnalytics("user", RoleRecruiter, idx, jobs, applicants, interviews, query, now, loc)
	if err != nil {
		t.Fatal(err)
	}
	if snap.Source != analyticsSource || snap.Filters.Preset != presetAll {
		t.Fatalf("source %s preset %s", snap.Source, snap.Filters.Preset)
	}
	if snap.Filters.JobID != nil || snap.Filters.From == nil || *snap.Filters.From != "2026-09-01" {
		t.Fatalf("filters %+v", snap.Filters)
	}
	want := map[string]int{"views": 15, "applied": 9, "screening": 5, "interview": 3, "offer": 2, "hired": 1}
	if len(snap.Funnel.Stages) != len(want) {
		t.Fatalf("funnel len %d", len(snap.Funnel.Stages))
	}
	for i, stage := range snap.Funnel.Stages {
		if stage.Count != want[stage.ID] {
			t.Fatalf("funnel %s = %d", stage.ID, stage.Count)
		}
		if i == 0 && stage.ConversionFromPrev != nil {
			t.Fatal("views conversion should be null")
		}
	}
	if got := *snap.Funnel.Stages[1].ConversionFromPrev; got != 60 {
		t.Fatalf("applied conversion %d", got)
	}
	if got := *snap.Funnel.Stages[2].ConversionFromPrev; got != 56 {
		t.Fatalf("screening conversion %d", got)
	}

	if len(snap.SourceMix.Buckets) != 5 {
		t.Fatalf("buckets %+v", snap.SourceMix.Buckets)
	}
	if snap.SourceMix.Buckets[0].ID != "direct" || snap.SourceMix.Buckets[0].Count != 5 || snap.SourceMix.Buckets[0].Label != "Applied directly" {
		t.Fatalf("direct %+v", snap.SourceMix.Buckets[0])
	}
	if snap.SourceMix.Buckets[3].ID != "referral" || snap.SourceMix.Buckets[3].Count != 1 {
		t.Fatalf("referral %+v", snap.SourceMix.Buckets[3])
	}
	if snap.SourceMix.Buckets[4].ID != "other" || snap.SourceMix.Buckets[4].Count != 1 {
		t.Fatalf("other %+v", snap.SourceMix.Buckets[4])
	}
	if snap.SourceMix.AssistedShare == nil || *snap.SourceMix.AssistedShare != 22 {
		t.Fatalf("assisted %v", snap.SourceMix.AssistedShare)
	}

	byStage := map[string]TimeInStageMetric{}
	for _, stage := range snap.TimeInStage.Stages {
		byStage[stage.Stage] = stage
	}
	if byStage[stageNew].Count != 2 || !byStage[stageNew].IsProxy || *byStage[stageNew].AvgDays != 6 || *byStage[stageNew].MedianDays != 6 {
		t.Fatalf("new %+v", byStage[stageNew])
	}
	if byStage[stageScreening].Count != 2 || byStage[stageScreening].IsProxy || *byStage[stageScreening].AvgDays != 6 {
		t.Fatalf("screening %+v", byStage[stageScreening])
	}
	if byStage[stageInterview].Count != 1 || *byStage[stageInterview].MedianDays != 10 || byStage[stageInterview].IsProxy {
		t.Fatalf("interview %+v", byStage[stageInterview])
	}
	if byStage[stageHired].Count != 1 || *byStage[stageHired].AvgDays != 0 || byStage[stageHired].IsProxy {
		t.Fatalf("hired %+v", byStage[stageHired])
	}
	if _, ok := byStage[stageRejected]; ok {
		t.Fatal("rejected is not a time-in-stage row")
	}

	if snap.Attendance.Held != 2 || snap.Attendance.Attended != 1 || snap.Attendance.NoShow != 1 || *snap.Attendance.Rate != 50 {
		t.Fatalf("attendance %+v", snap.Attendance)
	}
	if snap.ViewsToApplicants.Views != 15 || snap.ViewsToApplicants.Applicants != 9 || *snap.ViewsToApplicants.Rate != 60 {
		t.Fatalf("views %+v", snap.ViewsToApplicants)
	}

	body, err := json.Marshal(snap)
	if err != nil {
		t.Fatal(err)
	}
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		t.Fatal(err)
	}
	filters := raw["filters"].(map[string]any)
	if filters["jobId"] != nil {
		t.Fatalf("jobId = %#v", filters["jobId"])
	}
	funnel := raw["funnel"].(map[string]any)["stages"].([]any)
	first := funnel[0].(map[string]any)
	if first["conversionFromPrev"] != nil || first["label"] != "Views" {
		t.Fatalf("views json %#v", first)
	}
}

func TestAggregateAnalyticsForbidden(t *testing.T) {
	_, err := AggregateAnalytics("user", RoleInterviewer, NewAccessIndex(nil), nil, nil, nil, nil, time.Now(), time.UTC)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v", err)
	}
	query := url.Values{}
	query.Set("jobId", "j1")
	idx := NewAccessIndex(map[string][]JobAccessAssignment{
		"j2": {{MemberID: "user", Permissions: []string{PermAnalyticsView}}},
	})
	_, err = AggregateAnalytics("user", RoleInterviewer, idx, nil, nil, nil, query, time.Now(), time.UTC)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("other job err = %v", err)
	}

	snap, err := AggregateAnalytics("user", RoleInterviewer, idx, []Job{{ID: "j2", Views: 4}}, []Applicant{
		{ID: "a", JobID: "j2", ColumnID: stageNew, Assisted: "direct", AppliedOn: time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC), StageEnteredAt: time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC)},
		{ID: "b", JobID: "j1", ColumnID: stageHired, Assisted: "direct", AppliedOn: time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC)},
	}, nil, url.Values{}, time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC), time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	if snap.Funnel.Stages[0].Count != 4 || snap.Funnel.Stages[1].Count != 1 || snap.Funnel.Stages[5].Count != 0 {
		t.Fatalf("scoped funnel %+v", snap.Funnel.Stages)
	}
}

func TestAggregateAnalyticsPresetAndZone(t *testing.T) {
	loc, err := time.LoadLocation(DefaultHiringTimeZone)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 29, 3, 0, 0, 0, time.UTC)
	query := url.Values{}
	query.Set("preset", preset7d)
	snap, err := AggregateAnalytics("user", RoleFinance, NewAccessIndex(nil), nil, []Applicant{
		{ID: "late", JobID: "j1", ColumnID: stageNew, Assisted: "direct", AppliedOn: time.Date(2026, 9, 29, 6, 0, 0, 0, time.UTC)},
	}, nil, query, now, loc)
	if err != nil {
		t.Fatal(err)
	}
	if snap.Filters.Preset != preset7d || snap.Filters.To == nil || *snap.Filters.To != "2026-09-28" || *snap.Filters.From != "2026-09-22" {
		t.Fatalf("filters %+v", snap.Filters)
	}
	if snap.ViewsToApplicants.Applicants != 0 {
		t.Fatalf("chicago day excluded the UTC-next-morning apply, applicants %d", snap.ViewsToApplicants.Applicants)
	}

	query = url.Values{}
	query.Set("from", "2026-09-29")
	query.Set("to", "2026-09-01")
	_, err = AggregateAnalytics("user", RoleOwner, NewAccessIndex(nil), nil, nil, nil, query, now, time.UTC)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("range err = %v", err)
	}
}

func TestViewApplicantReturnsStageTiming(t *testing.T) {
	entered := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	applied := entered.AddDate(0, 0, -3)
	person := viewApplicant(candidate.Application{
		ID:             "a",
		ColumnID:       candidate.StageScreening,
		CompanyStage:   stageScreening,
		StageEnteredAt: entered,
		StageHistory: []candidate.StageVisit{
			{Stage: stageNew, EnteredAt: applied},
			{Stage: stageScreening, EnteredAt: entered},
		},
		Activity: []candidate.ApplicationEvent{{Date: applied}},
		Updated:  entered,
	}, auth.User{Name: "Ada"}, candidate.Profile{}, "Designer")
	if person.ColumnID != stageScreening || !person.StageEnteredAt.Equal(entered) || len(person.StageHistory) != 2 {
		t.Fatalf("%+v", person)
	}
	if person.StageHistory[0].Stage != stageNew || !person.StageHistory[1].EnteredAt.Equal(entered) {
		t.Fatalf("history %+v", person.StageHistory)
	}
}
