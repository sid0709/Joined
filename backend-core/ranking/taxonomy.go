package ranking

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
)

// maxOccupations is how many job families one title or profile maps to.
const maxOccupations = 3

//go:embed data/occupations.json
var occupationsJSON []byte

//go:embed data/skills.json
var skillsJSON []byte

// Occupation is one job family: a stable id, its O*NET-SOC code where one exists,
// and the title phrases that name it.
type Occupation struct {
	ID      string   `json:"id"`
	SOC     string   `json:"soc"`
	Title   string   `json:"title"`
	Aliases []string `json:"aliases"`
	Related []string `json:"related"`
}

type skillEntry struct {
	ID      string   `json:"id"`
	Aliases []string `json:"aliases"`
}

// Taxonomy maps free-text titles to job families and skill names to canonical ids.
type Taxonomy struct {
	occupations []Occupation
	byID        map[string]int
	related     map[string]map[string]struct{}
	// titlePhrases maps a folded alias phrase to its occupation index.
	titlePhrases map[string]int
	skillPhrases map[string]string
	maxTitleLen  int
	maxSkillLen  int
}

var (
	defaultTaxonomy     *Taxonomy
	defaultTaxonomyErr  error
	defaultTaxonomyOnce sync.Once
)

// DefaultTaxonomy is the taxonomy shipped with the package, parsed once.
func DefaultTaxonomy() *Taxonomy {
	defaultTaxonomyOnce.Do(func() {
		defaultTaxonomy, defaultTaxonomyErr = NewTaxonomy(occupationsJSON, skillsJSON)
	})
	if defaultTaxonomyErr != nil {
		// The data files are embedded and covered by tests; a parse failure is a build bug.
		panic(defaultTaxonomyErr)
	}
	return defaultTaxonomy
}

// NewTaxonomy parses occupation and skill JSON.
func NewTaxonomy(occupationData, skillData []byte) (*Taxonomy, error) {
	var occupations []Occupation
	if err := json.Unmarshal(occupationData, &occupations); err != nil {
		return nil, fmt.Errorf("parse occupations: %w", err)
	}
	var skills []skillEntry
	if err := json.Unmarshal(skillData, &skills); err != nil {
		return nil, fmt.Errorf("parse skills: %w", err)
	}
	t := &Taxonomy{
		occupations:  occupations,
		byID:         make(map[string]int, len(occupations)),
		related:      make(map[string]map[string]struct{}, len(occupations)),
		titlePhrases: map[string]int{},
		skillPhrases: map[string]string{},
	}
	for i, occupation := range occupations {
		if occupation.ID == "" {
			return nil, fmt.Errorf("occupation %d has no id", i)
		}
		if _, dup := t.byID[occupation.ID]; dup {
			return nil, fmt.Errorf("duplicate occupation id %q", occupation.ID)
		}
		t.byID[occupation.ID] = i
		for _, alias := range append([]string{occupation.Title}, occupation.Aliases...) {
			phrase := Phrase(alias)
			if phrase == "" {
				continue
			}
			if _, taken := t.titlePhrases[phrase]; !taken {
				t.titlePhrases[phrase] = i
			}
			t.maxTitleLen = max(t.maxTitleLen, len(strings.Fields(phrase)))
		}
	}
	for _, occupation := range occupations {
		set := map[string]struct{}{}
		for _, other := range occupation.Related {
			if _, ok := t.byID[other]; !ok {
				return nil, fmt.Errorf("occupation %q relates to unknown %q", occupation.ID, other)
			}
			set[other] = struct{}{}
		}
		t.related[occupation.ID] = set
	}
	for _, skill := range skills {
		for _, alias := range append([]string{skill.ID}, skill.Aliases...) {
			phrase := Phrase(alias)
			if phrase == "" {
				continue
			}
			if _, taken := t.skillPhrases[phrase]; !taken {
				t.skillPhrases[phrase] = skill.ID
			}
			t.maxSkillLen = max(t.maxSkillLen, len(strings.Fields(phrase)))
		}
	}
	return t, nil
}

// Occupation returns the family with id.
func (t *Taxonomy) Occupation(id string) (Occupation, bool) {
	i, ok := t.byID[id]
	if !ok {
		return Occupation{}, false
	}
	return t.occupations[i], true
}

// Occupations lists every family in file order.
func (t *Taxonomy) Occupations() []Occupation {
	return t.occupations
}

type phraseMatch struct {
	index    int
	length   int
	position int
}

// ClassifyTitle returns up to maxOccupations family ids for a job title, best first:
// the longest alias phrase found wins, then the earliest.
func (t *Taxonomy) ClassifyTitle(title string) []string {
	terms := Tokens(title)
	if len(terms) == 0 {
		return nil
	}
	best := map[int]phraseMatch{}
	for start := range terms {
		for n := min(t.maxTitleLen, len(terms)-start); n >= 1; n-- {
			phrase := strings.Join(terms[start:start+n], " ")
			index, ok := t.titlePhrases[phrase]
			if !ok {
				continue
			}
			current, seen := best[index]
			if !seen || n > current.length || (n == current.length && start < current.position) {
				best[index] = phraseMatch{index: index, length: n, position: start}
			}
			break
		}
	}
	matches := make([]phraseMatch, 0, len(best))
	for _, match := range best {
		matches = append(matches, match)
	}
	sort.Slice(matches, func(i, j int) bool {
		if matches[i].length != matches[j].length {
			return matches[i].length > matches[j].length
		}
		if matches[i].position != matches[j].position {
			return matches[i].position < matches[j].position
		}
		return matches[i].index < matches[j].index
	})
	out := make([]string, 0, min(len(matches), maxOccupations))
	for _, match := range matches {
		out = append(out, t.occupations[match.index].ID)
		if len(out) == maxOccupations {
			break
		}
	}
	return out
}

// OccupationAffinity is 1 when two family sets share a family, 0.5 when they are
// related, and 0 otherwise.
func (t *Taxonomy) OccupationAffinity(a, b []string) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	best := 0.0
	for _, x := range a {
		for _, y := range b {
			if x == y {
				return 1
			}
			if _, ok := t.related[x][y]; ok {
				best = relatedAffinity
			}
		}
	}
	return best
}

// relatedAffinity is the credit for a neighboring family (ML engineer ↔ data scientist).
const relatedAffinity = 0.5

// CanonicalSkill maps a skill name to its canonical id. Unknown skills keep their
// folded phrase, so two postings that both say "Terraform Cloud" still match.
func (t *Taxonomy) CanonicalSkill(name string) string {
	phrase := Phrase(name)
	if phrase == "" {
		return ""
	}
	if id, ok := t.skillPhrases[phrase]; ok {
		return id
	}
	return phrase
}

// SkillIDs canonicalizes and de-duplicates a skill list, keeping order.
func (t *Taxonomy) SkillIDs(names []string) []string {
	out := make([]string, 0, len(names))
	seen := make(map[string]struct{}, len(names))
	for _, name := range names {
		id := t.CanonicalSkill(name)
		if id == "" {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

// SkillsIn finds known skills mentioned anywhere in free text (a query, a headline).
func (t *Taxonomy) SkillsIn(text string) []string {
	terms := Tokens(text)
	out := []string{}
	seen := map[string]struct{}{}
	for start := 0; start < len(terms); {
		matched := 0
		for n := min(t.maxSkillLen, len(terms)-start); n >= 1; n-- {
			id, ok := t.skillPhrases[strings.Join(terms[start:start+n], " ")]
			if !ok {
				continue
			}
			if _, dup := seen[id]; !dup {
				seen[id] = struct{}{}
				out = append(out, id)
			}
			matched = n
			break
		}
		if matched == 0 {
			matched = 1
		}
		start += matched
	}
	return out
}
