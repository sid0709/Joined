package jobs

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	maxLogoBytes     = 2 << 20
	logoFetchTimeout = 8 * time.Second
	logoUserAgent    = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
	logoReferer      = "https://www.linkedin.com/"
	faviconSize      = 128
)

var logoClient = &http.Client{Timeout: logoFetchTimeout}

// OpenCompanyLogo serves a company mark. Stored logos are usually on LinkedIn,
// which refuses hotlinking (and refuses this server too), so a failed fetch
// falls back to the icon for the company website.
func (s *Store) OpenCompanyLogo(ctx context.Context, id string) (io.ReadCloser, string, error) {
	company, err := s.publicCompany(ctx, id)
	if err != nil {
		return nil, "", err
	}
	if logo, err := safeLogoURL(company.Logo); err == nil {
		body, contentType, fetchErr := fetchImage(ctx, logo, logoReferer)
		if fetchErr == nil {
			return body, contentType, nil
		}
	}
	if icon, err := faviconURL(company.URL); err == nil {
		return fetchImage(ctx, icon, "")
	}
	return nil, "", ErrNotFound
}

func fetchImage(ctx context.Context, target *url.URL, referer string) (io.ReadCloser, string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, "", err
	}
	request.Header.Set("User-Agent", logoUserAgent)
	request.Header.Set("Accept", "image/avif,image/webp,image/*,*/*;q=0.8")
	if referer != "" {
		request.Header.Set("Referer", referer)
	}

	response, err := logoClient.Do(request)
	if err != nil {
		return nil, "", err
	}
	if response.StatusCode != http.StatusOK {
		response.Body.Close()
		return nil, "", ErrNotFound
	}
	contentType := response.Header.Get("Content-Type")
	if semicolon := strings.IndexByte(contentType, ';'); semicolon >= 0 {
		contentType = strings.TrimSpace(contentType[:semicolon])
	}
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		response.Body.Close()
		return nil, "", ErrNotFound
	}
	return struct {
		io.Reader
		io.Closer
	}{Reader: io.LimitReader(response.Body, maxLogoBytes), Closer: response.Body}, contentType, nil
}

func faviconURL(website string) (*url.URL, error) {
	parsed, err := safeLogoURL(website)
	if err != nil {
		return nil, err
	}
	return url.Parse(fmt.Sprintf("https://www.google.com/s2/favicons?domain=%s&sz=%d", url.QueryEscape(parsed.Hostname()), faviconSize))
}

func safeLogoURL(raw string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Host == "" {
		return nil, ErrNotFound
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return nil, ErrNotFound
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" || host == "127.0.0.1" || host == "::1" || strings.HasSuffix(host, ".local") {
		return nil, ErrNotFound
	}
	return parsed, nil
}
