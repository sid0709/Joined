package resumeread

import (
	"regexp"
	"strings"
)

// usStates maps a lower-case name or postal abbreviation to the abbreviation
// the profile state selector stores.
var usStates = map[string]string{
	"al": "AL", "alabama": "AL",
	"ak": "AK", "alaska": "AK",
	"az": "AZ", "arizona": "AZ",
	"ar": "AR", "arkansas": "AR",
	"ca": "CA", "california": "CA",
	"co": "CO", "colorado": "CO",
	"ct": "CT", "connecticut": "CT",
	"de": "DE", "delaware": "DE",
	"dc": "DC", "district of columbia": "DC",
	"fl": "FL", "florida": "FL",
	"ga": "GA", "georgia": "GA",
	"hi": "HI", "hawaii": "HI",
	"id": "ID", "idaho": "ID",
	"il": "IL", "illinois": "IL",
	"in": "IN", "indiana": "IN",
	"ia": "IA", "iowa": "IA",
	"ks": "KS", "kansas": "KS",
	"ky": "KY", "kentucky": "KY",
	"la": "LA", "louisiana": "LA",
	"me": "ME", "maine": "ME",
	"md": "MD", "maryland": "MD",
	"ma": "MA", "massachusetts": "MA",
	"mi": "MI", "michigan": "MI",
	"mn": "MN", "minnesota": "MN",
	"ms": "MS", "mississippi": "MS",
	"mo": "MO", "missouri": "MO",
	"mt": "MT", "montana": "MT",
	"ne": "NE", "nebraska": "NE",
	"nv": "NV", "nevada": "NV",
	"nh": "NH", "new hampshire": "NH",
	"nj": "NJ", "new jersey": "NJ",
	"nm": "NM", "new mexico": "NM",
	"ny": "NY", "new york": "NY",
	"nc": "NC", "north carolina": "NC",
	"nd": "ND", "north dakota": "ND",
	"oh": "OH", "ohio": "OH",
	"ok": "OK", "oklahoma": "OK",
	"or": "OR", "oregon": "OR",
	"pa": "PA", "pennsylvania": "PA",
	"ri": "RI", "rhode island": "RI",
	"sc": "SC", "south carolina": "SC",
	"sd": "SD", "south dakota": "SD",
	"tn": "TN", "tennessee": "TN",
	"tx": "TX", "texas": "TX",
	"ut": "UT", "utah": "UT",
	"vt": "VT", "vermont": "VT",
	"va": "VA", "virginia": "VA",
	"wa": "WA", "washington": "WA",
	"wv": "WV", "west virginia": "WV",
	"wi": "WI", "wisconsin": "WI",
	"wy": "WY", "wyoming": "WY",
}

// caProvinces maps a lower-case Canadian province or territory, or its postal
// abbreviation, to the abbreviation.
var caProvinces = map[string]string{
	"ab": "AB", "alberta": "AB",
	"bc": "BC", "british columbia": "BC",
	"mb": "MB", "manitoba": "MB",
	"nb": "NB", "new brunswick": "NB",
	"nl": "NL", "newfoundland and labrador": "NL",
	"ns": "NS", "nova scotia": "NS",
	"nt": "NT", "northwest territories": "NT",
	"nu": "NU", "nunavut": "NU",
	"on": "ON", "ontario": "ON",
	"pe": "PE", "prince edward island": "PE",
	"qc": "QC", "quebec": "QC", "québec": "QC",
	"sk": "SK", "saskatchewan": "SK",
	"yt": "YT", "yukon": "YT",
}

var (
	placePattern  = regexp.MustCompile(`(?i)^([A-Za-z][A-Za-z .'-]{0,40}?),\s*([A-Za-z][A-Za-z .'-]{1,24}?)(?:\s+(\d{5}(?:-\d{4})?))?(?:,\s*([A-Za-z][A-Za-z .'-]{1,40}))?$`)
	remotePattern = regexp.MustCompile(`(?i)^(remote|hybrid|on-?site)(\s*[(,-].*)?$`)
	// contactSplit separates the pieces of a contact line: "City, ST | email | phone".
	contactSplit = regexp.MustCompile(`[|•·▪◦●\t]|\s{2,}`)
)

// place is where a person or a job is: a US city and state, or a city and country.
type place struct {
	city, state, country, zip string
}

func (p place) empty() bool { return p.city == "" && p.state == "" && p.country == "" }

// parsePlace reads "San Francisco, CA", "Austin, Texas 78701", "Toronto, ON, Canada",
// "London, United Kingdom", or a bare country. Anything else is not a place.
func parsePlace(value string) (place, bool) {
	value = strings.Trim(strings.TrimSpace(value), ",.;")
	if named := countryName(value); named != "" {
		return place{country: named}, true
	}
	match := placePattern.FindStringSubmatch(value)
	if match == nil {
		return place{}, false
	}
	city := titlePlace(match[1])
	if remotePattern.MatchString(city) {
		city = ""
	}
	region := strings.TrimSpace(match[2])
	if abbr, ok := usStates[strings.ToLower(region)]; ok {
		country := countryName(match[4])
		if country == "" {
			country = unitedStates
		}
		return place{city: city, state: abbr, country: country, zip: match[3]}, true
	}
	if abbr, ok := caProvinces[strings.ToLower(region)]; ok && (match[4] == "" || countryName(match[4]) == canada) {
		return place{city: city, state: abbr, country: canada, zip: match[3]}, true
	}
	if named := countryName(region); named != "" && match[4] == "" {
		return place{city: city, country: named, zip: match[3]}, true
	}
	if named := countryName(match[4]); named != "" {
		return place{city: city, state: strings.ToUpper(region), country: named, zip: match[3]}, true
	}
	return place{}, false
}

func isPlace(value string) bool {
	if remotePattern.MatchString(strings.TrimSpace(value)) {
		return true
	}
	_, ok := parsePlace(value)
	return ok
}

// placeFrom finds where the person lives: the contact header first, then the whole page.
func placeFrom(header, lines []string) place {
	if found := scanPlaces(header); !found.empty() {
		return found
	}
	return scanPlaces(lines)
}

func scanPlaces(lines []string) place {
	var found place
	for _, line := range lines {
		for _, part := range contactSplit.Split(line, -1) {
			next, ok := parsePlace(part)
			if !ok {
				continue
			}
			if next.city != "" {
				return next
			}
			if found.country == "" {
				found.country = next.country
			}
		}
	}
	return found
}

const (
	unitedStates  = "United States"
	canada        = "Canada"
	unitedKingdom = "United Kingdom"
)

// countryNames maps how résumés write a country to the profile's country choice.
var countryNames = map[string]string{
	"united states": unitedStates, "united states of america": unitedStates, "usa": unitedStates,
	"us": unitedStates, "u.s": unitedStates, "u.s.a": unitedStates, "america": unitedStates,
	"canada":         canada,
	"united kingdom": unitedKingdom, "uk": unitedKingdom, "u.k": unitedKingdom, "england": unitedKingdom,
	"scotland": unitedKingdom, "wales": unitedKingdom, "britain": unitedKingdom, "great britain": unitedKingdom,
}

func countryName(value string) string {
	return countryNames[strings.ToLower(strings.Trim(strings.TrimSpace(value), "."))]
}

// countryAsWritten is the common English name for a country the reader knows,
// otherwise the country as the résumé wrote it.
func countryAsWritten(value string) string {
	value = strings.TrimSpace(value)
	if named := countryName(value); named != "" {
		return named
	}
	return value
}

// stateChoice is the postal abbreviation the state selector stores, when the value names a US state.
func stateChoice(value string) string {
	if abbr, ok := usStates[strings.ToLower(strings.Trim(strings.TrimSpace(value), "."))]; ok {
		return abbr
	}
	return strings.TrimSpace(value)
}

// titlePlace fixes the case of "SAN FRANCISCO" or "austin" and leaves "McAllen" alone.
func titlePlace(value string) string {
	if value != strings.ToUpper(value) && value != strings.ToLower(value) {
		return strings.Join(strings.Fields(value), " ")
	}
	words := strings.Fields(value)
	for i, word := range words {
		lower := strings.ToLower(word)
		if lower == "of" || lower == "and" {
			words[i] = lower
			continue
		}
		words[i] = strings.ToUpper(lower[:1]) + lower[1:]
	}
	return strings.Join(words, " ")
}
