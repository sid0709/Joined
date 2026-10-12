package resumeread

import (
	"strings"
	"unicode"
)

// minPrintableShare is how much of a line must be letters, digits, punctuation,
// or spaces for it to read as text; less is binary noise from a font or image.
const minPrintableShare = 0.85

// ligatures spells out the typographic ligatures PDFs keep as one glyph ("ﬂow").
var ligatures = strings.NewReplacer("ﬀ", "ff", "ﬁ", "fi", "ﬂ", "fl", "ﬃ", "ffi", "ﬄ", "ffl", "ﬅ", "st", "ﬆ", "st")

// cleanText makes extracted text safe to read by layout: Unicode spaces
// (no-break, thin, figure) become plain spaces, so column gaps still split;
// ligatures are spelled out; control characters go; and lines that are mostly
// noise are dropped.
func cleanText(text string) string {
	var out []string
	text = ligatures.Replace(strings.ReplaceAll(text, "\r", ""))
	for _, line := range strings.Split(text, "\n") {
		line = strings.Map(cleanRune, line)
		if printableShare(line) < minPrintableShare {
			continue
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

func cleanRune(r rune) rune {
	switch {
	case r == '\t':
		return r
	case unicode.IsSpace(r):
		return ' '
	case unicode.IsControl(r), r == unicode.ReplacementChar, unicode.Is(unicode.Co, r):
		return -1
	}
	return r
}

func printableShare(line string) float64 {
	total, printable := 0, 0
	for _, r := range line {
		if r == ' ' || r == '\t' {
			continue
		}
		total++
		if unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.IsPunct(r) || unicode.IsSymbol(r) && r < unicode.MaxLatin1 {
			printable++
		}
	}
	if total == 0 {
		return 1
	}
	return float64(printable) / float64(total)
}
