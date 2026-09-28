package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	requestTimeout = 90 * time.Second
	maxAttempts    = 4
	retryBase      = 500 * time.Millisecond
	maxRetryWait   = 8 * time.Second
)

var ErrMissingAPIKey = errors.New("OPENAI_API_KEY is not set")

type Client struct {
	apiKey  string
	model   string
	baseURL string
	http    *http.Client
}

func New(apiKey, model, baseURL string) *Client {
	return &Client{
		apiKey:  strings.TrimSpace(apiKey),
		model:   model,
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    newHTTPClient(),
	}
}

func newHTTPClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.MaxIdleConns = 128
	transport.MaxIdleConnsPerHost = 128
	transport.MaxConnsPerHost = 128
	return &http.Client{Timeout: requestTimeout, Transport: transport}
}

func (c *Client) Model() string {
	return c.model
}

func (c *Client) JSON(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error) {
	if c == nil || c.apiKey == "" {
		return nil, ErrMissingAPIKey
	}

	body, err := json.Marshal(chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		ResponseFormat: responseFormat{
			Type: "json_schema",
			JSONSchema: jsonSchemaBody{
				Name:   "opened_job",
				Strict: true,
				Schema: schema,
			},
		},
	})
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
		if err == nil && status != http.StatusTooManyRequests && status < http.StatusInternalServerError {
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
		if err := wait(ctx, retryDelay(attempt, retryAfter)); err != nil {
			return nil, err
		}
	}
	if last == nil {
		last = fmt.Errorf("model request failed")
	}
	return nil, last
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

func retryDelay(attempt int, retryAfter string) time.Duration {
	if seconds, err := strconv.Atoi(strings.TrimSpace(retryAfter)); err == nil && seconds > 0 {
		delay := time.Duration(seconds) * time.Second
		if delay > maxRetryWait {
			return maxRetryWait
		}
		return delay
	}
	delay := retryBase << attempt
	if delay > maxRetryWait {
		return maxRetryWait
	}
	return delay
}

func wait(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

type chatRequest struct {
	Model          string         `json:"model"`
	Messages       []chatMessage  `json:"messages"`
	ResponseFormat responseFormat `json:"response_format"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type       string         `json:"type"`
	JSONSchema jsonSchemaBody `json:"json_schema"`
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
