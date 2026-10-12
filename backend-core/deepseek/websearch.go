package deepseek

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/sid0709/Joined/backend-core/llmhttp"
	"github.com/sid0709/Joined/backend-core/openai"
)

const (
	completionsPath  = "/chat/completions"
	searchAttempts   = 3
	maxSearchBody    = 4 << 20
	maxSearchSources = 10
	webPluginID      = "web"
	schemaPrompt     = "\n\nWhen you are done searching, reply with one JSON object and nothing else: no prose, no code fence. It must match this JSON schema exactly, with every property present:\n"
)

// JSONWebSearch answers a question from the live web as JSON matching schema, plus the
// pages it cited. Search runs through OpenRouter's web plugin for every catalog model
// except a :batch id, which the Batch API serves with native search instead.
func (c *Client) JSONWebSearch(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, []string, error) {
	if !c.Ready() {
		return nil, nil, ErrMissingAPIKey
	}
	// A :batch model cannot take the web plugin. The Batch API runs native search
	// on the Responses shape instead. Every other model keeps the plugin, which is
	// what works across the catalog.
	if openai.IsBatchCatalog(c.model) {
		return c.chat.BatchWebSearch(ctx, system, user, schema)
	}
	body, err := json.Marshal(searchRequest{
		Model: c.model,
		Messages: []searchMessage{
			{Role: "system", Content: system + schemaPrompt + string(schema)},
			{Role: "user", Content: user},
		},
		ResponseFormat: searchFormat{Type: "json_object"},
		Plugins:        []searchPlugin{{ID: webPluginID, MaxResults: c.maxSearches}},
	})
	if err != nil {
		return nil, nil, err
	}

	var last error
	for attempt := 0; attempt < searchAttempts; attempt++ {
		reply, status, retryAfter, err := c.postSearch(ctx, body)
		if err == nil && status >= 200 && status < 300 {
			return research(reply)
		}
		if err == nil && !llmhttp.Retryable(status) {
			return nil, nil, statusError(status, reply.errorMessage())
		}
		if err != nil && ctx.Err() != nil {
			return nil, nil, err
		}
		if err != nil {
			last, retryAfter = err, ""
		} else {
			last = statusError(status, reply.errorMessage())
		}
		if attempt == searchAttempts-1 {
			break
		}
		if err := llmhttp.Wait(ctx, llmhttp.RetryDelay(attempt, retryAfter)); err != nil {
			return nil, nil, err
		}
	}
	if last == nil {
		last = fmt.Errorf("web search request failed")
	}
	return nil, nil, last
}

func (c *Client) postSearch(ctx context.Context, body []byte) (searchReply, int, string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+completionsPath, bytes.NewReader(body))
	if err != nil {
		return searchReply{}, 0, "", err
	}
	request.Header.Set("Authorization", "Bearer "+c.apiKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := c.http.Do(request)
	if err != nil {
		return searchReply{}, 0, "", err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, maxSearchBody))
	if err != nil {
		return searchReply{}, response.StatusCode, "", err
	}
	var decoded searchReply
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return searchReply{}, response.StatusCode, response.Header.Get("Retry-After"), fmt.Errorf("read web search response: %w", err)
	}
	return decoded, response.StatusCode, response.Header.Get("Retry-After"), nil
}

func research(reply searchReply) ([]byte, []string, error) {
	message := reply.message()
	answer, err := jsonObject(message.Content)
	if err != nil {
		return nil, nil, err
	}
	return answer, sources(message.citationURLs()), nil
}

// jsonObject is the one JSON object in text, without any prose or code fence around it.
func jsonObject(text string) ([]byte, error) {
	start, end := strings.Index(text, "{"), strings.LastIndex(text, "}")
	if start < 0 || end < start {
		return nil, fmt.Errorf("model returned no JSON answer")
	}
	answer := []byte(text[start : end+1])
	if !json.Valid(answer) {
		return nil, fmt.Errorf("model returned malformed JSON")
	}
	return answer, nil
}

func sources(links []string) []string {
	out := []string{}
	seen := map[string]struct{}{}
	for _, link := range links {
		link = llmhttp.CleanSourceURL(link)
		if _, dup := seen[link]; dup || link == "" {
			continue
		}
		seen[link] = struct{}{}
		out = append(out, link)
		if len(out) == maxSearchSources {
			break
		}
	}
	return out
}

func statusError(status int, message string) error {
	if message = strings.TrimSpace(message); message != "" {
		return fmt.Errorf("web search request failed (%d): %s", status, message)
	}
	return fmt.Errorf("web search request failed (%d)", status)
}

type searchRequest struct {
	Model          string          `json:"model"`
	Messages       []searchMessage `json:"messages"`
	ResponseFormat searchFormat    `json:"response_format"`
	Plugins        []searchPlugin  `json:"plugins"`
}

type searchMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type searchFormat struct {
	Type string `json:"type"`
}

type searchPlugin struct {
	ID         string `json:"id"`
	MaxResults int    `json:"max_results,omitempty"`
}

type searchReply struct {
	Choices []struct {
		Message searchChoice `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type searchChoice struct {
	Content     string           `json:"content"`
	Annotations []searchCitation `json:"annotations"`
}

type searchCitation struct {
	Type        string `json:"type"`
	URLCitation struct {
		URL string `json:"url"`
	} `json:"url_citation"`
}

func (r searchReply) message() searchChoice {
	if len(r.Choices) == 0 {
		return searchChoice{}
	}
	return r.Choices[0].Message
}

func (r searchReply) errorMessage() string {
	if r.Error != nil {
		return r.Error.Message
	}
	return ""
}

func (m searchChoice) citationURLs() []string {
	urls := make([]string, 0, len(m.Annotations))
	for _, note := range m.Annotations {
		if note.Type == "url_citation" {
			urls = append(urls, note.URLCitation.URL)
		}
	}
	return urls
}
