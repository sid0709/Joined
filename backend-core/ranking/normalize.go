package ranking

import (
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

// Workplace is a job's work arrangement. Unknown never matches a workplace filter.
type Workplace uint8

const (
	WorkplaceUnknown Workplace = iota
	WorkplaceRemote
	WorkplaceHybrid
	WorkplaceOnsite
)

// Region is the market a job hires in (for a remote job, where it may be done from).
type Region uint8

const (
	RegionUnknown Region = iota
	RegionUS
	RegionCanada
	RegionUK
	RegionEurope
	RegionLatAm
	RegionAPAC
	RegionIndia
	RegionGlobal
)

// regionNames are the API spellings, indexed by Region.
var regionNames = [...]string{"unknown", "us", "ca", "uk", "eu", "latam", "apac", "in", "global"}

func (r Region) String() string {
	if int(r) < len(regionNames) {
		return regionNames[r]
	}
	return regionNames[RegionUnknown]
}

// ParseRegion reads an API region name.
func ParseRegion(name string) (Region, bool) {
	name = strings.ToLower(strings.TrimSpace(name))
	for i, value := range regionNames {
		if value == name && Region(i) != RegionUnknown {
			return Region(i), true
		}
	}
	return RegionUnknown, false
}

// Level indexes jobschema.Seniorities(); LevelUnknown is "not stated".
type Level uint8

// LevelUnknown is a job or profile whose seniority is not known.
const LevelUnknown Level = 0

// Employment indexes jobschema.Employments() + 1; 0 is unknown.
type Employment uint8

// Visa is whether a job sponsors work visas. The postings say yes or say nothing,
// so "no" is never asserted — a visa filter keeps only explicit yes.
type Visa uint8

const (
	VisaUnknown Visa = iota
	VisaYes
)

// Annual pay sanity bounds: anything outside is a parsing error, treated as unknown.
const (
	minPlausibleAnnualUSD = 5_000
	maxPlausibleAnnualUSD = 2_000_000
	hoursPerWorkYear      = 2080
)

// usdPerUnit converts posted currencies to US dollars. Approximate on purpose:
// it only places pay against a filter floor or a profile's salary floor.
var usdPerUnit = map[string]float64{
	"USD": 1, "CAD": 0.73, "CA$": 0.73, "EUR": 1.08, "GBP": 1.27, "AUD": 0.66, "NZD": 0.6,
	"CHF": 1.12, "INR": 0.012, "MXN": 0.055, "BRL": 0.18, "ARS": 0.0011, "PLN": 0.25,
	"TWD": 0.031, "GEL": 0.37, "SGD": 0.74, "JPY": 0.0067, "SEK": 0.095, "NOK": 0.094, "DKK": 0.145,
}

// ToAnnualUSD converts a pay figure to yearly US dollars. ok is false when the
// period or currency is unknown or the result is implausible.
func ToAnnualUSD(amount int, period, currency string) (int32, bool) {
	if amount <= 0 {
		return 0, false
	}
	rate, ok := usdPerUnit[strings.ToUpper(strings.TrimSpace(currency))]
	if !ok {
		if strings.TrimSpace(currency) != "" {
			return 0, false
		}
		rate = 1
	}
	yearly := float64(amount)
	switch strings.ToLower(strings.TrimSpace(period)) {
	case jobschema.PayHour:
		yearly *= hoursPerWorkYear
	case jobschema.PayYear, "":
	default:
		return 0, false
	}
	usd := yearly * rate
	if usd < minPlausibleAnnualUSD || usd > maxPlausibleAnnualUSD {
		return 0, false
	}
	return int32(usd), true
}

// JobFeatures is a normalized job: everything filters and the ranker read.
type JobFeatures struct {
	JobID string
	// ObjectID is the job's Mongo _id (hex), for hydration through the _id index.
	ObjectID     string
	Title        string
	TitlePhrase  string
	Company      string
	CompanyID    string
	Location     string
	Workplace    Workplace
	Region       Region
	Seniority    Level
	Employment   Employment
	PayMinUSD    int32
	PayMaxUSD    int32
	PayKnown     bool
	Visa         Visa
	PostedAt     time.Time
	Applicants   int32
	Source       string
	Hidden       bool
	Occupations  []string
	Skills       []string
	DedupeKey    string
	CompanyScore float32
	// Summary and Team feed the embedding text; the index does not keep them.
	Summary string
	Team    string
}

// NormalizeJob turns a stored job into ranking features.
func NormalizeJob(doc jobs.RankingDoc, tax *Taxonomy) JobFeatures {
	return normalizeJob(doc, tax, nil)
}

// maxMemoEntries bounds each normalization memo; a full memo starts over.
const maxMemoEntries = 500_000

// normMemo remembers the derived values that repeat across jobs (titles,
// locations, skill names), so a full reconcile of a million jobs does not redo
// the same regex and taxonomy work. Safe for one goroutine at a time.
type normMemo struct {
	titles  map[string]titleInfo
	regions map[string]Region
	skills  map[string]string
}

type titleInfo struct {
	clean       string
	phrase      string
	occupations []string
}

func newNormMemo() *normMemo {
	return &normMemo{titles: map[string]titleInfo{}, regions: map[string]Region{}, skills: map[string]string{}}
}

func (m *normMemo) title(raw string, tax *Taxonomy) titleInfo {
	if m != nil {
		if info, ok := m.titles[raw]; ok {
			return info
		}
	}
	clean := jobschema.CleanTitle(raw)
	info := titleInfo{clean: clean, phrase: Phrase(clean), occupations: tax.ClassifyTitle(clean)}
	if m != nil {
		if len(m.titles) >= maxMemoEntries {
			m.titles = map[string]titleInfo{}
		}
		m.titles[raw] = info
	}
	return info
}

func (m *normMemo) region(location string) Region {
	if m == nil {
		return DetectRegion(location)
	}
	if r, ok := m.regions[location]; ok {
		return r
	}
	r := DetectRegion(location)
	if len(m.regions) >= maxMemoEntries {
		m.regions = map[string]Region{}
	}
	m.regions[location] = r
	return r
}

func (m *normMemo) skillIDs(names []string, tax *Taxonomy) []string {
	if m == nil {
		return tax.SkillIDs(names)
	}
	out := make([]string, 0, len(names))
	for _, name := range names {
		id, ok := m.skills[name]
		if !ok {
			id = tax.CanonicalSkill(name)
			if len(m.skills) >= maxMemoEntries {
				m.skills = map[string]string{}
			}
			m.skills[name] = id
		}
		if id != "" && !containsValue(out, id) {
			out = append(out, id)
		}
	}
	return out
}

func normalizeJob(doc jobs.RankingDoc, tax *Taxonomy, memo *normMemo) JobFeatures {
	title := memo.title(doc.Title, tax)
	f := JobFeatures{
		JobID:       doc.JobID,
		ObjectID:    doc.ObjectID,
		Title:       title.clean,
		TitlePhrase: title.phrase,
		Company:     strings.TrimSpace(doc.Company),
		CompanyID:   doc.CompanyID,
		Location:    strings.TrimSpace(doc.Location),
		Workplace:   parseWorkplace(doc.Workplace),
		Region:      memo.region(doc.Location),
		Seniority:   ParseLevel(doc.Seniority),
		Employment:  parseEmployment(doc.Employment),
		Applicants:  int32(max(doc.Applicants, 0)),
		Source:      strings.ToLower(strings.TrimSpace(doc.Source)),
		Hidden:      doc.Hidden,
		Occupations: title.occupations,
		Skills:      memo.skillIDs(doc.Skills, tax),
		DedupeKey:   doc.DedupeKey,
		Summary:     doc.Summary,
		Team:        doc.Team,
		PostedAt:    doc.PostedAt,
	}
	if doc.Visa {
		f.Visa = VisaYes
	}
	if f.PostedAt.IsZero() {
		f.PostedAt = doc.AnalyzedAt
	}
	low, high := doc.Pay.Min, doc.Pay.Max
	if high <= 0 {
		high = low
	}
	if low <= 0 {
		low = high
	}
	minUSD, okMin := ToAnnualUSD(low, doc.Pay.Period, doc.Pay.Currency)
	maxUSD, okMax := ToAnnualUSD(high, doc.Pay.Period, doc.Pay.Currency)
	if okMin && okMax {
		f.PayMinUSD, f.PayMaxUSD, f.PayKnown = min(minUSD, maxUSD), max(minUSD, maxUSD), true
	}
	return f
}

func parseWorkplace(value string) Workplace {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case jobschema.WorkplaceRemote:
		return WorkplaceRemote
	case jobschema.WorkplaceHybrid:
		return WorkplaceHybrid
	case jobschema.WorkplaceOnsite:
		return WorkplaceOnsite
	default:
		return WorkplaceUnknown
	}
}

// ParseWorkplace reads an API workplace name; unknown names report false.
func ParseWorkplace(value string) (Workplace, bool) {
	w := parseWorkplace(value)
	return w, w != WorkplaceUnknown
}

// ParseLevel maps a seniority name to its Level (1-based index into jobschema.Seniorities()).
func ParseLevel(value string) Level {
	canonical, ok := jobschema.CanonicalSeniority(value)
	if !ok {
		canonical = strings.TrimSpace(value)
	}
	for i, level := range jobschema.Seniorities() {
		if strings.EqualFold(level, canonical) {
			return Level(i + 1)
		}
	}
	return LevelUnknown
}

func parseEmployment(value string) Employment {
	for i, kind := range jobschema.Employments() {
		if strings.EqualFold(kind, strings.TrimSpace(value)) {
			return Employment(i + 1)
		}
	}
	return 0
}

// ParseEmployment reads an API employment name; unknown names report false.
func ParseEmployment(value string) (Employment, bool) {
	e := parseEmployment(value)
	return e, e != 0
}

// regionPatterns are checked in order against the folded location; first hit wins,
// so specific markets come before the catch-all global words.
var regionPatterns = []struct {
	region Region
	words  []string
}{
	{RegionUS, []string{"united states", "usa", "u.s.a.", "u.s.a", "u.s.", "u.s", "us only", "us-based", "remote us", "us remote", "nationwide"}},
	{RegionCanada, []string{"canada", "ontario", "toronto", "vancouver", "montreal", "british columbia", "quebec", "alberta"}},
	{RegionUK, []string{"united kingdom", "england", "scotland", "london", "manchester", "uk"}},
	{RegionIndia, []string{"india", "bangalore", "bengaluru", "hyderabad", "pune", "mumbai", "delhi", "chennai"}},
	{RegionEurope, []string{"europe", "emea", "germany", "deutschland", "france", "spain", "netherlands", "ireland", "poland", "portugal", "italy", "sweden", "berlin", "munich", "paris", "amsterdam", "dublin", "madrid", "lisbon", "warsaw", "switzerland", "austria", "belgium", "denmark", "finland", "norway", "czech"}},
	{RegionLatAm, []string{"latam", "latin america", "mexico", "brazil", "argentina", "colombia", "chile", "peru"}},
	{RegionAPAC, []string{"apac", "asia", "australia", "new zealand", "singapore", "japan", "philippines", "taiwan", "sydney", "melbourne"}},
	// Last: "anywhere in the U.S." is a US job, not a global one.
	{RegionGlobal, []string{"anywhere in the world", "worldwide", "global", "anywhere"}},
}

// usStates are two-letter codes after a comma ("Austin, TX") that place a job in the US.
var usStates = map[string]struct{}{
	"al": {}, "ak": {}, "az": {}, "ar": {}, "ca": {}, "co": {}, "ct": {}, "de": {}, "fl": {}, "ga": {},
	"hi": {}, "id": {}, "il": {}, "in": {}, "ia": {}, "ks": {}, "ky": {}, "la": {}, "me": {}, "md": {},
	"ma": {}, "mi": {}, "mn": {}, "ms": {}, "mo": {}, "mt": {}, "ne": {}, "nv": {}, "nh": {}, "nj": {},
	"nm": {}, "ny": {}, "nc": {}, "nd": {}, "oh": {}, "ok": {}, "or": {}, "pa": {}, "ri": {}, "sc": {},
	"sd": {}, "tn": {}, "tx": {}, "ut": {}, "vt": {}, "va": {}, "wa": {}, "wv": {}, "wi": {}, "wy": {}, "dc": {},
}

// usStateNames catch "Eden Prairie, Minnesota".
var usStateNames = []string{
	"alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
	"florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky",
	"louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
	"missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york",
	"north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island",
	"south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington",
	"west virginia", "wisconsin", "wyoming",
}

// DetectRegion reads the hiring market from a free-text location.
func DetectRegion(location string) Region {
	folded := " " + strings.ToLower(location) + " "
	plain := " " + Fold(location) + " "
	for _, pattern := range regionPatterns {
		for _, word := range pattern.words {
			if strings.Contains(plain, " "+word+" ") || strings.Contains(folded, " "+word+" ") ||
				strings.Contains(folded, " "+word+",") || strings.Contains(folded, "("+word+")") {
				return pattern.region
			}
		}
	}
	for _, part := range strings.Split(location, ",") {
		code := strings.ToLower(strings.TrimSpace(part))
		if _, ok := usStates[code]; ok && len(code) == 2 {
			return RegionUS
		}
		for _, name := range usStateNames {
			if code == name || strings.HasPrefix(code, name+" ") {
				return RegionUS
			}
		}
	}
	return RegionUnknown
}

// LocationTerms are the words a location filter matches against.
func LocationTerms(location string) []string {
	return strings.Fields(Fold(location))
}
