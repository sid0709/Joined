package deepseek

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/Joined/backend-core/config"
	"github.com/sid0709/Joined/backend-core/openai"
)

const searchedReply = `{
  "choices": [{
    "message": {
      "content": "{\"name\":\"Acme\"}",
      "annotations": [
        {"type": "url_citation", "url_citation": {"url": "https://acme.example/about#team"}},
        {"type": "url_citation", "url_citation": {"url": "https://acme.example/careers"}},
        {"type": "url_citation", "url_citation": {"url": "https://acme.example/about?utm_source=x"}}
      ]
    }
  }]
}`

func newTestClient(url string) *Client {
	return New(config.OpenRouter{APIKey: "key", Model: "deepseek/deepseek-chat", BaseURL: url})
}

func TestJSONWebSearchSendsWebPluginAndReadsAnswer(t *testing.T) {
	var got map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != completionsPath || r.Header.Get("Authorization") != "Bearer key" {
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
	plugins := got["plugins"].([]any)
	search := plugins[0].(map[string]any)
	if search["id"] != webPluginID || got["model"] != "deepseek/deepseek-chat" {
		t.Fatalf("request = %v", got)
	}
	if search["max_results"] != float64(config.DefaultOpenRouterMaxSearches) {
		t.Fatalf("max_results = %v, want the default %d", search["max_results"], config.DefaultOpenRouterMaxSearches)
	}
	messages := got["messages"].([]any)
	system := messages[0].(map[string]any)["content"].(string)
	if !strings.HasPrefix(system, "be exact") || !strings.Contains(system, `{"type":"object"}`) {
		t.Fatalf("system = %q", system)
	}
}

func TestJSONWebSearchSendsABatchModelToTheBatchAPI(t *testing.T) {
	var got struct {
		Endpoint string `json:"endpoint"`
		Model    string `json:"model"`
		Requests []struct {
			Body struct {
				Model string `json:"model"`
				Tools []struct {
					Type string `json:"type"`
				} `json:"tools"`
			} `json:"body"`
		} `json:"requests"`
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/batches":
			_ = json.NewDecoder(r.Body).Decode(&got)
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"id":"batch_1","status":"validating"}`))
		case "/batches/batch_1":
			_, _ = w.Write([]byte(`{"id":"batch_1","status":"completed","results":[{"custom_id":"request","response":{"status_code":200,"body":{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{\"name\":\"Acme\"}"}]}]}}}]}`))
		default:
			t.Errorf("path = %q", r.URL.Path)
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := New(config.OpenRouter{APIKey: "key", Model: "openai/gpt-6-luna:batch", BaseURL: server.URL})
	answer, _, err := client.JSONWebSearch(context.Background(), "s", "Acme", json.RawMessage(`{"type":"object"}`))
	if err != nil {
		t.Fatal(err)
	}
	if string(answer) != `{"name":"Acme"}` || client.Model() != "openai/gpt-6-luna:batch" {
		t.Fatalf("answer = %s model = %q", answer, client.Model())
	}
	if got.Endpoint != "/v1/responses" || got.Model != "openai/gpt-6-luna" || len(got.Requests) != 1 || got.Requests[0].Body.Model != "openai/gpt-6-luna" {
		t.Fatalf("batch = %+v", got)
	}
	if len(got.Requests[0].Body.Tools) != 1 || got.Requests[0].Body.Tools[0].Type != "web_search" {
		t.Fatalf("tools = %+v", got.Requests[0].Body.Tools)
	}
}

func TestJSONWebSearchLeavesThePluginOffForSonar(t *testing.T) {
	var got map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != completionsPath {
			t.Errorf("path = %q", r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(`{"citations":["https://acme.example/about?utm_source=x"],"choices":[{"message":{"content":"{\"name\":\"Acme\"}"}}]}`))
	}))
	defer server.Close()

	client := New(config.OpenRouter{APIKey: "key", Model: "perplexity/sonar-pro", BaseURL: server.URL})
	answer, sources, err := client.JSONWebSearch(context.Background(), "search", "Acme", json.RawMessage(`{"type":"object"}`))
	if err != nil {
		t.Fatal(err)
	}
	if string(answer) != `{"name":"Acme"}` || len(sources) != 1 || sources[0] != "https://acme.example/about" {
		t.Fatalf("answer = %s sources = %v", answer, sources)
	}
	if got["model"] != "perplexity/sonar-pro" || got["plugins"] != nil {
		t.Fatalf("request = %v", got)
	}
}

func TestJSONWebSearchCapsSearchesAsConfigured(t *testing.T) {
	var got struct {
		Plugins []struct {
			MaxResults int `json:"max_results"`
		} `json:"plugins"`
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(searchedReply))
	}))
	defer server.Close()

	client := New(config.OpenRouter{APIKey: "key", Model: "openai/gpt-4o-mini", BaseURL: server.URL, MaxSearches: 2})
	if _, _, err := client.JSONWebSearch(context.Background(), "", "Acme", json.RawMessage(`{}`)); err != nil {
		t.Fatal(err)
	}
	if len(got.Plugins) != 1 || got.Plugins[0].MaxResults != 2 {
		t.Fatalf("plugins = %+v", got.Plugins)
	}
}

func TestJSONWebSearchAllowsAnAnswerWithoutCitations(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"name\":\"Guess\"}"}}]}`))
	}))
	defer server.Close()

	answer, sources, err := newTestClient(server.URL).JSONWebSearch(context.Background(), "s", "u", json.RawMessage(`{}`))
	if err != nil || string(answer) != `{"name":"Guess"}` || len(sources) != 0 {
		t.Fatalf("answer = %s sources = %v err = %v", answer, sources, err)
	}
}

func TestMissingKeyMatchesOpenAIError(t *testing.T) {
	client := New(config.OpenRouter{Model: "deepseek/deepseek-chat"})
	if _, _, err := client.JSONWebSearch(context.Background(), "s", "u", nil); !errors.Is(err, openai.ErrMissingAPIKey) {
		t.Fatalf("search err = %v", err)
	}
	if _, err := client.JSON(context.Background(), "s", "u", nil); !errors.Is(err, openai.ErrMissingAPIKey) || !strings.Contains(err.Error(), "OPENROUTER_API_KEY") {
		t.Fatalf("json err = %v", err)
	}
}
