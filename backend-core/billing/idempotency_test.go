package billing

import (
	"testing"
	"time"
)

func TestMemoryIdempotencyStoreMarkProcessed(t *testing.T) {
	store := NewMemoryIdempotencyStore()
	if !store.MarkProcessed("evt_1") {
		t.Fatal("expected first mark to succeed")
	}
	if store.MarkProcessed("evt_1") {
		t.Fatal("expected duplicate mark to fail")
	}
	if !store.MarkProcessed("evt_2") {
		t.Fatal("expected different event to succeed")
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
	if !store.MarkProcessed("evt_old") {
		t.Fatal("expected cleaned event to be processable again")
	}
	if store.MarkProcessed("evt_new") {
		t.Fatal("expected recent event to still be marked as processed")
	}
}
