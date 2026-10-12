package deepseek

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sid0709/Joined/backend-core/config"
)

func TestDecidePostsBesideTheV1API(t *testing.T) {
	var got decisionsRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != decisionsPath || r.Header.Get("Authorization") != "Bearer key" {
			t.Errorf("path = %q", r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(`{"answers":{"visa":{"type":"noul","noul":0.91}},"model":"typesafe/jev-1.13"}`))
	}))
	defer server.Close()

	client := New(config.OpenRouter{APIKey: "key", Model: "typesafe/jev-1.13", BaseURL: server.URL + apiVersionSuffix})
	answers, err := client.Decide(context.Background(), "Title: Engineer", json.RawMessage(`{"visa":{"type":"noul"}}`))
	if err != nil {
		t.Fatal(err)
	}
	if got.Model != "typesafe/jev-1.13" || got.State != "Title: Engineer" || !json.Valid(answers) {
		t.Fatalf("request = %+v answers = %s", got, answers)
	}
}
