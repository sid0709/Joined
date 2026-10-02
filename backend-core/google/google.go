// Package google is the Google OAuth client every service shares: Sign in with
// Google and the job hunter's calendar connection both go through it.
package google

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"
)

const (
	authURL     = "https://accounts.google.com/o/oauth2/v2/auth"
	tokenURL    = "https://oauth2.googleapis.com/token"
	userInfoURL = "https://openidconnect.googleapis.com/v1/userinfo"
	maxBody     = 1 << 20
	stateBytes  = 32
	// verifierBytes gives a 43-character PKCE verifier, the shortest RFC 7636 allows.
	verifierBytes = 32
)

// Scopes this codebase asks for.
const (
	ScopeOpenID         = "openid"
	ScopeEmail          = "email"
	ScopeProfile        = "profile"
	ScopeCalendarEvents = "https://www.googleapis.com/auth/calendar.events"
)

// ErrInvalidGrant is a code or refresh token Google no longer accepts: used,
// expired, revoked, or sent with the wrong redirect URL or verifier.
var ErrInvalidGrant = errors.New("google rejected the authorization")

// Client is one OAuth client from Google Cloud → Credentials.
type Client struct {
	ClientID     string
	ClientSecret string
	HTTP         *http.Client
}

func (c *Client) Configured() bool {
	return c != nil && c.ClientID != "" && c.ClientSecret != ""
}

// HTTPClient is the client calls to Google APIs go through.
func (c *Client) HTTPClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return http.DefaultClient
}

// AuthRequest is one trip to Google's consent screen.
type AuthRequest struct {
	RedirectURL string
	Scopes      []string
	State       string
	// CodeChallenge is the PKCE S256 challenge from NewVerifier. Blank skips PKCE.
	CodeChallenge string
	// Offline asks for a refresh token, to call Google later without the person.
	Offline bool
	// Consent shows the consent screen even when everything was granted before,
	// which makes Google send a fresh refresh token.
	Consent bool
	// HostedDomain asks Google to offer only accounts of this Workspace domain. It
	// is a hint for the account picker: check Profile.HostedDomain after sign-in.
	HostedDomain string
}

// AuthURL is where to send the browser to sign in and grant scopes.
func (c *Client) AuthURL(req AuthRequest) string {
	values := url.Values{
		"client_id":              {c.ClientID},
		"redirect_uri":           {req.RedirectURL},
		"response_type":          {"code"},
		"scope":                  {strings.Join(req.Scopes, " ")},
		"state":                  {req.State},
		"include_granted_scopes": {"true"},
	}
	if req.CodeChallenge != "" {
		values.Set("code_challenge", req.CodeChallenge)
		values.Set("code_challenge_method", "S256")
	}
	if req.Offline {
		values.Set("access_type", "offline")
	}
	if req.Consent {
		values.Set("prompt", "consent")
	}
	if req.HostedDomain != "" {
		values.Set("hd", req.HostedDomain)
	}
	return authURL + "?" + values.Encode()
}

// Token is what Google returns for an authorization code.
type Token struct {
	AccessToken string `json:"access_token"`
	// RefreshToken is only sent the first time offline access is granted, or
	// whenever the consent screen was shown.
	RefreshToken string `json:"refresh_token"`
	// Scope lists what the person actually granted; they can untick scopes.
	Scope string `json:"scope"`
}

// Granted reports whether the person granted scope.
func (t Token) Granted(scope string) bool {
	return slices.Contains(strings.Fields(t.Scope), scope)
}

// Exchange trades the code from the redirect for tokens. redirectURL and
// verifier must be the ones the auth URL was built with.
func (c *Client) Exchange(ctx context.Context, code, redirectURL, verifier string) (Token, error) {
	values := url.Values{
		"code":          {code},
		"client_id":     {c.ClientID},
		"client_secret": {c.ClientSecret},
		"redirect_uri":  {redirectURL},
		"grant_type":    {"authorization_code"},
	}
	if verifier != "" {
		values.Set("code_verifier", verifier)
	}
	return c.token(ctx, values)
}

// AccessToken uses a stored refresh token to get a short-lived access token.
func (c *Client) AccessToken(ctx context.Context, refreshToken string) (string, error) {
	token, err := c.token(ctx, url.Values{
		"refresh_token": {refreshToken},
		"client_id":     {c.ClientID},
		"client_secret": {c.ClientSecret},
		"grant_type":    {"refresh_token"},
	})
	if err != nil {
		return "", err
	}
	return token.AccessToken, nil
}

// Profile is the signed-in Google account.
type Profile struct {
	// Subject is the account's stable Google ID; the email can change.
	Subject       string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	// HostedDomain is the Google Workspace domain that manages the account, or ""
	// for a personal Google account.
	HostedDomain string `json:"hd"`
}

// Profile reads who the access token belongs to. It needs the openid and email scopes.
func (c *Client) Profile(ctx context.Context, accessToken string) (Profile, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, userInfoURL, nil)
	if err != nil {
		return Profile{}, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	body, status, err := c.do(req)
	if err != nil {
		return Profile{}, err
	}
	if status >= 300 {
		return Profile{}, fmt.Errorf("google userinfo: status %d", status)
	}
	var profile Profile
	if err := json.Unmarshal(body, &profile); err != nil {
		return Profile{}, err
	}
	profile.Email = strings.ToLower(strings.TrimSpace(profile.Email))
	profile.Name = strings.TrimSpace(profile.Name)
	profile.HostedDomain = strings.ToLower(strings.TrimSpace(profile.HostedDomain))
	return profile, nil
}

func (c *Client) token(ctx context.Context, values url.Values) (Token, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(values.Encode()))
	if err != nil {
		return Token{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	body, status, err := c.do(req)
	if err != nil {
		return Token{}, err
	}
	if status >= 300 {
		var failure struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(body, &failure) == nil && failure.Error == "invalid_grant" {
			return Token{}, ErrInvalidGrant
		}
		return Token{}, fmt.Errorf("google token: status %d", status)
	}
	var token Token
	if err := json.Unmarshal(body, &token); err != nil {
		return Token{}, err
	}
	return token, nil
}

func (c *Client) do(req *http.Request) ([]byte, int, error) {
	res, err := c.HTTPClient().Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	body, err := ReadBody(res)
	if err != nil {
		return nil, 0, err
	}
	return body, res.StatusCode, nil
}

// ReadBody reads a Google API response, capped so a bad reply cannot exhaust memory.
func ReadBody(res *http.Response) ([]byte, error) {
	return io.ReadAll(io.LimitReader(res.Body, maxBody))
}

// NewState is an unguessable OAuth state value.
func NewState() (string, error) {
	return randomString(stateBytes)
}

// NewVerifier is a PKCE code verifier and its S256 challenge for the auth URL.
func NewVerifier() (verifier, challenge string, err error) {
	verifier, err = randomString(verifierBytes)
	if err != nil {
		return "", "", err
	}
	sum := sha256.Sum256([]byte(verifier))
	return verifier, base64.RawURLEncoding.EncodeToString(sum[:]), nil
}

func randomString(size int) (string, error) {
	raw := make([]byte, size)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}
