package deepseek

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/llmhttp"
)

const (
	messagesPath     = "/v1/messages"
	anthropicVersion = "2023-06-01"
	searchAttempts   = 3
	maxSearchBody    = 4 << 20
	maxSearchSources = 10
	maxSearchTokens  = 8192
	// maxContinuations is how many times a long search may pause and resume.
	maxContinuations = 3
	webSearchTool    = "web_search"
	webSearchType    = "web_search_20250305"
	stopPaused       = "pause_turn"
	stopRefused      = "refusal"
	stopMaxTokens    = "max_tokens"
	schemaPrompt     = "\n\nWhen you are done searching, reply with one JSON object and nothing else: no prose, no code fence. It must match this JSON schema exactly, with every property present:\n"
)

// ErrNoSearch means the model answered without searching, so its facts are unchecked.
var ErrNoSearch = errors.New("the model answered without searching the web")

// JSONWebSearch answers a question from the live web as JSON matching schema, plus the
// pages it used. The search runs on DeepSeek's side. An answer that never searched is
// refused rather than trusted.
func (c *Client) JSONWebSearch(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, []string, error) {
	if !c.Ready() {
		return nil, nil, ErrMissingAPIKey
	}
	request := messagesRequest{
		Model:     c.model,
		MaxTokens: maxSearchTokens,
		System:    system + schemaPrompt + string(schema),
		Messages:  []message{{Role: "user", Content: mustJSON(user)}},
		Tools:     []tool{{Type: webSearchType, Name: webSearchTool, MaxUses: c.maxSearches}},
	}

	var turns []messagesReply
	for turn := 0; turn <= maxContinuations; turn++ {
		reply, err := c.send(ctx, request)
		if err != nil {
			return nil, nil, err
		}
		turns = append(turns, reply)
		if reply.StopReason != stopPaused {
			break
		}
		// A paused turn resumes from what it has so far.
		request.Messages = append(request.Messages, message{Role: "assistant", Content: reply.Content})
	}
	return research(turns)
}

func (c *Client) send(ctx context.Context, request messagesRequest) (messagesReply, error) {
	body, err := json.Marshal(request)
	if err != nil {
		return messagesReply{}, err
	}
	var last error
	for attempt := 0; attempt < searchAttempts; attempt++ {
		reply, status, retryAfter, err := c.post(ctx, body)
		if err == nil && status >= 200 && status < 300 {
			return reply, nil
		}
		if err == nil && !llmhttp.Retryable(status) {
			return messagesReply{}, statusError(status, reply.errorMessage())
		}
		if err != nil && ctx.Err() != nil {
			return messagesReply{}, err
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
			return messagesReply{}, err
		}
	}
	if last == nil {
		last = fmt.Errorf("web search request failed")
	}
	return messagesReply{}, last
}

func (c *Client) post(ctx context.Context, body []byte) (messagesReply, int, string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.searchURL+messagesPath, bytes.NewReader(body))
	if err != nil {
		return messagesReply{}, 0, "", err
	}
	request.Header.Set("x-api-key", c.apiKey)
	request.Header.Set("anthropic-version", anthropicVersion)
	request.Header.Set("Content-Type", "application/json")

	response, err := c.http.Do(request)
	if err != nil {
		return messagesReply{}, 0, "", err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, maxSearchBody))
	if err != nil {
		return messagesReply{}, response.StatusCode, "", err
	}
	var decoded messagesReply
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return messagesReply{}, response.StatusCode, response.Header.Get("Retry-After"), fmt.Errorf("read web search response: %w", err)
	}
	return decoded, response.StatusCode, response.Header.Get("Retry-After"), nil
}

// research reads the JSON answer from the last turn and the pages every turn used:
// cited pages first, then the other search results.
func research(turns []messagesReply) ([]byte, []string, error) {
	searched := false
	var cited, found []string
	for _, turn := range turns {
		for _, block := range turn.blocks() {
			switch block.Type {
			case "server_tool_use":
				searched = searched || block.Name == webSearchTool
			case "web_search_tool_result":
				for _, result := range block.results() {
					found = append(found, result.URL)
				}
			case "text":
				for _, citation := range block.Citations {
					cited = append(cited, citation.URL)
				}
			}
		}
	}
	last := turns[len(turns)-1]
	switch last.StopReason {
	case stopRefused:
		return nil, nil, fmt.Errorf("model declined to answer")
	case stopMaxTokens:
		return nil, nil, fmt.Errorf("the answer was cut off")
	case stopPaused:
		return nil, nil, fmt.Errorf("web search did not finish")
	}
	if !searched {
		return nil, nil, ErrNoSearch
	}
	answer, err := jsonObject(last.finalText())
	if err != nil {
		return nil, nil, err
	}
	return answer, sources(append(cited, found...)), nil
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

// sources are the distinct cleaned links, in order, up to the cap.
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

func mustJSON(text string) json.RawMessage {
	raw, _ := json.Marshal(text)
	return raw
}

type messagesRequest struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	System    string    `json:"system"`
	Messages  []message `json:"messages"`
	Tools     []tool    `json:"tools"`
}

// message content is a string for the question, or the content blocks of a paused turn.
type message struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

type tool struct {
	Type    string `json:"type"`
	Name    string `json:"name"`
	MaxUses int    `json:"max_uses"`
}

type messagesReply struct {
	Content    json.RawMessage `json:"content"`
	StopReason string          `json:"stop_reason"`
	Error      *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type contentBlock struct {
	Type      string          `json:"type"`
	Name      string          `json:"name"`
	Text      string          `json:"text"`
	Content   json.RawMessage `json:"content"`
	Citations []struct {
		URL string `json:"url"`
	} `json:"citations"`
}

type searchResult struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

func (r messagesReply) blocks() []contentBlock {
	var blocks []contentBlock
	_ = json.Unmarshal(r.Content, &blocks)
	return blocks
}

// finalText is the text after the last search: the answer, not the narration before it.
func (r messagesReply) finalText() string {
	var text strings.Builder
	for _, block := range r.blocks() {
		switch block.Type {
		case "server_tool_use", "web_search_tool_result":
			text.Reset()
		case "text":
			text.WriteString(block.Text)
		}
	}
	return text.String()
}

func (r messagesReply) errorMessage() string {
	if r.Error != nil {
		return r.Error.Message
	}
	return ""
}

// results are a search's hits. A failed search holds an error object instead of a list.
func (b contentBlock) results() []searchResult {
	var results []searchResult
	if err := json.Unmarshal(b.Content, &results); err != nil {
		return nil
	}
	return results
}
