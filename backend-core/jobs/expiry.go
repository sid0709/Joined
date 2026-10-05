package jobs

import (
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/config"
)

const (
	defaultExpiryTimeout      = 10 * time.Second
	defaultExpiryHostInterval = time.Second
	defaultExpiryPollInterval = time.Hour
	defaultExpiryBatch        = 50
	defaultFailureThreshold   = 3
	defaultScoutedInterval    = 24 * time.Hour
	defaultDirectInterval     = 7 * 24 * time.Hour

	envExpiryFailures         = "JOBS_EXPIRY_FAILURES"
	envExpiryTimeout          = "JOBS_EXPIRY_TIMEOUT"
	envExpiryHostInterval     = "JOBS_EXPIRY_HOST_INTERVAL"
	envExpiryPollInterval     = "JOBS_EXPIRY_POLL_INTERVAL"
	envExpiryBatch            = "JOBS_EXPIRY_BATCH"
	envExpiryScoutedInterval  = "JOBS_EXPIRY_SCOUTED_INTERVAL"
	envExpiryDirectInterval   = "JOBS_EXPIRY_DIRECT_INTERVAL"
	envExpiryAggregatedSameAs = "JOBS_EXPIRY_AGGREGATED_INTERVAL"
)

// ExpiryConfig is how often listings are rechecked and how many dead probes expire one.
type ExpiryConfig struct {
	Enabled            bool
	FailureThreshold   int
	Timeout            time.Duration
	HostInterval       time.Duration
	PollInterval       time.Duration
	Batch              int
	ScoutedInterval    time.Duration
	AggregatedInterval time.Duration
	DirectInterval     time.Duration
}

func DefaultExpiryConfig() ExpiryConfig {
	return ExpiryConfig{
		Enabled:            false,
		FailureThreshold:   defaultFailureThreshold,
		Timeout:            defaultExpiryTimeout,
		HostInterval:       defaultExpiryHostInterval,
		PollInterval:       defaultExpiryPollInterval,
		Batch:              defaultExpiryBatch,
		ScoutedInterval:    defaultScoutedInterval,
		AggregatedInterval: defaultScoutedInterval,
		DirectInterval:     defaultDirectInterval,
	}
}

func LoadExpiryConfig() ExpiryConfig {
	cfg := DefaultExpiryConfig()
	cfg.Enabled = config.JobsExpiryCheckerEnabled()
	cfg.FailureThreshold = config.EnvInt(envExpiryFailures, cfg.FailureThreshold)
	cfg.Timeout = config.EnvDuration(envExpiryTimeout, cfg.Timeout)
	cfg.HostInterval = config.EnvDuration(envExpiryHostInterval, cfg.HostInterval)
	cfg.PollInterval = config.EnvDuration(envExpiryPollInterval, cfg.PollInterval)
	cfg.Batch = config.EnvInt(envExpiryBatch, cfg.Batch)
	cfg.ScoutedInterval = config.EnvDuration(envExpiryScoutedInterval, cfg.ScoutedInterval)
	cfg.AggregatedInterval = config.EnvDuration(envExpiryAggregatedSameAs, cfg.ScoutedInterval)
	cfg.DirectInterval = config.EnvDuration(envExpiryDirectInterval, cfg.DirectInterval)
	return cfg.withDefaults()
}

func (cfg ExpiryConfig) withDefaults() ExpiryConfig {
	if cfg.FailureThreshold < 1 {
		cfg.FailureThreshold = defaultFailureThreshold
	}
	if cfg.Timeout < 1 {
		cfg.Timeout = defaultExpiryTimeout
	}
	if cfg.HostInterval < 0 {
		cfg.HostInterval = defaultExpiryHostInterval
	}
	if cfg.PollInterval < 1 {
		cfg.PollInterval = defaultExpiryPollInterval
	}
	if cfg.Batch < 1 {
		cfg.Batch = defaultExpiryBatch
	}
	if cfg.ScoutedInterval < 1 {
		cfg.ScoutedInterval = defaultScoutedInterval
	}
	if cfg.AggregatedInterval < 1 {
		cfg.AggregatedInterval = cfg.ScoutedInterval
	}
	if cfg.DirectInterval < 1 {
		cfg.DirectInterval = defaultDirectInterval
	}
	return cfg
}

type expiryJob struct {
	ID                    string
	ApplyLink             string
	JobSource             string
	ListingSource         string
	ListingStatus         string
	PreviousListingStatus string
	TakedownCause         string
	LinkCheckFailures     int
	LastLinkCheckedAt     time.Time
	LastVerifiedOpenAt    time.Time
	ExpiredAt             time.Time
	LinkCheckSignal       string
}

func checkInterval(jobSource, listingSource string, cfg ExpiryConfig) time.Duration {
	cfg = cfg.withDefaults()
	switch expirySourceKind(jobSource, listingSource) {
	case DirectSource:
		return cfg.DirectInterval
	case scoutedJobType:
		return cfg.ScoutedInterval
	default:
		return cfg.AggregatedInterval
	}
}

func expirySourceKind(jobSource, listingSource string) string {
	if canonicalizeSource(listingSource) == DirectSource || canonicalizeSource(jobSource) == DirectSource {
		return DirectSource
	}
	if isHiddenJob(jobSource, listingSource) {
		return scoutedJobType
	}
	return aggregatedSource
}

func checkDue(lastChecked time.Time, jobSource, listingSource string, now time.Time, cfg ExpiryConfig) bool {
	if lastChecked.IsZero() {
		return true
	}
	return !now.Before(lastChecked.Add(checkInterval(jobSource, listingSource, cfg)))
}

func applyLinkCheck(job expiryJob, result linkResult, now time.Time, threshold int) expiryJob {
	if threshold < 1 {
		threshold = defaultFailureThreshold
	}
	job.LastLinkCheckedAt = now
	if result.Open {
		job.LinkCheckFailures = 0
		job.LastVerifiedOpenAt = now
		job.LinkCheckSignal = ""
		return job
	}
	job.LinkCheckFailures++
	job.LinkCheckSignal = result.Signal
	if job.LinkCheckFailures < threshold || job.ListingStatus == ListingExpired {
		return job
	}
	job.PreviousListingStatus = job.ListingStatus
	job.ListingStatus = ListingExpired
	job.ExpiredAt = now
	job.TakedownCause = TakedownCauseDeadLink
	return job
}

func normalizeHost(host string) string {
	host = strings.ToLower(strings.TrimSpace(host))
	return strings.TrimPrefix(host, "www.")
}
