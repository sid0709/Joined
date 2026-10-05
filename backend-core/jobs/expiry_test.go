package jobs

import (
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestLoadExpiryConfigDefaultsOff(t *testing.T) {
	t.Setenv("JOBS_EXPIRY_CHECKER_ENABLED", "")
	t.Setenv("JOBS_EXPIRY_FAILURES", "")
	t.Setenv("JOBS_EXPIRY_TIMEOUT", "")
	t.Setenv("JOBS_EXPIRY_SCOUTED_INTERVAL", "")
	t.Setenv("JOBS_EXPIRY_DIRECT_INTERVAL", "")
	cfg := LoadExpiryConfig()
	if cfg.Enabled {
		t.Fatal("checker must be off by default")
	}
	if cfg.FailureThreshold != defaultFailureThreshold {
		t.Fatalf("failures = %d", cfg.FailureThreshold)
	}
	if cfg.ScoutedInterval != defaultScoutedInterval || cfg.AggregatedInterval != defaultScoutedInterval {
		t.Fatalf("daily cadence = %v / %v", cfg.ScoutedInterval, cfg.AggregatedInterval)
	}
	if cfg.DirectInterval != defaultDirectInterval {
		t.Fatalf("direct cadence = %v", cfg.DirectInterval)
	}
}

func TestCheckDueUsesDailyAndWeeklyCadence(t *testing.T) {
	cfg := DefaultExpiryConfig()
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	if !checkDue(time.Time{}, scoutedJobType, ScoutedSource, now, cfg) {
		t.Fatal("never-checked scouted jobs are due")
	}
	if checkDue(now.Add(-12*time.Hour), scoutedJobType, ScoutedSource, now, cfg) {
		t.Fatal("scouted job checked 12h ago is not due")
	}
	if !checkDue(now.Add(-25*time.Hour), aggregatedSource, "Greenhouse", now, cfg) {
		t.Fatal("aggregated job checked yesterday is due")
	}
	if checkDue(now.Add(-3*24*time.Hour), directType, DirectSource, now, cfg) {
		t.Fatal("direct job checked 3 days ago is not due yet")
	}
	if !checkDue(now.Add(-8*24*time.Hour), directType, DirectSource, now, cfg) {
		t.Fatal("direct job checked 8 days ago is due")
	}
}

func TestApplyLinkCheckExpiresOnlyAfterConsecutiveFailures(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	dead := linkResult{Signal: signalHTTP404, Status: 404}
	job := expiryJob{ID: "job-1", ListingStatus: ListingActive}

	job = applyLinkCheck(job, dead, now, 3)
	if job.ListingStatus != ListingActive || job.LinkCheckFailures != 1 {
		t.Fatalf("one failure expired = %+v", job)
	}
	job = applyLinkCheck(job, dead, now.Add(time.Hour), 3)
	if job.ListingStatus != ListingActive || job.LinkCheckFailures != 2 {
		t.Fatalf("two failures expired = %+v", job)
	}
	job = applyLinkCheck(job, dead, now.Add(2*time.Hour), 3)
	if job.ListingStatus != ListingExpired || job.LinkCheckFailures != 3 {
		t.Fatalf("third failure should expire: %+v", job)
	}
	if job.TakedownCause != TakedownCauseDeadLink || job.PreviousListingStatus != ListingActive {
		t.Fatalf("expiry metadata = %+v", job)
	}
	if listingMatchesSearch(job.ListingStatus, aggregatedSource, "Greenhouse", SearchQuery{}) {
		t.Fatal("expired job must drop out of search")
	}
}

func TestApplyLinkCheckTransientFailureDoesNotExpire(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	job := expiryJob{ID: "job-2", ListingStatus: ""}
	job = applyLinkCheck(job, linkResult{Signal: signalTimeout}, now, 3)
	if job.ListingStatus != "" || job.LinkCheckFailures != 1 {
		t.Fatalf("timeout should not expire: %+v", job)
	}
	job = applyLinkCheck(job, linkResult{Open: true, Status: 200}, now.Add(time.Minute), 3)
	if job.LinkCheckFailures != 0 || job.LastVerifiedOpenAt != now.Add(time.Minute) {
		t.Fatalf("open probe should reset failures: %+v", job)
	}
	if job.ListingStatus == ListingExpired {
		t.Fatal("reset job must stay listed")
	}
}

func TestExpiredListingsAreExcludedFromSearch(t *testing.T) {
	if listingMatchesSearch(ListingExpired, aggregatedSource, "Greenhouse", SearchQuery{}) {
		t.Fatal("expired aggregated job must not match search")
	}
	if listingMatchesSearch(ListingExpired, scoutedJobType, ScoutedSource, SearchQuery{Source: SearchSourceHidden}) {
		t.Fatal("expired scouted job must not match hidden search")
	}
	filter := (&Store{}).buildSearchFilter(SearchQuery{}, time.Now())
	if !hasListingStatusFilter(filter) {
		t.Fatalf("search filter must keep the public listingStatus clause: %+v", filter)
	}
	if listingStatusAllows(filter, ListingExpired) {
		t.Fatal("public listing filter must not include expired")
	}
}

func TestDueExpiryFilterKeepsPublicListingsWithApplyLinks(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	filter := dueExpiryFilter(now, DefaultExpiryConfig())
	if len(filter) != 1 || filter[0].Key != "$and" {
		t.Fatalf("filter = %+v", filter)
	}
	clauses, ok := filter[0].Value.(bson.A)
	if !ok || len(clauses) != 3 {
		t.Fatalf("clauses = %#v", filter[0].Value)
	}
}

func listingStatusAllows(filter bson.D, status string) bool {
	for _, cond := range filterConditions(filter) {
		if len(cond) == 0 || cond[0].Key != "listingStatus" {
			continue
		}
		clause, ok := cond[0].Value.(bson.D)
		if !ok {
			continue
		}
		for _, part := range clause {
			if part.Key != "$in" {
				continue
			}
			allowed, ok := part.Value.(bson.A)
			if !ok {
				continue
			}
			for _, value := range allowed {
				if value == status {
					return true
				}
			}
		}
	}
	return false
}
