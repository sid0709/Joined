package employer

import (
	"math"
	"net/url"
	"sort"
	"strings"
	"time"
)

const (
	analyticsSource = "einstein"

	preset7d  = "7d"
	preset30d = "30d"
	preset90d = "90d"
	presetAll = "all"

	percentScale = 100
)

// CompanyAnalyticsSnapshot is GET /v1/company/analytics.
// Field names match opened-frontend/lib/analytics.ts.
type CompanyAnalyticsSnapshot struct {
	Filters           AnalyticsFilters         `json:"filters"`
	GeneratedAt       time.Time                `json:"generatedAt"`
	Source            string                   `json:"source"`
	Funnel            AnalyticsFunnel          `json:"funnel"`
	SourceMix         AnalyticsSourceMix       `json:"sourceMix"`
	TimeInStage       AnalyticsTimeInStage     `json:"timeInStage"`
	Attendance        AnalyticsAttendance      `json:"attendance"`
	ViewsToApplicants AnalyticsViewsApplicants `json:"viewsToApplicants"`
}

// AnalyticsFilters echoes the query. Null job, from, and to mean unbounded.
type AnalyticsFilters struct {
	JobID  *string `json:"jobId"`
	From   *string `json:"from"`
	To     *string `json:"to"`
	Preset string  `json:"preset"`
}

type AnalyticsFunnel struct {
	Stages []FunnelStageMetric `json:"stages"`
}

type FunnelStageMetric struct {
	ID                 string `json:"id"`
	Label              string `json:"label"`
	Count              int    `json:"count"`
	ConversionFromPrev *int   `json:"conversionFromPrev"`
}

type AnalyticsSourceMix struct {
	Buckets       []SourceBucket `json:"buckets"`
	AssistedShare *int           `json:"assistedShare"`
}

type SourceBucket struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Count int    `json:"count"`
	Share int    `json:"share"`
}

type AnalyticsTimeInStage struct {
	Stages []TimeInStageMetric `json:"stages"`
}

type TimeInStageMetric struct {
	Stage      string `json:"stage"`
	Label      string `json:"label"`
	Count      int    `json:"count"`
	AvgDays    *int   `json:"avgDays"`
	MedianDays *int   `json:"medianDays"`
	IsProxy    bool   `json:"isProxy"`
}

type AnalyticsAttendance struct {
	Held     int  `json:"held"`
	Attended int  `json:"attended"`
	NoShow   int  `json:"noShow"`
	Rate     *int `json:"rate"`
}

type AnalyticsViewsApplicants struct {
	Views      int  `json:"views"`
	Applicants int  `json:"applicants"`
	Rate       *int `json:"rate"`
}

type analyticsWindow struct {
	jobID    *string
	from     *time.Time
	to       *time.Time
	fromText *string
	toText   *string
	preset   string
}

var funnelStages = []struct{ id, label string }{
	{"views", "Views"},
	{"applied", "Applied"},
	{"screening", "Screening+"},
	{"interview", "Interview+"},
	{"offer", "Offer+"},
	{"hired", "Hired"},
}

var timeStages = []struct{ id, label string }{
	{stageNew, "New"},
	{stageScreening, "Screening"},
	{stageInterview, "Interview"},
	{stageOffer, "Offer"},
	{stageHired, "Hired"},
}

var sourceOrder = []string{"direct", "bidder", "agent", "referral", "other"}

var sourceLabels = map[string]string{
	"direct":   "Applied directly",
	"bidder":   "Prepared by a bidder",
	"agent":    "Prepared by the agent",
	"referral": "Referral",
	"other":    "Other",
}

var presetDays = map[string]int{
	preset7d:  7,
	preset30d: 30,
	preset90d: 90,
}

// AnalyticsLocation is the company calendar used for inclusive YYYY-MM-DD filters.
func AnalyticsLocation(zone string) *time.Location {
	zone = strings.TrimSpace(zone)
	if zone == "" {
		zone = DefaultHiringTimeZone
	}
	loc, err := time.LoadLocation(zone)
	if err == nil {
		return loc
	}
	loc, err = time.LoadLocation(DefaultHiringTimeZone)
	if err != nil {
		return time.UTC
	}
	return loc
}

// AnalyticsAllowed reports whether this actor may read analytics for jobID.
// An empty jobID is the company-wide view, including a grant on any one job.
func AnalyticsAllowed(userID, role string, idx AccessIndex, jobID string) bool {
	jobID = strings.TrimSpace(jobID)
	if jobID != "" {
		return idx.Allows(userID, role, jobID, PermAnalyticsView)
	}
	return idx.CompanyOrGrant(userID, role, PermAnalyticsView)
}

// AggregateAnalytics builds the hiring snapshot for jobs this actor may analyze.
func AggregateAnalytics(userID, role string, idx AccessIndex, jobs []Job, applicants []Applicant, interviews []Interview, query url.Values, now time.Time, loc *time.Location) (CompanyAnalyticsSnapshot, error) {
	if query == nil {
		query = url.Values{}
	}
	if !AnalyticsAllowed(userID, role, idx, query.Get("jobId")) {
		return CompanyAnalyticsSnapshot{}, Forbidden("Missing permission: " + PermAnalyticsView)
	}
	if loc == nil {
		loc = time.UTC
	}
	window, err := parseAnalyticsQuery(query, now, loc)
	if err != nil {
		return CompanyAnalyticsSnapshot{}, err
	}
	filterJob := ""
	if window.jobID != nil {
		filterJob = *window.jobID
	}

	views := 0
	for _, job := range jobs {
		if !analyticsJob(idx, userID, role, job.ID, filterJob) {
			continue
		}
		views += job.Views
	}

	var people []Applicant
	for _, person := range applicants {
		if !analyticsJob(idx, userID, role, person.JobID, filterJob) {
			continue
		}
		if !inAnalyticsRange(person.AppliedOn, window.from, window.to, loc) {
			continue
		}
		people = append(people, person)
	}

	var rounds []Interview
	for _, item := range interviews {
		if !analyticsJob(idx, userID, role, item.JobID, filterJob) {
			continue
		}
		if !interviewInRange(item.Date, window.from, window.to, loc) {
			continue
		}
		rounds = append(rounds, item)
	}

	applied := len(people)
	screening := countReached(people, stageScreening, stageInterview, stageOffer, stageHired)
	interviewReached := countReached(people, stageInterview, stageOffer, stageHired)
	offerReached := countReached(people, stageOffer, stageHired)
	hired := countReached(people, stageHired)
	counts := map[string]int{
		"views":     views,
		"applied":   applied,
		"screening": screening,
		"interview": interviewReached,
		"offer":     offerReached,
		"hired":     hired,
	}
	funnel := make([]FunnelStageMetric, 0, len(funnelStages))
	for i, stage := range funnelStages {
		var conversion *int
		if i > 0 {
			conversion = percentRate(counts[stage.id], counts[funnelStages[i-1].id])
		}
		funnel = append(funnel, FunnelStageMetric{
			ID:                 stage.id,
			Label:              stage.label,
			Count:              counts[stage.id],
			ConversionFromPrev: conversion,
		})
	}

	sourceCounts := map[string]int{}
	for _, person := range people {
		sourceCounts[sourceBucket(person)]++
	}
	buckets := make([]SourceBucket, 0, len(sourceOrder))
	for _, id := range sourceOrder {
		count := sourceCounts[id]
		if count == 0 && id != "direct" && id != "bidder" && id != "agent" {
			continue
		}
		share := 0
		if applied > 0 {
			share = int(math.Round(float64(count) / float64(applied) * percentScale))
		}
		buckets = append(buckets, SourceBucket{
			ID:    id,
			Label: sourceLabels[id],
			Count: count,
			Share: share,
		})
	}

	sitting := make([]TimeInStageMetric, 0, len(timeStages))
	for _, stage := range timeStages {
		var days []int
		proxy := false
		count := 0
		for _, person := range people {
			if person.ColumnID != stage.id {
				continue
			}
			count++
			dayCount, usedProxy := daysInStage(person, now, loc)
			if usedProxy {
				proxy = true
			}
			days = append(days, dayCount)
		}
		if count == 0 {
			proxy = false
		}
		sitting = append(sitting, TimeInStageMetric{
			Stage:      stage.id,
			Label:      stage.label,
			Count:      count,
			AvgDays:    averageDays(days),
			MedianDays: medianDays(days),
			IsProxy:    proxy,
		})
	}

	held := 0
	attended := 0
	noShow := 0
	for _, item := range rounds {
		switch item.Status {
		case "attended":
			held++
			attended++
		case "no-show":
			held++
			noShow++
		}
	}

	return CompanyAnalyticsSnapshot{
		Filters: AnalyticsFilters{
			JobID:  window.jobID,
			From:   window.fromText,
			To:     window.toText,
			Preset: window.preset,
		},
		GeneratedAt: now.UTC(),
		Source:      analyticsSource,
		Funnel:      AnalyticsFunnel{Stages: funnel},
		SourceMix: AnalyticsSourceMix{
			Buckets:       buckets,
			AssistedShare: percentRate(sourceCounts["bidder"]+sourceCounts["agent"], applied),
		},
		TimeInStage: AnalyticsTimeInStage{Stages: sitting},
		Attendance: AnalyticsAttendance{
			Held:     held,
			Attended: attended,
			NoShow:   noShow,
			Rate:     percentRate(attended, held),
		},
		ViewsToApplicants: AnalyticsViewsApplicants{
			Views:      views,
			Applicants: applied,
			Rate:       percentRate(applied, views),
		},
	}, nil
}

func analyticsJob(idx AccessIndex, userID, role, jobID, filter string) bool {
	if filter != "" && jobID != filter {
		return false
	}
	return idx.Allows(userID, role, jobID, PermAnalyticsView)
}

func parseAnalyticsQuery(query url.Values, now time.Time, loc *time.Location) (analyticsWindow, error) {
	jobID := strings.TrimSpace(query.Get("jobId"))
	var jobPtr *string
	if jobID != "" {
		jobPtr = &jobID
	}
	preset := strings.TrimSpace(query.Get("preset"))
	switch preset {
	case "", preset7d, preset30d, preset90d, presetAll:
	default:
		return analyticsWindow{}, Invalid("preset must be 7d, 30d, 90d, or all")
	}
	fromRaw := strings.TrimSpace(query.Get("from"))
	toRaw := strings.TrimSpace(query.Get("to"))
	var fromAt, toAt *time.Time
	var fromText, toText *string
	if fromRaw != "" {
		day, err := parseAnalyticsDay(fromRaw, loc)
		if err != nil {
			return analyticsWindow{}, err
		}
		fromAt = &day
		fromText = &fromRaw
	}
	if toRaw != "" {
		day, err := parseAnalyticsDay(toRaw, loc)
		if err != nil {
			return analyticsWindow{}, err
		}
		toAt = &day
		toText = &toRaw
	}
	if fromAt != nil && toAt != nil && fromAt.After(*toAt) {
		return analyticsWindow{}, Invalid("from must be on or before to")
	}
	if fromRaw == "" && toRaw == "" && preset != "" && preset != presetAll {
		start, end := presetRange(preset, now, loc)
		fromAt = &start
		toAt = &end
		startText := formatAnalyticsDay(start)
		endText := formatAnalyticsDay(end)
		fromText = &startText
		toText = &endText
	}
	if preset == "" {
		preset = inferPreset(fromAt, toAt, now, loc)
	}
	return analyticsWindow{
		jobID:    jobPtr,
		from:     fromAt,
		to:       toAt,
		fromText: fromText,
		toText:   toText,
		preset:   preset,
	}, nil
}

func presetRange(preset string, now time.Time, loc *time.Location) (time.Time, time.Time) {
	days := presetDays[preset]
	end := calendarDay(now, loc)
	start := end.AddDate(0, 0, -(days - 1))
	return start, end
}

func inferPreset(from, to *time.Time, now time.Time, loc *time.Location) string {
	if from == nil || to == nil {
		return presetAll
	}
	end := calendarDay(now, loc)
	if !to.Equal(end) {
		return presetAll
	}
	span := inclusiveDays(*from, *to)
	switch span {
	case presetDays[preset7d]:
		return preset7d
	case presetDays[preset30d]:
		return preset30d
	case presetDays[preset90d]:
		return preset90d
	default:
		return presetAll
	}
}

func inclusiveDays(from, to time.Time) int {
	days := 0
	for day := from; !day.After(to); day = day.AddDate(0, 0, 1) {
		days++
	}
	return days
}

func parseAnalyticsDay(value string, loc *time.Location) (time.Time, error) {
	day, err := time.ParseInLocation("2006-01-02", value, loc)
	if err != nil || day.Format("2006-01-02") != value {
		return time.Time{}, Invalid("from and to must be YYYY-MM-DD")
	}
	return day, nil
}

func formatAnalyticsDay(day time.Time) string {
	return day.Format("2006-01-02")
}

func calendarDay(t time.Time, loc *time.Location) time.Time {
	if loc == nil {
		loc = time.UTC
	}
	year, month, day := t.In(loc).Date()
	return time.Date(year, month, day, 0, 0, 0, 0, loc)
}

func inAnalyticsRange(when time.Time, from, to *time.Time, loc *time.Location) bool {
	if from == nil && to == nil {
		return true
	}
	day := calendarDay(when, loc)
	if from != nil && day.Before(*from) {
		return false
	}
	if to != nil && day.After(*to) {
		return false
	}
	return true
}

func interviewInRange(date string, from, to *time.Time, loc *time.Location) bool {
	if from == nil && to == nil {
		return true
	}
	day, err := parseAnalyticsDay(strings.TrimSpace(date), loc)
	if err != nil {
		return false
	}
	return inAnalyticsRange(day, from, to, loc)
}

func countReached(people []Applicant, stages ...string) int {
	count := 0
	for _, person := range people {
		if containsPerm(stages, person.ColumnID) {
			count++
		}
	}
	return count
}

func sourceBucket(person Applicant) string {
	if strings.TrimSpace(person.ReferralSource) != "" {
		return "referral"
	}
	switch person.Assisted {
	case "direct", "bidder", "agent":
		return person.Assisted
	default:
		return "other"
	}
}

func daysInStage(person Applicant, now time.Time, loc *time.Location) (int, bool) {
	from := person.AppliedOn
	proxy := true
	if !person.StageEnteredAt.IsZero() {
		from = person.StageEnteredAt
		proxy = false
	}
	days := daysBetween(from, now, loc)
	if days < 0 {
		days = 0
	}
	return days, proxy
}

func daysBetween(from, to time.Time, loc *time.Location) int {
	start := calendarDay(from, loc)
	end := calendarDay(to, loc)
	return int(math.Round(float64(end.Sub(start)) / float64(24*time.Hour)))
}

func percentRate(numerator, denominator int) *int {
	if denominator <= 0 {
		return nil
	}
	value := int(math.Round(float64(numerator) / float64(denominator) * percentScale))
	return &value
}

func averageDays(values []int) *int {
	if len(values) == 0 {
		return nil
	}
	sum := 0
	for _, value := range values {
		sum += value
	}
	avg := int(math.Round(float64(sum) / float64(len(values))))
	return &avg
}

func medianDays(values []int) *int {
	if len(values) == 0 {
		return nil
	}
	sorted := append([]int(nil), values...)
	sort.Ints(sorted)
	mid := len(sorted) / 2
	var value int
	if len(sorted)%2 == 0 {
		value = int(math.Round(float64(sorted[mid-1]+sorted[mid]) / 2))
	} else {
		value = sorted[mid]
	}
	return &value
}
