package auth

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/smtp"
	"strings"
	"testing"
)

type fakeSMTPClient struct {
	from    string
	to      string
	message string
	authd   bool
	tlsUsed bool
	closed  bool
	err     error
}

func (f *fakeSMTPClient) Mail(from string) error {
	if f.err != nil {
		return f.err
	}
	f.from = from
	return nil
}

func (f *fakeSMTPClient) Rcpt(to string) error {
	if f.err != nil {
		return f.err
	}
	f.to = to
	return nil
}

func (f *fakeSMTPClient) Data() (io.WriteCloser, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &fakeWriteCloser{client: f}, nil
}

func (f *fakeSMTPClient) Quit() error {
	return nil
}

func (f *fakeSMTPClient) Close() error {
	f.closed = true
	return nil
}

func (f *fakeSMTPClient) StartTLS(config *tls.Config) error {
	f.tlsUsed = true
	return nil
}

func (f *fakeSMTPClient) Auth(a smtp.Auth) error {
	f.authd = true
	return nil
}

type fakeWriteCloser struct {
	client *fakeSMTPClient
}

func (f *fakeWriteCloser) Write(p []byte) (n int, err error) {
	f.client.message += string(p)
	return len(p), nil
}

func (f *fakeWriteCloser) Close() error {
	return nil
}

func TestSMTPProviderSendVerification(t *testing.T) {
	var client *fakeSMTPClient
	provider := &SMTPProvider{
		Host:     "smtp.example.com",
		Port:     "587",
		Username: "user@example.com",
		Password: "password",
		From:     "noreply@example.com",
		Config: EmailTemplateConfig{
			ProductName: "TestApp",
			AppBaseURL:  "https://example.com",
		},
		DialFunc: func(addr string) (smtpClient, error) {
			client = &fakeSMTPClient{}
			return client, nil
		},
	}

	err := provider.SendVerification(context.Background(), "alice@example.com", "Alice", "token123")
	if err != nil {
		t.Fatalf("SendVerification failed: %v", err)
	}

	if client.from != "noreply@example.com" {
		t.Errorf("got from %q, want %q", client.from, "noreply@example.com")
	}
	if client.to != "alice@example.com" {
		t.Errorf("got to %q, want %q", client.to, "alice@example.com")
	}
	if !client.authd {
		t.Error("expected authentication to be used")
	}
	if !client.tlsUsed {
		t.Error("expected TLS to be used")
	}
	if !strings.Contains(client.message, "Verify your TestApp account") {
		t.Error("message missing subject")
	}
	if !strings.Contains(client.message, "Alice") {
		t.Error("message missing recipient name")
	}
	if !strings.Contains(client.message, "https://example.com/verify?token=token123") {
		t.Error("message missing verification link")
	}
	if !strings.Contains(client.message, "text/plain") {
		t.Error("message missing text part")
	}
	if !strings.Contains(client.message, "text/html") {
		t.Error("message missing html part")
	}
}

func TestSMTPProviderSendPasswordReset(t *testing.T) {
	var client *fakeSMTPClient
	provider := &SMTPProvider{
		Host:     "smtp.example.com",
		Port:     "587",
		Username: "user@example.com",
		Password: "password",
		From:     "noreply@example.com",
		Config: EmailTemplateConfig{
			ProductName: "TestApp",
			AppBaseURL:  "https://example.com",
		},
		DialFunc: func(addr string) (smtpClient, error) {
			client = &fakeSMTPClient{}
			return client, nil
		},
	}

	err := provider.SendPasswordReset(context.Background(), "bob@example.com", "Bob", "resettoken")
	if err != nil {
		t.Fatalf("SendPasswordReset failed: %v", err)
	}

	if client.from != "noreply@example.com" {
		t.Errorf("got from %q, want %q", client.from, "noreply@example.com")
	}
	if client.to != "bob@example.com" {
		t.Errorf("got to %q, want %q", client.to, "bob@example.com")
	}
	if !strings.Contains(client.message, "Reset your TestApp password") {
		t.Error("message missing subject")
	}
	if !strings.Contains(client.message, "Bob") {
		t.Error("message missing recipient name")
	}
	if !strings.Contains(client.message, "https://example.com/reset-password?token=resettoken") {
		t.Error("message missing reset link")
	}
}

func TestSMTPProviderDialError(t *testing.T) {
	provider := &SMTPProvider{
		Host: "smtp.example.com",
		Port: "587",
		From: "noreply@example.com",
		Config: EmailTemplateConfig{
			ProductName: "TestApp",
			AppBaseURL:  "https://example.com",
		},
		DialFunc: func(addr string) (smtpClient, error) {
			return nil, errors.New("connection failed")
		},
	}

	err := provider.SendVerification(context.Background(), "alice@example.com", "Alice", "token123")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "dial smtp") {
		t.Errorf("expected dial error, got: %v", err)
	}
}

func TestResendProviderSendVerification(t *testing.T) {
	var capturedRequest *http.Request
	var capturedBody resendEmailRequest

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedRequest = r
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &capturedBody)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"id":"email-123"}`))
	}))
	defer server.Close()

	provider := &ResendProvider{
		APIKey:  "test-api-key",
		From:    "noreply@example.com",
		BaseURL: server.URL,
		Config: EmailTemplateConfig{
			ProductName: "TestApp",
			AppBaseURL:  "https://example.com",
		},
	}

	err := provider.SendVerification(context.Background(), "alice@example.com", "Alice", "token123")
	if err != nil {
		t.Fatalf("SendVerification failed: %v", err)
	}

	if capturedRequest == nil {
		t.Fatal("no request captured")
	}

	auth := capturedRequest.Header.Get("Authorization")
	if auth != "Bearer test-api-key" {
		t.Errorf("got authorization %q, want %q", auth, "Bearer test-api-key")
	}

	contentType := capturedRequest.Header.Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("got content-type %q, want %q", contentType, "application/json")
	}

	if capturedBody.From != "noreply@example.com" {
		t.Errorf("got from %q, want %q", capturedBody.From, "noreply@example.com")
	}
	if len(capturedBody.To) != 1 || capturedBody.To[0] != "alice@example.com" {
		t.Errorf("got to %v, want [%q]", capturedBody.To, "alice@example.com")
	}
	if capturedBody.Subject != "Verify your TestApp account" {
		t.Errorf("got subject %q, want %q", capturedBody.Subject, "Verify your TestApp account")
	}
	if !strings.Contains(capturedBody.Text, "Alice") {
		t.Error("text body missing recipient name")
	}
	if !strings.Contains(capturedBody.HTML, "https://example.com/verify?token=token123") {
		t.Error("html body missing verification link")
	}
}

func TestResendProviderSendPasswordReset(t *testing.T) {
	var capturedBody resendEmailRequest

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &capturedBody)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"id":"email-456"}`))
	}))
	defer server.Close()

	provider := &ResendProvider{
		APIKey:  "test-api-key",
		From:    "noreply@example.com",
		BaseURL: server.URL,
		Config: EmailTemplateConfig{
			ProductName: "TestApp",
			AppBaseURL:  "https://example.com",
		},
	}

	err := provider.SendPasswordReset(context.Background(), "bob@example.com", "Bob", "resettoken")
	if err != nil {
		t.Fatalf("SendPasswordReset failed: %v", err)
	}

	if capturedBody.Subject != "Reset your TestApp password" {
		t.Errorf("got subject %q, want %q", capturedBody.Subject, "Reset your TestApp password")
	}
	if !strings.Contains(capturedBody.Text, "Bob") {
		t.Error("text body missing recipient name")
	}
	if !strings.Contains(capturedBody.HTML, "https://example.com/reset-password?token=resettoken") {
		t.Error("html body missing reset link")
	}
}

func TestResendProviderAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error":"Invalid email"}`))
	}))
	defer server.Close()

	provider := &ResendProvider{
		APIKey:  "test-api-key",
		From:    "noreply@example.com",
		BaseURL: server.URL,
		Config: EmailTemplateConfig{
			ProductName: "TestApp",
			AppBaseURL:  "https://example.com",
		},
	}

	err := provider.SendVerification(context.Background(), "invalid", "Test", "token")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "resend api error") {
		t.Errorf("expected api error, got: %v", err)
	}
}

func TestValidateProviderConfig(t *testing.T) {
	tests := []struct {
		name      string
		provider  string
		from      string
		hasSMTP   bool
		hasResend bool
		wantErr   bool
	}{
		{
			name:     "log provider no config needed",
			provider: "log",
		},
		{
			name:     "empty provider defaults to log",
			provider: "",
		},
		{
			name:     "smtp with config",
			provider: "smtp",
			from:     "test@example.com",
			hasSMTP:  true,
		},
		{
			name:     "smtp missing config",
			provider: "smtp",
			wantErr:  true,
		},
		{
			name:     "smtp missing from",
			provider: "smtp",
			hasSMTP:  true,
			wantErr:  true,
		},
		{
			name:      "resend with config",
			provider:  "resend",
			from:      "test@example.com",
			hasResend: true,
		},
		{
			name:     "resend missing config",
			provider: "resend",
			wantErr:  true,
		},
		{
			name:      "resend missing from",
			provider:  "resend",
			hasResend: true,
			wantErr:   true,
		},
		{
			name:     "unknown provider",
			provider: "sendgrid",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateProviderConfig(tt.provider, tt.from, tt.hasSMTP, tt.hasResend)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateProviderConfig() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestBuildMIMEMessage(t *testing.T) {
	msg, err := buildMIMEMessage(
		"from@example.com",
		"to@example.com",
		"Test Subject",
		"Plain text body",
		"<html><body>HTML body</body></html>",
	)
	if err != nil {
		t.Fatalf("buildMIMEMessage failed: %v", err)
	}

	if !strings.Contains(msg, "From: from@example.com") {
		t.Error("message missing from header")
	}
	if !strings.Contains(msg, "To: to@example.com") {
		t.Error("message missing to header")
	}
	if !strings.Contains(msg, "Subject: Test Subject") {
		t.Error("message missing subject header")
	}
	if !strings.Contains(msg, "MIME-Version: 1.0") {
		t.Error("message missing MIME version")
	}
	if !strings.Contains(msg, "multipart/alternative") {
		t.Error("message missing multipart/alternative content type")
	}
	if !strings.Contains(msg, "text/plain") {
		t.Error("message missing text/plain part")
	}
	if !strings.Contains(msg, "text/html") {
		t.Error("message missing text/html part")
	}
	if !strings.Contains(msg, "Plain text body") {
		t.Error("message missing text body")
	}
	if !strings.Contains(msg, "HTML body") {
		t.Error("message missing html body")
	}
}
