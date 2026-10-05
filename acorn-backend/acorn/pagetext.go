package acorn

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// PageTextMaxChars caps the page text sent to the model for JD extraction.
const PageTextMaxChars = 20_000

var (
	whitespace = regexp.MustCompile(`\s+`)
	skipTags   = map[string]bool{"input": true, "select": true, "textarea": true, "button": true, "option": true, "script": true, "style": true, "noscript": true}
)

func capText(value string) string {
	runes := []rune(value)
	if len(runes) > PageTextMaxChars {
		return string(runes[:PageTextMaxChars])
	}
	return value
}

// visibleText flattens a pure tree into the text a reader would see.
func visibleText(node map[string]any, title, url string) string {
	var chunks []string
	var walk func(map[string]any)
	walk = func(n map[string]any) {
		tag, _ := n["tag"].(string)
		if skipTags[strings.ToLower(tag)] {
			return
		}
		if text, _ := n["text"].(string); strings.TrimSpace(text) != "" {
			chunks = append(chunks, strings.TrimSpace(text))
		}
		children, _ := n["children"].([]any)
		for _, child := range children {
			if row, ok := child.(map[string]any); ok {
				walk(row)
			}
		}
	}
	walk(node)
	body := strings.TrimSpace(whitespace.ReplaceAllString(strings.Join(chunks, " "), " "))
	if body == "" {
		return ""
	}
	var parts []string
	if title = strings.TrimSpace(title); title != "" {
		parts = append(parts, title)
	}
	if url = strings.TrimSpace(url); url != "" {
		parts = append(parts, url)
	}
	parts = append(parts, body)
	return capText(strings.Join(parts, "\n\n"))
}

// MetaToPageText turns a Custom list item's meta (a string or a DOM-like tree)
// into extract-jd input text.
func MetaToPageText(meta any) string {
	switch value := meta.(type) {
	case nil:
		return ""
	case string:
		return capText(strings.TrimSpace(value))
	case float64, bool:
		return capText(fmt.Sprint(value))
	case map[string]any:
		if _, ok := value["tag"].(string); ok {
			title, _ := value["title"].(string)
			url, _ := value["url"].(string)
			return visibleText(value, title, url)
		}
		if value["metaTree"] != nil {
			return MetaToPageText(value["metaTree"])
		}
		if value["meta"] != nil {
			return MetaToPageText(value["meta"])
		}
		if text, ok := value["text"].(string); ok {
			if _, hasChildren := value["children"].([]any); !hasChildren {
				return capText(strings.TrimSpace(text))
			}
		}
	}
	data, err := json.Marshal(meta)
	if err != nil {
		return ""
	}
	return capText(string(data))
}
