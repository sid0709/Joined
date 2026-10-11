package resumeread

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/ledongthuc/pdf"
)

const (
	// maxPDFPages is the most pages read; a résumé is a few.
	maxPDFPages = 10
	// lineTolerance, as a share of the font size, is how far apart two glyphs'
	// baselines can sit and still be on one line (superscripts, mixed fonts).
	lineTolerance = 0.5
	// spaceGap and columnGap, as shares of the font size, are the horizontal gaps
	// that read as a space and as a column break. A column break becomes a tab.
	spaceGap  = 0.15
	columnGap = 2.0
	// unknownAdvance, as a share of the font size, is a glyph's width when the
	// PDF gives none: wider than most letters, so a run never looks short.
	unknownAdvance = 0.75
)

// pdfText reads a PDF's text with a full PDF parser (fonts, encodings, and
// ToUnicode maps, which Word, Google Docs, and browser PDFs rely on). Glyphs
// are grouped into lines by baseline and wide gaps become tabs, so a résumé's
// columns stay apart.
func pdfText(data []byte) (text string, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("read pdf: %v", recovered)
		}
	}()
	reader, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("read pdf: %w", err)
	}
	var lines []string
	for n := 1; n <= reader.NumPage() && n <= maxPDFPages; n++ {
		page := reader.Page(n)
		if page.V.IsNull() {
			continue
		}
		lines = append(lines, pageLines(page.Content().Text)...)
	}
	return strings.Join(lines, "\n"), nil
}

// pageLines turns one page's glyphs into lines of text, top to bottom.
func pageLines(glyphs []pdf.Text) []string {
	sort.SliceStable(glyphs, func(i, j int) bool { return glyphs[i].Y > glyphs[j].Y })
	var lines []string
	var line []pdf.Text
	flush := func() {
		if text := strings.TrimSpace(lineText(line)); text != "" {
			lines = append(lines, text)
		}
		line = line[:0]
	}
	for _, glyph := range glyphs {
		if glyph.S == "" {
			continue
		}
		if len(line) > 0 && glyph.Y < line[0].Y-lineTolerance*fontSize(line[0]) {
			flush()
		}
		line = append(line, glyph)
	}
	flush()
	return lines
}

// lineText joins one line's glyphs left to right, writing the gaps the PDF
// left as positioning: a space between words, a tab between columns.
//
// Embedded CID fonts often come without widths: every glyph of a run then
// shares the run's X. Their runs are measured generously, so a run split for
// kerning ("Pr" "oduct") never reads as a gap; only a wide gap becomes a tab,
// and spaces come from the PDF's own space glyphs.
func lineText(line []pdf.Text) string {
	sort.SliceStable(line, func(i, j int) bool { return line[i].X < line[j].X })
	var b strings.Builder
	end, runX, runRunes := 0.0, 0.0, 0
	for i, glyph := range line {
		size := fontSize(glyph)
		measured := glyph.W > 0
		if i > 0 && (measured || glyph.X != runX) {
			gap := glyph.X - end
			text := b.String()
			ended := strings.HasSuffix(text, " ") || strings.HasSuffix(text, "\t")
			switch {
			case gap > columnGap*size:
				b.WriteByte('\t')
			case measured && gap > spaceGap*size && !ended && glyph.S != " ":
				b.WriteByte(' ')
			}
		}
		b.WriteString(glyph.S)
		if measured {
			end = glyph.X + glyph.W
			continue
		}
		if i == 0 || glyph.X != runX {
			runX, runRunes = glyph.X, 0
		}
		runRunes += utf8.RuneCountInString(glyph.S)
		end = runX + float64(runRunes)*unknownAdvance*size
	}
	return b.String()
}

func fontSize(glyph pdf.Text) float64 {
	if glyph.FontSize > 0 {
		return glyph.FontSize
	}
	return 1
}
