package resumeread

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"html"
	"io"
	"path/filepath"
	"regexp"
	"strings"
	"unicode/utf8"
)

// docxBodyParts are the parts of a .docx that carry visible text, in reading order.
// Many résumés keep the name and contact line in the page header.
var docxBodyParts = regexp.MustCompile(`^word/(header\d*|document|footer\d*)\.xml$`)

// fileText is the visible text of a résumé file, chosen by its extension.
func fileText(name string, data []byte) (string, error) {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".docx":
		return docxText(data), nil
	case ".pdf":
		return readPDF(data), nil
	case ".txt", ".md":
		if !utf8.Valid(data) {
			return "", ErrUnreadable
		}
		return string(data), nil
	default:
		return "", ErrUnsupported
	}
}

// readPDF is the PDF's text from the full parser, or from the stream scanner
// when the parser fails or finds too little (a malformed or unusual file).
func readPDF(data []byte) string {
	text, err := pdfText(data)
	if err == nil && len([]rune(cleanText(text))) >= minResumeRunes {
		return text
	}
	return extractPDFText(data)
}

// docxText reads every visible paragraph of a .docx, keeping tabs and line
// breaks as layout, and lists hyperlink targets after the body so a "LinkedIn"
// label still yields its URL.
func docxText(data []byte) string {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return ""
	}
	var headers, body, footers []string
	var links []string
	for _, file := range reader.File {
		match := docxBodyParts.FindStringSubmatch(file.Name)
		if match != nil {
			text := docxPartText(file)
			switch {
			case strings.HasPrefix(match[1], "header"):
				headers = append(headers, text)
			case strings.HasPrefix(match[1], "footer"):
				footers = append(footers, text)
			default:
				body = append(body, text)
			}
			continue
		}
		if strings.HasPrefix(file.Name, "word/_rels/") {
			links = append(links, hyperlinkTargets(file)...)
		}
	}
	parts := append(append(headers, body...), footers...)
	if len(links) > 0 {
		parts = append(parts, strings.Join(dedupe(links), "\n"))
	}
	return strings.Join(parts, "\n")
}

var (
	docxTab       = regexp.MustCompile(`<w:(?:tab|ptab)\b[^>]*/>`)
	docxBreak     = regexp.MustCompile(`<w:(?:br|cr)\b[^>]*/>`)
	docxParagraph = regexp.MustCompile(`</w:p>`)
	// Field codes ("HYPERLINK \"…\"") and deleted runs are not visible text.
	docxHidden = regexp.MustCompile(`(?s)<w:instrText\b[^>]*>.*?</w:instrText>|<w:delText\b[^>]*>.*?</w:delText>`)
)

func docxPartText(file *zip.File) string {
	src, err := file.Open()
	if err != nil {
		return ""
	}
	defer src.Close()
	body, err := io.ReadAll(src)
	if err != nil {
		return ""
	}
	text := docxHidden.ReplaceAllString(string(body), "")
	text = docxTab.ReplaceAllString(text, "\t")
	text = docxBreak.ReplaceAllString(text, "\n")
	text = docxParagraph.ReplaceAllString(text, "\n")
	return html.UnescapeString(stripTags(text))
}

func hyperlinkTargets(file *zip.File) []string {
	src, err := file.Open()
	if err != nil {
		return nil
	}
	defer src.Close()
	var rels struct {
		Items []struct {
			Type   string `xml:"Type,attr"`
			Target string `xml:"Target,attr"`
		} `xml:"Relationship"`
	}
	if err := xml.NewDecoder(src).Decode(&rels); err != nil {
		return nil
	}
	var out []string
	for _, item := range rels.Items {
		if strings.HasSuffix(item.Type, "/hyperlink") && strings.HasPrefix(strings.ToLower(item.Target), "http") {
			out = append(out, item.Target)
		}
	}
	return out
}

func dedupe(values []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, value := range values {
		if !seen[value] {
			seen[value] = true
			out = append(out, value)
		}
	}
	return out
}

func stripTags(xml string) string {
	var b strings.Builder
	in := false
	for _, r := range xml {
		switch {
		case r == '<':
			in = true
		case r == '>':
			in = false
		case !in:
			b.WriteRune(r)
		}
	}
	return b.String()
}
