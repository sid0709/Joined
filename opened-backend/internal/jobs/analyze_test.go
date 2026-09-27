package jobs

import (
	"strconv"
	"testing"
)

func TestNormalizeSelection(t *testing.T) {
	ids, err := normalizeSelection([]string{" abc ", "abc", "", "def"})
	if err != nil {
		t.Fatal(err)
	}
	if len(ids) != 2 || ids[0] != "abc" || ids[1] != "def" {
		t.Fatalf("ids = %#v", ids)
	}

	if _, err := normalizeSelection(nil); err != ErrNoSelection {
		t.Fatalf("empty = %v", err)
	}
	tooMany := make([]string, maxAnalyzeIDs+1)
	for i := range tooMany {
		tooMany[i] = strconv.Itoa(i)
	}
	if _, err := normalizeSelection(tooMany); err != ErrTooMany {
		t.Fatalf("too many = %v", err)
	}
}
