package jobs

import (
	"context"
	"errors"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/openai"
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

func TestAnalyzeAllPreservesOrderAndRunsTogether(t *testing.T) {
	ids := make([]string, 20)
	for i := range ids {
		ids[i] = strconv.Itoa(i)
	}
	var current, peak atomic.Int32
	batch, err := analyzeAll(context.Background(), ids, 8, "test", func(_ context.Context, id string) (SearchRecord, error) {
		n := current.Add(1)
		defer current.Add(-1)
		for {
			old := peak.Load()
			if n <= old || peak.CompareAndSwap(old, n) {
				break
			}
		}
		time.Sleep(40 * time.Millisecond)
		return SearchRecord{TempJobID: id}, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if peak.Load() < 2 {
		t.Fatalf("peak concurrency = %d", peak.Load())
	}
	if len(batch.Analyzed) != len(ids) || len(batch.Failed) != 0 {
		t.Fatalf("batch = %d analyzed, %d failed", len(batch.Analyzed), len(batch.Failed))
	}
	for i, record := range batch.Analyzed {
		if record.TempJobID != ids[i] {
			t.Fatalf("order[%d] = %s", i, record.TempJobID)
		}
	}
}

func TestAnalyzeAllKeepsFailuresInOrder(t *testing.T) {
	batch, err := analyzeAll(context.Background(), []string{"ok", "bad", "ok2"}, 3, "test", func(_ context.Context, id string) (SearchRecord, error) {
		if id == "bad" {
			return SearchRecord{}, errors.New("nope")
		}
		return SearchRecord{TempJobID: id}, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(batch.Analyzed) != 2 || batch.Analyzed[0].TempJobID != "ok" || batch.Analyzed[1].TempJobID != "ok2" {
		t.Fatalf("analyzed = %#v", batch.Analyzed)
	}
	if len(batch.Failed) != 1 || batch.Failed[0].TempJobID != "bad" || batch.Failed[0].Error != "nope" {
		t.Fatalf("failed = %#v", batch.Failed)
	}
}

func TestAnalyzeAllStopsWhenAPIKeyMissing(t *testing.T) {
	_, err := analyzeAll(context.Background(), []string{"a", "b"}, 2, "test", func(context.Context, string) (SearchRecord, error) {
		return SearchRecord{}, openai.ErrMissingAPIKey
	})
	if !IsMissingAPIKey(err) {
		t.Fatalf("err = %v", err)
	}
}
