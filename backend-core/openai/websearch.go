package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	// A search answer reads several pages, so it gets longer than a plain completion.
	searchTimeout     = 150 * time.Second
	searchAttempts    = 2
	maxSearchBody     = 4 << 20
	maxSearchSources  = 10
	searchSchemaName  = "joined_research"
	webSearchToolType = "web_search"
)

// WithSearchModel sets the model used for web search. Without it, the main model is used.
func (c *Client) WithSearchModel(model string) *Client {
	c.searchModel = strings.TrimSpace(model)
	return c
}

// JSONWebSearch answers a question from the live web and returns it as JSON matching
// schema, plus the pages the answer cited. It uses the Responses API, since chat
// completions cannot search.
func (c *Client) JSONWebSearch(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, []string, error) {
	if c == nil || c.apiKey == "" {
		return nil, nil, ErrMissingAPIKey
	}
	model := c.searchModel
	if model == "" {
		model = c.model
	}
	body, err := json.Marshal(responsesRequest{
		Model:        model,
		Instructions: system,
		Input:        user,
		Tools:        []responsesTool{{Type: webSearchToolType}},
		Text: responsesText{Format: responsesFormat{
			Type:   "json_schema",
			Name:   searchSchemaName,
			Strict: true,
			Schema: schema,
		}},
	})
	if err != nil {
		return nil, nil, err
	}

	var last error
	for attempt := 0; attempt < searchAttempts; attempt++ {
		decoded, status, retryAfter, err := c.respond(ctx, body)
		if err == nil && status >= 200 && status < 300 {
			return decoded.answer()
		}
		if err == nil && status != http.StatusTooManyRequests && status < http.StatusInternalServerError {
			return nil, nil, statusError(status, decoded.errorMessage())
		}
		if err != nil && ctx.Err() != nil {
			return nil, nil, err
		}
		if err != nil {
			last, retryAfter = err, ""
		} else {
			last = statusError(status, decoded.errorMessage())
		}
		if attempt == searchAttempts-1 {
			break
		}
		if err := wait(ctx, retryDelay(attempt, retryAfter)); err != nil {
			return nil, nil, err
		}
	}
	if last == nil {
		last = fmt.Errorf("web search request failed")
	}
	return nil, nil, last
}

func (c *Client) respond(ctx context.Context, body []byte) (responsesReply, int, string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/responses", bytes.NewReader(body))
	if err != nil {
		return responsesReply{}, 0, "", err
	}
	request.Header.Set("Authorization", "Bearer "+c.apiKey)
	request.Header.Set("Content-Type", "application/json")

	client := c.searchHTTP
	if client == nil {
		client = c.http
	}
	response, err := client.Do(request)
	if err != nil {
		return responsesReply{}, 0, "", err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, maxSearchBody))
	if err != nil {
		return responsesReply{}, response.StatusCode, "", err
	}
	var decoded responsesReply
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return responsesReply{}, response.StatusCode, response.Header.Get("Retry-After"), fmt.Errorf("read web search response: %w", err)
	}
	return decoded, response.StatusCode, response.Header.Get("Retry-After"), nil
}

// answer is the model's JSON text and the distinct pages it cited.
func (r responsesReply) answer() ([]byte, []string, error) {
	var text strings.Builder
	var sources []string
	seen := map[string]struct{}{}
	for _, item := range r.Output {
		if item.Type != "message" {
			continue
		}
		for _, part := range item.Content {
			switch part.Type {
			case "refusal":
				return nil, nil, fmt.Errorf("model declined: %s", strings.TrimSpace(part.Refusal))
			case "output_text":
				text.WriteString(part.Text)
				for _, note := range part.Annotations {
					link := cleanSourceURL(note.URL)
					if note.Type != "url_citation" || link == "" {
						continue
					}
					if _, dup := seen[link]; dup || len(sources) == maxSearchSources {
						continue
					}
					seen[link] = struct{}{}
					sources = append(sources, link)
				}
			}
		}
	}
	if r.Status == "incomplete" {
		return nil, nil, fmt.Errorf("web search did not finish: %s", r.IncompleteDetails.Reason)
	}
	if strings.TrimSpace(text.String()) == "" {
		return nil, nil, fmt.Errorf("model returned an empty answer")
	}
	return []byte(text.String()), sources, nil
}

func (r responsesReply) errorMessage() string {
	if r.Error != nil {
		return r.Error.Message
	}
	return ""
}

// cleanSourceURL drops tracking parameters and fragments so the same page is listed once.
func cleanSourceURL(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return ""
	}
	query := parsed.Query()
	for key := range query {
		if strings.HasPrefix(strings.ToLower(key), "utm_") {
			query.Del(key)
		}
	}
	parsed.RawQuery = query.Encode()
	parsed.Fragment = ""
	return parsed.String()
}

type responsesRequest struct {
	Model        string          `json:"model"`
	Instructions string          `json:"instructions"`
	Input        string          `json:"input"`
	Tools        []responsesTool `json:"tools"`
	Text         responsesText   `json:"text"`
}

type responsesTool struct {
	Type string `json:"type"`
}

type responsesText struct {
	Format responsesFormat `json:"format"`
}

type responsesFormat struct {
	Type   string          `json:"type"`
	Name   string          `json:"name"`
	Strict bool            `json:"strict"`
	Schema json.RawMessage `json:"schema"`
}

type responsesReply struct {
	Status            string `json:"status"`
	IncompleteDetails struct {
		Reason string `json:"reason"`
	} `json:"incomplete_details"`
	Output []struct {
		Type    string `json:"type"`
		Content []struct {
			Type        string `json:"type"`
			Text        string `json:"text"`
			Refusal     string `json:"refusal"`
			Annotations []struct {
				Type string `json:"type"`
				URL  string `json:"url"`
			} `json:"annotations"`
		} `json:"content"`
	} `json:"output"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}
