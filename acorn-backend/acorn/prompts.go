// Package acorn is the Acorn extension's brain: it plans form fills, matches dropdown
// options, answers free-text questions, and extracts job postings, all from the
// signed-in job hunter's Joined profile.
package acorn

import (
	"embed"
	"strings"
)

//go:embed prompts/*.txt
var promptFiles embed.FS

func prompt(name string) string {
	data, err := promptFiles.ReadFile("prompts/" + name + ".txt")
	if err != nil {
		panic("acorn: missing prompt " + name)
	}
	return string(data)
}

var (
	analyzeSystem     = prompt("analyze_system")
	analyzeUserTail   = strings.TrimSpace(prompt("analyze_user_tail"))
	matchOptionSystem = prompt("match_option_system")
	proseSystem       = prompt("prose_system")
	identitySystem    = prompt("identity_system")
	extractJDSystem   = prompt("extract_jd_system")
)
