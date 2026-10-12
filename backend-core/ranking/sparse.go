package ranking

import (
	"hash/fnv"
	"sort"
)

// BM25 term-frequency saturation (k1) and length normalization (b). Qdrant's idf
// modifier supplies the IDF half at query time, so a document vector carries
// only the TF part and stays valid as the corpus grows.
const (
	bm25K1 = 1.2
	bm25B  = 0.75
	// bm25AvgLength is the typical weighted length of a job's lexical text. It only
	// shapes length normalization; being off by a few terms does not reorder results.
	bm25AvgLength = 60
	// maxSummaryTerms caps how much of a summary feeds the lexical vector.
	maxSummaryTerms = 80
)

// Field weights: a title word counts three times a summary word.
const (
	weightTitleTerm   = 3
	weightSkillTerm   = 2
	weightCompanyTerm = 2
	weightSummaryTerm = 1
)

func termIndex(term string) uint32 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(term))
	return h.Sum32()
}

// JobSparse is the lexical vector for a job: weighted title, skills, company, and summary terms.
func JobSparse(job JobFeatures) *SparseVector {
	counts := map[string]float64{}
	add := func(terms []string, weight float64) {
		for _, term := range terms {
			counts[term] += weight
		}
	}
	add(Tokens(job.Title), weightTitleTerm)
	for _, skill := range job.Skills {
		add(Tokens(skill), weightSkillTerm)
	}
	add(Tokens(job.Company), weightCompanyTerm)
	summary := Tokens(job.Summary + " " + job.Team)
	if len(summary) > maxSummaryTerms {
		summary = summary[:maxSummaryTerms]
	}
	add(summary, weightSummaryTerm)
	length := 0.0
	for _, c := range counts {
		length += c
	}
	weights := map[uint32]float64{}
	for term, tf := range counts {
		weights[termIndex(term)] += tf * (bm25K1 + 1) / (tf + bm25K1*(1-bm25B+bm25B*length/bm25AvgLength))
	}
	return toSparse(weights)
}

// QuerySparse is the lexical vector for a query: each distinct term weighs 1, and
// Qdrant multiplies in its IDF.
func QuerySparse(query string) *SparseVector {
	weights := map[uint32]float64{}
	for _, term := range Tokens(query) {
		weights[termIndex(term)] = 1
	}
	if len(weights) == 0 {
		return nil
	}
	return toSparse(weights)
}

func toSparse(weights map[uint32]float64) *SparseVector {
	v := &SparseVector{Indices: make([]uint32, 0, len(weights)), Values: make([]float32, 0, len(weights))}
	for index := range weights {
		v.Indices = append(v.Indices, index)
	}
	sort.Slice(v.Indices, func(i, j int) bool { return v.Indices[i] < v.Indices[j] })
	for _, index := range v.Indices {
		v.Values = append(v.Values, float32(weights[index]))
	}
	return v
}
