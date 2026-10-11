package resumeread

import (
	"regexp"
	"strconv"
	"strings"
)

// A résumé date is a month name and year ("Mar 2025", "March, 2025"), a numeric
// month and year in either order ("3/2025", "2022.4", "2018-11"), or a bare year.
const (
	monthWord = `(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`
	yearWord  = `(?:19|20)\d{2}`
	monthNum  = `(?:1[0-2]|0?[1-9])`
	dateWord  = `(?:` + monthWord + `\s*,?\s*` + yearWord + `|` + monthNum + `\s*/\s*` + yearWord + `|` + yearWord + `\s*[./-]\s*` + monthNum + `|` + yearWord + `)`
	openEnd   = `(?:present|current|now|today|ongoing)`
	rangeJoin = `\s*(?:-|–|—|~|\bto\b|\buntil\b|\bthrough\b)\s*`
)

var (
	dateRangePattern = regexp.MustCompile(`(?i)\b(` + dateWord + `)` + rangeJoin + `(` + dateWord + `|` + openEnd + `)\b`)
	loneDatePattern  = regexp.MustCompile(`(?i)\b(` + dateWord + `)\s*$`)
	monthNamePattern = regexp.MustCompile(`(?i)\b` + monthWord)
	yearPattern      = regexp.MustCompile(yearWord)
	monthFirst       = regexp.MustCompile(`^(` + monthNum + `)\s*/\s*(` + yearWord + `)$`)
	yearFirst        = regexp.MustCompile(`^(` + yearWord + `)\s*[./-]\s*(` + monthNum + `)$`)
	openEndPattern   = regexp.MustCompile(`(?i)^` + openEnd + `$`)
	months           = []string{"jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"}
)

type dates struct {
	startMonth string
	startYear  string
	endMonth   string
	endYear    string
	current    bool
}

// findDates returns the date range on a line and the line with it removed.
// A line that ends in a single date (a graduation) counts when lone is true.
func findDates(line string, lone bool) (dates, string, bool) {
	if loc := dateRangePattern.FindStringSubmatchIndex(line); loc != nil {
		start := line[loc[2]:loc[3]]
		end := line[loc[4]:loc[5]]
		out := dates{}
		out.startMonth, out.startYear = monthYear(start)
		if openEndPattern.MatchString(strings.TrimSpace(end)) {
			out.current = true
		} else {
			out.endMonth, out.endYear = monthYear(end)
		}
		return out, line[:loc[0]] + "\t" + line[loc[1]:], true
	}
	if !lone {
		return dates{}, line, false
	}
	if loc := loneDatePattern.FindStringSubmatchIndex(line); loc != nil {
		out := dates{}
		out.endMonth, out.endYear = monthYear(line[loc[2]:loc[3]])
		out.startYear = ""
		return out, line[:loc[0]], true
	}
	return dates{}, line, false
}

func monthYear(token string) (string, string) {
	token = strings.TrimSpace(token)
	if match := monthFirst.FindStringSubmatch(token); match != nil {
		return trimMonth(match[1]), match[2]
	}
	if match := yearFirst.FindStringSubmatch(token); match != nil {
		return trimMonth(match[2]), match[1]
	}
	month := ""
	if name := monthNamePattern.FindString(token); name != "" {
		month = monthOf(name)
	}
	return month, yearPattern.FindString(token)
}

func trimMonth(value string) string {
	n, err := strconv.Atoi(value)
	if err != nil || n < 1 || n > 12 {
		return ""
	}
	return strconv.Itoa(n)
}

func monthOf(token string) string {
	lower := strings.ToLower(token)
	for index, month := range months {
		if strings.HasPrefix(lower, month) {
			return strconv.Itoa(index + 1)
		}
	}
	return ""
}
