package employer

import (
	"errors"
	"testing"
)

func TestFreeBusyStaysUnimplemented(t *testing.T) {
	blocks, err := FreeBusy("2026-10-01", "2026-10-14")
	if !errors.Is(err, ErrFreeBusyNotReady) {
		t.Fatalf("err = %v", err)
	}
	if blocks != nil {
		t.Fatalf("blocks = %+v", blocks)
	}
	if FreeBusyNotReadyCode != "free_busy_not_ready" {
		t.Fatalf("code = %s", FreeBusyNotReadyCode)
	}
}

func TestFreeBusyRejectsBadRange(t *testing.T) {
	cases := []struct {
		from, to string
	}{
		{"", "2026-10-14"},
		{"2026-10-01", ""},
		{"10/01/2026", "2026-10-14"},
		{"2026-10-14", "2026-10-01"},
	}
	for _, tc := range cases {
		blocks, err := FreeBusy(tc.from, tc.to)
		if !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("FreeBusy(%q, %q) err = %v", tc.from, tc.to, err)
		}
		if errors.Is(err, ErrFreeBusyNotReady) {
			t.Fatalf("FreeBusy(%q, %q) reported not-ready for a bad range", tc.from, tc.to)
		}
		if blocks != nil {
			t.Fatalf("blocks = %+v", blocks)
		}
	}
}
