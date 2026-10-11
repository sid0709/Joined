package resumeread

import (
	"bytes"
	"compress/zlib"
	"encoding/hex"
	"io"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// binaryStream matches the dictionary of an embedded font program or an image.
var binaryStream = regexp.MustCompile(`/Length[123]\b|/Subtype\s*/(?:Image|Type1C|CIDFontType0C|OpenType)\b`)

// extractPDFText reads selectable text from a PDF, including text stored in
// FlateDecode streams. Image-only PDFs return empty.
func extractPDFText(data []byte) string {
	var fromStreams []string
	for _, stream := range inflateFlateStreams(data) {
		fromStreams = append(fromStreams, pdfShowText(stream)...)
	}
	if text := strings.TrimSpace(strings.Join(fromStreams, "\n")); text != "" {
		return text
	}
	return strings.TrimSpace(strings.Join(pdfShowText(data), "\n"))
}

func inflateFlateStreams(data []byte) [][]byte {
	var out [][]byte
	rest := data
	for {
		rel := bytes.Index(rest, []byte("stream"))
		if rel < 0 {
			return out
		}
		headerFrom := rel - 800
		if headerFrom < 0 {
			headerFrom = 0
		}
		header := rest[headerFrom:rel]
		if open := bytes.LastIndex(header, []byte("obj")); open >= 0 {
			header = header[open:]
		}
		// Fonts and images are binary; read as text they turn into noise.
		compressed := bytes.Contains(header, []byte("FlateDecode")) && !binaryStream.Match(header)
		start := rel + len("stream")
		if start < len(rest) && rest[start] == '\r' {
			start++
		}
		if start < len(rest) && rest[start] == '\n' {
			start++
		}
		endRel := bytes.Index(rest[start:], []byte("endstream"))
		if endRel < 0 {
			return out
		}
		if compressed {
			payload := bytes.TrimRight(rest[start:start+endRel], "\r\n")
			if inflated := inflateZlib(payload); len(inflated) > 0 {
				out = append(out, inflated)
			}
		}
		rest = rest[start+endRel+len("endstream"):]
	}
}

func inflateZlib(payload []byte) []byte {
	reader, err := zlib.NewReader(bytes.NewReader(payload))
	if err != nil {
		return nil
	}
	defer reader.Close()
	decoded, err := io.ReadAll(io.LimitReader(reader, 8<<20))
	if err != nil && len(decoded) == 0 {
		return nil
	}
	return decoded
}

// pdfShowText pulls text-showing operators and link URIs out of PDF content.
func pdfShowText(data []byte) []string {
	var lines []string
	for i := 0; i < len(data); {
		switch data[i] {
		case '(':
			text, next, ok := readPDFLiteral(data, i)
			if !ok {
				i++
				continue
			}
			if pdfOperator(data, next, "Tj") || pdfOperator(data, next, "'") || pdfOperator(data, next, `"`) {
				if line := strings.TrimSpace(text); line != "" {
					lines = append(lines, line)
				}
			}
			i = next
		case '[':
			line, next, ok := readPDFTextArray(data, i)
			if ok {
				if line = strings.TrimSpace(line); line != "" {
					lines = append(lines, line)
				}
				i = next
				continue
			}
			i++
		case '<':
			text, next, ok := readPDFHex(data, i)
			if !ok {
				i++
				continue
			}
			if pdfOperator(data, next, "Tj") || pdfOperator(data, next, "'") {
				if line := strings.TrimSpace(text); line != "" {
					lines = append(lines, line)
				}
			}
			i = next
		default:
			if bytes.HasPrefix(data[i:], []byte("/URI")) {
				if uri, next, ok := pdfURI(data, i+len("/URI")); ok {
					lines = append(lines, uri)
					i = next
					continue
				}
			}
			i++
		}
	}
	return lines
}

func pdfOperator(data []byte, i int, op string) bool {
	i = skipPDFSpace(data, i)
	if i+len(op) > len(data) || string(data[i:i+len(op)]) != op {
		return false
	}
	end := i + len(op)
	return end >= len(data) || !isPDFName(data[end])
}

func pdfURI(data []byte, i int) (string, int, bool) {
	i = skipPDFSpace(data, i)
	if i >= len(data) {
		return "", i, false
	}
	if data[i] == '(' {
		text, next, ok := readPDFLiteral(data, i)
		return strings.TrimSpace(text), next, ok
	}
	if data[i] == '<' {
		text, next, ok := readPDFHex(data, i)
		return strings.TrimSpace(text), next, ok
	}
	return "", i, false
}

// A gap this large, in thousandths of a text unit, is a space the PDF encoded as positioning.
const pdfSpaceAdjust = -120

func readPDFTextArray(data []byte, i int) (string, int, bool) {
	if i >= len(data) || data[i] != '[' {
		return "", i, false
	}
	start := i
	i++
	var b strings.Builder
	for i < len(data) {
		i = skipPDFSpace(data, i)
		if i >= len(data) {
			return "", start, false
		}
		switch data[i] {
		case ']':
			i++
			if !pdfOperator(data, i, "TJ") {
				return "", start, false
			}
			return b.String(), skipPDFSpace(data, i) + len("TJ"), true
		case '(':
			text, next, ok := readPDFLiteral(data, i)
			if !ok {
				return "", start, false
			}
			b.WriteString(text)
			i = next
		case '<':
			text, next, ok := readPDFHex(data, i)
			if !ok {
				return "", start, false
			}
			b.WriteString(text)
			i = next
		default:
			num, next, ok := readPDFNumber(data, i)
			if !ok {
				i++
				continue
			}
			if num <= pdfSpaceAdjust && b.Len() > 0 && !strings.HasSuffix(b.String(), " ") {
				b.WriteByte(' ')
			}
			i = next
		}
	}
	return "", start, false
}

func readPDFNumber(data []byte, i int) (float64, int, bool) {
	start := i
	if i < len(data) && (data[i] == '+' || data[i] == '-') {
		i++
	}
	digits := false
	for i < len(data) && ((data[i] >= '0' && data[i] <= '9') || data[i] == '.') {
		if data[i] != '.' {
			digits = true
		}
		i++
	}
	if !digits || i == start {
		return 0, start, false
	}
	value, err := strconv.ParseFloat(string(data[start:i]), 64)
	if err != nil {
		return 0, start, false
	}
	return value, i, true
}

func readPDFLiteral(data []byte, i int) (string, int, bool) {
	if i >= len(data) || data[i] != '(' {
		return "", i, false
	}
	i++
	var raw []byte
	depth := 1
	for i < len(data) && depth > 0 {
		c := data[i]
		i++
		if c == '\\' {
			if i >= len(data) {
				break
			}
			esc := data[i]
			i++
			switch esc {
			case 'n':
				raw = append(raw, '\n')
			case 'r':
				raw = append(raw, '\r')
			case 't':
				raw = append(raw, '\t')
			case 'b':
				raw = append(raw, '\b')
			case 'f':
				raw = append(raw, '\f')
			case '(', ')', '\\':
				raw = append(raw, esc)
			case '\n':
			case '\r':
				if i < len(data) && data[i] == '\n' {
					i++
				}
			default:
				if esc >= '0' && esc <= '7' {
					oct := []byte{esc}
					for n := 0; n < 2 && i < len(data) && data[i] >= '0' && data[i] <= '7'; n++ {
						oct = append(oct, data[i])
						i++
					}
					value, _ := strconv.ParseInt(string(oct), 8, 16)
					raw = append(raw, byte(value))
				} else {
					raw = append(raw, esc)
				}
			}
			continue
		}
		switch c {
		case '(':
			depth++
			raw = append(raw, c)
		case ')':
			depth--
			if depth > 0 {
				raw = append(raw, c)
			}
		default:
			raw = append(raw, c)
		}
	}
	if depth != 0 {
		return "", i, false
	}
	return decodePDFText(raw), i, true
}

func readPDFHex(data []byte, i int) (string, int, bool) {
	if i >= len(data) || data[i] != '<' || (i+1 < len(data) && data[i+1] == '<') {
		return "", i, false
	}
	i++
	var digits []byte
	for i < len(data) && data[i] != '>' {
		if !isPDFSpace(data[i]) {
			digits = append(digits, data[i])
		}
		i++
	}
	if i >= len(data) || data[i] != '>' {
		return "", i, false
	}
	i++
	if len(digits) == 0 || len(digits)%2 == 1 {
		if len(digits) == 0 {
			return "", i, true
		}
		digits = append(digits, '0')
	}
	decoded := make([]byte, hex.DecodedLen(len(digits)))
	if _, err := hex.Decode(decoded, digits); err != nil {
		return "", i, false
	}
	return decodePDFText(decoded), i, true
}

func decodePDFText(raw []byte) string {
	if len(raw) >= 2 && raw[0] == 0xfe && raw[1] == 0xff {
		units := raw[2:]
		if len(units)%2 == 1 {
			units = units[:len(units)-1]
		}
		words := make([]uint16, len(units)/2)
		for n := range words {
			words[n] = uint16(units[n*2])<<8 | uint16(units[n*2+1])
		}
		return string(utf16.Decode(words))
	}
	if utf8.Valid(raw) {
		return string(raw)
	}
	runes := make([]rune, len(raw))
	for n, c := range raw {
		runes[n] = rune(c)
	}
	return string(runes)
}

func skipPDFSpace(data []byte, i int) int {
	for i < len(data) && isPDFSpace(data[i]) {
		i++
	}
	return i
}

func isPDFSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == 0
}

func isPDFName(c byte) bool {
	return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
}
