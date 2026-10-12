package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/Joined/backend-core/llmhttp"
)

const (
	batchPath = "/batches"
	// batchEndpointChat is the chat-completions shape inside a batch. Any provider's
	// :batch model uses it; the Batch API resolves the batch price from the slug.
	batchEndpointChat = "/v1/chat/completions"
	// batchEndpointResponses is how a batch runs provider-native web search.
	// OpenRouter rejects its own web plugin on the Batch API.
	batchEndpointResponses = "/v1/responses"
	batchWindow            = "24h"
	batchCustomID          = "request"
	maxBatchBody           = 4 << 20
)

// A batch is often missing for a moment after submit. Poll until it shows up,
// and treat a 404 inside this window as that delay.
var (
	batchPollEvery  = 2 * time.Second
	batchMissingFor = 30 * time.Second
)

// batchChat runs one JSON completion on the Batch API and waits for it.
func (c *Client) batchChat(ctx context.Context, system, user string, schema json.RawMessage) (string, int, int, error) {
	request := c.chatRequest(system, user, schema)
	request.Model = batchSlug(c.model)
	body, err := json.Marshal(request)
	if err != nil {
		return "", 0, 0, err
	}
	raw, err := c.awaitBatch(ctx, batchEndpointChat, request.Model, body)
	if err != nil {
		return "", 0, 0, err
	}
	var decoded chatResponse
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return "", 0, 0, fmt.Errorf("read model response: %w", err)
	}
	if decoded.Error != nil && decoded.Error.Message != "" {
		return "", 0, 0, statusError(http.StatusBadRequest, decoded.Error.Message)
	}
	content := ""
	if len(decoded.Choices) > 0 {
		content = decoded.Choices[0].Message.Content
	}
	prompt, completion := 0, 0
	if decoded.Usage != nil {
		prompt = decoded.Usage.PromptTokens
		completion = decoded.Usage.CompletionTokens
	}
	return content, prompt, completion, nil
}

// BatchWebSearch runs one web search on the Batch API. The model id keeps every
// suffix except :batch. Search uses the Responses shape, which is the native
// search the Batch API accepts for the providers that run it.
func (c *Client) BatchWebSearch(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, []string, error) {
	if c == nil || c.apiKey == "" {
		return nil, nil, ErrMissingAPIKey
	}
	model := batchSlug(c.model)
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
	raw, err := c.awaitBatch(ctx, batchEndpointResponses, model, body)
	if err != nil {
		return nil, nil, err
	}
	var decoded responsesReply
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil, nil, fmt.Errorf("read web search response: %w", err)
	}
	if message := decoded.errorMessage(); message != "" && len(decoded.Output) == 0 {
		return nil, nil, statusError(http.StatusBadRequest, message)
	}
	return decoded.answer()
}

func (c *Client) awaitBatch(ctx context.Context, endpoint, model string, body json.RawMessage) (json.RawMessage, error) {
	payload, err := json.Marshal(batchCreate{
		Endpoint:         endpoint,
		Model:            model,
		CompletionWindow: batchWindow,
		Requests: []batchItem{{
			CustomID: batchCustomID,
			Body:     body,
		}},
	})
	if err != nil {
		return nil, err
	}
	created, status, err := c.postBatch(ctx, payload)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, statusError(status, created.errorMessage())
	}
	if created.ID == "" {
		return nil, fmt.Errorf("model request failed: the batch had no id")
	}
	var missingSince time.Time
	for {
		current, status, err := c.getBatch(ctx, created.ID)
		if err != nil {
			return nil, err
		}
		if status >= 200 && status < 300 {
			missingSince = time.Time{}
			switch current.Status {
			case "completed":
				return current.result()
			case "failed", "expired", "cancelled":
				message := current.errorMessage()
				if message == "" {
					message = "batch " + current.Status
				}
				return nil, statusError(http.StatusBadGateway, message)
			}
		} else if status == http.StatusNotFound {
			if missingSince.IsZero() {
				missingSince = time.Now()
			} else if time.Since(missingSince) > batchMissingFor {
				return nil, statusError(status, current.errorMessage())
			}
		} else if !llmhttp.Retryable(status) {
			return nil, statusError(status, current.errorMessage())
		}
		if err := llmhttp.Wait(ctx, batchPollEvery); err != nil {
			return nil, err
		}
	}
}

func (c *Client) postBatch(ctx context.Context, body []byte) (batchObject, int, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+batchPath, bytes.NewReader(body))
	if err != nil {
		return batchObject{}, 0, err
	}
	request.Header.Set("Authorization", "Bearer "+c.apiKey)
	request.Header.Set("Content-Type", "application/json")
	return c.readBatch(c.http.Do(request))
}

func (c *Client) getBatch(ctx context.Context, id string) (batchObject, int, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+batchPath+"/"+id, nil)
	if err != nil {
		return batchObject{}, 0, err
	}
	request.Header.Set("Authorization", "Bearer "+c.apiKey)
	return c.readBatch(c.http.Do(request))
}

func (c *Client) readBatch(response *http.Response, err error) (batchObject, int, error) {
	if err != nil {
		return batchObject{}, 0, err
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(response.Body, maxBatchBody))
	if err != nil {
		return batchObject{}, response.StatusCode, err
	}
	var decoded batchObject
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return batchObject{}, response.StatusCode, fmt.Errorf("read model response: %w", err)
	}
	return decoded, response.StatusCode, nil
}

type batchCreate struct {
	Endpoint         string      `json:"endpoint"`
	Model            string      `json:"model"`
	CompletionWindow string      `json:"completion_window"`
	Requests         []batchItem `json:"requests"`
}

type batchItem struct {
	CustomID string          `json:"custom_id"`
	Body     json.RawMessage `json:"body"`
}

type batchObject struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Error  *struct {
		Message string `json:"message"`
	} `json:"error"`
	Results []struct {
		CustomID string `json:"custom_id"`
		Response *struct {
			StatusCode int             `json:"status_code"`
			Body       json.RawMessage `json:"body"`
		} `json:"response"`
		Error json.RawMessage `json:"error"`
	} `json:"results"`
}

func (b batchObject) errorMessage() string {
	if b.Error != nil && strings.TrimSpace(b.Error.Message) != "" {
		return b.Error.Message
	}
	return ""
}

func (b batchObject) result() (json.RawMessage, error) {
	for _, item := range b.Results {
		if item.CustomID != batchCustomID {
			continue
		}
		if message := rawMessage(item.Error); message != "" {
			return nil, statusError(http.StatusBadGateway, message)
		}
		if item.Response == nil {
			return nil, fmt.Errorf("model request failed: batch result was empty")
		}
		if item.Response.StatusCode < 200 || item.Response.StatusCode >= 300 {
			return nil, statusError(item.Response.StatusCode, rawMessage(item.Response.Body))
		}
		return item.Response.Body, nil
	}
	return nil, fmt.Errorf("model request failed: batch result was empty")
}

func rawMessage(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var object struct {
		Message string `json:"message"`
		Error   *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(raw, &object) == nil {
		if strings.TrimSpace(object.Message) != "" {
			return object.Message
		}
		if object.Error != nil && strings.TrimSpace(object.Error.Message) != "" {
			return object.Error.Message
		}
	}
	text := strings.Trim(string(raw), `"`)
	if strings.TrimSpace(text) == "" || strings.HasPrefix(strings.TrimSpace(text), "{") {
		return ""
	}
	return text
}
