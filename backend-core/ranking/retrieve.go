package ranking

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/RoaringBitmap/roaring/v2"
)

// Retrieval constants.
const (
	// rrfK is the reciprocal-rank-fusion constant: rank r in a channel adds 1/(rrfK+r).
	rrfK = 60
	// denseTitleFloor and denseBodyFloor are the cosines a meaning-only hit needs to
	// count as relevant to a typed query. Measured with bge-small-en-v1.5 on the live
	// catalog: real matches score 0.72+ on the title ("machine learning engineer"
	// 0.94, "golang" 0.85), while a query the catalog cannot answer tops out at
	// 0.63–0.68 ("registered nurse" against tech jobs). Re-measure if the model changes.
	denseTitleFloor = 0.72
	denseBodyFloor  = 0.70
	// lexicalShare: a keyword-only hit needs at least this share of the best keyword
	// score, so one shared word ("registered") does not make a job relevant.
	lexicalShare = 0.5
	// lexicalCoverage: a keyword-only hit must also carry this share of the query's
	// terms (rounded up, filter words such as "remote" aside) in its title, skills,
	// or company. A word that appears only in a summary ("a health platform for
	// registered nurses") needs the meaning channels to vouch for it.
	lexicalCoverage = 1.0 / 3
	// queryEmbedTimeout bounds embedding a typed query. A busy embedder (a backfill
	// in progress) then costs keyword-only retrieval, not the whole request.
	queryEmbedTimeout = 300 * time.Millisecond
	// minChannelLimit is the fewest hits a shared-budget dense channel asks for.
	minChannelLimit = 100
	// imputeFactor scales a channel's weakest returned score to stand in for a
	// candidate that channel did not return (its true score is lower).
	imputeFactor = 0.95
)

// Channel names.
const (
	chanQueryTitle  = "q_title"
	chanQueryBody   = "q_body"
	chanQueryLex    = "q_lex"
	chanRole        = "role"
	chanProfileBody = "profile"
	chanProfileLex  = "profile_lex"
	chanScan        = "scan"
	chanRecent      = "recent"
	chanOccupation  = "occupation"
)

// candidates is the fused output of every retrieval channel.
type candidates struct {
	ids     []string
	signals map[string]*signals
	// complete is true when every job passing the filter was considered, so a
	// count over the candidates is exact.
	complete bool
	// relevant is how many candidates clear the relevance floor (typed queries).
	relevant int
	channels []string
	// degraded is true when a vector channel could not run, so the list should
	// not be kept as long as a full one.
	degraded bool
}

type channelResult struct {
	name string
	hits []Hit
}

// retrieve gathers candidates for one request.
func (s *Service) retrieve(ctx context.Context, req Request, mode string, parsed Parsed, user *User, index *Index, slots *roaring.Bitmap) (candidates, error) {
	count := slots.GetCardinality()
	results, degraded, err := s.vectorChannels(ctx, req, mode, parsed, user, index)
	if err != nil {
		if mode == ModeQuery {
			return candidates{}, fmt.Errorf("%w: %v", ErrFallback, err)
		}
		s.log.Warn("ranking vector channels", "error", err, "mode", mode)
		results, degraded = nil, true
	}
	if mode == ModeQuery && len(results) == 0 {
		return candidates{}, ErrFallback
	}

	complete := false
	if mode != ModeQuery {
		scanLimit := uint64(s.cfg.CandidateLimit)
		if len(results) == 0 {
			// No vectors: scoring every filtered job is the only way to rank them all.
			scanLimit = uint64(s.cfg.ScanLimit)
		}
		if count <= scanLimit {
			results = append(results, channelResult{name: chanScan, hits: idHits(index.Recent(slots, int(count)))})
			complete = true
		}
		results = append(results, channelResult{name: chanRecent, hits: idHits(index.Recent(slots, s.cfg.ChannelLimit))})
		if user != nil && len(user.Features.Occupations) > 0 {
			inFamily := index.OccupationSlots(user.Features.Occupations)
			inFamily.And(slots)
			results = append(results, channelResult{name: chanOccupation, hits: idHits(index.Recent(inFamily, s.cfg.ChannelLimit))})
		}
	}
	cands := fuse(results, mode, complete, keywordCoverage(index, parsed.Core))
	cands.degraded = degraded
	return cands, nil
}

// keywordCoverage reports whether a keyword-only hit carries enough of the
// query's terms in its title, skills, or company (see lexicalCoverage).
func keywordCoverage(index *Index, query string) func(id string) bool {
	terms := map[string]bool{}
	for _, term := range Tokens(query) {
		terms[term] = true
	}
	need := int(math.Ceil(float64(len(terms)) * lexicalCoverage))
	return func(id string) bool {
		job, ok := index.Get(id)
		if !ok {
			return false
		}
		found := map[string]bool{}
		mark := func(text string) {
			for _, term := range Tokens(text) {
				if terms[term] {
					found[term] = true
				}
			}
		}
		mark(job.Title)
		mark(job.Company)
		for _, skill := range job.Skills {
			mark(skill)
		}
		return len(found) >= need
	}
}

// vectorChannels runs every Qdrant search for the request in one round trip.
// degraded is true when a channel was left out because its vector could not be made.
func (s *Service) vectorChannels(ctx context.Context, req Request, mode string, parsed Parsed, user *User, index *Index) (results []channelResult, degraded bool, err error) {
	if !s.vectorsOn() {
		if mode == ModeQuery {
			return nil, true, fmt.Errorf("vector index not ready")
		}
		return nil, s.qdrant != nil, nil
	}
	var queries []Query
	var names []string
	limit := s.cfg.ChannelLimit
	switch mode {
	case ModeQuery:
		embedCtx, cancel := context.WithTimeout(ctx, queryEmbedTimeout)
		vector, err := s.queryVector(embedCtx, parsed.Text)
		cancel()
		if err != nil {
			// Keyword retrieval still answers; the coverage rule keeps it precise.
			s.log.Warn("ranking query embedding", "error", err)
			degraded = true
		} else {
			queries = append(queries, Query{Using: vectorTitle, Dense: vector, Limit: limit}, Query{Using: vectorBody, Dense: vector, Limit: limit})
			names = append(names, chanQueryTitle, chanQueryBody)
		}
		if sparse := QuerySparse(parsed.Text); sparse != nil {
			queries = append(queries, Query{Using: vectorLexical, Sparse: sparse, Limit: limit})
			names = append(names, chanQueryLex)
		}
	case ModeProfile:
		if user == nil || user.Vectors == nil {
			return nil, user != nil, nil
		}
		for i, role := range user.Vectors.Roles {
			queries = append(queries, Query{Using: vectorTitle, Dense: role, Limit: limit})
			names = append(names, fmt.Sprintf("%s%d", chanRole, i))
		}
		queries = append(queries, Query{Using: vectorBody, Dense: user.Vectors.Profile, Limit: limit})
		names = append(names, chanProfileBody)
		if sparse := QuerySparse(strings.Join(user.Features.RoleTexts(), " ")); sparse != nil {
			queries = append(queries, Query{Using: vectorLexical, Sparse: sparse, Limit: limit})
			names = append(names, chanProfileLex)
		}
	default:
		return nil, false, nil
	}
	if len(queries) == 0 {
		return nil, degraded, fmt.Errorf("no retrieval channel for this query")
	}
	location, company := index.Expansions(req.Filter)
	filter := req.Filter.Qdrant(location, company)
	// The dense channels share a candidate budget of two channels' worth: four
	// profile vectors at 250 each cost far less than four at 500, and the union
	// still reaches the candidate limit. A larger limit also widens the HNSW beam.
	dense := 0
	for _, q := range queries {
		if q.Sparse == nil {
			dense++
		}
	}
	denseLimit := limit
	if dense > 2 {
		denseLimit = max(minChannelLimit, 2*limit/dense)
	}
	for i := range queries {
		queries[i].Filter = filter
		if queries[i].Sparse == nil {
			queries[i].Limit = denseLimit
		}
	}
	hits, err := s.qdrant.QueryBatch(ctx, s.cfg.JobsCollection, queries)
	if err != nil {
		return nil, true, err
	}
	results = make([]channelResult, len(names))
	for i, name := range names {
		results[i] = channelResult{name: name, hits: hits[i]}
	}
	return results, degraded, nil
}

// queryVector embeds a typed query, reusing a cached vector for repeated queries.
func (s *Service) queryVector(ctx context.Context, text string) ([]float32, error) {
	key := VectorKey(text)
	if v, ok, err := s.cache.GetVector(ctx, key); err == nil && ok {
		return v, nil
	}
	vectors, err := s.embedder.Embed(ctx, []string{text}, true)
	if err != nil {
		return nil, err
	}
	if err := s.cache.SetVector(ctx, key, vectors[0], s.cfg.QueryVectorTTL); err != nil {
		s.log.Warn("ranking cache query vector", "error", err)
	}
	return vectors[0], nil
}

func idHits(ids []string) []Hit {
	hits := make([]Hit, len(ids))
	for i, id := range ids {
		hits[i] = Hit{JobID: id}
	}
	return hits
}

// fuse merges channels with reciprocal rank fusion and fills each candidate's
// per-channel signals. A dense channel that did not return a candidate stands in
// a little under its weakest hit, so missing is never better than present.
// keywordOK, when set, must also accept a typed query's keyword-only hits.
func fuse(results []channelResult, mode string, complete bool, keywordOK func(id string) bool) candidates {
	sig := map[string]*signals{}
	fused := map[string]float64{}
	relevantDense := map[string]bool{}
	floors := map[string]float32{}
	maxLexical := float32(0)
	get := func(id string) *signals {
		if s, ok := sig[id]; ok {
			return s
		}
		s := &signals{}
		sig[id] = s
		return s
	}
	names := make([]string, 0, len(results))
	for _, result := range results {
		names = append(names, result.name)
		for rank, hit := range result.hits {
			fused[hit.JobID] += 1 / float64(rrfK+rank+1)
			s := get(hit.JobID)
			switch {
			case result.name == chanQueryTitle:
				s.queryTitle = hit.Score
				relevantDense[hit.JobID] = relevantDense[hit.JobID] || hit.Score >= denseTitleFloor
			case result.name == chanQueryBody:
				s.queryBody = hit.Score
				relevantDense[hit.JobID] = relevantDense[hit.JobID] || hit.Score >= denseBodyFloor
			case result.name == chanQueryLex || result.name == chanProfileLex:
				s.lexical = max(s.lexical, hit.Score)
				maxLexical = max(maxLexical, hit.Score)
			case strings.HasPrefix(result.name, chanRole):
				s.roleTitle = max(s.roleTitle, hit.Score)
			case result.name == chanProfileBody:
				s.profileBody = hit.Score
			}
		}
		if n := len(result.hits); n > 0 && result.hits[n-1].Score > 0 {
			floors[result.name] = result.hits[n-1].Score * imputeFactor
		}
	}
	ids := make([]string, 0, len(sig))
	for id, s := range sig {
		s.fusion = float32(fused[id])
		if mode == ModeQuery && !relevantDense[id] {
			relevantLexical := maxLexical > 0 && s.lexical >= lexicalShare*maxLexical
			if !relevantLexical || (keywordOK != nil && !keywordOK(id)) {
				continue
			}
		}
		if s.queryTitle == 0 {
			s.queryTitle = floors[chanQueryTitle]
		}
		if s.queryBody == 0 {
			s.queryBody = floors[chanQueryBody]
		}
		if s.profileBody == 0 {
			s.profileBody = floors[chanProfileBody]
		}
		if s.roleTitle == 0 {
			for name, floor := range floors {
				if strings.HasPrefix(name, chanRole) {
					s.roleTitle = max(s.roleTitle, floor)
				}
			}
		}
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool {
		if fused[ids[i]] != fused[ids[j]] {
			return fused[ids[i]] > fused[ids[j]]
		}
		return ids[i] < ids[j]
	})
	return candidates{ids: ids, signals: sig, complete: complete, relevant: len(ids), channels: names}
}
