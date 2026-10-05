package config

import (
	"testing"
	"time"
)

func TestLoadJobImportDisabledByDefault(t *testing.T) {
	t.Setenv("JOB_IMPORT_ENABLED", "")
	t.Setenv("JOB_IMPORT_INTERVAL", "")
	t.Setenv("JOB_IMPORT_SOURCES", "")
	t.Setenv("JOB_IMPORT_RUNS_COLLECTION", "")
	t.Setenv("JOB_IMPORT_LOCKS_COLLECTION", "")
	t.Setenv("JOB_IMPORT_RECENT_LIMIT", "")
	t.Setenv("JOB_IMPORT_TIMEOUT", "")

	cfg := LoadJobImport()
	if cfg.Enabled {
		t.Fatal("import runner must be disabled by default")
	}
	if len(cfg.EnabledSources) != 0 {
		t.Fatalf("enabled sources = %v, want none", cfg.EnabledSources)
	}
	if cfg.SourceEnabled("athens") {
		t.Fatal("athens must stay off until listed in JOB_IMPORT_SOURCES")
	}
	if cfg.Interval != time.Hour {
		t.Fatalf("interval = %s, want 1h", cfg.Interval)
	}
	if cfg.RecentLimit != 20 {
		t.Fatalf("recent limit = %d, want 20", cfg.RecentLimit)
	}
	if cfg.RunsCollection != DefaultJobImportRunsCollection {
		t.Fatalf("runs collection = %q", cfg.RunsCollection)
	}
	if cfg.LocksCollection != DefaultJobImportLocksCollection {
		t.Fatalf("locks collection = %q", cfg.LocksCollection)
	}
}

func TestLoadJobImportEnabledSources(t *testing.T) {
	t.Setenv("JOB_IMPORT_ENABLED", "true")
	t.Setenv("JOB_IMPORT_SOURCES", "athens, fake")
	t.Setenv("JOB_IMPORT_INTERVAL", "15m")
	t.Setenv("JOB_IMPORT_TIMEOUT", "5m")
	t.Setenv("JOB_IMPORT_RECENT_LIMIT", "5")

	cfg := LoadJobImport()
	if !cfg.Enabled {
		t.Fatal("JOB_IMPORT_ENABLED=true should enable the runner")
	}
	if !cfg.SourceEnabled("athens") || !cfg.SourceEnabled("fake") {
		t.Fatalf("sources = %v", cfg.EnabledSources)
	}
	if cfg.Interval != 15*time.Minute {
		t.Fatalf("interval = %s", cfg.Interval)
	}
	if cfg.RunTimeout != 5*time.Minute {
		t.Fatalf("timeout = %s", cfg.RunTimeout)
	}
	if cfg.RecentLimit != 5 {
		t.Fatalf("recent limit = %d", cfg.RecentLimit)
	}
}

func TestLoadJobImportRejectsInvalidDuration(t *testing.T) {
	t.Setenv("JOB_IMPORT_INTERVAL", "nope")
	t.Setenv("JOB_IMPORT_TIMEOUT", "0s")
	cfg := LoadJobImport()
	if cfg.Interval != time.Hour {
		t.Fatalf("interval = %s, want default", cfg.Interval)
	}
	if cfg.RunTimeout != 20*time.Minute {
		t.Fatalf("timeout = %s, want default", cfg.RunTimeout)
	}
}
