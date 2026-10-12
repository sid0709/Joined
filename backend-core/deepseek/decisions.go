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
)

const (
	decisionsPath    = "/alpha/decisions"
	apiVersionSuffix = "/v1"
)

// Decide asks a decision model the typed questions about state. Every decision
// model on OpenRouter, including Jev and the other vendors' decision models,
// uses this one call. The answer is probabilities, not prose.
func (c *Client) Decide(ctx context.Context, state string, questions json.RawMessage) (json.RawMessage, error) {
	if !c.Ready() {
		return nil, ErrMissingAPIKey
	}
	body, err := json.Marshal(decisionsRequest{
		Model:     c.model,
		State:     state,
		Questions: questions,
	})
	if err != nil {
		return nil, err
	}
	var last error
	for attempt := 0; attempt < searchAttempts; attempt++ {
		answers, status, retryAfter, err := c.postDecisions(ctx, body)
		if err == nil && status >= 200 && status < 300 {
			if len(answers) == 0 {
				return nil, fmt.Errorf("model returned no decisions")
			}
			return answers, nil
		}
		if err == nil && !llmhttp.Retryable(status) {
			return nil, statusError(status, string(answers))
		}
		if err != nil && ctx.Err() != nil {
			return nil, err
		}
		if err != nil {
			last, retryAfter = err, ""
		} else {
			last = statusError(status, string(answers))
		}
		if attempt == searchAttempts-1 {
			break
		}
		if err := llmhttp.Wait(ctx, llmhttp.RetryDelay(attempt, retryAfter)); err != nil {
			return nil, err
		}
	}
	if last == nil {
		last = fmt.Errorf("decision request failed")
	}
	return nil, last
}

func (c *Client) postDecisions(ctx context.Context, body []byte) (json.RawMessage, int, string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, decisionsURL(c.baseURL), bytes.NewReader(body))
	if err != nil {
		return nil, 0, "", err
	}
	request.Header.Set("Authorization", "Bearer "+c.apiKey)
	request.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(request)
	if err != nil {
		return nil, 0, "", err
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(response.Body, maxSearchBody))
	if err != nil {
		return nil, response.StatusCode, "", err
	}
	var decoded decisionsResponse
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return nil, response.StatusCode, response.Header.Get("Retry-After"), fmt.Errorf("read decision response: %w", err)
	}
	if decoded.Error != nil && decoded.Error.Message != "" && (response.StatusCode < 200 || response.StatusCode >= 300) {
		return json.RawMessage(decoded.Error.Message), response.StatusCode, response.Header.Get("Retry-After"), nil
	}
	return decoded.Answers, response.StatusCode, response.Header.Get("Retry-After"), nil
}

// decisionsURL is the decisions API beside /v1, not under it.
func decisionsURL(base string) string {
	base = strings.TrimRight(base, "/")
	if strings.HasSuffix(base, apiVersionSuffix) {
		return strings.TrimSuffix(base, apiVersionSuffix) + decisionsPath
	}
	return base + decisionsPath
}

type decisionsRequest struct {
	Model     string          `json:"model"`
	State     string          `json:"state"`
	Questions json.RawMessage `json:"questions"`
}

type decisionsResponse struct {
	Answers json.RawMessage `json:"answers"`
	Error   *struct {
		Message string `json:"message"`
	} `json:"error"`
}
