package ranking

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sid0709/Joined/backend-core/jobs"
	"github.com/sid0709/Joined/backend-core/metrics"
)

const (
	// vectorsReadyShare is how much of the index must be in Qdrant before the
	// vector channels serve searches.
	vectorsReadyShare = 0.9
	// upsertBatch is how many job points one Qdrant upsert carries.
	upsertBatch = 128
	// syncRetry is how long a failed full load waits before trying again.
	syncRetry = 15 * time.Second
	// mirrorWorkers is how many upsert batches embed at once during a backfill:
	// enough to keep the embedder's batching full without growing its queue.
	mirrorWorkers = 2
	// mirrorAttempts and mirrorBackoff retry a batch the embedder or Qdrant failed.
	mirrorAttempts = 3
	mirrorBackoff  = 5 * time.Second
	// mirrorProgressEvery logs backfill progress every so many jobs.
	mirrorProgressEvery = 2000
	// reconcileHeadroom pre-sizes a fresh index past the last job count.
	reconcileHeadroom = 1024
	// countPoll and countSettle: how often a reindex re-counts while upserts land,
	// and how long a count may stand still before the reindex gives up waiting.
	countPoll   = time.Second
	countSettle = 30 * time.Second
)

// Run keeps the in-memory index in sync with Mongo until ctx ends: a full load,
// then incremental polls for jobs inserted since the last _id seen, and a full
// reconcile on a slower clock that catches edits, status changes, and removals. With the indexer on, every
// change is mirrored into Qdrant and new jobs fan out to matching feeds.
func (s *Service) Run(ctx context.Context, source RankingSource) {
	var watermark string
	for {
		var err error
		started := time.Now()
		watermark, err = s.reconcile(ctx, source)
		metrics.ObserveWorker(metrics.WorkerRanking, time.Since(started), err != nil, 0)
		if err == nil {
			break
		}
		s.log.Error("ranking initial load", "error", err)
		select {
		case <-ctx.Done():
			return
		case <-time.After(syncRetry):
		}
	}
	poll := time.NewTicker(s.cfg.SyncInterval)
	defer poll.Stop()
	full := time.NewTicker(s.cfg.ReconcileInterval)
	defer full.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-poll.C:
			started := time.Now()
			next, err := s.poll(ctx, source, watermark)
			metrics.ObserveWorker(metrics.WorkerRanking, time.Since(started), err != nil, 0)
			if err != nil {
				s.log.Warn("ranking poll", "error", err)
				continue
			}
			watermark = next
		case <-full.C:
			started := time.Now()
			next, err := s.reconcile(ctx, source)
			metrics.ObserveWorker(metrics.WorkerRanking, time.Since(started), err != nil, 0)
			if err != nil {
				s.log.Warn("ranking reconcile", "error", err)
				continue
			}
			watermark = next
		}
	}
}

// Load fills the index from one full scan without touching Qdrant: for tools
// that rank against the live vectors (eval, synth). Servers call Run.
func (s *Service) Load(ctx context.Context, source RankingSource) error {
	if _, err := s.reconcileWith(ctx, source, false); err != nil {
		return err
	}
	s.checkVectors(ctx, s.Index().Len())
	return nil
}

// reconcile builds a fresh index from a full scan and swaps it in.
func (s *Service) reconcile(ctx context.Context, source RankingSource) (string, error) {
	return s.reconcileWith(ctx, source, s.cfg.Indexer)
}

func (s *Service) reconcileWith(ctx context.Context, source RankingSource, mirror bool) (string, error) {
	started := time.Now()
	companies, err := source.CompanySignals(ctx)
	if err != nil {
		return "", err
	}
	// Size for the last count plus headroom; the memo carries over between scans.
	index := NewIndexWithCapacity(s.Index().Len() + s.Index().Len()/10 + reconcileHeadroom)
	watermark := ""
	all := []JobFeatures{}
	s.memoMu.Lock()
	defer s.memoMu.Unlock()
	err = source.ScanRankingDocs(ctx, "", func(doc jobs.RankingDoc) error {
		job := normalizeJob(doc, s.tax, s.memo)
		job.CompanyScore = companies[job.CompanyID]
		watermark = laterID(watermark, doc.ObjectID)
		if mirror {
			all = append(all, job)
		}
		index.Upsert(job)
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("full scan: %w", err)
	}
	s.index.Store(index)
	s.ready.Store(true)
	s.log.Info("ranking index loaded", "jobs", index.Len(), "ms", time.Since(started).Milliseconds())
	// Vectors already in Qdrant serve while a mirror brings them up to date.
	s.checkVectors(ctx, index.Len())
	if mirror {
		go s.mirrorAll(context.WithoutCancel(ctx), all)
	}
	return watermark, nil
}

// poll applies jobs inserted after the watermark _id.
func (s *Service) poll(ctx context.Context, source RankingSource, since string) (string, error) {
	index := s.index.Load()
	watermark := since
	changed := []JobFeatures{}
	fresh := map[string]bool{}
	companies := map[string]float32(nil)
	err := source.ScanRankingDocs(ctx, since, func(doc jobs.RankingDoc) error {
		if companies == nil {
			loaded, err := source.CompanySignals(ctx)
			if err != nil {
				return err
			}
			companies = loaded
		}
		s.memoMu.Lock()
		job := normalizeJob(doc, s.tax, s.memo)
		s.memoMu.Unlock()
		job.CompanyScore = companies[job.CompanyID]
		if _, existed := index.Get(job.JobID); !existed {
			fresh[job.JobID] = true
		}
		index.Upsert(job)
		changed = append(changed, job)
		watermark = laterID(watermark, doc.ObjectID)
		return nil
	})
	if err != nil {
		return since, err
	}
	if len(changed) > 0 && s.cfg.Indexer {
		titles, bodies, err := s.upsertJobs(ctx, s.cfg.JobsCollection, changed)
		if err != nil {
			return watermark, err
		}
		newJobs := make([]JobFeatures, 0, len(fresh))
		for _, job := range changed {
			if fresh[job.JobID] {
				newJobs = append(newJobs, job)
			}
		}
		if err := s.FanOut(ctx, newJobs, titles, bodies); err != nil {
			s.log.Warn("ranking fan-out", "error", err, "jobs", len(newJobs))
		}
	}
	if !s.cfg.Indexer {
		s.checkVectors(ctx, index.Len())
	}
	return watermark, nil
}

// laterID is the greater of two hex ObjectIDs. Hex of a fixed width orders like
// the ObjectID itself, so a string compare is enough.
func laterID(a, b string) string {
	if len(b) == len(a) && b > a || a == "" {
		return b
	}
	return a
}

// checkVectors turns the vector channels on once Qdrant holds most of the index.
func (s *Service) checkVectors(ctx context.Context, indexed int) {
	if s.qdrant == nil || s.embedder == nil {
		return
	}
	count, err := s.qdrant.Count(ctx, s.cfg.JobsCollection)
	if err != nil {
		s.vectors.Store(false)
		return
	}
	s.vectors.Store(indexed > 0 && float64(count) >= vectorsReadyShare*float64(indexed))
}

// EnsureCollections creates the versioned Qdrant collections behind their aliases.
func (s *Service) EnsureCollections(ctx context.Context) error {
	if s.qdrant == nil {
		return nil
	}
	if s.embedder == nil {
		return fmt.Errorf("QDRANT_URL is set but EMBEDDER_URL is not")
	}
	dims := s.embedder.Dimensions()
	if _, err := s.qdrant.EnsureCollection(ctx, s.cfg.JobsCollection, s.cfg.CollectionVersion, JobsSpec(dims)); err != nil {
		return err
	}
	if _, err := s.qdrant.EnsureCollection(ctx, s.cfg.UsersCollection, s.cfg.CollectionVersion, UsersSpec(dims)); err != nil {
		return err
	}
	return nil
}

// mirrorAll makes Qdrant match the index: upsert what is new or changed, delete what left.
func (s *Service) mirrorAll(ctx context.Context, all []JobFeatures) {
	if s.qdrant == nil || s.embedder == nil {
		return
	}
	// A backfill can outlast the reconcile clock; never run two at once.
	if !s.mirroring.CompareAndSwap(false, true) {
		s.log.Info("ranking mirror already running")
		return
	}
	defer s.mirroring.Store(false)
	if err := s.EnsureCollections(ctx); err != nil {
		s.log.Error("ranking ensure collections", "error", err)
		return
	}
	s.mirrorInto(ctx, s.cfg.JobsCollection, all)
	s.checkVectors(ctx, len(all))
}

// mirrorInto brings one collection in line with all, by content revision. It
// reports how many jobs it wrote and whether every batch succeeded.
func (s *Service) mirrorInto(ctx context.Context, collection string, all []JobFeatures) (int, bool) {
	started := time.Now()
	stored := map[string]StoredRevisions{}
	if err := s.qdrant.ScrollRevisions(ctx, collection, func(id string, rev StoredRevisions) { stored[id] = rev }); err != nil {
		s.log.Error("ranking scroll", "error", err, "collection", collection)
		return 0, false
	}
	pending, refresh := []JobFeatures{}, []JobFeatures{}
	for _, job := range all {
		have, ok := stored[job.JobID]
		switch {
		case !ok || have.Dense != jobRevision(job):
			pending = append(pending, job)
		case have.Data != jobDataRevision(job):
			refresh = append(refresh, job)
		}
		delete(stored, job.JobID)
	}
	for start := 0; start < len(refresh); start += upsertBatch {
		batch := refresh[start:min(start+upsertBatch, len(refresh))]
		points := make([]Point, len(batch))
		for i, job := range batch {
			points[i] = Point{ID: PointID("job", job.JobID), Vector: map[string]any{vectorLexical: JobSparse(job)}, Payload: jobPayload(job)}
		}
		if err := s.qdrant.RefreshPoints(ctx, collection, points); err != nil {
			s.log.Warn("ranking refresh points", "error", err, "jobs", len(batch))
		}
	}
	if len(refresh) > 0 {
		s.log.Info("ranking refreshed payloads", "collection", collection, "jobs", len(refresh))
	}
	removed := make([]string, 0, len(stored))
	for id := range stored {
		removed = append(removed, PointID("job", id))
	}
	if err := s.qdrant.Delete(ctx, collection, removed, false); err != nil {
		s.log.Warn("ranking delete stale points", "error", err)
	}
	// Several batches in flight keep the embedder's dynamic batching full.
	batches := make(chan []JobFeatures)
	var failed atomic.Bool
	var done atomic.Int64
	var wg sync.WaitGroup
	for w := 0; w < mirrorWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for batch := range batches {
				var err error
				for attempt := 1; attempt <= mirrorAttempts; attempt++ {
					if _, _, err = s.upsertJobs(ctx, collection, batch); err == nil {
						break
					}
					time.Sleep(time.Duration(attempt) * mirrorBackoff)
				}
				if err != nil {
					// Skip it: the next reconcile finds these revisions stale and retries.
					failed.Store(true)
					s.log.Warn("ranking mirror batch", "error", err, "jobs", len(batch))
					continue
				}
				if n := done.Add(int64(len(batch))); n%mirrorProgressEvery < int64(len(batch)) {
					s.log.Info("ranking mirror progress", "done", n, "pending", len(pending))
				}
			}
		}()
	}
	for start := 0; start < len(pending); start += upsertBatch {
		batches <- pending[start:min(start+upsertBatch, len(pending))]
	}
	close(batches)
	wg.Wait()
	s.log.Info("ranking vectors mirrored", "collection", collection, "upserted", done.Load(), "pending", len(pending),
		"deleted", len(removed), "complete", !failed.Load(), "ms", time.Since(started).Milliseconds())
	return int(done.Load()), !failed.Load()
}

// Reindex builds a new version of the jobs collection from a full Mongo scan and
// moves the alias to it once it is complete, so searches never see a half-built
// index. dropOld deletes the version the alias pointed at before.
func (s *Service) Reindex(ctx context.Context, source RankingSource, version string, dropOld bool) error {
	if s.qdrant == nil || s.embedder == nil {
		return fmt.Errorf("reindex needs QDRANT_URL and EMBEDDER_URL")
	}
	alias := s.cfg.JobsCollection
	previous, err := s.qdrant.AliasTarget(ctx, alias)
	if err != nil {
		return err
	}
	target, err := s.qdrant.CreateVersion(ctx, alias, version, JobsSpec(s.embedder.Dimensions()))
	if err != nil {
		return err
	}
	if target == previous {
		return fmt.Errorf("version %s is already live; pick a new version", version)
	}
	all := []JobFeatures{}
	companies, err := source.CompanySignals(ctx)
	if err != nil {
		return err
	}
	if err := source.ScanRankingDocs(ctx, "", func(doc jobs.RankingDoc) error {
		job := NormalizeJob(doc, s.tax)
		job.CompanyScore = companies[job.CompanyID]
		all = append(all, job)
		return nil
	}); err != nil {
		return fmt.Errorf("full scan: %w", err)
	}
	if _, complete := s.mirrorInto(ctx, target, all); !complete {
		return fmt.Errorf("reindex into %s was incomplete; the alias still points at %q", target, previous)
	}
	count, err := s.awaitCount(ctx, target, len(all))
	if err != nil {
		return err
	}
	if count < len(all) {
		return fmt.Errorf("%s holds %d of %d jobs; the alias still points at %q", target, count, len(all), previous)
	}
	if err := s.qdrant.SwapAlias(ctx, alias, target); err != nil {
		return err
	}
	s.log.Info("ranking reindexed", "alias", alias, "from", previous, "to", target, "jobs", count)
	if dropOld && previous != "" {
		return s.qdrant.DeleteCollection(ctx, previous)
	}
	return nil
}

// upsertJobs embeds and writes jobs, returning their vectors for the fan-out.
// Titles and bodies go in separate requests: a batch pads every text to the
// longest one, so mixing short titles with long bodies would double the cost.
func (s *Service) upsertJobs(ctx context.Context, collection string, batch []JobFeatures) (titles, bodies map[string][]float32, err error) {
	titles, bodies = map[string][]float32{}, map[string][]float32{}
	for start := 0; start < len(batch); start += EmbedBatch {
		chunk := batch[start:min(start+EmbedBatch, len(batch))]
		titleTexts := make([]string, len(chunk))
		bodyTexts := make([]string, len(chunk))
		for i, job := range chunk {
			titleTexts[i], bodyTexts[i] = JobTexts(job)
		}
		titleVectors, err := s.embedder.Embed(ctx, titleTexts, false)
		if err != nil {
			return nil, nil, fmt.Errorf("embed job titles: %w", err)
		}
		bodyVectors, err := s.embedder.Embed(ctx, bodyTexts, false)
		if err != nil {
			return nil, nil, fmt.Errorf("embed job bodies: %w", err)
		}
		points := make([]Point, len(chunk))
		for i, job := range chunk {
			titles[job.JobID], bodies[job.JobID] = titleVectors[i], bodyVectors[i]
			points[i] = Point{
				ID:      PointID("job", job.JobID),
				Vector:  map[string]any{vectorTitle: titleVectors[i], vectorBody: bodyVectors[i], vectorLexical: JobSparse(job)},
				Payload: jobPayload(job),
			}
		}
		if err := s.qdrant.Upsert(ctx, collection, points, false); err != nil {
			return nil, nil, err
		}
	}
	return titles, bodies, nil
}

// jobPayload is a job's filterable fields, at the index's resolution.
func jobPayload(job JobFeatures) map[string]any {
	payload := map[string]any{
		payloadJobID:      job.JobID,
		payloadActive:     true,
		payloadWorkplace:  int(job.Workplace),
		payloadSeniority:  int(job.Seniority),
		payloadEmployment: int(job.Employment),
		payloadRegion:     int(job.Region),
		payloadSource:     job.Source,
		payloadHidden:     job.Hidden,
		payloadVisa:       job.Visa == VisaYes,
		payloadPayKnown:   job.PayKnown,
		payloadPosted:     dayOf(job.PostedAt),
		payloadLocation:   uniqueTerms(job.Location),
		payloadCompany:    uniqueTerms(job.Company),
		payloadOccupation: job.Occupations,
		payloadCompanyID:  job.CompanyID,
		payloadRevision:   jobRevision(job),
		payloadDataRev:    jobDataRevision(job),
	}
	if job.PayKnown {
		payload[payloadPayMin] = int64(job.PayMinUSD / payUnitUSD)
		payload[payloadPayMax] = int64(job.PayMaxUSD / payUnitUSD)
	}
	return payload
}

// TextVersion names the tokenizer and lexical weighting behind sparse vectors.
// Bump it when Tokens, abbreviations, or BM25 weights change: the next reconcile
// rewrites every lexical vector and payload in place, without re-embedding.
const TextVersion = "t3"

// jobRevision changes when the embedded texts change: only then is a job re-embedded.
func jobRevision(job JobFeatures) string {
	title, body := JobTexts(job)
	return shortHash(title, body)
}

// jobDataRevision changes when the payload or lexical vector would.
func jobDataRevision(job JobFeatures) string {
	title, body := JobTexts(job)
	return shortHash(
		title, body, job.Location, job.Company, job.CompanyID, job.Source,
		strconv.Itoa(int(job.Workplace)), strconv.Itoa(int(job.Seniority)), strconv.Itoa(int(job.Employment)),
		strconv.Itoa(int(job.Region)), strconv.FormatBool(job.Hidden), strconv.Itoa(int(job.Visa)),
		strconv.FormatBool(job.PayKnown), strconv.Itoa(int(job.PayMinUSD/payUnitUSD)), strconv.Itoa(int(job.PayMaxUSD/payUnitUSD)),
		strconv.Itoa(int(dayOf(job.PostedAt))), strings.Join(job.Occupations, ","), FeatureVersion, TextVersion,
	)
}

func shortHash(parts ...string) string {
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x00")))
	return hex.EncodeToString(sum[:8])
}

// awaitCount waits for asynchronous upserts to land: it polls the collection's
// count until it reaches want or stops growing for countSettle.
func (s *Service) awaitCount(ctx context.Context, collection string, want int) (int, error) {
	last, stalled := -1, time.Now()
	for {
		count, err := s.qdrant.Count(ctx, collection)
		if err != nil {
			return 0, err
		}
		if count >= want {
			return count, nil
		}
		if count != last {
			last, stalled = count, time.Now()
		} else if time.Since(stalled) > countSettle {
			return count, nil
		}
		select {
		case <-ctx.Done():
			return count, ctx.Err()
		case <-time.After(countPoll):
		}
	}
}

// DropCollections deletes one version of the jobs and users collections (synthetic runs).
func (s *Service) DropCollections(ctx context.Context, version string) {
	if s.qdrant == nil {
		return
	}
	for _, alias := range []string{s.cfg.JobsCollection, s.cfg.UsersCollection} {
		if err := s.qdrant.DeleteCollection(ctx, alias+"_"+version); err != nil {
			s.log.Warn("ranking drop collection", "error", err, "collection", alias+"_"+version)
		}
	}
}

// WaitOptimized waits for the jobs collection's optimizer to finish.
func (s *Service) WaitOptimized(ctx context.Context) error {
	if s.qdrant == nil {
		return nil
	}
	return s.qdrant.WaitOptimized(ctx, s.cfg.JobsCollection, countPoll)
}
