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

	"github.com/sid0709/Joined/backend-core/llmhttp"
)

const (
	listTimeout = 15 * time.Second
	// maxModelsBody bounds the provider's answer; OpenRouter's catalog with
	// descriptions is large but still well under this.
	maxModelsBody = 4 << 20
	textModality  = "text"
	modelsPath    = "/models"
	newestSort    = "newest"
)

// ErrNoKey is returned when there is no API key to list models with.
var ErrNoKey = errors.New("no API key to list models with")

var modelsClient = llmhttp.NewClient(listTimeout)

// CatalogModel is one chat model from OpenRouter, with the fields the console shows.
type CatalogModel struct {
	ID              string         `json:"id"`
	Name            string         `json:"name"`
	Description     string         `json:"description"`
	ContextLength   int            `json:"contextLength"`
	Created         int64          `json:"created"`
	Pricing         CatalogPricing `json:"pricing"`
	Architecture    CatalogArch    `json:"architecture"`
	SupportedParams []string       `json:"supportedParameters"`
}

// CatalogPricing is USD per token or per request, as OpenRouter returns it.
type CatalogPricing struct {
	Prompt     string `json:"prompt"`
	Completion string `json:"completion"`
	Request    string `json:"request"`
	Image      string `json:"image"`
	WebSearch  string `json:"webSearch"`
}

// CatalogArch is the model's input and output modalities.
type CatalogArch struct {
	Modality         string   `json:"modality"`
	InputModalities  []string `json:"inputModalities"`
	OutputModalities []string `json:"outputModalities"`
}

type openRouterList struct {
	Data []openRouterModel `json:"data"`
}

type openRouterModel struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	ContextLength   int      `json:"context_length"`
	Created         int64    `json:"created"`
	SupportedParams []string `json:"supported_parameters"`
	Pricing         struct {
		Prompt     string `json:"prompt"`
		Completion string `json:"completion"`
		Request    string `json:"request"`
		Image      string `json:"image"`
		WebSearch  string `json:"web_search"`
	} `json:"pricing"`
	Architecture struct {
		Modality         string   `json:"modality"`
		InputModalities  []string `json:"input_modalities"`
		OutputModalities []string `json:"output_modalities"`
	} `json:"architecture"`
}

// ListModels asks OpenRouter which chat models the key can use and returns them
// newest first, with pricing and architecture so the console can show details.
func ListModels(ctx context.Context, baseURL, apiKey string) ([]CatalogModel, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, ErrNoKey
	}
	endpoint := strings.TrimRight(baseURL, "/") + modelsPath + "?sort=" + newestSort
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
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
	var body openRouterList
	if err := json.NewDecoder(http.MaxBytesReader(nil, response.Body, maxModelsBody)).Decode(&body); err != nil {
		return nil, errors.New("the provider's model list was not understood")
	}
	all := make([]CatalogModel, 0, len(body.Data))
	for _, item := range body.Data {
		id := strings.TrimSpace(item.ID)
		if id == "" || !isTextChat(item) {
			continue
		}
		name := strings.TrimSpace(item.Name)
		if name == "" {
			name = id
		}
		all = append(all, CatalogModel{
			ID:              id,
			Name:            name,
			Description:     strings.TrimSpace(item.Description),
			ContextLength:   item.ContextLength,
			Created:         item.Created,
			SupportedParams: slices.Clone(item.SupportedParams),
			Pricing: CatalogPricing{
				Prompt:     item.Pricing.Prompt,
				Completion: item.Pricing.Completion,
				Request:    item.Pricing.Request,
				Image:      item.Pricing.Image,
				WebSearch:  item.Pricing.WebSearch,
			},
			Architecture: CatalogArch{
				Modality:         item.Architecture.Modality,
				InputModalities:  slices.Clone(item.Architecture.InputModalities),
				OutputModalities: slices.Clone(item.Architecture.OutputModalities),
			},
		})
	}
	sort.SliceStable(all, func(i, j int) bool {
		if all[i].Created != all[j].Created {
			return all[i].Created > all[j].Created
		}
		return all[i].ID < all[j].ID
	})
	return all, nil
}

func isTextChat(item openRouterModel) bool {
	id := strings.ToLower(item.ID)
	if strings.Contains(id, "embedding") || strings.Contains(id, "whisper") || strings.Contains(id, "tts") || strings.Contains(id, "moderation") {
		return false
	}
	outputs := item.Architecture.OutputModalities
	if len(outputs) > 0 {
		return hasModality(outputs, textModality) &&
			(hasModality(item.Architecture.InputModalities, textModality) || len(item.Architecture.InputModalities) == 0)
	}
	modality := strings.ToLower(item.Architecture.Modality)
	if modality == "" {
		// A catalog row with no architecture still belongs in the list.
		return true
	}
	return strings.Contains(modality, textModality+"->"+textModality)
}

func hasModality(values []string, want string) bool {
	return slices.ContainsFunc(values, func(value string) bool {
		return strings.EqualFold(value, want)
	})
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
