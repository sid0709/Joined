package resumeread

import (
	"bytes"
	"compress/zlib"
	"strings"
	"testing"
)

func flatePDF(content string) []byte {
	var compressed bytes.Buffer
	writer := zlib.NewWriter(&compressed)
	_, _ = writer.Write([]byte(content))
	_ = writer.Close()
	var pdf bytes.Buffer
	pdf.WriteString("%PDF-1.4\n1 0 obj\n<< /Length 20 /Filter /FlateDecode >>\nstream\n")
	pdf.Write(compressed.Bytes())
	pdf.WriteString("\nendstream\nendobj\n%%EOF\n")
	return pdf.Bytes()
}

func TestExtractPDFTextReadsCompressedStreams(t *testing.T) {
	got := extractPDFText(flatePDF("BT (Senior Engineer) Tj ET"))
	if !strings.Contains(got, "Senior Engineer") {
		t.Fatalf("compressed text = %q", got)
	}
}

func TestExtractPDFTextJoinsPositionedRuns(t *testing.T) {
	got := extractPDFText(flatePDF("[(Go) -250 (PostgreSQL)] TJ"))
	if !strings.Contains(got, "Go PostgreSQL") {
		t.Fatalf("positioned text = %q", got)
	}
}

func TestExtractPDFTextReadsUncompressedAndLinks(t *testing.T) {
	raw := []byte("(Ada Lovelace) Tj /URI (https://linkedin.com/in/ada)")
	got := extractPDFText(raw)
	if !strings.Contains(got, "Ada Lovelace") || !strings.Contains(got, "https://linkedin.com/in/ada") {
		t.Fatalf("uncompressed text = %q", got)
	}
}
