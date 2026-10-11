package ranking

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Payload keys on Qdrant points. Pay is in thousands of USD and dates in days,
// the same resolution the in-memory index uses.
const (
	payloadJobID       = "jobId"
	payloadActive      = "active"
	payloadWorkplace   = "workplace"
	payloadSeniority   = "seniority"
	payloadEmployment  = "employment"
	payloadRegion      = "region"
	payloadSource      = "source"
	payloadHidden      = "hidden"
	payloadVisa        = "visa"
	payloadPayKnown    = "payKnown"
	payloadPayMin      = "payMinK"
	payloadPayMax      = "payMaxK"
	payloadPosted      = "postedDay"
	payloadLocation    = "locationTerms"
	payloadCompany     = "companyTerms"
	payloadOccupation  = "occupations"
	payloadCompanyID   = "companyId"
	payloadUserID      = "userId"
	payloadProfileHash = "hash"
)

// Vector names. Jobs carry title, body, and lexical; users carry profile and one per role.
const (
	vectorTitle   = "title"
	vectorBody    = "body"
	vectorLexical = "lexical"
	vectorProfile = "profile"
	vectorRole    = "role"
)

// Qdrant tuning. int8 quantization keeps vectors in RAM at a quarter of the size;
// rescoring with the original vectors keeps the order exact at the top.
const (
	qdrantTimeout       = 5 * time.Second
	qdrantHNSWM         = 16
	qdrantHNSWConstruct = 128
	qdrantQuantile      = 0.99
	// qdrantMaxErrorBody caps how much of an error response is kept for the message.
	qdrantMaxErrorBody = 1 << 12
)

// payloadSchemas are the indexed payload fields of the jobs collection.
var payloadSchemas = map[string]string{
	payloadJobID: "keyword", payloadActive: "bool", payloadWorkplace: "integer",
	payloadSeniority: "integer", payloadEmployment: "integer", payloadRegion: "integer",
	payloadSource: "keyword", payloadHidden: "bool", payloadVisa: "bool", payloadPayKnown: "bool",
	payloadPayMin: "integer", payloadPayMax: "integer", payloadPosted: "integer",
	payloadLocation: "keyword", payloadCompany: "keyword", payloadOccupation: "keyword",
	payloadCompanyID: "keyword",
}

// ErrQdrantUnavailable wraps every Qdrant transport or server failure.
var ErrQdrantUnavailable = errors.New("qdrant unavailable")

// Qdrant is a minimal REST client for the parts of the Qdrant API ranking uses.
type Qdrant struct {
	base   string
	apiKey string
	http   *http.Client
}

// NewQdrant returns a client for baseURL (e.g. http://127.0.0.1:6333).
func NewQdrant(baseURL, apiKey string) *Qdrant {
	return &Qdrant{base: baseURL, apiKey: apiKey, http: &http.Client{Timeout: qdrantTimeout}}
}

// SparseVector is a bag of term weights: indices are term hashes.
type SparseVector struct {
	Indices []uint32  `json:"indices"`
	Values  []float32 `json:"values"`
}

// Point is one vector record.
type Point struct {
	ID      string         `json:"id"`
	Vector  map[string]any `json:"vector"`
	Payload map[string]any `json:"payload,omitempty"`
}

// Query is one search in a batch. Exactly one of Dense and Sparse is set.
type Query struct {
	Using  string
	Dense  []float32
	Sparse *SparseVector
	Filter map[string]any
	Limit  int
}

// Hit is one search result.
type Hit struct {
	JobID string
	Score float32
}

// PointID is the stable Qdrant id for a job or user id: a name-based (v5-style) UUID.
func PointID(kind, id string) string {
	sum := sha1.Sum([]byte(kind + ":" + id))
	sum[6] = (sum[6] & 0x0f) | 0x50
	sum[8] = (sum[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", sum[0:4], sum[4:6], sum[6:8], sum[8:10], sum[10:16])
}

// CollectionSpec describes a collection's vectors.
type CollectionSpec struct {
	Dense  []string
	Sparse []string
	Size   int
	// Indexed payload fields and their schema.
	Payload map[string]string
}

// JobsSpec is the jobs collection: title and body dense vectors, a lexical sparse vector.
func JobsSpec(size int) CollectionSpec {
	return CollectionSpec{Dense: []string{vectorTitle, vectorBody}, Sparse: []string{vectorLexical}, Size: size, Payload: payloadSchemas}
}

// UsersSpec is the users collection: one profile vector and one per target role.
func UsersSpec(size int) CollectionSpec {
	dense := []string{vectorProfile}
	for i := 0; i < maxTargetRoles; i++ {
		dense = append(dense, roleVector(i))
	}
	return CollectionSpec{Dense: dense, Size: size, Payload: map[string]string{payloadUserID: "keyword"}}
}

func roleVector(i int) string {
	return fmt.Sprintf("%s%d", vectorRole, i)
}

// EnsureCollection makes sure alias points at alias_version, creating the
// collection and its payload indexes when it is missing. It returns the
// versioned name.
func (q *Qdrant) EnsureCollection(ctx context.Context, alias, version string, spec CollectionSpec) (string, error) {
	name := alias + "_" + version
	exists, err := q.collectionExists(ctx, name)
	if err != nil {
		return "", err
	}
	if !exists {
		if err := q.createCollection(ctx, name, spec); err != nil {
			return "", err
		}
	}
	for field, schema := range spec.Payload {
		body := map[string]any{"field_name": field, "field_schema": schema}
		if err := q.do(ctx, http.MethodPut, "/collections/"+url.PathEscape(name)+"/index?wait=true", body, nil); err != nil {
			return "", fmt.Errorf("index %s.%s: %w", name, field, err)
		}
	}
	current, err := q.aliasTarget(ctx, alias)
	if err != nil {
		return "", err
	}
	if current != name {
		if err := q.SwapAlias(ctx, alias, name); err != nil {
			return "", err
		}
	}
	return name, nil
}

func (q *Qdrant) createCollection(ctx context.Context, name string, spec CollectionSpec) error {
	vectors := map[string]any{}
	for _, v := range spec.Dense {
		vectors[v] = map[string]any{"size": spec.Size, "distance": "Cosine"}
	}
	body := map[string]any{
		"vectors":     vectors,
		"hnsw_config": map[string]any{"m": qdrantHNSWM, "ef_construct": qdrantHNSWConstruct},
		"quantization_config": map[string]any{
			"scalar": map[string]any{"type": "int8", "quantile": qdrantQuantile, "always_ram": true},
		},
	}
	if len(spec.Sparse) > 0 {
		sparse := map[string]any{}
		for _, v := range spec.Sparse {
			sparse[v] = map[string]any{"modifier": "idf"}
		}
		body["sparse_vectors"] = sparse
	}
	if err := q.do(ctx, http.MethodPut, "/collections/"+url.PathEscape(name), body, nil); err != nil {
		return fmt.Errorf("create collection %s: %w", name, err)
	}
	return nil
}

func (q *Qdrant) collectionExists(ctx context.Context, name string) (bool, error) {
	var out struct {
		Result struct {
			Exists bool `json:"exists"`
		} `json:"result"`
	}
	if err := q.do(ctx, http.MethodGet, "/collections/"+url.PathEscape(name)+"/exists", nil, &out); err != nil {
		return false, fmt.Errorf("check collection %s: %w", name, err)
	}
	return out.Result.Exists, nil
}

func (q *Qdrant) aliasTarget(ctx context.Context, alias string) (string, error) {
	var out struct {
		Result struct {
			Aliases []struct {
				Alias      string `json:"alias_name"`
				Collection string `json:"collection_name"`
			} `json:"aliases"`
		} `json:"result"`
	}
	if err := q.do(ctx, http.MethodGet, "/aliases", nil, &out); err != nil {
		return "", fmt.Errorf("list aliases: %w", err)
	}
	for _, a := range out.Result.Aliases {
		if a.Alias == alias {
			return a.Collection, nil
		}
	}
	return "", nil
}

// SwapAlias points alias at collection in one atomic step.
func (q *Qdrant) SwapAlias(ctx context.Context, alias, collection string) error {
	actions := []map[string]any{}
	if current, err := q.aliasTarget(ctx, alias); err != nil {
		return err
	} else if current != "" {
		actions = append(actions, map[string]any{"delete_alias": map[string]any{"alias_name": alias}})
	}
	actions = append(actions, map[string]any{"create_alias": map[string]any{"collection_name": collection, "alias_name": alias}})
	if err := q.do(ctx, http.MethodPost, "/collections/aliases", map[string]any{"actions": actions}, nil); err != nil {
		return fmt.Errorf("swap alias %s → %s: %w", alias, collection, err)
	}
	return nil
}

// DeleteCollection drops a collection (an old version after a swap).
func (q *Qdrant) DeleteCollection(ctx context.Context, name string) error {
	return q.do(ctx, http.MethodDelete, "/collections/"+url.PathEscape(name), nil, nil)
}

// Upsert writes points. wait makes the call return only once they are searchable.
func (q *Qdrant) Upsert(ctx context.Context, collection string, points []Point, wait bool) error {
	if len(points) == 0 {
		return nil
	}
	path := fmt.Sprintf("/collections/%s/points?wait=%t", url.PathEscape(collection), wait)
	if err := q.do(ctx, http.MethodPut, path, map[string]any{"points": points}, nil); err != nil {
		return fmt.Errorf("upsert %d points: %w", len(points), err)
	}
	return nil
}

// Delete removes points by id.
func (q *Qdrant) Delete(ctx context.Context, collection string, ids []string, wait bool) error {
	if len(ids) == 0 {
		return nil
	}
	path := fmt.Sprintf("/collections/%s/points/delete?wait=%t", url.PathEscape(collection), wait)
	if err := q.do(ctx, http.MethodPost, path, map[string]any{"points": ids}, nil); err != nil {
		return fmt.Errorf("delete %d points: %w", len(ids), err)
	}
	return nil
}

// SetPayload merges payload fields into points.
func (q *Qdrant) SetPayload(ctx context.Context, collection string, ids []string, payload map[string]any) error {
	path := fmt.Sprintf("/collections/%s/points/payload?wait=false", url.PathEscape(collection))
	return q.do(ctx, http.MethodPost, path, map[string]any{"points": ids, "payload": payload}, nil)
}

// QueryBatch runs several searches in one round trip and returns hits per query.
func (q *Qdrant) QueryBatch(ctx context.Context, collection string, queries []Query) ([][]Hit, error) {
	if len(queries) == 0 {
		return nil, nil
	}
	searches := make([]map[string]any, 0, len(queries))
	for _, query := range queries {
		search := map[string]any{
			"using":        query.Using,
			"limit":        query.Limit,
			"with_payload": []string{payloadJobID},
		}
		if query.Sparse != nil {
			search["query"] = query.Sparse
		} else {
			search["query"] = query.Dense
			search["params"] = map[string]any{"quantization": map[string]any{"rescore": true}}
		}
		if query.Filter != nil {
			search["filter"] = query.Filter
		}
		searches = append(searches, search)
	}
	var out struct {
		Result []struct {
			Points []struct {
				Score   float32 `json:"score"`
				Payload struct {
					JobID string `json:"jobId"`
				} `json:"payload"`
			} `json:"points"`
		} `json:"result"`
	}
	path := "/collections/" + url.PathEscape(collection) + "/points/query/batch"
	if err := q.do(ctx, http.MethodPost, path, map[string]any{"searches": searches}, &out); err != nil {
		return nil, fmt.Errorf("query batch: %w", err)
	}
	hits := make([][]Hit, len(queries))
	for i := range hits {
		if i >= len(out.Result) {
			break
		}
		for _, p := range out.Result[i].Points {
			if p.Payload.JobID != "" {
				hits[i] = append(hits[i], Hit{JobID: p.Payload.JobID, Score: p.Score})
			}
		}
	}
	return hits, nil
}

// StoredPoint is a point read back with its vectors.
type StoredPoint struct {
	Payload map[string]any
	Vectors map[string][]float32
}

// Retrieve reads points by id with their dense vectors and payload.
func (q *Qdrant) Retrieve(ctx context.Context, collection string, ids []string) (map[string]StoredPoint, error) {
	var out struct {
		Result []struct {
			ID      string                     `json:"id"`
			Payload map[string]any             `json:"payload"`
			Vector  map[string]json.RawMessage `json:"vector"`
		} `json:"result"`
	}
	body := map[string]any{"ids": ids, "with_payload": true, "with_vector": true}
	if err := q.do(ctx, http.MethodPost, "/collections/"+url.PathEscape(collection)+"/points", body, &out); err != nil {
		return nil, fmt.Errorf("retrieve points: %w", err)
	}
	points := make(map[string]StoredPoint, len(out.Result))
	for _, r := range out.Result {
		vectors := map[string][]float32{}
		for name, raw := range r.Vector {
			var dense []float32
			if json.Unmarshal(raw, &dense) == nil {
				vectors[name] = dense
			}
		}
		points[r.ID] = StoredPoint{Payload: r.Payload, Vectors: vectors}
	}
	return points, nil
}

// Count is how many points a collection holds.
func (q *Qdrant) Count(ctx context.Context, collection string) (int, error) {
	var out struct {
		Result struct {
			Count int `json:"count"`
		} `json:"result"`
	}
	path := "/collections/" + url.PathEscape(collection) + "/points/count"
	if err := q.do(ctx, http.MethodPost, path, map[string]any{"exact": true}, &out); err != nil {
		return 0, err
	}
	return out.Result.Count, nil
}

// ScrollIDs pages through every job id in a collection.
func (q *Qdrant) ScrollIDs(ctx context.Context, collection string, fn func(jobID string)) error {
	var offset any
	for {
		body := map[string]any{"limit": 1000, "with_payload": []string{payloadJobID}, "with_vector": false}
		if offset != nil {
			body["offset"] = offset
		}
		var out struct {
			Result struct {
				Points []struct {
					Payload struct {
						JobID string `json:"jobId"`
					} `json:"payload"`
				} `json:"points"`
				Next any `json:"next_page_offset"`
			} `json:"result"`
		}
		if err := q.do(ctx, http.MethodPost, "/collections/"+url.PathEscape(collection)+"/points/scroll", body, &out); err != nil {
			return fmt.Errorf("scroll: %w", err)
		}
		for _, p := range out.Result.Points {
			fn(p.Payload.JobID)
		}
		if out.Result.Next == nil {
			return nil
		}
		offset = out.Result.Next
	}
}

// Healthy reports whether Qdrant answers.
func (q *Qdrant) Healthy(ctx context.Context) bool {
	return q.do(ctx, http.MethodGet, "/readyz", nil, nil) == nil
}

func (q *Qdrant) do(ctx context.Context, method, path string, body, out any) error {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode qdrant request: %w", err)
		}
		reader = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, q.base+path, reader)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrQdrantUnavailable, err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if q.apiKey != "" {
		req.Header.Set("api-key", q.apiKey)
	}
	resp, err := q.http.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrQdrantUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		text, _ := io.ReadAll(io.LimitReader(resp.Body, qdrantMaxErrorBody))
		return fmt.Errorf("%w: %s %s: %d %s", ErrQdrantUnavailable, method, path, resp.StatusCode, bytes.TrimSpace(text))
	}
	if out == nil {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode qdrant response: %w", err)
	}
	return nil
}

// UserHit is one user matched by a reverse search, with its stored payload.
type UserHit struct {
	Score   float32
	Payload map[string]any
}

// QueryUsers runs dense searches over the users collection and returns hits with
// their full payload (the fan-out needs each user's profile features).
func (q *Qdrant) QueryUsers(ctx context.Context, collection string, queries []Query, minScore float32) ([][]UserHit, error) {
	if len(queries) == 0 {
		return nil, nil
	}
	searches := make([]map[string]any, 0, len(queries))
	for _, query := range queries {
		searches = append(searches, map[string]any{
			"query":           query.Dense,
			"using":           query.Using,
			"limit":           query.Limit,
			"with_payload":    true,
			"score_threshold": minScore,
		})
	}
	var out struct {
		Result []struct {
			Points []struct {
				Score   float32        `json:"score"`
				Payload map[string]any `json:"payload"`
			} `json:"points"`
		} `json:"result"`
	}
	path := "/collections/" + url.PathEscape(collection) + "/points/query/batch"
	if err := q.do(ctx, http.MethodPost, path, map[string]any{"searches": searches}, &out); err != nil {
		return nil, fmt.Errorf("query users: %w", err)
	}
	hits := make([][]UserHit, len(queries))
	for i := range hits {
		if i >= len(out.Result) {
			break
		}
		for _, p := range out.Result[i].Points {
			hits[i] = append(hits[i], UserHit{Score: p.Score, Payload: p.Payload})
		}
	}
	return hits, nil
}
