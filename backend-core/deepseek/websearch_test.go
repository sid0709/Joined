package deepseek

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/openai"
)

const searchedReply = `{
  "stop_reason": "end_turn",
  "content": [
    {"type": "text", "text": "Let me look that up. {not json"},
    {"type": "server_tool_use", "id": "s1", "name": "web_search", "input": {"query": "Acme"}},
    {"type": "web_search_tool_result", "tool_use_id": "s1", "content": [
      {"type": "web_search_result", "url": "https://acme.example/careers", "title": "Careers"},
      {"type": "web_search_result", "url": "https://acme.example/about?utm_source=x", "title": "About"}
    ]},
    {"type": "text", "text": "{\"name\":", "citations": [{"type": "web_search_result_location", "url": "https://acme.example/about#team"}]},
    {"type": "text", "text": "\"Acme\"}"}
  ]
}`

func newTestClient(url string) *Client {
	return New(config.DeepSeek{APIKey: "key", Model: "deepseek-flash", BaseURL: url, SearchURL: url})
}

func TestJSONWebSearchSendsSearchToolAndReadsAnswer(t *testing.T) {
	var got map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != messagesPath || r.Header.Get("x-api-key") != "key" || r.Header.Get("anthropic-version") == "" {
			t.Errorf("path = %q headers = %v", r.URL.Path, r.Header)
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(searchedReply))
	}))
	defer server.Close()

	answer, sources, err := newTestClient(server.URL).JSONWebSearch(context.Background(), "be exact", "Acme", json.RawMessage(`{"type":"object"}`))
	if err != nil {
		t.Fatal(err)
	}
	if string(answer) != `{"name":"Acme"}` {
		t.Fatalf("answer = %s", answer)
	}
	want := []string{"https://acme.example/about", "https://acme.example/careers"}
	if strings.Join(sources, ",") != strings.Join(want, ",") {
		t.Fatalf("sources = %v", sources)
	}
	tools := got["tools"].([]any)
	search := tools[0].(map[string]any)
	if search["type"] != webSearchType || got["model"] != "deepseek-flash" {
		t.Fatalf("request = %v", got)
	}
	if search["max_uses"] != float64(config.DefaultDeepSeekMaxSearches) {
		t.Fatalf("max_uses = %v, want the default %d", search["max_uses"], config.DefaultDeepSeekMaxSearches)
	}
	if system := got["system"].(string); !strings.HasPrefix(system, "be exact") || !strings.Contains(system, `{"type":"object"}`) {
		t.Fatalf("system = %q", system)
	}
}

func TestJSONWebSearchCapsSearchesAsConfigured(t *testing.T) {
	var got struct {
		Tools []struct {
			MaxUses int `json:"max_uses"`
		} `json:"tools"`
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(searchedReply))
	}))
	defer server.Close()

	client := New(config.DeepSeek{APIKey: "key", Model: "deepseek-flash", SearchURL: server.URL, MaxSearches: 2})
	if _, _, err := client.JSONWebSearch(context.Background(), "", "Acme", json.RawMessage(`{}`)); err != nil {
		t.Fatal(err)
	}
	if len(got.Tools) != 1 || got.Tools[0].MaxUses != 2 {
		t.Fatalf("tools = %+v", got.Tools)
	}
}

func TestJSONWebSearchRefusesAnAnswerThatNeverSearched(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"stop_reason":"end_turn","content":[{"type":"text","text":"{\"name\":\"Guess\"}"}]}`))
	}))
	defer server.Close()

	_, _, err := newTestClient(server.URL).JSONWebSearch(context.Background(), "s", "u", json.RawMessage(`{}`))
	if !errors.Is(err, ErrNoSearch) {
		t.Fatalf("err = %v", err)
	}
}

func TestJSONWebSearchResumesAPausedTurn(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var got messagesRequest
		_ = json.NewDecoder(r.Body).Decode(&got)
		if calls.Add(1) == 1 {
			_, _ = w.Write([]byte(`{"stop_reason":"pause_turn","content":[{"type":"server_tool_use","id":"s1","name":"web_search","input":{}}]}`))
			return
		}
		if len(got.Messages) != 2 || got.Messages[1].Role != "assistant" {
			t.Errorf("resumed messages = %v", got.Messages)
		}
		_, _ = w.Write([]byte(`{"stop_reason":"end_turn","content":[{"type":"text","text":"{\"name\":\"Acme\"}"}]}`))
	}))
	defer server.Close()

	answer, _, err := newTestClient(server.URL).JSONWebSearch(context.Background(), "s", "u", json.RawMessage(`{}`))
	if err != nil || string(answer) != `{"name":"Acme"}` || calls.Load() != 2 {
		t.Fatalf("answer = %s err = %v calls = %d", answer, err, calls.Load())
	}
}

func TestMissingKeyMatchesOpenAIError(t *testing.T) {
	client := New(config.DeepSeek{Model: "deepseek-flash"})
	if _, _, err := client.JSONWebSearch(context.Background(), "s", "u", nil); !errors.Is(err, openai.ErrMissingAPIKey) {
		t.Fatalf("search err = %v", err)
	}
	if _, err := client.JSON(context.Background(), "s", "u", nil); !errors.Is(err, openai.ErrMissingAPIKey) || !strings.Contains(err.Error(), "DEEPSEEK_API_KEY") {
		t.Fatalf("json err = %v", err)
	}
}
