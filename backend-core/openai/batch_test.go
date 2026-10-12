package openai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJSONRoutesBatchModelsFromAnyProvider(t *testing.T) {
	cases := []struct {
		model string
		slug  string
	}{
		{"openai/gpt-6-luna:batch", "openai/gpt-6-luna"},
		{"openai/gpt-6-luna:nitro:batch", "openai/gpt-6-luna:nitro"},
		{"anthropic/claude-sonnet-5:batch", "anthropic/claude-sonnet-5"},
		{"google/gemini-2.5-flash:batch", "google/gemini-2.5-flash"},
	}
	for _, tc := range cases {
		t.Run(tc.model, func(t *testing.T) {
			var got struct {
				Endpoint string `json:"endpoint"`
				Model    string `json:"model"`
				Requests []struct {
					Body struct {
						Model string `json:"model"`
					} `json:"body"`
				} `json:"requests"`
			}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/batches":
					if r.Method != http.MethodPost {
						t.Errorf("method = %s", r.Method)
					}
					_ = json.NewDecoder(r.Body).Decode(&got)
					w.WriteHeader(http.StatusAccepted)
					_, _ = w.Write([]byte(`{"id":"batch_1","status":"validating"}`))
				case "/batches/batch_1":
					_, _ = w.Write([]byte(`{"id":"batch_1","status":"completed","results":[{"custom_id":"request","response":{"status_code":200,"body":{"choices":[{"message":{"content":"{\"ok\":true}"}}]}}}]}`))
				default:
					t.Errorf("path = %q", r.URL.Path)
					http.NotFound(w, r)
				}
			}))
			defer server.Close()

			client := New("key", tc.model, server.URL).ForProvider(ErrMissingAPIKey, true, true).OpenRouter()
			out, err := client.JSON(context.Background(), "sys", "user", json.RawMessage(`{"type":"object"}`))
			if err != nil {
				t.Fatal(err)
			}
			if string(out) != `{"ok":true}` || client.Model() != tc.model {
				t.Fatalf("out = %s model = %q", out, client.Model())
			}
			if got.Endpoint != "/v1/chat/completions" || got.Model != tc.slug || len(got.Requests) != 1 || got.Requests[0].Body.Model != tc.slug {
				t.Fatalf("batch = %+v", got)
			}
		})
	}
}

func TestBatchSlugKeepsOtherSuffixes(t *testing.T) {
	if !IsBatchCatalog("openai/gpt-6-luna:batch") || IsBatchCatalog("openai/gpt-6-luna:nitro") || IsBatchCatalog("poolside/laguna:free") {
		t.Fatal("batch catalog detection")
	}
	if batchSlug("anthropic/claude-sonnet-5:batch:nitro") != "anthropic/claude-sonnet-5:nitro" {
		t.Fatalf("slug = %s", batchSlug("anthropic/claude-sonnet-5:batch:nitro"))
	}
}
