package candidate

import "testing"

func TestCompactIDsDropsBlanksAndDuplicates(t *testing.T) {
	got := compactIDs([]string{"a", "", "a", "b"})
	if len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Fatalf("ids = %#v", got)
	}
	if compactIDs(nil) != nil {
		t.Fatal("empty input should stay empty")
	}
}
