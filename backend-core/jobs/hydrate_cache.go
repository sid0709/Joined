package jobs

import (
	"sync"
	"time"
)

const (
	// hydrationTTL is how long a hydrated catalog job is served from memory. An
	// admin edit or status change shows on ranked search within this long; the
	// ranking index drops removed jobs from results sooner.
	hydrationTTL = time.Minute
	// hydrationMaxEntries bounds the cache (a catalog job is a few KB).
	hydrationMaxEntries = 50_000
)

// hydrationCache keeps recently hydrated catalog jobs, so a page of a cached
// ranked list is served without a Mongo read. The posted age is recomputed on
// every read. Safe for concurrent use.
type hydrationCache struct {
	mu      sync.Mutex
	entries map[string]hydratedJob
}

type hydratedJob struct {
	job      catalogJob
	postedAt time.Time
	expires  time.Time
}

// get returns the cached jobs among objectIDs and the ids still to load.
func (c *hydrationCache) get(objectIDs []string, now time.Time) (map[string]catalogJob, []string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	found := make(map[string]catalogJob, len(objectIDs))
	var missing []string
	for _, id := range objectIDs {
		entry, ok := c.entries[id]
		if !ok || now.After(entry.expires) {
			missing = append(missing, id)
			continue
		}
		job := entry.job
		job.PostedHoursAgo = hoursSince(entry.postedAt, now)
		found[id] = job
	}
	return found, missing
}

func (c *hydrationCache) put(id string, job catalogJob, postedAt, now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.entries == nil {
		c.entries = make(map[string]hydratedJob)
	}
	if len(c.entries) >= hydrationMaxEntries {
		for key, entry := range c.entries {
			if now.After(entry.expires) {
				delete(c.entries, key)
			}
		}
		if len(c.entries) >= hydrationMaxEntries {
			c.entries = make(map[string]hydratedJob)
		}
	}
	c.entries[id] = hydratedJob{job: job, postedAt: postedAt, expires: now.Add(hydrationTTL)}
}
