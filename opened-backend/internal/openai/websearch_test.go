package openai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const replyWithSources = `{
  "status": "completed",
  "output": [
    {"type": "web_search_call", "id": "ws_1", "status": "completed"},
    {"type": "message", "content": [{
      "type": "output_text",
      "text": "{\"name\":\"Acme\"}",
      "annotations": [
        {"type": "url_citation", "url": "https://acme.example/about?utm_source=x#team", "title": "About"},
        {"type": "url_citation", "url": "https://acme.example/about"},
        {"type": "url_citation", "url": "javascript:alert(1)"},
        {"type": "file_citation", "url": "https://ignored.example"}
      ]
    }]}
  ]
}`

func TestJSONWebSearchSendsSearchToolAndSchema(t *testing.T) {
	var got map[string]any
	var path, auth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(replyWithSources))
	}))
	defer server.Close()

	client := New("key", "main-model", server.URL).WithSearchModel("search-model")
	text, sources, err := client.JSONWebSearch(context.Background(), "be exact", "Acme, acme.example", json.RawMessage(`{"type":"object"}`))
	if err != nil {
		t.Fatal(err)
	}
	if path != "/responses" || auth != "Bearer key" {
		t.Fatalf("path = %q auth = %q", path, auth)
	}
	if got["model"] != "search-model" || got["instructions"] != "be exact" || got["input"] != "Acme, acme.example" {
		t.Fatalf("request = %v", got)
	}
	tools, _ := got["tools"].([]any)
	if len(tools) != 1 || tools[0].(map[string]any)["type"] != "web_search" {
		t.Fatalf("tools = %v", got["tools"])
	}
	format := got["text"].(map[string]any)["format"].(map[string]any)
	if format["type"] != "json_schema" || format["strict"] != true {
		t.Fatalf("format = %v", format)
	}
	if string(text) != `{"name":"Acme"}` {
		t.Fatalf("text = %s", text)
	}
	if len(sources) != 1 || sources[0] != "https://acme.example/about" {
		t.Fatalf("sources = %v", sources)
	}
}

func TestJSONWebSearchFallsBackToTheMainModel(t *testing.T) {
	var model any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		model = body["model"]
		_, _ = w.Write([]byte(replyWithSources))
	}))
	defer server.Close()
	if _, _, err := New("key", "main-model", server.URL).JSONWebSearch(context.Background(), "s", "u", json.RawMessage(`{}`)); err != nil {
		t.Fatal(err)
	}
	if model != "main-model" {
		t.Fatalf("model = %v", model)
	}
}

func TestJSONWebSearchErrors(t *testing.T) {
	if _, _, err := New("", "m", "http://unused").JSONWebSearch(context.Background(), "s", "u", nil); err != ErrMissingAPIKey {
		t.Fatalf("err = %v", err)
	}
	cases := map[string]struct {
		status int
		body   string
		want   string
	}{
		"api error":  {http.StatusBadRequest, `{"error":{"message":"model does not support web search"}}`, "does not support web search"},
		"refusal":    {http.StatusOK, `{"status":"completed","output":[{"type":"message","content":[{"type":"refusal","refusal":"no"}]}]}`, "declined"},
		"incomplete": {http.StatusOK, `{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"},"output":[]}`, "did not finish"},
		"empty":      {http.StatusOK, `{"status":"completed","output":[{"type":"web_search_call"}]}`, "empty answer"},
	}
	for name, tc := range cases {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tc.status)
			_, _ = w.Write([]byte(tc.body))
		}))
		_, _, err := New("key", "m", server.URL).JSONWebSearch(context.Background(), "s", "u", json.RawMessage(`{}`))
		server.Close()
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Fatalf("%s: err = %v, want %q", name, err, tc.want)
		}
	}
}
