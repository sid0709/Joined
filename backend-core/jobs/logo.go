package jobs

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

const (
	// MaxLogoBytes is the largest logo a company page can store.
	MaxLogoBytes     = 2 << 20
	logoFetchTimeout = 8 * time.Second
	logoUserAgent    = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
	logoReferer      = "https://www.linkedin.com/"
	faviconSize      = 128
)

var logoClient = &http.Client{Timeout: logoFetchTimeout}

// OpenCompanyLogo serves a company mark. The current logo URL wins when it is
// not a LinkedIn file (those refuse hotlinking). A stored upload is used for
// LinkedIn URLs and when no URL is set. A failed fetch falls back to the site icon.
func (s *Store) OpenCompanyLogo(ctx context.Context, id string) (io.ReadCloser, string, error) {
	doc, err := s.storedCompanyByID(ctx, id)
	if err != nil {
		return nil, "", err
	}
	company := doc.publicCompany()
	logo, logoErr := safeLogoURL(company.Logo)
	linkedin := logoErr == nil && linkedInLogoHost(logo.Hostname())
	if hasLogoFile(doc.LogoFile) && (logoErr != nil || linkedin) {
		return io.NopCloser(bytes.NewReader(doc.LogoFile.Data)), doc.LogoFile.ContentType, nil
	}
	if logoErr == nil {
		body, contentType, fetchErr := fetchImage(ctx, logo, logoFetchReferer(logo.Hostname()))
		if fetchErr == nil {
			return body, contentType, nil
		}
	}
	if icon, err := faviconURL(company.URL); err == nil {
		body, contentType, fetchErr := fetchImage(ctx, icon, "")
		if fetchErr == nil {
			return body, contentType, nil
		}
	}
	return nil, "", ErrNotFound
}

func hasLogoFile(file logoFile) bool {
	return file.ContentType != "" && len(file.Data) > 0
}

func linkedInLogoHost(host string) bool {
	host = strings.ToLower(host)
	return host == "linkedin.com" || strings.HasSuffix(host, ".linkedin.com") || host == "licdn.com" || strings.HasSuffix(host, ".licdn.com")
}

func logoFetchReferer(host string) string {
	if linkedInLogoHost(host) {
		return logoReferer
	}
	return ""
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
	}{Reader: io.LimitReader(response.Body, MaxLogoBytes), Closer: response.Body}, contentType, nil
}

var allowedLogoTypes = map[string]struct{}{
	"image/png":  {},
	"image/jpeg": {},
	"image/gif":  {},
	"image/webp": {},
}

// LogoContentType reports a supported image type, or "" when the bytes are not one.
func LogoContentType(data []byte) string {
	detected := http.DetectContentType(data)
	if _, ok := allowedLogoTypes[detected]; ok {
		return detected
	}
	if len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return "image/webp"
	}
	return ""
}

// SaveCompanyLogo stores an uploaded mark beside the company, not inside overrides.
func (s *Store) SaveCompanyLogo(ctx context.Context, id, contentType string, data []byte) (AdminCompany, error) {
	if _, ok := allowedLogoTypes[contentType]; !ok || len(data) == 0 || len(data) > MaxLogoBytes {
		return AdminCompany{}, ErrInvalidInput
	}
	doc, err := s.storedCompanyByID(ctx, id)
	if err != nil {
		return AdminCompany{}, err
	}
	file := logoFile{ContentType: contentType, Data: data}
	_, err = s.companies().UpdateOne(ctx, bson.D{{Key: "id", Value: doc.ID}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "logoFile", Value: file}}},
	})
	if err != nil {
		return AdminCompany{}, err
	}
	doc.LogoFile = logoFile{ContentType: contentType}
	return doc.adminCompany(), nil
}

// ClearCompanyLogo removes an uploaded mark. A logo URL on the company is left as-is.
func (s *Store) ClearCompanyLogo(ctx context.Context, id string) (AdminCompany, error) {
	doc, err := s.storedCompanyByID(ctx, id)
	if err != nil {
		return AdminCompany{}, err
	}
	_, err = s.companies().UpdateOne(ctx, bson.D{{Key: "id", Value: doc.ID}}, bson.D{
		{Key: "$unset", Value: bson.D{{Key: "logoFile", Value: ""}}},
	})
	if err != nil {
		return AdminCompany{}, err
	}
	doc.LogoFile = logoFile{}
	return doc.adminCompany(), nil
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
