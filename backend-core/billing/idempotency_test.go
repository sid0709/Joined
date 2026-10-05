package billing

import (
	"testing"
	"time"
)

func TestMemoryIdempotencyStoreMarkProcessed(t *testing.T) {
	store := NewMemoryIdempotencyStore()
	if store.IsProcessed("evt_1") {
		t.Fatal("expected event not processed initially")
	}
	store.MarkProcessed("evt_1")
	if !store.IsProcessed("evt_1") {
		t.Fatal("expected event to be marked as processed")
	}
	store.MarkProcessed("evt_1")
	if !store.IsProcessed("evt_1") {
		t.Fatal("expected event to still be marked as processed after duplicate mark")
	}
	if store.IsProcessed("evt_2") {
		t.Fatal("expected different event not processed")
	}
	store.MarkProcessed("evt_2")
	if !store.IsProcessed("evt_2") {
		t.Fatal("expected second event to be marked as processed")
	}
}

func TestMemoryIdempotencyStoreCleanup(t *testing.T) {
	store := NewMemoryIdempotencyStore()
	store.MarkProcessed("evt_old")
	time.Sleep(10 * time.Millisecond)
	cutoff := time.Now()
	time.Sleep(10 * time.Millisecond)
	store.MarkProcessed("evt_new")
	store.Cleanup(cutoff)
	if store.IsProcessed("evt_old") {
		t.Fatal("expected cleaned event to be removed")
	}
	if !store.IsProcessed("evt_new") {
		t.Fatal("expected recent event to remain")
	}
}
