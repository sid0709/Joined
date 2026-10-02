// Package deepseek is the DeepSeek model the admin migration uses: JSON answers over
// chat completions, and web research over DeepSeek's Anthropic-format endpoint, which
// runs the web search on DeepSeek's side.
package deepseek

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/llmhttp"
	"github.com/sid0709/OpenSeat/backend-core/openai"
)

// A search answer reads several pages, so it gets longer than a plain completion.
const searchTimeout = 4 * time.Minute

// ErrMissingAPIKey is returned without DEEPSEEK_API_KEY. It matches openai.ErrMissingAPIKey,
// so callers that check for a missing key treat both the same.
var ErrMissingAPIKey = errors.Join(errors.New("DEEPSEEK_API_KEY is not set"), openai.ErrMissingAPIKey)

type Client struct {
	chat      *openai.Client
	apiKey    string
	model     string
	searchURL string
	// maxSearches caps the web searches behind one answer.
	maxSearches int
	http        *http.Client
}

func New(cfg config.DeepSeek) *Client {
	return &Client{
		// DeepSeek promises valid JSON but not a strict schema, and reasoning only slows
		// down reading a job post.
		chat:        openai.New(cfg.APIKey, cfg.Model, cfg.BaseURL).ForProvider(ErrMissingAPIKey, true, true),
		apiKey:      strings.TrimSpace(cfg.APIKey),
		model:       cfg.Model,
		searchURL:   strings.TrimRight(cfg.SearchURL, "/"),
		maxSearches: cmp.Or(max(cfg.MaxSearches, 0), config.DefaultDeepSeekMaxSearches),
		http:        llmhttp.NewClient(searchTimeout),
	}
}

func (c *Client) Model() string {
	return c.model
}

// Ready reports whether DEEPSEEK_API_KEY is set.
func (c *Client) Ready() bool {
	return c != nil && c.apiKey != ""
}

// JSON answers in JSON that matches schema.
func (c *Client) JSON(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error) {
	return c.chat.JSON(ctx, system, user, schema)
}
