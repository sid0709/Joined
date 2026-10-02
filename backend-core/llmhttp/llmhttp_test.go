package llmhttp

import (
	"context"
	"net/http"
	"testing"
	"time"
)

func TestRetryDelayPrefersRetryAfterAndCaps(t *testing.T) {
	if got := RetryDelay(0, "3"); got != 3*time.Second {
		t.Fatalf("retry-after = %v", got)
	}
	if got := RetryDelay(0, "600"); got != maxRetryWait {
		t.Fatalf("capped retry-after = %v", got)
	}
	if got := RetryDelay(2, ""); got != retryBase<<2 {
		t.Fatalf("backoff = %v", got)
	}
	if got := RetryDelay(20, "soon"); got != maxRetryWait {
		t.Fatalf("capped backoff = %v", got)
	}
}

func TestRetryable(t *testing.T) {
	for status, want := range map[int]bool{
		http.StatusTooManyRequests:     true,
		http.StatusBadGateway:          true,
		http.StatusBadRequest:          false,
		http.StatusUnauthorized:        false,
		http.StatusInternalServerError: true,
	} {
		if Retryable(status) != want {
			t.Fatalf("Retryable(%d) = %v", status, !want)
		}
	}
}

func TestWaitStopsWithContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := Wait(ctx, time.Hour); err == nil {
		t.Fatal("expected the canceled context's error")
	}
}
