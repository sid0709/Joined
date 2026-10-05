package config

import (
	"time"
)

const (
	// DefaultJobImportRunsCollection stores scheduled import run logs.
	DefaultJobImportRunsCollection = "job_import_runs"
	// DefaultJobImportLocksCollection holds the single-runner lock document.
	DefaultJobImportLocksCollection = "job_import_locks"
	defaultJobImportInterval        = time.Hour
	defaultJobImportRecentLimit     = 20
	defaultJobImportRunTimeout      = 20 * time.Minute
)

// JobImport is the scheduled job-import runner. It stays off until JOB_IMPORT_ENABLED
// is set, and no source runs until it is listed in JOB_IMPORT_SOURCES.
type JobImport struct {
	Enabled         bool
	Interval        time.Duration
	EnabledSources  []string
	RunsCollection  string
	LocksCollection string
	RecentLimit     int
	RunTimeout      time.Duration
}

// LoadJobImport reads import-runner settings. The runner and every source are
// disabled when the variables are unset.
func LoadJobImport() JobImport {
	return JobImport{
		Enabled:         envFlag("JOB_IMPORT_ENABLED"),
		Interval:        envDuration("JOB_IMPORT_INTERVAL", defaultJobImportInterval),
		EnabledSources:  splitList(Env("JOB_IMPORT_SOURCES", "")),
		RunsCollection:  Env("JOB_IMPORT_RUNS_COLLECTION", DefaultJobImportRunsCollection),
		LocksCollection: Env("JOB_IMPORT_LOCKS_COLLECTION", DefaultJobImportLocksCollection),
		RecentLimit:     EnvInt("JOB_IMPORT_RECENT_LIMIT", defaultJobImportRecentLimit),
		RunTimeout:      envDuration("JOB_IMPORT_TIMEOUT", defaultJobImportRunTimeout),
	}
}

// SourceEnabled reports whether id is in JOB_IMPORT_SOURCES.
func (c JobImport) SourceEnabled(id string) bool {
	for _, source := range c.EnabledSources {
		if source == id {
			return true
		}
	}
	return false
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value := Env(key, "")
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
