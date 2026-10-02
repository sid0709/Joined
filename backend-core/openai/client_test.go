package openai

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const chatReply = `{"choices":[{"message":{"content":"{\"ok\":true}"}}]}`

func captureChat(t *testing.T) (*httptest.Server, *map[string]any) {
	t.Helper()
	var got map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Errorf("path = %q", r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(chatReply))
	}))
	t.Cleanup(server.Close)
	return server, &got
}

func TestJSONSendsStrictSchemaByDefault(t *testing.T) {
	server, got := captureChat(t)
	if _, err := New("key", "m", server.URL).JSON(context.Background(), "sys", "user", json.RawMessage(`{"type":"object"}`)); err != nil {
		t.Fatal(err)
	}
	format := (*got)["response_format"].(map[string]any)
	if format["type"] != "json_schema" || (*got)["thinking"] != nil {
		t.Fatalf("request = %v", *got)
	}
}

func TestJSONObjectModePutsSchemaInPromptAndDisablesThinking(t *testing.T) {
	server, got := captureChat(t)
	client := New("key", "m", server.URL).ForProvider(ErrMissingAPIKey, true, true)
	if _, err := client.JSON(context.Background(), "sys", "user", json.RawMessage(`{"type":"object"}`)); err != nil {
		t.Fatal(err)
	}
	format := (*got)["response_format"].(map[string]any)
	if format["type"] != "json_object" || format["json_schema"] != nil {
		t.Fatalf("format = %v", format)
	}
	system := (*got)["messages"].([]any)[0].(map[string]any)["content"].(string)
	if !strings.HasPrefix(system, "sys") || !strings.Contains(system, `{"type":"object"}`) {
		t.Fatalf("system = %q", system)
	}
	if (*got)["thinking"].(map[string]any)["type"] != "disabled" {
		t.Fatalf("thinking = %v", (*got)["thinking"])
	}
}

func TestJSONWithoutKeyReturnsProviderError(t *testing.T) {
	missing := errors.Join(errors.New("PROVIDER_KEY is not set"), ErrMissingAPIKey)
	_, err := New("", "m", "http://unused").ForProvider(missing, true, false).JSON(context.Background(), "s", "u", nil)
	if !errors.Is(err, ErrMissingAPIKey) || !strings.Contains(err.Error(), "PROVIDER_KEY") {
		t.Fatalf("err = %v", err)
	}
}
