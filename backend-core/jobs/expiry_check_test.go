package jobs

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

type scriptedTransport struct {
	mu       sync.Mutex
	handlers []func(*http.Request) (*http.Response, error)
	requests []*http.Request
}

func (s *scriptedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cloned := req.Clone(req.Context())
	s.requests = append(s.requests, cloned)
	if len(s.handlers) == 0 {
		return response(http.StatusOK, req, "", ""), nil
	}
	h := s.handlers[0]
	if len(s.handlers) > 1 {
		s.handlers = s.handlers[1:]
	}
	return h(req)
}

func response(status int, req *http.Request, body, location string) *http.Response {
	header := http.Header{}
	if location != "" {
		header.Set("Location", location)
	}
	header.Set("Content-Type", "text/html")
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     header,
		Request:    req,
	}
}

func TestLinkCheckerHEADThenGETUserAgent(t *testing.T) {
	script := &scriptedTransport{handlers: []func(*http.Request) (*http.Response, error){
		func(req *http.Request) (*http.Response, error) {
			if req.Method != http.MethodHead {
				t.Fatalf("first method = %s", req.Method)
			}
			return response(http.StatusOK, req, "", ""), nil
		},
		func(req *http.Request) (*http.Response, error) {
			if req.Method != http.MethodGet {
				t.Fatalf("second method = %s", req.Method)
			}
			return response(http.StatusOK, req, "<html><body>Apply now</body></html>", ""), nil
		},
	}}
	checker := NewLinkChecker(ExpiryConfig{HostInterval: 0, Timeout: time.Second}).WithTransport(script)
	result := checker.Check(context.Background(), "https://jobs.example.com/apply/42")
	if !result.Open {
		t.Fatalf("result = %+v", result)
	}
	if len(script.requests) != 2 {
		t.Fatalf("requests = %d", len(script.requests))
	}
	for _, req := range script.requests {
		if got := req.Header.Get("User-Agent"); got != expiryUserAgent {
			t.Fatalf("User-Agent = %q", got)
		}
		if req.Header.Get("User-Agent") == "" || strings.Contains(strings.ToLower(req.Header.Get("User-Agent")), "mozilla") {
			t.Fatalf("User-Agent should be honest, got %q", req.Header.Get("User-Agent"))
		}
	}
}

func TestLinkChecker404IsClosedWithoutGET(t *testing.T) {
	script := &scriptedTransport{handlers: []func(*http.Request) (*http.Response, error){
		func(req *http.Request) (*http.Response, error) {
			return response(http.StatusNotFound, req, "", ""), nil
		},
	}}
	checker := NewLinkChecker(ExpiryConfig{HostInterval: 0, Timeout: time.Second}).WithTransport(script)
	result := checker.Check(context.Background(), "https://jobs.example.com/apply/missing")
	if result.Open || result.Signal != signalHTTP404 {
		t.Fatalf("result = %+v", result)
	}
	if len(script.requests) != 1 || script.requests[0].Method != http.MethodHead {
		t.Fatalf("should stop after HEAD 404, requests=%d", len(script.requests))
	}
}

func TestLinkChecker410IsClosed(t *testing.T) {
	script := &scriptedTransport{handlers: []func(*http.Request) (*http.Response, error){
		func(req *http.Request) (*http.Response, error) {
			return response(http.StatusGone, req, "", ""), nil
		},
	}}
	checker := NewLinkChecker(ExpiryConfig{HostInterval: 0, Timeout: time.Second}).WithTransport(script)
	result := checker.Check(context.Background(), "https://jobs.example.com/apply/gone")
	if result.Open || result.Signal != signalHTTP410 {
		t.Fatalf("result = %+v", result)
	}
}

func TestLinkCheckerCareersIndexRedirect(t *testing.T) {
	script := &scriptedTransport{handlers: []func(*http.Request) (*http.Response, error){
		func(req *http.Request) (*http.Response, error) {
			if strings.Contains(req.URL.Path, "/jobs/123") {
				return response(http.StatusFound, req, "", "https://boards.greenhouse.io/acme"), nil
			}
			return response(http.StatusOK, req, "<html>all jobs</html>", ""), nil
		},
	}}
	checker := NewLinkChecker(ExpiryConfig{HostInterval: 0, Timeout: time.Second}).WithTransport(script)
	result := checker.Check(context.Background(), "https://boards.greenhouse.io/acme/jobs/123")
	if result.Open || result.Signal != signalCareersIndex {
		t.Fatalf("result = %+v", result)
	}
}

func TestLinkCheckerATSClosedMarker(t *testing.T) {
	script := &scriptedTransport{handlers: []func(*http.Request) (*http.Response, error){
		func(req *http.Request) (*http.Response, error) {
			if req.Method == http.MethodHead {
				return response(http.StatusOK, req, "", ""), nil
			}
			return response(http.StatusOK, req, `<html>This job is no longer available</html>`, ""), nil
		},
	}}
	checker := NewLinkChecker(ExpiryConfig{HostInterval: 0, Timeout: time.Second}).WithTransport(script)
	result := checker.Check(context.Background(), "https://jobs.lever.co/acme/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
	if result.Open || result.Signal != signalATSClosed {
		t.Fatalf("result = %+v", result)
	}
}

func TestLinkCheckerATSClosedJSON(t *testing.T) {
	script := &scriptedTransport{handlers: []func(*http.Request) (*http.Response, error){
		func(req *http.Request) (*http.Response, error) {
			if req.Method == http.MethodHead {
				return response(http.StatusOK, req, "", ""), nil
			}
			return response(http.StatusOK, req, `{"status": "closed"}`, ""), nil
		},
	}}
	checker := NewLinkChecker(ExpiryConfig{HostInterval: 0, Timeout: time.Second}).WithTransport(script)
	result := checker.Check(context.Background(), "https://jobs.ashbyhq.com/acme/role-99")
	if result.Open || result.Signal != signalATSClosed {
		t.Fatalf("result = %+v", result)
	}
}

func TestLinkCheckerHEADNotAllowedFallsBackToGET(t *testing.T) {
	script := &scriptedTransport{handlers: []func(*http.Request) (*http.Response, error){
		func(req *http.Request) (*http.Response, error) {
			if req.Method == http.MethodHead {
				return response(http.StatusMethodNotAllowed, req, "", ""), nil
			}
			return response(http.StatusOK, req, "<html>Apply</html>", ""), nil
		},
	}}
	checker := NewLinkChecker(ExpiryConfig{HostInterval: 0, Timeout: time.Second}).WithTransport(script)
	result := checker.Check(context.Background(), "https://jobs.example.com/apply/ok")
	if !result.Open {
		t.Fatalf("result = %+v", result)
	}
}

func TestLinkCheckerInvalidURL(t *testing.T) {
	checker := NewLinkChecker(ExpiryConfig{HostInterval: 0, Timeout: time.Second})
	result := checker.Check(context.Background(), "ftp://jobs.example.com/apply")
	if result.Open || result.Signal != signalInvalidURL {
		t.Fatalf("result = %+v", result)
	}
}

func TestHostLimiterWaitsBetweenSameHost(t *testing.T) {
	var slept []time.Duration
	limiter := newHostLimiter(time.Second)
	limiter.now = func() time.Time { return time.Unix(100, 0) }
	limiter.sleep = func(_ context.Context, d time.Duration) error {
		slept = append(slept, d)
		return nil
	}
	if err := limiter.Wait(context.Background(), "Jobs.Example.com"); err != nil {
		t.Fatal(err)
	}
	if err := limiter.Wait(context.Background(), "jobs.example.com"); err != nil {
		t.Fatal(err)
	}
	if len(slept) != 1 || slept[0] != time.Second {
		t.Fatalf("slept = %v", slept)
	}
	if err := limiter.Wait(context.Background(), "other.example.com"); err != nil {
		t.Fatal(err)
	}
	if len(slept) != 1 {
		t.Fatalf("other host should not wait, slept = %v", slept)
	}
}

func TestIsCareersIndexRedirect(t *testing.T) {
	if !isCareersIndexRedirect("https://boards.greenhouse.io/acme/jobs/123", "https://boards.greenhouse.io/acme") {
		t.Fatal("greenhouse board root should count as careers index")
	}
	if isCareersIndexRedirect("https://boards.greenhouse.io/acme/jobs/123", "https://boards.greenhouse.io/acme/jobs/123/") {
		t.Fatal("trailing slash on the same job is not an index redirect")
	}
	if isCareersIndexRedirect("https://jobs.example.com/apply/42", "https://jobs.example.com/apply/42?src=board") {
		t.Fatal("query-only change is not an index redirect")
	}
}
