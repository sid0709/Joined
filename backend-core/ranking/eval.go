package ranking

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

// Evaluation depth: NDCG over the first page, recall over the candidate depth.
const (
	EvalNDCGDepth   = 10
	EvalRecallDepth = 1000
)

//go:embed data/golden.json
var goldenJSON []byte

// GoldenCase is one labeled search. Grades are per job family so the set stays
// valid as jobs come and go: a job graded by the best family it belongs to.
type GoldenCase struct {
	Name    string             `json:"name"`
	Profile *candidate.Profile `json:"profile,omitempty"`
	Query   string             `json:"query,omitempty"`
	Filter  jobs.SearchQuery   `json:"filter"`
	Grades  map[string]int     `json:"grades"`
}

// GoldenSet is the shipped evaluation set.
func GoldenSet() ([]GoldenCase, error) {
	var cases []GoldenCase
	if err := json.Unmarshal(goldenJSON, &cases); err != nil {
		return nil, fmt.Errorf("parse golden set: %w", err)
	}
	return cases, nil
}

// Grade is a job's relevance for a case: the best grade among its families.
func (c GoldenCase) Grade(job *JobFeatures) int {
	return c.grade(job)
}

func (c GoldenCase) grade(job *JobFeatures) int {
	best := 0
	for _, family := range job.Occupations {
		best = max(best, c.Grades[family])
	}
	return best
}

// NDCG is normalized discounted cumulative gain at depth k for graded relevance.
func NDCG(gains []int, ideal []int, k int) float64 {
	dcg := func(g []int) float64 {
		total := 0.0
		for i := 0; i < min(k, len(g)); i++ {
			total += (math.Exp2(float64(g[i])) - 1) / math.Log2(float64(i+2))
		}
		return total
	}
	sorted := append([]int(nil), ideal...)
	sort.Sort(sort.Reverse(sort.IntSlice(sorted)))
	best := dcg(sorted)
	if best == 0 {
		return 0
	}
	return dcg(gains) / best
}

// Recall is the share of relevant jobs found in the first k results.
func Recall(gains []int, relevantTotal, k int) float64 {
	if relevantTotal == 0 {
		return 0
	}
	found := 0
	for i := 0; i < min(k, len(gains)); i++ {
		if gains[i] > 0 {
			found++
		}
	}
	return float64(found) / float64(min(relevantTotal, k))
}

// EvalResult is one case's scores.
type EvalResult struct {
	Name     string  `json:"name"`
	NDCG     float64 `json:"ndcg"`
	Recall   float64 `json:"recall"`
	Relevant int     `json:"relevant"`
	Returned int     `json:"returned"`
	Skipped  string  `json:"skipped,omitempty"`
	// Top are the first-page job ids, for inspecting a case.
	Top []string `json:"top,omitempty"`
	// Explain maps a job id to its score and non-zero features (top results, and
	// the best-graded job if it ranked lower), for tuning.
	Explain map[string]string `json:"explain,omitempty"`
	// FirstBest is the 1-based rank of the first job with the case's top grade.
	FirstBest int `json:"firstBest,omitempty"`
}

// EvalReport summarizes a golden-set run.
type EvalReport struct {
	Cases      []EvalResult `json:"cases"`
	MeanNDCG   float64      `json:"meanNdcg"`
	MeanRecall float64      `json:"meanRecall"`
	Model      string       `json:"model"`
	At         time.Time    `json:"at"`
}

// Evaluate runs every golden case against the live index. Profiles in the set
// stand in for real users through an in-memory profile source.
func (s *Service) Evaluate(ctx context.Context, cases []GoldenCase) (EvalReport, error) {
	profiles := map[string]candidate.Profile{}
	for i, c := range cases {
		if c.Profile != nil {
			profiles[evalUser(i)] = *c.Profile
		}
	}
	saved := s.users.source
	s.users.source = staticProfiles(profiles)
	defer func() { s.users.source = saved }()

	index := s.Index()
	report := EvalReport{Model: s.control.Name(), At: time.Now()}
	counted := 0
	for i, c := range cases {
		now := time.Now()
		req := RequestFromQuery(c.Filter, "", now)
		req.Query, req.PageSize, req.Page = c.Query, maxPageSize, 1
		req.Sort = SortRelevance
		if c.Profile != nil {
			req.UserID, req.Sort = evalUser(i), SortRecommended
		}
		slots := index.Match(req.Filter)
		relevant := 0
		ideal := []int{}
		index.ForEach(slots, func(job *JobFeatures) bool {
			if g := c.grade(job); g > 0 {
				relevant++
				ideal = append(ideal, g)
			}
			return true
		})
		list, err := s.evalRanking(ctx, req)
		ids := list.IDs
		if err != nil {
			report.Cases = append(report.Cases, EvalResult{Name: c.Name, Skipped: err.Error()})
			continue
		}
		jobs := index.Lookup(ids)
		gains := make([]int, len(ids))
		for j, id := range ids {
			if job, ok := jobs[id]; ok {
				gains[j] = c.grade(job)
			}
		}
		result := EvalResult{
			Name:     c.Name,
			NDCG:     NDCG(gains, ideal, EvalNDCGDepth),
			Recall:   Recall(gains, relevant, EvalRecallDepth),
			Relevant: relevant,
			Returned: len(ids),
			Top:      ids[:min(EvalNDCGDepth, len(ids))],
			Explain:  map[string]string{},
		}
		bestGrade := 0
		for _, g := range c.Grades {
			bestGrade = max(bestGrade, g)
		}
		for j, g := range gains {
			if g == bestGrade {
				result.FirstBest = j + 1
				break
			}
		}
		for j := range ids {
			if j < EvalNDCGDepth || j+1 == result.FirstBest {
				explain := fmt.Sprintf("score=%.4f", list.Scores[j])
				if j < len(list.Features) {
					var f Features
					copy(f[:], list.Features[j])
					explain += " " + f.describe()
				}
				result.Explain[ids[j]] = explain
			}
		}
		report.Cases = append(report.Cases, result)
		report.MeanNDCG += result.NDCG
		report.MeanRecall += result.Recall
		counted++
	}
	if counted > 0 {
		report.MeanNDCG /= float64(counted)
		report.MeanRecall /= float64(counted)
	}
	return report, nil
}

// evalRanking returns the full ranked list for a request, bypassing the cache.
func (s *Service) evalRanking(ctx context.Context, req Request) (RankedList, error) {
	req = req.normalized()
	index := s.Index()
	parsed := ParseQuery(req.Query, s.tax)
	var user *User
	if req.UserID != "" {
		loaded, err := s.users.load(ctx, req.UserID, req.Now)
		if err != nil {
			return RankedList{}, err
		}
		user = loaded
	}
	mode := ModeAnonymous
	switch {
	case parsed.Text != "":
		mode = ModeQuery
	case user != nil && !user.Features.Empty():
		mode = ModeProfile
	}
	return s.rankFull(ctx, req, mode, ArmControl, parsed, user, index, index.Match(req.Filter), s.control, newStageTimer())
}

func evalUser(i int) string {
	return fmt.Sprintf("golden-%d", i)
}

type staticProfiles map[string]candidate.Profile

func (p staticProfiles) GetProfile(_ context.Context, userID string, _ time.Time) (candidate.Profile, error) {
	return p[userID], nil
}
