package scout

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
)

const longDescription = "This captured job description is long enough to pass the minimum summary length for a scout submission."

func validExtensionInput() ExtensionSubmissionInput {
	return ExtensionSubmissionInput{
		Title:       "Staff Engineer",
		Company:     "Acme Labs",
		Location:    "Remote",
		ApplyURL:    "https://boards.greenhouse.io/acme/jobs/123",
		Description: longDescription,
		Board:       "Greenhouse",
	}
}

func TestNormalizeExtensionInputRejectsMissingFields(t *testing.T) {
	in := validExtensionInput()
	in.Title = ""
	_, err := NormalizeExtensionInput(in)
	var fields *ValidationError
	if err == nil || !asValidation(err, &fields) {
		t.Fatalf("err = %v, want ValidationError", err)
	}
	if !hasField(fields, "title") {
		t.Fatalf("fields = %+v, want title", fields.Fields)
	}
}

func TestNormalizeExtensionInputRejectsBadURL(t *testing.T) {
	for _, raw := range []string{"ftp://acme.com/job", "javascript:alert(1)", "http://localhost/job", "not a url"} {
		in := validExtensionInput()
		in.ApplyURL = raw
		_, err := NormalizeExtensionInput(in)
		var fields *ValidationError
		if err == nil || !asValidation(err, &fields) || !hasField(fields, "apply_url") {
			t.Fatalf("%q: err = %v, want apply_url", raw, err)
		}
	}
}

func TestNormalizeExtensionInputRejectsOversizeField(t *testing.T) {
	in := validExtensionInput()
	in.Title = strings.Repeat("t", maxTitleChars+1)
	_, err := NormalizeExtensionInput(in)
	var fields *ValidationError
	if err == nil || !asValidation(err, &fields) || !hasField(fields, "title") {
		t.Fatalf("err = %v, want title oversize", err)
	}
}

func TestSubmitFromExtensionWritesOneSubmission(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	sub, err := store.SubmitFromExtension(ctx, Actor{UserID: "scout-1"}, validExtensionInput())
	if err != nil {
		t.Fatalf("SubmitFromExtension: %v", err)
	}
	if sub.ID == "" || sub.Title != "Staff Engineer" || sub.CompanyName != "Acme Labs" {
		t.Fatalf("submission = %+v", sub)
	}
	if sub.URL != "https://boards.greenhouse.io/acme/jobs/123" {
		t.Fatalf("url = %q", sub.URL)
	}
	if MemorySubmissionCount(store) != 1 {
		t.Fatalf("count = %d, want 1", MemorySubmissionCount(store))
	}
}

func TestIdempotentSameKeyCreatesOneSubmission(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	body := []byte(`{"title":"Staff Engineer"}`)
	first, replayed, err := store.Idempotent(ctx, "scout-1", "/v1/scout/submissions/extension", "key-1", body, func() Replay {
		sub, err := store.SubmitFromExtension(ctx, Actor{UserID: "scout-1"}, validExtensionInput())
		if err != nil {
			t.Fatalf("submit: %v", err)
		}
		return Replay{Status: 201, Body: []byte(sub.ID)}
	})
	if err != nil || replayed {
		t.Fatalf("first: replayed=%v err=%v", replayed, err)
	}
	second, replayed, err := store.Idempotent(ctx, "scout-1", "/v1/scout/submissions/extension", "key-1", body, func() Replay {
		t.Fatal("fn should not run on replay")
		return Replay{}
	})
	if err != nil || !replayed {
		t.Fatalf("second: replayed=%v err=%v", replayed, err)
	}
	if string(first.Body) != string(second.Body) || first.Status != second.Status {
		t.Fatalf("replay mismatch: %+v vs %+v", first, second)
	}
	if MemorySubmissionCount(store) != 1 {
		t.Fatalf("count = %d, want 1", MemorySubmissionCount(store))
	}
}

func TestIdempotentSameKeyDifferentBodyConflicts(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	_, _, err := store.Idempotent(ctx, "scout-1", "/v1/scout/submissions/extension", "key-1", []byte(`{"a":1}`), func() Replay {
		return Replay{Status: 201, Body: []byte(`ok`)}
	})
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	_, _, err = store.Idempotent(ctx, "scout-1", "/v1/scout/submissions/extension", "key-1", []byte(`{"a":2}`), func() Replay {
		t.Fatal("fn should not run on conflict")
		return Replay{}
	})
	if err != ErrIdempotency {
		t.Fatalf("second err = %v, want ErrIdempotency", err)
	}
	if MemorySubmissionCount(store) != 0 {
		t.Fatalf("count = %d, want 0", MemorySubmissionCount(store))
	}
}

func TestIdempotentDropsKeyAfterServerError(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	body := []byte(`{"title":"Staff Engineer"}`)
	calls := 0
	first, replayed, err := store.Idempotent(ctx, "scout-1", "/v1/scout/submissions/extension", "key-500", body, func() Replay {
		calls++
		return Replay{Status: 500, Body: []byte(`{"title":"internal_error"}`)}
	})
	if err != nil || replayed {
		t.Fatalf("first: replayed=%v err=%v", replayed, err)
	}
	if first.Status != 500 {
		t.Fatalf("first status = %d, want 500", first.Status)
	}
	if memoryIdempotencyExists(store, "scout-1", "/v1/scout/submissions/extension", "key-500") {
		t.Fatal("expected 5xx key to be dropped")
	}

	second, replayed, err := store.Idempotent(ctx, "scout-1", "/v1/scout/submissions/extension", "key-500", body, func() Replay {
		calls++
		return Replay{Status: 201, Body: []byte(`ok`)}
	})
	if err != nil || replayed {
		t.Fatalf("retry: replayed=%v err=%v", replayed, err)
	}
	if second.Status != 201 {
		t.Fatalf("retry status = %d, want 201", second.Status)
	}
	if calls != 2 {
		t.Fatalf("handler calls = %d, want 2", calls)
	}
}

func TestIdempotentDropsInFlightWhenCompleteFails(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	finishErr := errors.New("finish failed")
	store.docs = &failingFinishDocs{documents: store.docs, fail: finishErr}
	body := []byte(`{"title":"Staff Engineer"}`)
	calls := 0

	_, replayed, err := store.Idempotent(ctx, "scout-1", "/v1/scout/submissions/extension", "key-finish", body, func() Replay {
		calls++
		return Replay{Status: 201, Body: []byte(`ok`)}
	})
	if replayed {
		t.Fatal("first call should not be a replay")
	}
	if err == nil || !strings.Contains(err.Error(), finishErr.Error()) {
		t.Fatalf("first err = %v, want complete failure", err)
	}
	if memoryIdempotencyExists(store, "scout-1", "/v1/scout/submissions/extension", "key-finish") {
		t.Fatal("expected in-flight key to be dropped after complete failure")
	}

	second, replayed, err := store.Idempotent(ctx, "scout-1", "/v1/scout/submissions/extension", "key-finish", body, func() Replay {
		calls++
		return Replay{Status: 201, Body: []byte(`ok-retry`)}
	})
	if err != nil || replayed {
		t.Fatalf("retry: replayed=%v err=%v", replayed, err)
	}
	if string(second.Body) != "ok-retry" {
		t.Fatalf("retry body = %q, want ok-retry", second.Body)
	}
	if calls != 2 {
		t.Fatalf("handler calls = %d, want 2", calls)
	}
}

type failingFinishDocs struct {
	documents
	fail error
}

func (f *failingFinishDocs) finishIdempotency(ctx context.Context, userID, route, key string, status int, body []byte) error {
	if f.fail != nil {
		err := f.fail
		f.fail = nil
		return err
	}
	return f.documents.finishIdempotency(ctx, userID, route, key, status, body)
}

func memoryIdempotencyExists(store *Store, userID, route, key string) bool {
	_, err := store.docs.findIdempotency(context.Background(), userID, route, key)
	return err == nil
}

func TestSubmitFromExtensionRejectsNonScout(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	_, err := store.SubmitFromExtension(ctx, Actor{UserID: "hunter-1"}, validExtensionInput())
	if err != ErrNotScout {
		t.Fatalf("err = %v, want ErrNotScout", err)
	}
}

func memoryScout(t *testing.T, scoutID string) (*Store, *MemoryAccounts) {
	t.Helper()
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	accounts := &MemoryAccounts{UsersByID: map[string]auth.User{
		scoutID:    {ID: scoutID, Name: "Ada Scout", Email: "ada@example.com", Role: auth.RoleScout},
		"hunter-1": {ID: "hunter-1", Name: "Pat Hunter", Email: "pat@example.com", Role: auth.RoleCandidate},
	}}
	store := NewMemoryStore(accounts, func() time.Time { return now })
	MemoryAcceptTerms(store, scoutID)
	return store, accounts
}

func asValidation(err error, dest **ValidationError) bool {
	ok := errors.As(err, dest)
	return ok
}

func hasField(err *ValidationError, field string) bool {
	if err == nil {
		return false
	}
	for _, item := range err.Fields {
		if item.Field == field {
			return true
		}
	}
	return false
}
