package ranking

import (
	"context"
	"sort"
	"time"

	"github.com/RoaringBitmap/roaring/v2"
)

// build computes the full ranked list for a request that missed the cache.
func (s *Service) build(ctx context.Context, req Request, mode, arm string, parsed Parsed, user *User, index *Index, timer *stageTimer) (RankedList, error) {
	slots := index.Match(req.Filter)
	count := int(slots.GetCardinality())
	timer.mark("filter")
	model := s.modelFor(arm)

	// Blank query sorted by a field: exact over every filtered job, no retrieval.
	if parsed.Text == "" && req.List == ListAll && isFieldSort(req.Sort) {
		ids := orderByField(index, slots, req.Sort, s.cfg.CandidateLimit)
		timer.mark("order")
		return RankedList{IDs: ids, Scores: make([]float32, len(ids)), Total: count, Exact: true, Model: "field-" + req.Sort, Arm: arm, Built: req.Now}, nil
	}

	// Blank query, no filters, personalized: the precomputed feed is the list.
	if parsed.Text == "" && mode == ModeProfile && req.List == ListAll && req.Filter.Empty() && req.Sort == SortRecommended {
		if list, ok := s.feedList(ctx, user, index, count, arm); ok {
			timer.mark("feed")
			return list, nil
		}
	}

	list, err := s.rankFull(ctx, req, mode, arm, parsed, user, index, slots, model, timer)
	if err != nil {
		return RankedList{}, err
	}
	if parsed.Text == "" && req.List == ListAll {
		// Every filtered job is a valid result; the count is the filter count.
		list.Total, list.Exact = count, true
	}
	if mode == ModeProfile && req.List == ListAll && req.Filter.Empty() && req.Sort == SortRecommended && user != nil && !list.Degraded {
		s.storeFeed(ctx, user, list)
	}
	if parsed.Text != "" && isFieldSort(req.Sort) {
		reorderByField(index, &list, req.Sort)
	}
	return list, nil
}

func (s *Service) modelFor(arm string) Model {
	if arm == ArmLearned && s.learned != nil {
		return s.learned
	}
	return s.control
}

func isFieldSort(sort string) bool {
	return sort == SortNewest || sort == SortPay || sort == SortApplicants
}

// rankFull retrieves, scores, and re-ranks.
func (s *Service) rankFull(ctx context.Context, req Request, mode, arm string, parsed Parsed, user *User, index *Index, slots *roaring.Bitmap, model Model, timer *stageTimer) (RankedList, error) {
	cands, err := s.retrieve(ctx, req, mode, parsed, user, index, slots)
	if err != nil {
		return RankedList{}, err
	}
	timer.mark("retrieve")

	sc := &scoringContext{now: req.Now, query: parsed, hasQuery: parsed.Text != "", tax: s.tax}
	if user != nil && !user.Features.Empty() {
		sc.profile = &user.Features
		sc.fitProfile = &user.Fit
	}
	for _, sig := range cands.signals {
		sc.lexicalMax = max(sc.lexicalMax, sig.lexical)
		sc.fusionMax = max(sc.fusionMax, sig.fusion)
	}

	jobs := index.Lookup(cands.ids)
	ids := cands.ids
	if len(ids) > s.cfg.CandidateLimit {
		// A wide scan without vectors: pre-rank on cheap signals, then score the best fully.
		ids = preRank(ids, jobs, cands.signals, sc, s.cfg.CandidateLimit)
	}
	items := make([]rankedItem, 0, len(ids))
	fitOK := map[string]bool{}
	for _, id := range ids {
		job, ok := jobs[id]
		if !ok {
			continue
		}
		features, fit := computeFeatures(sc, job, *cands.signals[id])
		if req.List == ListForYou {
			if fit == nil || len(fit.Criteria) == 0 || fit.Score < GoodFit {
				continue
			}
			fitOK[id] = true
		}
		items = append(items, rankedItem{
			id:       id,
			score:    model.Score(mode, &features),
			features: features,
			company:  companyKey(job),
			dedupe:   dedupeKey(job),
			posted:   job.PostedAt,
		})
	}
	timer.mark("score")
	items = rerank(items, req.Now)
	if len(items) > s.cfg.CandidateLimit {
		items = items[:s.cfg.CandidateLimit]
	}
	timer.mark("rerank")

	list := RankedList{
		IDs:         make([]string, len(items)),
		Scores:      make([]float32, len(items)),
		Total:       len(items),
		Exact:       cands.complete,
		Model:       model.Name(),
		Arm:         arm,
		Built:       req.Now,
		Suggestions: parsed.Suggestions,
		Degraded:    cands.degraded,
	}
	for i, item := range items {
		list.IDs[i] = item.id
		list.Scores[i] = float32(item.score)
		if i < FeatureLogLimit {
			list.Features = append(list.Features, append([]float32(nil), item.features[:]...))
		}
	}
	if parsed.Text != "" {
		list.Exact = false
	}
	return list, nil
}

// dedupeKey is the stored duplicate key, or company + title + location for jobs
// without one: the same posting copied twice is one result.
func dedupeKey(job *JobFeatures) string {
	if job.DedupeKey != "" {
		return job.DedupeKey
	}
	return Phrase(job.Company) + "|" + job.TitlePhrase + "|" + Phrase(job.Location)
}

func companyKey(job *JobFeatures) string {
	if job.CompanyID != "" {
		return job.CompanyID
	}
	return Phrase(job.Company)
}

// preRank keeps the k candidates with the best cheap score: fusion, family, skills, freshness.
func preRank(ids []string, jobs map[string]*JobFeatures, sig map[string]*signals, sc *scoringContext, k int) []string {
	items := make([]rankedItem, 0, len(ids))
	for _, id := range ids {
		job, ok := jobs[id]
		if !ok {
			continue
		}
		score := float64(sig[id].fusion)
		if sc.fusionMax > 0 {
			score /= float64(sc.fusionMax)
		}
		if sc.profile != nil {
			score += sc.tax.OccupationAffinity(sc.profile.Occupations, job.Occupations)
			score += float64(jaccard(sc.profile.Skills, job.Skills))
		}
		score += float64(recency(sc.now, job.PostedAt))
		items = append(items, rankedItem{id: id, score: score})
	}
	kept := topK(items, k)
	sortByScore(kept)
	out := make([]string, len(kept))
	for i, item := range kept {
		out[i] = item.id
	}
	return out
}

// orderByField returns up to limit filtered job ids sorted by a field, exactly.
func orderByField(index *Index, slots *roaring.Bitmap, field string, limit int) []string {
	if field == SortNewest {
		return index.Recent(slots, limit)
	}
	type keyed struct {
		id  string
		key int64
		day int32
	}
	all := make([]keyed, 0, slots.GetCardinality())
	index.ForEach(slots, func(job *JobFeatures) bool {
		k := keyed{id: job.JobID, day: dayOf(job.PostedAt)}
		switch field {
		case SortPay:
			if !job.PayKnown {
				k.key = -1
			} else {
				k.key = int64(job.PayMaxUSD)
			}
		case SortApplicants:
			k.key = -int64(job.Applicants)
		}
		all = append(all, k)
		return true
	})
	sort.Slice(all, func(i, j int) bool {
		if all[i].key != all[j].key {
			return all[i].key > all[j].key
		}
		if all[i].day != all[j].day {
			return all[i].day > all[j].day
		}
		return all[i].id < all[j].id
	})
	if len(all) > limit {
		all = all[:limit]
	}
	out := make([]string, len(all))
	for i, k := range all {
		out[i] = k.id
	}
	return out
}

// reorderByField sorts an already-relevant list by a field, keeping scores aligned.
func reorderByField(index *Index, list *RankedList, field string) {
	jobs := index.Lookup(list.IDs)
	type row struct {
		id    string
		score float32
		feats []float32
	}
	rows := make([]row, len(list.IDs))
	for i, id := range list.IDs {
		rows[i] = row{id: id, score: list.Scores[i]}
		if i < len(list.Features) {
			rows[i].feats = list.Features[i]
		}
	}
	key := func(id string) int64 {
		job, ok := jobs[id]
		if !ok {
			return -1 << 40
		}
		switch field {
		case SortNewest:
			return job.PostedAt.Unix()
		case SortPay:
			if !job.PayKnown {
				return -1
			}
			return int64(job.PayMaxUSD)
		default:
			return -int64(job.Applicants)
		}
	}
	sort.SliceStable(rows, func(i, j int) bool { return key(rows[i].id) > key(rows[j].id) })
	list.Features = list.Features[:0]
	for i, r := range rows {
		list.IDs[i], list.Scores[i] = r.id, r.score
		if i < FeatureLogLimit && r.feats != nil {
			list.Features = append(list.Features, r.feats)
		}
	}
}

// feedKey is the feed's cache key: a profile edit starts a new feed.
func feedKey(user *User) string {
	return user.ID + ":" + user.Features.Hash
}

// feedList serves a blank personalized search from the precomputed feed.
func (s *Service) feedList(ctx context.Context, user *User, index *Index, total int, arm string) (RankedList, bool) {
	if user == nil || arm != ArmControl {
		// The feed is scored by the control model; learned-arm users rank live.
		return RankedList{}, false
	}
	items, ok, err := s.cache.Feed(ctx, feedKey(user), s.cfg.FeedSize)
	if err != nil || !ok || len(items) == 0 {
		return RankedList{}, false
	}
	ids := make([]string, len(items))
	for i, item := range items {
		ids[i] = item.ID
	}
	// Drop jobs that left the index since the feed was built.
	live := index.FilterIDs(index.Match(Filter{}), ids)
	scores := make([]float32, 0, len(live))
	byID := make(map[string]float64, len(items))
	for _, item := range items {
		byID[item.ID] = item.Score
	}
	for _, id := range live {
		scores = append(scores, float32(byID[id]))
	}
	return RankedList{IDs: live, Scores: scores, Total: total, Exact: true, Model: s.control.Name() + "-feed", Arm: arm, Built: time.Now(), FromFeed: true}, true
}

func (s *Service) storeFeed(ctx context.Context, user *User, list RankedList) {
	if list.Arm != ArmControl {
		return
	}
	n := min(len(list.IDs), s.cfg.FeedSize)
	items := make([]Scored, n)
	for i := 0; i < n; i++ {
		items[i] = Scored{ID: list.IDs[i], Score: float64(list.Scores[i])}
	}
	if err := s.cache.ReplaceFeed(ctx, feedKey(user), items); err != nil {
		s.log.Warn("ranking store feed", "error", err, "user", user.ID)
	}
}
