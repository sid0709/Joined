package jobs

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	expiryUserAgent    = "JoinedBot/1.0 (+job apply-link verification)"
	maxExpiryRedirects = 5
	maxExpiryBodyBytes = 1 << 20

	signalHTTP404      = "http_404"
	signalHTTP410      = "http_410"
	signalCareersIndex = "careers_index"
	signalATSClosed    = "ats_closed"
	signalTimeout      = "timeout"
	signalNetwork      = "network"
	signalHTTP5xx      = "http_5xx"
	signalHTTPOther    = "http_error"
	signalInvalidURL   = "invalid_url"
	signalRedirectLoop = "redirect_loop"
)

type linkResult struct {
	Open     bool
	Signal   string
	Status   int
	FinalURL string
}

type probe struct {
	Status   int
	FinalURL string
	Body     string
}

// LinkChecker probes apply URLs with a polite HEAD, then GET when needed.
type LinkChecker struct {
	client    *http.Client
	limiter   *hostLimiter
	timeout   time.Duration
	userAgent string
}

func NewLinkChecker(cfg ExpiryConfig) *LinkChecker {
	cfg = cfg.withDefaults()
	checker := &LinkChecker{
		limiter:   newHostLimiter(cfg.HostInterval),
		timeout:   cfg.Timeout,
		userAgent: expiryUserAgent,
	}
	checker.client = &http.Client{
		Timeout: cfg.Timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= maxExpiryRedirects {
				return fmt.Errorf("%s: stopped after %d redirects", signalRedirectLoop, maxExpiryRedirects)
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return fmt.Errorf("redirect to unsupported scheme %q", req.URL.Scheme)
			}
			req.Header.Set("User-Agent", expiryUserAgent)
			return nil
		},
	}
	return checker
}

func (c *LinkChecker) WithTransport(rt http.RoundTripper) *LinkChecker {
	clone := *c
	client := *c.client
	client.Transport = rt
	clone.client = &client
	return &clone
}

func (c *LinkChecker) Check(ctx context.Context, applyURL string) linkResult {
	raw := strings.TrimSpace(applyURL)
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return linkResult{Signal: signalInvalidURL}
	}

	head, headErr := c.do(ctx, http.MethodHead, raw)
	if headErr == nil {
		if result, closed := closedFromProbe(raw, head, ""); closed {
			return result
		}
	}

	get, getErr := c.do(ctx, http.MethodGet, raw)
	if getErr != nil {
		if headErr == nil && isGone(head.Status) {
			return closedFromStatus(head)
		}
		return resultFromErr(getErr)
	}
	result, _ := closedFromProbe(raw, get, get.Body)
	if result.Signal != "" {
		return result
	}
	if get.Status >= 400 {
		return linkResult{Signal: httpFailureSignal(get.Status), Status: get.Status, FinalURL: get.FinalURL}
	}
	return linkResult{Open: true, Status: get.Status, FinalURL: get.FinalURL}
}

func closedFromProbe(original string, p probe, body string) (linkResult, bool) {
	if isGone(p.Status) {
		return closedFromStatus(p), true
	}
	if isCareersIndexRedirect(original, p.FinalURL) {
		return linkResult{Signal: signalCareersIndex, Status: p.Status, FinalURL: p.FinalURL}, true
	}
	if body != "" {
		if marker := atsClosedMarker(body); marker != "" {
			return linkResult{Signal: signalATSClosed, Status: p.Status, FinalURL: p.FinalURL}, true
		}
	}
	return linkResult{}, false
}

func closedFromStatus(p probe) linkResult {
	signal := signalHTTP404
	if p.Status == http.StatusGone {
		signal = signalHTTP410
	}
	return linkResult{Signal: signal, Status: p.Status, FinalURL: p.FinalURL}
}

func isGone(status int) bool {
	return status == http.StatusNotFound || status == http.StatusGone
}

func httpFailureSignal(status int) string {
	if status >= 500 {
		return signalHTTP5xx
	}
	return signalHTTPOther
}

func resultFromErr(err error) linkResult {
	if err == nil {
		return linkResult{Signal: signalNetwork}
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, signalRedirectLoop) {
		return linkResult{Signal: signalRedirectLoop}
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return linkResult{Signal: signalTimeout}
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return linkResult{Signal: signalTimeout}
	}
	return linkResult{Signal: signalNetwork}
}

func (c *LinkChecker) do(ctx context.Context, method, rawURL string) (probe, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return probe{}, err
	}
	if err := c.limiter.Wait(ctx, parsed.Hostname()); err != nil {
		return probe{}, err
	}
	reqCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, method, rawURL, nil)
	if err != nil {
		return probe{}, err
	}
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5")
	req.Header.Set("Accept-Language", "en")
	resp, err := c.client.Do(req)
	if err != nil {
		return probe{}, err
	}
	defer resp.Body.Close()
	body := ""
	if method != http.MethodHead {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, maxExpiryBodyBytes))
		body = string(raw)
	} else {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, maxExpiryBodyBytes))
	}
	finalURL := rawURL
	if resp.Request != nil && resp.Request.URL != nil {
		finalURL = resp.Request.URL.String()
	}
	return probe{Status: resp.StatusCode, FinalURL: finalURL, Body: body}, nil
}

type hostLimiter struct {
	mu       sync.Mutex
	last     map[string]time.Time
	interval time.Duration
	now      func() time.Time
	sleep    func(context.Context, time.Duration) error
}

func newHostLimiter(interval time.Duration) *hostLimiter {
	return &hostLimiter{
		last:     map[string]time.Time{},
		interval: interval,
		now:      time.Now,
		sleep:    sleepContext,
	}
}

func (l *hostLimiter) Wait(ctx context.Context, host string) error {
	if l == nil || l.interval <= 0 {
		return nil
	}
	host = normalizeHost(host)
	if host == "" {
		return nil
	}
	l.mu.Lock()
	last := l.last[host]
	now := l.now()
	wait := l.interval - now.Sub(last)
	if last.IsZero() || wait <= 0 {
		l.last[host] = now
		l.mu.Unlock()
		return nil
	}
	l.last[host] = now.Add(wait)
	l.mu.Unlock()
	return l.sleep(ctx, wait)
}

func sleepContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

var (
	uuidSegment     = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	numericSegment  = regexp.MustCompile(`^\d+$`)
	digitInSegment  = regexp.MustCompile(`\d`)
	atsClosedJSON   = []string{`"status":"closed"`, `"status":"archived"`, `"state":"closed"`, `"live":false`, `"isexpired":true`}
	atsClosedPhrase = []string{
		"no longer accepting applications",
		"position has been filled",
		"this position is filled",
		"job is no longer available",
		"this job is no longer available",
		"posting has been closed",
		"job posting is closed",
		"this job has expired",
		"job has been closed",
		"the job you are looking for is no longer open",
		"this position is no longer open",
		"no longer open for applications",
		"sorry, this job is no longer available",
		"this position has been filled",
		"the job you are trying to apply for is no longer available",
	}
	indexPathSegment = map[string]struct{}{
		"jobs": {}, "job": {}, "careers": {}, "career": {}, "openings": {},
		"positions": {}, "position": {}, "vacancies": {}, "vacancy": {},
		"opportunities": {}, "join": {}, "join-us": {}, "work-with-us": {},
	}
	jobParentSegment = map[string]struct{}{
		"jobs": {}, "job": {}, "careers": {}, "career": {}, "openings": {},
		"positions": {}, "position": {}, "vacancies": {},
	}
)

func atsClosedMarker(body string) string {
	lower := strings.ToLower(body)
	for _, marker := range atsClosedPhrase {
		if strings.Contains(lower, marker) {
			return marker
		}
	}
	compact := strings.NewReplacer(" ", "", "\n", "", "\r", "", "\t", "").Replace(lower)
	for _, marker := range atsClosedJSON {
		if strings.Contains(compact, marker) {
			return marker
		}
	}
	return ""
}

func isCareersIndexRedirect(original, final string) bool {
	if strings.TrimSpace(final) == "" || strings.TrimSpace(original) == "" {
		return false
	}
	from, err := url.Parse(original)
	if err != nil {
		return false
	}
	to, err := url.Parse(final)
	if err != nil {
		return false
	}
	fromPath := normalizeURLPath(from.Path)
	toPath := normalizeURLPath(to.Path)
	if fromPath == toPath {
		return false
	}
	if !hasJobSpecificPath(fromPath) {
		return false
	}
	return isIndexPath(toPath)
}

func normalizeURLPath(path string) string {
	path = strings.ToLower(strings.TrimSpace(path))
	path = strings.Trim(path, "/")
	return path
}

func splitURLPath(path string) []string {
	path = normalizeURLPath(path)
	if path == "" {
		return nil
	}
	return strings.Split(path, "/")
}

func hasJobSpecificPath(path string) bool {
	parts := splitURLPath(path)
	if len(parts) == 0 {
		return false
	}
	last := parts[len(parts)-1]
	if _, ok := indexPathSegment[last]; ok {
		return false
	}
	if looksLikeJobID(last) {
		return true
	}
	for _, part := range parts[:len(parts)-1] {
		if _, ok := jobParentSegment[part]; ok {
			return true
		}
	}
	return false
}

func isIndexPath(path string) bool {
	parts := splitURLPath(path)
	if len(parts) == 0 {
		return true
	}
	for _, part := range parts {
		if _, ok := indexPathSegment[part]; !ok {
			return len(parts) == 1
		}
	}
	return true
}

func looksLikeJobID(seg string) bool {
	if uuidSegment.MatchString(seg) || numericSegment.MatchString(seg) {
		return true
	}
	return digitInSegment.MatchString(seg) && len(seg) >= 4
}
