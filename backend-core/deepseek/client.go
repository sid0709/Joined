// Package deepseek is the OpenRouter model the admin console uses: JSON answers over
// chat completions, and web research over OpenRouter's web-search plugin.
package deepseek

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/Joined/backend-core/config"
	"github.com/sid0709/Joined/backend-core/llmhttp"
	"github.com/sid0709/Joined/backend-core/openai"
)

// A search answer reads several pages, so it gets longer than a plain completion.
const searchTimeout = 4 * time.Minute

// ErrMissingAPIKey is returned without OPENROUTER_API_KEY. It matches openai.ErrMissingAPIKey,
// so callers that check for a missing key treat both the same.
var ErrMissingAPIKey = errors.Join(errors.New("OPENROUTER_API_KEY is not set"), openai.ErrMissingAPIKey)

type Client struct {
	chat    *openai.Client
	apiKey  string
	model   string
	baseURL string
	// maxSearches caps the web searches behind one answer.
	maxSearches int
	http        *http.Client
}

func New(cfg config.OpenRouter) *Client {
	return &Client{
		// OpenRouter's catalog mixes providers; json_object plus the schema in the
		// prompt works across them. Reasoning only slows down reading a job post.
		chat:        openai.New(cfg.APIKey, cfg.Model, cfg.BaseURL).ForProvider(ErrMissingAPIKey, true, true).OpenRouter(),
		apiKey:      strings.TrimSpace(cfg.APIKey),
		model:       cfg.Model,
		baseURL:     strings.TrimRight(cfg.BaseURL, "/"),
		maxSearches: cmp.Or(max(cfg.MaxSearches, 0), config.DefaultOpenRouterMaxSearches),
		http:        llmhttp.NewClient(searchTimeout),
	}
}

func (c *Client) Model() string {
	return c.model
}

// Ready reports whether an OpenRouter API key is set.
func (c *Client) Ready() bool {
	return c != nil && c.apiKey != ""
}

// JSON answers in JSON that matches schema.
func (c *Client) JSON(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error) {
	return c.chat.JSON(ctx, system, user, schema)
}
