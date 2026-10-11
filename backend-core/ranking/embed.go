package ranking

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"math"
	"net/http"
	"time"

	"github.com/sid0709/Joined/backend-core/config"
)

// bge models want this instruction on the short side of an asymmetric search
// (a query or a profile), and nothing on the documents.
const queryInstruction = "Represent this sentence for searching relevant passages: "

const (
	// embedTimeout bounds one embedding request. Backfill batches queue behind each
	// other on a CPU model, so it is generous; searches are bounded by their own
	// request deadline, which is much shorter.
	embedTimeout = 2 * time.Minute
	// EmbedBatch is how many texts one embedding request carries.
	EmbedBatch = 32
	// embedMaxErrorBody caps how much of an error response is kept for the message.
	embedMaxErrorBody = 1 << 12
)

// ErrEmbedderUnavailable wraps every embedding transport or server failure.
var ErrEmbedderUnavailable = errors.New("embedder unavailable")

// Embedder turns texts into unit-length vectors.
type Embedder interface {
	// Embed returns one vector per text. query marks the short side of a search.
	Embed(ctx context.Context, texts []string, query bool) ([][]float32, error)
	Dimensions() int
}

// NewEmbedder builds the embedder the config names, or nil when none is configured.
func NewEmbedder(cfg config.Ranking) Embedder {
	if cfg.EmbedderURL == "" {
		return nil
	}
	client := &http.Client{Timeout: embedTimeout}
	if cfg.EmbedderAPI == config.EmbedderOpenAI {
		return &openAIEmbedder{url: cfg.EmbedderURL, model: cfg.EmbedderModel, key: cfg.EmbedderAPIKey, dims: cfg.EmbedderDimensions, http: client}
	}
	return &teiEmbedder{url: cfg.EmbedderURL, key: cfg.EmbedderAPIKey, dims: cfg.EmbedderDimensions, http: client}
}

// teiEmbedder talks to HuggingFace text-embeddings-inference.
type teiEmbedder struct {
	url  string
	key  string
	dims int
	http *http.Client
}

func (e *teiEmbedder) Dimensions() int { return e.dims }

func (e *teiEmbedder) Embed(ctx context.Context, texts []string, query bool) ([][]float32, error) {
	inputs := prefixed(texts, query)
	var out [][]float32
	if err := postJSON(ctx, e.http, e.url+"/embed", e.key, map[string]any{"inputs": inputs, "normalize": true, "truncate": true}, &out); err != nil {
		return nil, err
	}
	return checkVectors(out, len(texts), e.dims)
}

// openAIEmbedder talks to any OpenAI-compatible /v1/embeddings (OpenAI, Ollama, vLLM).
type openAIEmbedder struct {
	url   string
	model string
	key   string
	dims  int
	http  *http.Client
}

func (e *openAIEmbedder) Dimensions() int { return e.dims }

func (e *openAIEmbedder) Embed(ctx context.Context, texts []string, query bool) ([][]float32, error) {
	body := map[string]any{"model": e.model, "input": prefixed(texts, query)}
	var out struct {
		Data []struct {
			Index     int       `json:"index"`
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := postJSON(ctx, e.http, e.url+"/v1/embeddings", e.key, body, &out); err != nil {
		return nil, err
	}
	vectors := make([][]float32, len(texts))
	for _, d := range out.Data {
		if d.Index >= 0 && d.Index < len(vectors) {
			vectors[d.Index] = normalized(d.Embedding)
		}
	}
	return checkVectors(vectors, len(texts), e.dims)
}

func prefixed(texts []string, query bool) []string {
	if !query {
		return texts
	}
	out := make([]string, len(texts))
	for i, text := range texts {
		out[i] = queryInstruction + text
	}
	return out
}

func checkVectors(vectors [][]float32, want, dims int) ([][]float32, error) {
	if len(vectors) != want {
		return nil, fmt.Errorf("%w: got %d vectors for %d texts", ErrEmbedderUnavailable, len(vectors), want)
	}
	for i, v := range vectors {
		if len(v) != dims {
			return nil, fmt.Errorf("%w: vector %d has %d dimensions, want %d", ErrEmbedderUnavailable, i, len(v), dims)
		}
	}
	return vectors, nil
}

// normalized scales v to unit length, so dot product equals cosine similarity.
func normalized(v []float32) []float32 {
	var sum float64
	for _, x := range v {
		sum += float64(x) * float64(x)
	}
	if sum == 0 {
		return v
	}
	inv := float32(1 / math.Sqrt(sum))
	out := make([]float32, len(v))
	for i, x := range v {
		out[i] = x * inv
	}
	return out
}

// Cosine is the cosine similarity of two unit vectors (their dot product).
func Cosine(a, b []float32) float32 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot float32
	for i := range a {
		dot += a[i] * b[i]
	}
	return dot
}

func postJSON(ctx context.Context, client *http.Client, url, key string, body, out any) error {
	encoded, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("encode embed request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(encoded))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrEmbedderUnavailable, err)
	}
	req.Header.Set("Content-Type", "application/json")
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrEmbedderUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		text, _ := io.ReadAll(io.LimitReader(resp.Body, embedMaxErrorBody))
		return fmt.Errorf("%w: %d %s", ErrEmbedderUnavailable, resp.StatusCode, bytes.TrimSpace(text))
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("%w: decode: %v", ErrEmbedderUnavailable, err)
	}
	return nil
}

// JobTexts are a job's two embedding inputs: the title alone, and a fuller body.
func JobTexts(job JobFeatures) (title, body string) {
	title = job.Title
	body = job.Title
	if job.Company != "" {
		body += " at " + job.Company
	}
	if len(job.Skills) > 0 {
		body += ". Skills: " + joinComma(job.Skills)
	}
	if job.Team != "" {
		body += ". Team: " + job.Team
	}
	if job.Summary != "" {
		body += ". " + job.Summary
	}
	return title, body
}

func joinComma(values []string) string {
	var b bytes.Buffer
	for i, v := range values {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(v)
	}
	return b.String()
}

// HashEmbedder maps each term to fixed pseudo-random directions, so texts that
// share words land close together. It is deterministic and needs no model:
// synthetic load tests and tests use it; it is no substitute for a real model.
type HashEmbedder struct{ Dims int }

// Dimensions is the vector size.
func (h HashEmbedder) Dimensions() int { return h.Dims }

// Embed returns one unit vector per text.
func (h HashEmbedder) Embed(_ context.Context, texts []string, _ bool) ([][]float32, error) {
	const directionsPerTerm = 8
	out := make([][]float32, len(texts))
	for i, text := range texts {
		v := make([]float32, h.Dims)
		for _, term := range Tokens(text) {
			f := fnv.New64a()
			_, _ = f.Write([]byte(term))
			seed := f.Sum64()
			for j := 0; j < directionsPerTerm; j++ {
				seed = seed*6364136223846793005 + 1442695040888963407
				v[seed%uint64(h.Dims)]++
			}
		}
		out[i] = normalized(v)
	}
	return out, nil
}
