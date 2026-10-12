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
