package ranking

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/sid0709/Joined/backend-core/jobschema"
)

// Suggestion kinds: each names the filter a chip would turn on.
const (
	SuggestWorkplace  = "workplace"
	SuggestSeniority  = "seniority"
	SuggestEmployment = "employment"
	SuggestVisa       = "visa"
	SuggestPosted     = "postedDays"
	SuggestPay        = "minPay"
)

// Suggestion is a filter the query implies. The UI offers it as a chip; it is
// never applied on its own, so a query never silently narrows the results.
type Suggestion struct {
	Kind  string `json:"kind"`
	Value string `json:"value"`
	Label string `json:"label"`
}

// Parsed is what query understanding reads from a typed query.
type Parsed struct {
	// Text is the query as typed, trimmed; it is what retrieval embeds.
	Text string
	// Phrase is the folded terms, for exact title and company matching.
	Phrase      string
	Skills      []string
	Occupations []string
	Suggestions []Suggestion
	// Core is the folded query without the words that only imply a filter
	// ("remote", "senior", "contract", "full time", "$150k"): what a job's title,
	// skills, or company must carry for a keyword-only match.
	Core string
}

var (
	payPattern   = regexp.MustCompile(`(?i)\$?\s?(\d{2,3})(?:,000|k)\+?`)
	postedPhrase = map[string]int{"today": 1, "past 24 hours": 1, "this week": 7, "past week": 7, "new": 7, "recent": 7, "newest": 7}
)

// queryWords map single folded words to the filter they imply.
var queryWords = map[string]Suggestion{
	"remote":      {Kind: SuggestWorkplace, Value: jobschema.WorkplaceRemote, Label: "Remote"},
	"wfh":         {Kind: SuggestWorkplace, Value: jobschema.WorkplaceRemote, Label: "Remote"},
	"hybrid":      {Kind: SuggestWorkplace, Value: jobschema.WorkplaceHybrid, Label: "Hybrid"},
	"onsite":      {Kind: SuggestWorkplace, Value: jobschema.WorkplaceOnsite, Label: "On-site"},
	"on-site":     {Kind: SuggestWorkplace, Value: jobschema.WorkplaceOnsite, Label: "On-site"},
	"junior":      {Kind: SuggestSeniority, Value: jobschema.SeniorityJunior, Label: "Junior"},
	"entry":       {Kind: SuggestSeniority, Value: jobschema.SeniorityJunior, Label: "Junior"},
	"intern":      {Kind: SuggestSeniority, Value: jobschema.SeniorityJunior, Label: "Junior"},
	"graduate":    {Kind: SuggestSeniority, Value: jobschema.SeniorityJunior, Label: "Junior"},
	"mid":         {Kind: SuggestSeniority, Value: jobschema.SeniorityMiddle, Label: "Middle"},
	"senior":      {Kind: SuggestSeniority, Value: jobschema.SenioritySenior, Label: "Senior"},
	"staff":       {Kind: SuggestSeniority, Value: jobschema.SeniorityLeader, Label: "Lead"},
	"principal":   {Kind: SuggestSeniority, Value: jobschema.SeniorityLeader, Label: "Lead"},
	"contract":    {Kind: SuggestEmployment, Value: jobschema.EmploymentContract, Label: "Contract"},
	"contractor":  {Kind: SuggestEmployment, Value: jobschema.EmploymentContract, Label: "Contract"},
	"freelance":   {Kind: SuggestEmployment, Value: jobschema.EmploymentContract, Label: "Contract"},
	"part-time":   {Kind: SuggestEmployment, Value: jobschema.EmploymentPartTime, Label: "Part-time"},
	"visa":        {Kind: SuggestVisa, Value: "true", Label: "Visa sponsor"},
	"sponsorship": {Kind: SuggestVisa, Value: "true", Label: "Visa sponsor"},
	"h1b":         {Kind: SuggestVisa, Value: "true", Label: "Visa sponsor"},
}

// ParseQuery reads skills, families, and implied filters from a typed query.
func ParseQuery(query string, tax *Taxonomy) Parsed {
	text := strings.TrimSpace(query)
	p := Parsed{Text: text, Phrase: Phrase(text)}
	if text == "" {
		return p
	}
	p.Skills = tax.SkillsIn(text)
	p.Occupations = tax.ClassifyTitle(text)
	seen := map[string]struct{}{}
	add := func(s Suggestion) {
		key := s.Kind + "=" + s.Value
		if _, dup := seen[key]; !dup {
			seen[key] = struct{}{}
			p.Suggestions = append(p.Suggestions, s)
		}
	}
	folded := Fold(text)
	for _, word := range strings.Fields(folded) {
		if s, ok := queryWords[word]; ok {
			add(s)
		}
	}
	for _, phrase := range []string{"part time", "full time"} {
		if strings.Contains(" "+folded+" ", " "+phrase+" ") {
			if phrase == "part time" {
				add(queryWords["part-time"])
			} else {
				add(Suggestion{Kind: SuggestEmployment, Value: jobschema.EmploymentFullTime, Label: "Full-time"})
			}
		}
	}
	for phrase, days := range postedPhrase {
		if strings.Contains(" "+folded+" ", " "+phrase+" ") {
			label := "Past week"
			if days == 1 {
				label = "Past 24 hours"
			}
			add(Suggestion{Kind: SuggestPosted, Value: strconv.Itoa(days), Label: label})
		}
	}
	if m := payPattern.FindStringSubmatch(text); m != nil {
		if thousands, err := strconv.Atoi(m[1]); err == nil && thousands >= 20 {
			add(Suggestion{Kind: SuggestPay, Value: strconv.Itoa(thousands * payUnitUSD), Label: "$" + m[1] + "k+"})
		}
	}
	sortSuggestions(p.Suggestions)
	p.Core = coreText(text)
	return p
}

// coreText drops the filter words ParseQuery reads as suggestions.
func coreText(text string) string {
	core := " " + Fold(payPattern.ReplaceAllString(text, " ")) + " "
	for phrase := range postedPhrase {
		core = strings.ReplaceAll(core, " "+phrase+" ", " ")
	}
	for _, phrase := range []string{"part time", "full time"} {
		core = strings.ReplaceAll(core, " "+phrase+" ", " ")
	}
	words := strings.Fields(core)
	kept := words[:0]
	for _, word := range words {
		if _, filter := queryWords[word]; !filter {
			kept = append(kept, word)
		}
	}
	return strings.Join(kept, " ")
}

// suggestionOrder keeps chips in the order the filter bar shows them.
var suggestionOrder = map[string]int{SuggestWorkplace: 0, SuggestSeniority: 1, SuggestEmployment: 2, SuggestVisa: 3, SuggestPosted: 4, SuggestPay: 5}

func sortSuggestions(s []Suggestion) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && suggestionOrder[s[j].Kind] < suggestionOrder[s[j-1].Kind]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}

// Unapplied drops suggestions the filter already applies.
func Unapplied(suggestions []Suggestion, f Filter) []Suggestion {
	out := make([]Suggestion, 0, len(suggestions))
	for _, s := range suggestions {
		applied := false
		switch s.Kind {
		case SuggestWorkplace:
			w, _ := ParseWorkplace(s.Value)
			applied = containsValue(f.Workplaces, w)
		case SuggestSeniority:
			applied = containsValue(f.Seniorities, ParseLevel(s.Value))
		case SuggestEmployment:
			e, _ := ParseEmployment(s.Value)
			applied = containsValue(f.Employments, e)
		case SuggestVisa:
			applied = f.VisaOnly
		case SuggestPosted:
			applied = !f.PostedAfter.IsZero()
		case SuggestPay:
			floor, _ := strconv.Atoi(s.Value)
			applied = f.PayMinUSD >= int32(floor)
		}
		if !applied {
			out = append(out, s)
		}
	}
	return out
}
