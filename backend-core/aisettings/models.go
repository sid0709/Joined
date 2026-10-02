package aisettings

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/llmhttp"
)

const (
	listTimeout = 15 * time.Second
	// maxModelsBody bounds the provider's answer; a full model list is far smaller.
	maxModelsBody = 4 << 20
)

// ErrNoKey is returned when there is no API key to list models with.
var ErrNoKey = errors.New("no API key to list models with")

// notChat marks model ids that are not chat models Acorn could use.
var notChat = []string{
	"audio", "realtime", "transcribe", "tts", "image", "embedding", "moderation",
	"whisper", "dall-e", "search", "instruct", "davinci", "babbage", "computer-use",
}

var modelsClient = llmhttp.NewClient(listTimeout)

// ListModels asks the provider (an OpenAI-compatible baseURL) which models the key
// can use and returns the chat models, newest first. The list comes from the provider
// so it never goes stale: new models appear as soon as the provider ships them.
func ListModels(ctx context.Context, baseURL, apiKey string) ([]string, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, ErrNoKey
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(baseURL, "/")+"/models", nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+apiKey)
	response, err := modelsClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized {
		return nil, errors.New("the provider rejected the API key")
	}
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return nil, fmt.Errorf("the provider answered %d", response.StatusCode)
	}
	var body struct {
		Data []struct {
			ID      string `json:"id"`
			Created int64  `json:"created"`
		} `json:"data"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(nil, response.Body, maxModelsBody)).Decode(&body); err != nil {
		return nil, errors.New("the provider's model list was not understood")
	}
	type entry struct {
		id      string
		created int64
	}
	all := make([]entry, 0, len(body.Data))
	for _, item := range body.Data {
		if id := strings.TrimSpace(item.ID); id != "" {
			all = append(all, entry{id, item.Created})
		}
	}
	sort.SliceStable(all, func(i, j int) bool {
		if all[i].created != all[j].created {
			return all[i].created > all[j].created
		}
		return all[i].id < all[j].id
	})
	chat, every := []string{}, []string{}
	for _, item := range all {
		every = append(every, item.id)
		if isChatModel(item.id) {
			chat = append(chat, item.id)
		}
	}
	// A provider whose ids don't look like OpenAI's still gets a usable list.
	if len(chat) == 0 {
		return every, nil
	}
	return chat, nil
}

func isChatModel(id string) bool {
	id = strings.ToLower(id)
	if !strings.HasPrefix(id, "gpt-") && !strings.HasPrefix(id, "chatgpt-") && !isReasoningID(id) {
		return false
	}
	return !slices.ContainsFunc(notChat, func(word string) bool { return strings.Contains(id, word) })
}

// isReasoningID matches ids like o3 and o4-mini.
func isReasoningID(id string) bool {
	return len(id) >= 2 && id[0] == 'o' && id[1] >= '0' && id[1] <= '9'
}

// Options returns the models to offer: each non-blank model once, in order.
func Options(models ...string) []string {
	options := make([]string, 0, len(models))
	for _, model := range models {
		if model != "" && !slices.Contains(options, model) {
			options = append(options, model)
		}
	}
	return options
}
