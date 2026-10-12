package config

import (
	"os"
	"testing"
	"time"
)

func TestSearchEnsureIndex(t *testing.T) {
	tests := []struct {
		name    string
		envVal  string
		want    bool
		cleanup bool
	}{
		{
			name:    "defaults to false when unset",
			envVal:  "",
			want:    false,
			cleanup: false,
		},
		{
			name:    "explicit true",
			envVal:  "true",
			want:    true,
			cleanup: true,
		},
		{
			name:    "explicit 1",
			envVal:  "1",
			want:    true,
			cleanup: true,
		},
		{
			name:    "explicit false",
			envVal:  "false",
			want:    false,
			cleanup: true,
		},
		{
			name:    "explicit 0",
			envVal:  "0",
			want:    false,
			cleanup: true,
		},
		{
			name:    "whitespace around true",
			envVal:  "  true  ",
			want:    true,
			cleanup: true,
		},
		{
			name:    "empty string explicit",
			envVal:  " ",
			want:    false,
			cleanup: true,
		},
	}

	originalVal, originalSet := os.LookupEnv("SEARCH_ENSURE_INDEX")
	defer func() {
		if originalSet {
			os.Setenv("SEARCH_ENSURE_INDEX", originalVal)
		} else {
			os.Unsetenv("SEARCH_ENSURE_INDEX")
		}
	}()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.cleanup {
				os.Setenv("SEARCH_ENSURE_INDEX", tt.envVal)
				defer os.Unsetenv("SEARCH_ENSURE_INDEX")
			} else {
				os.Unsetenv("SEARCH_ENSURE_INDEX")
			}

			got := SearchEnsureIndex()
			if got != tt.want {
				t.Errorf("SearchEnsureIndex() = %v, want %v (env=%q)", got, tt.want, tt.envVal)
			}
		})
	}
}

func TestJobsExpiryCheckerEnabledDefaultsOff(t *testing.T) {
	originalVal, originalSet := os.LookupEnv("JOBS_EXPIRY_CHECKER_ENABLED")
	defer func() {
		if originalSet {
			os.Setenv("JOBS_EXPIRY_CHECKER_ENABLED", originalVal)
		} else {
			os.Unsetenv("JOBS_EXPIRY_CHECKER_ENABLED")
		}
	}()

	os.Unsetenv("JOBS_EXPIRY_CHECKER_ENABLED")
	if JobsExpiryCheckerEnabled() {
		t.Fatal("expiry checker must be off when the env flag is unset")
	}

	tests := []struct {
		env  string
		want bool
	}{
		{env: "true", want: true},
		{env: "1", want: true},
		{env: "TRUE", want: true},
		{env: "false", want: false},
		{env: "0", want: false},
		{env: "yes", want: false},
	}
	for _, tt := range tests {
		t.Run(tt.env, func(t *testing.T) {
			os.Setenv("JOBS_EXPIRY_CHECKER_ENABLED", tt.env)
			if got := JobsExpiryCheckerEnabled(); got != tt.want {
				t.Fatalf("JobsExpiryCheckerEnabled() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEnvDuration(t *testing.T) {
	key := "TEST_JOBS_EXPIRY_TIMEOUT"
	originalVal, originalSet := os.LookupEnv(key)
	defer func() {
		if originalSet {
			os.Setenv(key, originalVal)
		} else {
			os.Unsetenv(key)
		}
	}()

	fallback := 10 * time.Second
	os.Unsetenv(key)
	if got := EnvDuration(key, fallback); got != fallback {
		t.Fatalf("unset = %v, want fallback", got)
	}
	os.Setenv(key, "15s")
	if got := EnvDuration(key, fallback); got != 15*time.Second {
		t.Fatalf("15s = %v", got)
	}
	os.Setenv(key, "nope")
	if got := EnvDuration(key, fallback); got != fallback {
		t.Fatalf("invalid = %v, want fallback", got)
	}
	os.Setenv(key, "0s")
	if got := EnvDuration(key, fallback); got != fallback {
		t.Fatalf("zero = %v, want fallback", got)
	}
}

func TestSearchEnsureIndexDoesNotInferFromAddress(t *testing.T) {
	originalVal, originalSet := os.LookupEnv("SEARCH_ENSURE_INDEX")
	defer func() {
		if originalSet {
			os.Setenv("SEARCH_ENSURE_INDEX", originalVal)
		} else {
			os.Unsetenv("SEARCH_ENSURE_INDEX")
		}
	}()

	os.Unsetenv("SEARCH_ENSURE_INDEX")

	got := SearchEnsureIndex()
	if got != false {
		t.Error("SearchEnsureIndex() should return false when SEARCH_ENSURE_INDEX is unset, regardless of address")
	}
}

func TestLoadErrorReportingOptional(t *testing.T) {
	t.Setenv("SENTRY_DSN", "")
	t.Setenv("UPTIME_PING_URL", "")
	got := LoadErrorReporting()
	if got.SentryDSN != "" || got.UptimePingURL != "" {
		t.Fatalf("empty monitoring = %+v", got)
	}
	t.Setenv("SENTRY_DSN", "  https://dsn.example/1  ")
	t.Setenv("UPTIME_PING_URL", "  https://uptime.example/ping  ")
	got = LoadErrorReporting()
	if got.SentryDSN != "https://dsn.example/1" || got.UptimePingURL != "https://uptime.example/ping" {
		t.Fatalf("trimmed monitoring = %+v", got)
	}
}
