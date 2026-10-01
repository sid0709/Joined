package scout

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"syscall"
	"time"
)

const (
	fetchTimeout      = 10 * time.Second
	maxFetchRedirects = 5
	maxPageBytes      = 1 << 20
	fetchUserAgent    = "ScoutwellBot/1.0 (+job link verification)"
)

// Page is what the reachability check learned about a link.
type Page struct {
	Status   int
	FinalURL string
	Text     string
	// Err is set when the request never produced a response (DNS, TLS, timeout, blocked).
	Err error
}

// Fetcher loads a job page. Tests swap in a fake.
type Fetcher interface {
	Fetch(ctx context.Context, rawURL string) Page
}

var errBlockedAddress = errors.New("link resolves to a private or reserved address")

// HTTPFetcher fetches public pages only: every dial, including after redirects,
// refuses loopback, private, link-local, and other reserved addresses.
type HTTPFetcher struct {
	client *http.Client
}

// NewHTTPFetcher returns a fetcher with the reachability rules from docs/13:
// 200 after redirects within ten seconds.
func NewHTTPFetcher() *HTTPFetcher {
	dialer := &net.Dialer{Timeout: fetchTimeout, Control: refusePrivate}
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           dialer.DialContext,
		TLSHandshakeTimeout:   fetchTimeout,
		ResponseHeaderTimeout: fetchTimeout,
		MaxIdleConns:          16,
		IdleConnTimeout:       30 * time.Second,
	}
	return &HTTPFetcher{client: &http.Client{
		Timeout:   fetchTimeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= maxFetchRedirects {
				return fmt.Errorf("stopped after %d redirects", maxFetchRedirects)
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return fmt.Errorf("redirect to unsupported scheme %q", req.URL.Scheme)
			}
			return nil
		},
	}}
}

func (f *HTTPFetcher) Fetch(ctx context.Context, rawURL string) Page {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return Page{Err: err}
	}
	req.Header.Set("User-Agent", fetchUserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5")
	req.Header.Set("Accept-Language", "en")
	resp, err := f.client.Do(req)
	if err != nil {
		return Page{Err: err}
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, maxPageBytes))
	text := ""
	if strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "html") || looksLikeHTML(body) {
		text = HTMLText(string(body))
	}
	return Page{Status: resp.StatusCode, FinalURL: resp.Request.URL.String(), Text: text}
}

func looksLikeHTML(body []byte) bool {
	head := strings.ToLower(string(body[:min(len(body), 512)]))
	return strings.Contains(head, "<html") || strings.Contains(head, "<!doctype html")
}

// refusePrivate runs after DNS resolution, so a public name pointing at an
// internal address is refused too.
func refusePrivate(_, address string, _ syscall.RawConn) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return err
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return err
	}
	if !PublicAddress(ip) {
		return errBlockedAddress
	}
	return nil
}

var reservedPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("64:ff9b::/96"),
	netip.MustParsePrefix("2001:db8::/32"),
}

// PublicAddress reports whether an address is routable on the public internet.
func PublicAddress(ip netip.Addr) bool {
	ip = ip.Unmap()
	if !ip.IsValid() || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() || ip.IsMulticast() ||
		ip.IsUnspecified() {
		return false
	}
	for _, prefix := range reservedPrefixes {
		if prefix.Contains(ip) {
			return false
		}
	}
	return true
}
