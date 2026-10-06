package httpkit

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	uptimeTimeout   = 5 * time.Second
	uptimeBodyLimit = 1024
	uptimeMinStatus = http.StatusOK
	uptimeMaxStatus = 299
)

// NotifyUptime pings url when it is set. An empty url is a no-op and does not
// open a connection. The error text never includes the URL or the response body.
func NotifyUptime(ctx context.Context, rawURL string) error {
	target := strings.TrimSpace(rawURL)
	if target == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, uptimeTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return errors.New("uptime ping url is invalid")
	}
	client := &http.Client{Timeout: uptimeTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return errors.New("uptime ping request failed")
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, uptimeBodyLimit))
	if resp.StatusCode < uptimeMinStatus || resp.StatusCode > uptimeMaxStatus {
		return fmt.Errorf("uptime ping status %d", resp.StatusCode)
	}
	return nil
}
