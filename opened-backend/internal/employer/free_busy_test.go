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
}
