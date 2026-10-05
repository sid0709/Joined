package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/quotedprintable"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"time"
)

const (
	smtpImplicitTLSPort     = "465"
	defaultEmailSendTimeout = 10 * time.Second
	defaultResendAPIURL     = "https://api.resend.com/emails"
)

// SMTPProvider sends email via an SMTP server.
type SMTPProvider struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
	Config   EmailTemplateConfig
	// Insecure continues without STARTTLS when the upgrade fails. Local development only.
	Insecure bool
	// DialFunc allows overriding the SMTP dial for testing
	DialFunc func(addr string) (smtpClient, error)
}

// smtpClient is the interface we need from smtp.Client for testing.
type smtpClient interface {
	Mail(string) error
	Rcpt(string) error
	Data() (io.WriteCloser, error)
	Quit() error
	Close() error
	StartTLS(*tls.Config) error
	Auth(smtp.Auth) error
}

// realSMTPClient wraps *smtp.Client to implement smtpClient.
type realSMTPClient struct {
	*smtp.Client
}

func (s *SMTPProvider) SendVerification(ctx context.Context, to, name, token string) error {
	content, err := RenderVerificationEmail(s.Config, name, token)
	if err != nil {
		return fmt.Errorf("render verification email: %w", err)
	}
	return s.send(ctx, to, content.Subject, content.TextBody, content.HTMLBody)
}

func (s *SMTPProvider) SendPasswordReset(ctx context.Context, to, name, token string) error {
	content, err := RenderPasswordResetEmail(s.Config, name, token)
	if err != nil {
		return fmt.Errorf("render password reset email: %w", err)
	}
	return s.send(ctx, to, content.Subject, content.TextBody, content.HTMLBody)
}

func (s *SMTPProvider) SendDuplicateSignupNotice(ctx context.Context, to string) error {
	content, err := RenderDuplicateSignupEmail(s.Config)
	if err != nil {
		return fmt.Errorf("render duplicate signup email: %w", err)
	}
	return s.send(ctx, to, content.Subject, content.TextBody, content.HTMLBody)
}

func (s *SMTPProvider) send(ctx context.Context, to, subject, textBody, htmlBody string) error {
	if err := validateEmailHeaders(s.From, to, subject); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, defaultEmailSendTimeout)
	defer cancel()

	addr := net.JoinHostPort(s.Host, s.Port)

	var client smtpClient
	var err error

	if s.DialFunc != nil {
		client, err = s.DialFunc(addr)
	} else {
		client, err = s.dialSMTP(ctx, addr)
	}
	if err != nil {
		return fmt.Errorf("dial smtp: %w", err)
	}
	defer client.Close()

	if !s.implicitTLS() {
		if err := client.StartTLS(&tls.Config{ServerName: s.Host}); err != nil {
			if !s.Insecure {
				return fmt.Errorf("smtp starttls: %w", err)
			}
			slog.Warn("smtp starttls failed; continuing because EMAIL_SMTP_INSECURE is set", "error", err)
		}
	}

	if s.Username != "" && s.Password != "" {
		auth := smtp.PlainAuth("", s.Username, s.Password, s.Host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}

	if err := client.Mail(s.From); err != nil {
		return fmt.Errorf("smtp mail: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}

	msg, err := buildMIMEMessage(s.From, to, subject, textBody, htmlBody)
	if err != nil {
		w.Close()
		return fmt.Errorf("build mime message: %w", err)
	}

	if _, err := w.Write([]byte(msg)); err != nil {
		w.Close()
		return fmt.Errorf("write message: %w", err)
	}

	if err := w.Close(); err != nil {
		return fmt.Errorf("close message: %w", err)
	}

	return client.Quit()
}

func (s *SMTPProvider) implicitTLS() bool {
	return s.Port == smtpImplicitTLSPort
}

func (s *SMTPProvider) dialSMTP(ctx context.Context, addr string) (smtpClient, error) {
	timeout := defaultEmailSendTimeout
	if deadline, ok := ctx.Deadline(); ok {
		if remaining := time.Until(deadline); remaining > 0 && remaining < timeout {
			timeout = remaining
		}
	}
	dialer := &net.Dialer{Timeout: timeout}
	tlsConfig := &tls.Config{ServerName: s.Host}

	var conn net.Conn
	var err error
	if s.implicitTLS() {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, tlsConfig)
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return nil, err
	}
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}
	client, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		conn.Close()
		return nil, err
	}
	return &realSMTPClient{client}, nil
}

func buildMIMEMessage(from, to, subject, textBody, htmlBody string) (string, error) {
	boundary, err := newMIMEBoundary()
	if err != nil {
		return "", err
	}
	messageID, err := newMessageID(from)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	buf.WriteString("From: " + from + "\r\n")
	buf.WriteString("To: " + to + "\r\n")
	buf.WriteString("Subject: " + subject + "\r\n")
	buf.WriteString("Date: " + time.Now().UTC().Format(time.RFC1123Z) + "\r\n")
	buf.WriteString("Message-ID: " + messageID + "\r\n")
	buf.WriteString("MIME-Version: 1.0\r\n")
	buf.WriteString("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n")
	buf.WriteString("\r\n")

	if err := writeQuotedPrintablePart(&buf, boundary, `text/plain; charset="UTF-8"`, textBody); err != nil {
		return "", err
	}
	if err := writeQuotedPrintablePart(&buf, boundary, `text/html; charset="UTF-8"`, htmlBody); err != nil {
		return "", err
	}
	buf.WriteString("--" + boundary + "--\r\n")
	return buf.String(), nil
}

func writeQuotedPrintablePart(buf *bytes.Buffer, boundary, contentType, body string) error {
	buf.WriteString("--" + boundary + "\r\n")
	buf.WriteString("Content-Type: " + contentType + "\r\n")
	buf.WriteString("Content-Transfer-Encoding: quoted-printable\r\n")
	buf.WriteString("\r\n")
	writer := quotedprintable.NewWriter(buf)
	if _, err := writer.Write([]byte(body)); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	buf.WriteString("\r\n")
	return nil
}

func newMIMEBoundary() (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return "b" + hex.EncodeToString(raw), nil
}

func newMessageID(from string) (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	domain := "localhost"
	if at := strings.LastIndex(from, "@"); at >= 0 && at+1 < len(from) {
		domain = from[at+1:]
	}
	return fmt.Sprintf("<%s@%s>", hex.EncodeToString(raw), domain), nil
}

// ResendProvider sends email via a Resend-style HTTP API.
type ResendProvider struct {
	APIKey  string
	From    string
	Config  EmailTemplateConfig
	BaseURL string
	// HTTPClient allows overriding http.Client for testing
	HTTPClient *http.Client
}

type resendEmailRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Text    string   `json:"text,omitempty"`
	HTML    string   `json:"html,omitempty"`
}

func (r *ResendProvider) SendVerification(ctx context.Context, to, name, token string) error {
	content, err := RenderVerificationEmail(r.Config, name, token)
	if err != nil {
		return fmt.Errorf("render verification email: %w", err)
	}
	return r.send(ctx, to, content.Subject, content.TextBody, content.HTMLBody)
}

func (r *ResendProvider) SendPasswordReset(ctx context.Context, to, name, token string) error {
	content, err := RenderPasswordResetEmail(r.Config, name, token)
	if err != nil {
		return fmt.Errorf("render password reset email: %w", err)
	}
	return r.send(ctx, to, content.Subject, content.TextBody, content.HTMLBody)
}

func (r *ResendProvider) SendDuplicateSignupNotice(ctx context.Context, to string) error {
	content, err := RenderDuplicateSignupEmail(r.Config)
	if err != nil {
		return fmt.Errorf("render duplicate signup email: %w", err)
	}
	return r.send(ctx, to, content.Subject, content.TextBody, content.HTMLBody)
}

func (r *ResendProvider) send(ctx context.Context, to, subject, textBody, htmlBody string) error {
	if err := validateEmailHeaders(r.From, to, subject); err != nil {
		return err
	}
	url := r.BaseURL
	if url == "" {
		url = defaultResendAPIURL
	}

	reqBody := resendEmailRequest{
		From:    r.From,
		To:      []string{to},
		Subject: subject,
		Text:    textBody,
		HTML:    htmlBody,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+r.APIKey)
	req.Header.Set("Content-Type", "application/json")

	client := emailHTTPClient(r.HTTPClient)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend api error: status %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

func validateEmailHeaders(from, to, subject string) error {
	for _, item := range []struct {
		name  string
		value string
	}{
		{"from", from},
		{"to", to},
		{"subject", subject},
	} {
		if strings.ContainsAny(item.value, "\r\n") {
			return fmt.Errorf("email %s contains CR or LF", item.name)
		}
	}
	return nil
}

func emailHTTPClient(existing *http.Client) *http.Client {
	if existing != nil {
		return existing
	}
	return &http.Client{Timeout: defaultEmailSendTimeout}
}

// ValidateProviderConfig checks if the provider configuration is complete.
func ValidateProviderConfig(provider, from string, hasSMTP, hasResend bool) error {
	switch strings.ToLower(provider) {
	case "log", "":
		return nil
	case "smtp":
		if !hasSMTP {
			return errors.New("SMTP provider requires EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, and EMAIL_SMTP_PASSWORD")
		}
		if from == "" {
			return errors.New("SMTP provider requires EMAIL_FROM")
		}
		return nil
	case "resend":
		if !hasResend {
			return errors.New("Resend provider requires EMAIL_RESEND_API_KEY")
		}
		if from == "" {
			return errors.New("Resend provider requires EMAIL_FROM")
		}
		return nil
	default:
		return fmt.Errorf("unknown email provider: %s (valid options: log, smtp, resend)", provider)
	}
}
