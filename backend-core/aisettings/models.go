package aisettings

import "slices"

// Models are the chat models staff can pick for Acorn, in the order the console
// lists them. Every one speaks the chat-completions JSON-schema output Acorn needs.
// Add a model here and it appears in the dropdown.
var Models = []string{
	"gpt-4o-mini",
	"gpt-4o",
	"gpt-4.1-mini",
	"gpt-4.1",
	"o4-mini",
}

// Options returns Models plus each extra model not already listed: the one the
// environment configures and the one saved, so neither disappears from the dropdown.
func Options(extra ...string) []string {
	options := slices.Clone(Models)
	for _, model := range extra {
		if model != "" && !slices.Contains(options, model) {
			options = append(options, model)
		}
	}
	return options
}
