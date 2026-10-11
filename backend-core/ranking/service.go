package ranking

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync/atomic"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/fitscore"
)

// Sort keys the search API accepts.
const (
	SortRecommended = "recommended"
	SortRelevance   = "relevance"
	SortNewest      = "newest"
	SortPay         = "pay"
	SortApplicants  = "applicants"
)

// Lists the search API accepts. ListForYou keeps strong fits only.
const (
	ListAll    = "all"
	ListForYou = "recommended"
)

const (
	defaultPageSize = 25
	maxPageSize     = 100
	// slowSearch is logged with its stage timings.
	slowSearch = 200 * time.Millisecond
)

// ErrFallback means ranking cannot serve this request (index still loading, or a
// typed query while the vector index is down). The caller uses the Mongo search.
var ErrFallback = errors.New("ranking unavailable for this request")

// Request is one search.
type Request struct {
	UserID   string
	Query    string
	Filter   Filter
	Sort     string
	List     string
	Page     int
	PageSize int
	Now      time.Time
}

func (r Request) normalized() Request {
	if r.Page < 1 {
		r.Page = 1
	}
	if r.PageSize < 1 {
		r.PageSize = defaultPageSize
	}
	r.PageSize = min(r.PageSize, maxPageSize)
	if r.Now.IsZero() {
		r.Now = time.Now()
	}
	r.Query = strings.TrimSpace(r.Query)
	switch r.Sort {
	case SortRecommended, SortRelevance, SortNewest, SortPay, SortApplicants:
	default:
		r.Sort = SortRelevance
	}
	if r.List != ListForYou {
		r.List = ListAll
	}
	return r
}

// Result is one page of a search.
type Result struct {
	IDs         []string                   `json:"ids"`
	Scores      []float32                  `json:"scores"`
	Fits        map[string]fitscore.Result `json:"fits,omitempty"`
	Total       int                        `json:"total"`
	Exact       bool                       `json:"exact"`
	HasMore     bool                       `json:"hasMore"`
	Facets      *Facets                    `json:"facets,omitempty"`
	Suggestions []Suggestion               `json:"suggestions,omitempty"`
	RankingID   string                     `json:"rankingId"`
	Mode        string                     `json:"mode"`
	Model       string                     `json:"model"`
	Arm         string                     `json:"arm"`
	CacheHit    bool                       `json:"cacheHit"`
	Timing      map[string]float64         `json:"timing"`
}

// JobSource is the Mongo side the index syncs from.
type JobSource interface {
	ScanRankingDocsSince(ctx context.Context, since time.Time, fn func(JobFeatures) error) error
	CompanySignals(ctx context.Context) (map[string]float32, error)
}

// Options wire a Service.
type Options struct {
	Config   config.Ranking
	Profiles ProfileSource
	Events   EventLog
	Logger   *slog.Logger
}

// Service is personalized job search. It is safe for concurrent use.
type Service struct {
	cfg      config.Ranking
	tax      *Taxonomy
	index    atomic.Pointer[Index]
	ready    atomic.Bool
	qdrant   *Qdrant
	embedder Embedder
	cache    Cache
	users    *users
	events   EventLog
	control  Model
	learned  Model
	log      *slog.Logger
	// vectors is true once the jobs collection is reachable and populated.
	vectors atomic.Bool
}

// NewService builds the service. External services that are not configured are
// simply off; the service works from the in-memory index alone.
func NewService(opts Options) (*Service, error) {
	log := opts.Logger
	if log == nil {
		log = slog.Default()
	}
	cache, err := NewCache(opts.Config.RedisURL)
	if err != nil {
		return nil, err
	}
	s := &Service{
		cfg:      opts.Config,
		tax:      DefaultTaxonomy(),
		embedder: NewEmbedder(opts.Config),
		cache:    cache,
		events:   opts.Events,
		control:  LinearModel{},
		log:      log,
	}
	if opts.Config.QdrantURL != "" {
		s.qdrant = NewQdrant(opts.Config.QdrantURL, opts.Config.QdrantAPIKey)
	}
	if opts.Config.ModelPath != "" {
		model, err := LoadLearnedModel(opts.Config.ModelPath)
		if err != nil {
			return nil, err
		}
		s.learned = model
	}
	s.users = &users{
		source:     opts.Profiles,
		tax:        s.tax,
		qdrant:     s.qdrant,
		collection: opts.Config.UsersCollection,
		embedder:   s.embedder,
		log:        log,
	}
	s.index.Store(NewIndex())
	return s, nil
}

// Ready reports whether the in-memory index has finished its first load.
func (s *Service) Ready() bool {
	return s.ready.Load()
}

// Index is the current in-memory index.
func (s *Service) Index() *Index {
	return s.index.Load()
}

// Taxonomy is the occupation and skill taxonomy the service uses.
func (s *Service) Taxonomy() *Taxonomy {
	return s.tax
}

// vectorsOn reports whether the vector channels can run.
func (s *Service) vectorsOn() bool {
	return s.qdrant != nil && s.embedder != nil && s.vectors.Load()
}

// Search ranks and pages one request.
func (s *Service) Search(ctx context.Context, req Request) (Result, error) {
	if !s.Ready() {
		return Result{}, ErrFallback
	}
	req = req.normalized()
	timer := newStageTimer()
	ctx, cancel := context.WithTimeout(ctx, s.cfg.RequestTimeout)
	defer cancel()
	index := s.index.Load()
	parsed := ParseQuery(req.Query, s.tax)

	var user *User
	if req.Sort == SortRecommended || req.List == ListForYou {
		loaded, err := s.users.load(ctx, req.UserID, req.Now)
		if err != nil {
			s.log.Warn("ranking load user", "error", err, "user", req.UserID)
		}
		user = loaded
	}
	timer.mark("user")

	mode := ModeAnonymous
	switch {
	case parsed.Text != "":
		mode = ModeQuery
	case user != nil && !user.Features.Empty():
		mode = ModeProfile
	}
	arm := Arm(req.UserID, s.cfg.Experiment, s.cfg.LTRPercent, s.learned != nil)

	profileHash, cacheUser := "", ""
	if user != nil {
		profileHash, cacheUser = user.Features.Hash, user.ID
	}
	key := RankedKey(cacheUser, mode+":"+arm+":"+req.List, parsed.Text, req.Filter.Key(), req.Sort, profileHash)
	list, hit, err := s.cache.GetRanked(ctx, key)
	if err != nil {
		s.log.Warn("ranking cache read", "error", err)
	}
	timer.mark("cache")
	if !hit {
		list, err = s.build(ctx, req, mode, arm, parsed, user, index, timer)
		if err != nil {
			return Result{}, err
		}
		if err := s.cache.SetRanked(ctx, cacheUser, key, list, s.cfg.CacheTTL); err != nil {
			s.log.Warn("ranking cache write", "error", err)
		}
	}

	start := (req.Page - 1) * req.PageSize
	end := min(start+req.PageSize, len(list.IDs))
	result := Result{
		Total:       list.Total,
		Exact:       list.Exact,
		Suggestions: Unapplied(list.Suggestions, req.Filter),
		RankingID:   NewRankingID(),
		Mode:        mode,
		Model:       list.Model,
		Arm:         list.Arm,
		CacheHit:    hit,
	}
	if start < end {
		result.IDs = list.IDs[start:end]
		result.Scores = list.Scores[start:end]
	}
	result.HasMore = end < len(list.IDs)
	if user != nil && len(result.IDs) > 0 {
		result.Fits = s.pageFits(index, user, result.IDs)
	}
	if parsed.Text == "" {
		facets := index.Facets(req.Filter, req.Now)
		result.Facets = &facets
	}
	timer.mark("page")
	result.Timing = timer.done()
	s.logImpression(req, result, list, start)
	if total := timer.total(); total > slowSearch {
		s.log.Warn("ranking slow search", "ms", total.Milliseconds(), "mode", mode, "timing", result.Timing, "cacheHit", hit)
	}
	return result, nil
}

func (s *Service) pageFits(index *Index, user *User, ids []string) map[string]fitscore.Result {
	jobs := index.Lookup(ids)
	out := make(map[string]fitscore.Result, len(jobs))
	for id, job := range jobs {
		out[id] = fitscore.Score(fitJobFromFeatures(job), user.Fit)
	}
	return out
}

func (s *Service) logImpression(req Request, result Result, list RankedList, start int) {
	if s.events == nil || req.UserID == "" || len(result.IDs) == 0 {
		return
	}
	items := make([]ImpressionItem, len(result.IDs))
	for i, id := range result.IDs {
		item := ImpressionItem{JobID: id, Position: start + i, Score: result.Scores[i]}
		if pos := start + i; pos < len(list.Features) {
			item.Features = list.Features[pos]
		}
		items[i] = item
	}
	s.events.Log(Event{
		Type:           EventImpression,
		RankingID:      result.RankingID,
		UserID:         req.UserID,
		At:             req.Now,
		Query:          req.Query,
		FilterKey:      req.Filter.Key(),
		Sort:           req.Sort,
		List:           req.List,
		Mode:           result.Mode,
		Model:          list.Model,
		Arm:            list.Arm,
		FeatureVersion: FeatureVersion,
		Page:           req.Page,
		Items:          items,
	})
}

// LogInteraction records a click, save, apply, or dismiss on a ranked result.
func (s *Service) LogInteraction(userID, rankingID, jobID, kind string, position int, at time.Time) error {
	switch kind {
	case EventClick, EventSave, EventApply, EventDismiss:
	default:
		return fmt.Errorf("unknown interaction %q", kind)
	}
	if rankingID == "" || jobID == "" {
		return fmt.Errorf("rankingId and jobId are required")
	}
	if s.events != nil {
		s.events.Log(Event{Type: kind, RankingID: rankingID, UserID: userID, JobID: jobID, Position: position, At: at})
	}
	return nil
}

// ProfileChanged drops a user's cached results and refreshes their vectors and
// feed in the background, so the next search reflects the edit.
func (s *Service) ProfileChanged(userID string) {
	if userID == "" {
		return
	}
	s.users.forget(userID)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := s.cache.DropUser(ctx, userID); err != nil {
			s.log.Warn("ranking drop user cache", "error", err, "user", userID)
		}
		if err := s.RebuildFeed(ctx, userID); err != nil {
			s.log.Warn("ranking rebuild feed", "error", err, "user", userID)
		}
	}()
}

// stageTimer records how long each stage of a search took.
type stageTimer struct {
	start, last time.Time
	stages      map[string]float64
}

func newStageTimer() *stageTimer {
	now := time.Now()
	return &stageTimer{start: now, last: now, stages: map[string]float64{}}
}

func (t *stageTimer) mark(stage string) {
	now := time.Now()
	t.stages[stage] += float64(now.Sub(t.last).Microseconds()) / 1000
	t.last = now
}

func (t *stageTimer) total() time.Duration { return time.Since(t.start) }

func (t *stageTimer) done() map[string]float64 {
	t.stages["total"] = float64(t.total().Microseconds()) / 1000
	return t.stages
}
