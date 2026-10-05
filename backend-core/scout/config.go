package scout

import (
	"os"
	"strconv"
)

// Config holds configurable scout settings.
type Config struct {
	// ApplyRewardCents is the fixed credit per qualifying apply (released immediately).
	ApplyRewardCents int64
}

// DefaultConfig returns the default scout configuration.
func DefaultConfig() Config {
	return Config{
		ApplyRewardCents: 50,
	}
}

// LoadConfig reads scout settings from the environment with defaults.
func LoadConfig() Config {
	cfg := DefaultConfig()
	if s := os.Getenv("SCOUT_APPLY_REWARD_CENTS"); s != "" {
		if v, err := strconv.ParseInt(s, 10, 64); err == nil && v >= 0 {
			cfg.ApplyRewardCents = v
		}
	}
	return cfg
}
