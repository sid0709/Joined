package jobs

import "sync"

// ImportKillSwitch is the optional step-26 gate. A source may import only when
// Allow reports true. Nil means every source is allowed.
type ImportKillSwitch interface {
	Allow(sourceID string) bool
}

type allowAllImports struct{}

func (allowAllImports) Allow(string) bool { return true }

func effectiveKillSwitch(gate ImportKillSwitch) ImportKillSwitch {
	if gate == nil {
		return allowAllImports{}
	}
	return gate
}

var (
	killSwitchMu               sync.RWMutex
	registeredImportKillSwitch ImportKillSwitch
)

// RegisterImportKillSwitch is how step-26 installs its gate. Safe to call from init.
func RegisterImportKillSwitch(gate ImportKillSwitch) {
	killSwitchMu.Lock()
	defer killSwitchMu.Unlock()
	registeredImportKillSwitch = gate
}

// LookupImportKillSwitch returns a registered step-26 gate, or nil when that
// package is not present yet.
func LookupImportKillSwitch() ImportKillSwitch {
	killSwitchMu.RLock()
	defer killSwitchMu.RUnlock()
	return registeredImportKillSwitch
}

type allowAdapter struct {
	fn func(string) bool
}

func (a allowAdapter) Allow(sourceID string) bool {
	if a.fn == nil {
		return true
	}
	return a.fn(sourceID)
}

// KillSwitchFrom accepts a step-26 object by interface so this step compiles
// whether or not that package has landed. Unknown types are ignored.
func KillSwitchFrom(value any) ImportKillSwitch {
	if value == nil {
		return nil
	}
	switch v := value.(type) {
	case ImportKillSwitch:
		return v
	case interface{ Allow(string) bool }:
		return allowAdapter{fn: v.Allow}
	case interface{ ImportAllowed(string) bool }:
		return allowAdapter{fn: v.ImportAllowed}
	case interface{ SourceEnabled(string) bool }:
		return allowAdapter{fn: v.SourceEnabled}
	default:
		return nil
	}
}
