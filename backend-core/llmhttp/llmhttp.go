// Package llmhttp is the HTTP plumbing every model client shares: a pooled client
// sized for many requests in flight, and backoff between retries.
package llmhttp

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	// maxConns lets a bulk run keep this many requests open to one model host.
	maxConns     = 256
	retryBase    = 500 * time.Millisecond
	maxRetryWait = 8 * time.Second
)

// NewClient is an HTTP client that reuses connections to one host under heavy concurrency.
func NewClient(timeout time.Duration) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.MaxIdleConns = maxConns
	transport.MaxIdleConnsPerHost = maxConns
	transport.MaxConnsPerHost = maxConns
	return &http.Client{Timeout: timeout, Transport: transport}
}

// Retryable reports whether a response status is worth another attempt.
func Retryable(status int) bool {
	return status == http.StatusTooManyRequests || status >= http.StatusInternalServerError
}

// RetryDelay is how long to wait before the next attempt: the server's Retry-After in
// seconds when it sent one, otherwise an exponential backoff. Both are capped.
func RetryDelay(attempt int, retryAfter string) time.Duration {
	if seconds, err := strconv.Atoi(strings.TrimSpace(retryAfter)); err == nil && seconds > 0 {
		return min(time.Duration(seconds)*time.Second, maxRetryWait)
	}
	return min(retryBase<<attempt, maxRetryWait)
}

// Wait sleeps for delay, or returns early with the context's error.
func Wait(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// CleanSourceURL drops tracking parameters and fragments so the same page is listed
// once. Anything but an http(s) link becomes "".
func CleanSourceURL(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return ""
	}
	query := parsed.Query()
	for key := range query {
		if strings.HasPrefix(strings.ToLower(key), "utm_") {
			query.Del(key)
		}
	}
	parsed.RawQuery = query.Encode()
	parsed.Fragment = ""
	return parsed.String()
}
