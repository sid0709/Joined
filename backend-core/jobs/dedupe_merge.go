package jobs

import "context"

const (
	dedupeActionInsert  = "insert"
	dedupeActionReplace = "replace"
	dedupeActionSkip    = "skip"
)

// DedupePool looks up active listings. Tests use an in-memory fake.
type DedupePool interface {
	FindActiveByKey(ctx context.Context, key, exceptID string) (*DedupeRecord, error)
	FindFuzzyCandidates(ctx context.Context, incoming DedupeRecord, exceptID string) ([]DedupeRecord, error)
}

// WritePlan is whether an incoming listing should be inserted, folded into an
// existing row, or dropped because the pool already has a better source.
type WritePlan struct {
	Action string
	Save   DedupeRecord
	Match  *DedupeRecord
}

// DecideWrite keeps one listing. A higher-priority incoming source replaces
// the match in place (stable id). Equal or lower rank skips the incoming row.
func DecideWrite(incoming DedupeRecord, match *DedupeRecord) WritePlan {
	if incoming.DedupeKey == "" {
		incoming.DedupeKey = incoming.Key()
	}
	if match == nil {
		return WritePlan{Action: dedupeActionInsert, Save: incoming}
	}
	kept := *match
	if PreferIncomingSource(incoming.Source, match.Source) {
		merged := incoming
		merged.ID = match.ID
		merged.JobID = match.JobID
		if !match.PostedAt.IsZero() {
			merged.PostedAt = match.PostedAt
		}
		merged.DedupeKey = incoming.Key()
		return WritePlan{Action: dedupeActionReplace, Save: merged, Match: &kept}
	}
	return WritePlan{Action: dedupeActionSkip, Save: kept, Match: &kept}
}

// ResolveDedupe finds an exact-key hit, then a fuzzy match, among active jobs.
func ResolveDedupe(ctx context.Context, cfg DedupeConfig, pool DedupePool, incoming DedupeRecord) (*DedupeRecord, error) {
	cfg = cfg.withDefaults()
	key := incoming.Key()
	if key != "" {
		exact, err := pool.FindActiveByKey(ctx, key, incoming.ID)
		if err != nil {
			return nil, err
		}
		if exact != nil {
			return exact, nil
		}
	}
	candidates, err := pool.FindFuzzyCandidates(ctx, incoming, incoming.ID)
	if err != nil {
		return nil, err
	}
	for i := range candidates {
		candidate := candidates[i]
		if incoming.ID != "" && candidate.ID == incoming.ID {
			continue
		}
		if FuzzyMatch(incoming, candidate, cfg) {
			return &candidate, nil
		}
	}
	return nil, nil
}

func PlanDedupeWrite(ctx context.Context, cfg DedupeConfig, pool DedupePool, incoming DedupeRecord) (WritePlan, error) {
	match, err := ResolveDedupe(ctx, cfg, pool, incoming)
	if err != nil {
		return WritePlan{}, err
	}
	return DecideWrite(incoming, match), nil
}

const (
	duplicateReasonExact = "exact"
	duplicateReasonFuzzy = "fuzzy"
)

// DuplicateGroup is a set of active listings that look like one opening.
type DuplicateGroup struct {
	Reason    string         `json:"reason"`
	DedupeKey string         `json:"dedupeKey,omitempty"`
	Listings  []DedupeRecord `json:"listings"`
}

// DuplicateGroups reports exact-key and fuzzy clusters without writing.
func DuplicateGroups(records []DedupeRecord, cfg DedupeConfig) []DuplicateGroup {
	cfg = cfg.withDefaults()
	n := len(records)
	if n < 2 {
		return nil
	}
	parent := make([]int, n)
	for i := range parent {
		parent[i] = i
	}
	var find func(int) int
	find = func(i int) int {
		for parent[i] != i {
			parent[i] = parent[parent[i]]
			i = parent[i]
		}
		return i
	}
	union := func(a, b int) {
		ra, rb := find(a), find(b)
		if ra != rb {
			parent[rb] = ra
		}
	}

	byKey := map[string][]int{}
	for i, rec := range records {
		key := rec.Key()
		if key == "" {
			continue
		}
		byKey[key] = append(byKey[key], i)
	}
	exactMembers := map[int]struct{}{}
	for _, indexes := range byKey {
		if len(indexes) < 2 {
			continue
		}
		for _, idx := range indexes[1:] {
			union(indexes[0], idx)
		}
		for _, idx := range indexes {
			exactMembers[idx] = struct{}{}
		}
	}
	for i := 0; i < n; i++ {
		for j := i + 1; j < n; j++ {
			if find(i) == find(j) {
				continue
			}
			if FuzzyMatch(records[i], records[j], cfg) {
				union(i, j)
			}
		}
	}

	clusters := map[int][]int{}
	for i := range records {
		root := find(i)
		clusters[root] = append(clusters[root], i)
	}
	groups := make([]DuplicateGroup, 0)
	for _, indexes := range clusters {
		if len(indexes) < 2 {
			continue
		}
		listings := make([]DedupeRecord, 0, len(indexes))
		keys := map[string]struct{}{}
		allExact := true
		for _, idx := range indexes {
			listings = append(listings, records[idx])
			if _, ok := exactMembers[idx]; !ok {
				allExact = false
			}
			if key := records[idx].Key(); key != "" {
				keys[key] = struct{}{}
			}
		}
		group := DuplicateGroup{Reason: duplicateReasonFuzzy, Listings: listings}
		if allExact && len(keys) == 1 {
			group.Reason = duplicateReasonExact
			for key := range keys {
				group.DedupeKey = key
			}
		}
		groups = append(groups, group)
	}
	return groups
}
