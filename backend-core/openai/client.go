package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/llmhttp"
)

const (
	requestTimeout = 90 * time.Second
	maxAttempts    = 4
	// schemaInstruction introduces the schema when the provider only promises valid JSON.
	schemaInstruction = "\n\nReply with one JSON object and nothing else. It must match this JSON schema exactly, with every property present:\n"
)

var ErrMissingAPIKey = errors.New("OPENAI_API_KEY is not set")

type Client struct {
	apiKey      string
	model       string
	searchModel string
	baseURL     string
	missingKey  error
	jsonObject  bool
	noThinking  bool
	http        *http.Client
	searchHTTP  *http.Client
}

func New(apiKey, model, baseURL string) *Client {
	return &Client{
		apiKey:     strings.TrimSpace(apiKey),
		model:      model,
		baseURL:    strings.TrimRight(baseURL, "/"),
		missingKey: ErrMissingAPIKey,
		http:       llmhttp.NewClient(requestTimeout),
		searchHTTP: llmhttp.NewClient(searchTimeout),
	}
}

// ForProvider adapts the client to an OpenAI-compatible provider: missingKey is
// returned without an API key and should wrap ErrMissingAPIKey. jsonObject asks for
// plain JSON mode and puts the schema in the system prompt, for providers without
// strict json_schema output. noThinking turns off the provider's reasoning mode.
func (c *Client) ForProvider(missingKey error, jsonObject, noThinking bool) *Client {
	c.missingKey = missingKey
	c.jsonObject = jsonObject
	c.noThinking = noThinking
	return c
}

func (c *Client) Model() string {
	return c.model
}

// Ready reports whether the client has an API key.
func (c *Client) Ready() bool {
	return c != nil && c.apiKey != ""
}

func (c *Client) JSON(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error) {
	if c == nil {
		return nil, ErrMissingAPIKey
	}
	if c.apiKey == "" {
		return nil, c.missingKey
	}

	body, err := json.Marshal(c.chatRequest(system, user, schema))
	if err != nil {
		return nil, err
	}

	var last error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		content, status, retryAfter, err := c.complete(ctx, body)
		if err == nil && status >= 200 && status < 300 {
			if strings.TrimSpace(content) == "" {
				return nil, fmt.Errorf("model returned an empty job")
			}
			return []byte(content), nil
		}
		if err == nil && !llmhttp.Retryable(status) {
			return nil, statusError(status, content)
		}
		if err != nil && ctx.Err() != nil {
			return nil, err
		}
		if err != nil {
			last = err
			retryAfter = ""
		} else {
			last = statusError(status, content)
		}
		if attempt == maxAttempts-1 {
			break
		}
		if err := llmhttp.Wait(ctx, llmhttp.RetryDelay(attempt, retryAfter)); err != nil {
			return nil, err
		}
	}
	if last == nil {
		last = fmt.Errorf("model request failed")
	}
	return nil, last
}

func (c *Client) chatRequest(system, user string, schema json.RawMessage) chatRequest {
	request := chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		ResponseFormat: responseFormat{
			Type: "json_schema",
			JSONSchema: &jsonSchemaBody{
				Name:   "joined_job",
				Strict: true,
				Schema: schema,
			},
		},
	}
	if c.jsonObject {
		request.Messages[0].Content = system + schemaInstruction + string(schema)
		request.ResponseFormat = responseFormat{Type: "json_object"}
	}
	if c.noThinking {
		request.Thinking = &thinking{Type: "disabled"}
	}
	return request
}

func (c *Client) complete(ctx context.Context, body []byte) (string, int, string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", 0, "", err
	}
	request.Header.Set("Authorization", "Bearer "+c.apiKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := c.http.Do(request)
	if err != nil {
		return "", 0, "", err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return "", response.StatusCode, "", err
	}
	var decoded chatResponse
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return "", response.StatusCode, response.Header.Get("Retry-After"), fmt.Errorf("read model response: %w", err)
	}
	content := ""
	if len(decoded.Choices) > 0 {
		content = decoded.Choices[0].Message.Content
	}
	if decoded.Error != nil && decoded.Error.Message != "" && (response.StatusCode < 200 || response.StatusCode >= 300) {
		return decoded.Error.Message, response.StatusCode, response.Header.Get("Retry-After"), nil
	}
	return content, response.StatusCode, response.Header.Get("Retry-After"), nil
}

func statusError(status int, message string) error {
	if strings.TrimSpace(message) != "" && !strings.HasPrefix(strings.TrimSpace(message), "{") {
		return fmt.Errorf("model request failed: %s", strings.TrimSpace(message))
	}
	return fmt.Errorf("model request failed (%d)", status)
}

type chatRequest struct {
	Model          string         `json:"model"`
	Messages       []chatMessage  `json:"messages"`
	ResponseFormat responseFormat `json:"response_format"`
	Thinking       *thinking      `json:"thinking,omitempty"`
}

type thinking struct {
	Type string `json:"type"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type       string          `json:"type"`
	JSONSchema *jsonSchemaBody `json:"json_schema,omitempty"`
}

type jsonSchemaBody struct {
	Name   string          `json:"name"`
	Strict bool            `json:"strict"`
	Schema json.RawMessage `json:"schema"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}
