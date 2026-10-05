package killswitch

import (
	"time"

	"github.com/sid0709/OpenSeat/backend-core/config"
)

// Defaults is the env snapshot a process starts with. True means the feature runs.
type Defaults map[Name]bool

// LoadDefaults reads KILLSWITCH_* from the environment. Unset or blank leaves
// the feature on. off/false/0/no/disabled turns it off until a Mongo override.
func LoadDefaults() Defaults {
	out := Defaults{}
	for _, name := range Names {
		out[name] = parseEnabled(config.Env(envKeys[name], "on"))
	}
	return out
}

func complete(in Defaults) Defaults {
	out := Defaults{}
	for _, name := range Names {
		if in == nil {
			out[name] = true
			continue
		}
		enabled, ok := in[name]
		if !ok {
			out[name] = true
			continue
		}
		out[name] = enabled
	}
	return out
}

func cacheTTL() time.Duration {
	ms := config.EnvInt(envCacheMS, int(DefaultCache/time.Millisecond))
	return time.Duration(ms) * time.Millisecond
}
