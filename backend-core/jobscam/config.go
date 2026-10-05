package jobscam

import (
	"strconv"

	"github.com/sid0709/OpenSeat/backend-core/config"
)

const (
	// DefaultHoldThreshold is the score at which a job is held for staff instead of
	// going public. One high-confidence signal (pay-to-apply, crypto/wire) is enough.
	DefaultHoldThreshold = 40
	maxHoldThreshold     = 100

	envHoldThreshold = "JOB_SCAM_HOLD_THRESHOLD"
	holdsCollection  = "job_scam_holds"
)

// Config is the hold threshold staff can raise or lower without a code change.
type Config struct {
	HoldThreshold int
}

// LoadConfig reads JOB_SCAM_HOLD_THRESHOLD (0–100). Unset or invalid keeps 40.
func LoadConfig() Config {
	return Config{HoldThreshold: parseThreshold(config.Env(envHoldThreshold, ""), DefaultHoldThreshold)}
}

func parseThreshold(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 || value > maxHoldThreshold {
		return fallback
	}
	return value
}

func (cfg Config) withDefaults() Config {
	if cfg.HoldThreshold < 0 || cfg.HoldThreshold > maxHoldThreshold {
		cfg.HoldThreshold = DefaultHoldThreshold
	}
	return cfg
}
