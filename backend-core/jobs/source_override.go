package jobs

import (
	"strings"
	"sync"
)

// sourceOverride is a staff enable/disable on top of the env registry.
type sourceOverride struct {
	Enabled bool
	Reason  string
}

var (
	sourceOverrideMu sync.Mutex
	sourceOverrides  = map[string]sourceOverride{}
)

// SetSourceEnabled records a staff override for one import source.
// id must be a known source. The first supported id is athens.
func SetSourceEnabled(id string, enabled bool, reason string) error {
	id = strings.TrimSpace(id)
	if id != AthensSourceID {
		return ErrInvalidInput
	}
	sourceOverrideMu.Lock()
	defer sourceOverrideMu.Unlock()
	sourceOverrides[id] = sourceOverride{Enabled: enabled, Reason: strings.TrimSpace(reason)}
	return nil
}

// SourceEnabled reports a staff override. The bool is false when none is set.
func SourceEnabled(id string) (bool, bool) {
	sourceOverrideMu.Lock()
	defer sourceOverrideMu.Unlock()
	item, ok := sourceOverrides[id]
	if !ok {
		return false, false
	}
	return item.Enabled, true
}

// DisabledImportSources is the source ids staff turned off.
// Public search excludes job.source values in this list.
func DisabledImportSources() []string {
	sourceOverrideMu.Lock()
	defer sourceOverrideMu.Unlock()
	var ids []string
	for id, item := range sourceOverrides {
		if !item.Enabled {
			ids = append(ids, id)
		}
	}
	return ids
}

// ResetSourceOverrides clears staff overrides. Tests call it.
func ResetSourceOverrides() {
	sourceOverrideMu.Lock()
	defer sourceOverrideMu.Unlock()
	sourceOverrides = map[string]sourceOverride{}
}

// MergeSourceStatus applies staff overrides onto the registry rows.
func MergeSourceStatus(rows []SourceStatus) []SourceStatus {
	out := make([]SourceStatus, len(rows))
	copy(out, rows)
	seen := map[string]bool{}
	for i := range out {
		seen[out[i].ID] = true
		if enabled, ok := SourceEnabled(out[i].ID); ok {
			out[i].Enabled = enabled
		}
	}
	if !seen[AthensSourceID] {
		enabled, ok := SourceEnabled(AthensSourceID)
		if !ok {
			enabled = false
		}
		out = append(out, SourceStatus{ID: AthensSourceID, Enabled: enabled})
	}
	return out
}
