package auth

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/smtp"
	"net/textproto"
	"strings"
)

// SMTPProvider sends email via an SMTP server.
type SMTPProvider struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
	Config   EmailTemplateConfig
	// DialFunc allows overriding net/smtp.Dial for testing
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
	return s.send(to, content.Subject, content.TextBody, content.HTMLBody)
}

func (s *SMTPProvider) SendPasswordReset(ctx context.Context, to, name, token string) error {
	content, err := RenderPasswordResetEmail(s.Config, name, token)
	if err != nil {
		return fmt.Errorf("render password reset email: %w", err)
	}
	return s.send(to, content.Subject, content.TextBody, content.HTMLBody)
}

func (s *SMTPProvider) SendDuplicateSignupNotice(ctx context.Context, to string) error {
	content, err := RenderDuplicateSignupEmail(s.Config)
	if err != nil {
		return fmt.Errorf("render duplicate signup email: %w", err)
	}
	return s.send(to, content.Subject, content.TextBody, content.HTMLBody)
}

func (s *SMTPProvider) send(to, subject, textBody, htmlBody string) error {
	addr := s.Host + ":" + s.Port

	var client smtpClient
	var err error

	if s.DialFunc != nil {
		client, err = s.DialFunc(addr)
	} else {
		var c *smtp.Client
		c, err = smtp.Dial(addr)
		if err == nil {
			client = &realSMTPClient{c}
		}
	}
	if err != nil {
		return fmt.Errorf("dial smtp: %w", err)
	}
	defer client.Close()

	if err := client.StartTLS(&tls.Config{ServerName: s.Host}); err != nil {
		slog.Warn("smtp starttls failed", "error", err)
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

func buildMIMEMessage(from, to, subject, textBody, htmlBody string) (string, error) {
	var buf bytes.Buffer
	boundary := "boundary-openseat-email"

	buf.WriteString("From: " + from + "\r\n")
	buf.WriteString("To: " + to + "\r\n")
	buf.WriteString("Subject: " + subject + "\r\n")
	buf.WriteString("MIME-Version: 1.0\r\n")
	buf.WriteString("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n")
	buf.WriteString("\r\n")

	buf.WriteString("--" + boundary + "\r\n")
	buf.WriteString("Content-Type: text/plain; charset=\"UTF-8\"\r\n")
	buf.WriteString("Content-Transfer-Encoding: quoted-printable\r\n")
	buf.WriteString("\r\n")
	buf.WriteString(textBody)
	buf.WriteString("\r\n\r\n")

	buf.WriteString("--" + boundary + "\r\n")
	buf.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	buf.WriteString("Content-Transfer-Encoding: quoted-printable\r\n")
	buf.WriteString("\r\n")
	buf.WriteString(htmlBody)
	buf.WriteString("\r\n\r\n")

	buf.WriteString("--" + boundary + "--\r\n")

	return buf.String(), nil
}

// ResendProvider sends email via a Resend-style HTTP API.
type ResendProvider struct {
	APIKey   string
	From     string
	Config   EmailTemplateConfig
	BaseURL  string
	// HTTPClient allows overriding http.Client for testing
	HTTPClient *http.Client
}

type resendEmailRequest struct {
	From    string `json:"from"`
	To      []string `json:"to"`
	Subject string `json:"subject"`
	Text    string `json:"text,omitempty"`
	HTML    string `json:"html,omitempty"`
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
	url := r.BaseURL
	if url == "" {
		url = "https://api.resend.com/emails"
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

	client := r.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

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

func buildMultipartMessage(from, to, subject, textBody, htmlBody string) (string, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	header := textproto.MIMEHeader{}
	header.Set("From", from)
	header.Set("To", to)
	header.Set("Subject", subject)
	header.Set("MIME-Version", "1.0")
	header.Set("Content-Type", fmt.Sprintf("multipart/alternative; boundary=%s", writer.Boundary()))

	for key, values := range header {
		for _, value := range values {
			buf.WriteString(key + ": " + value + "\r\n")
		}
	}
	buf.WriteString("\r\n")

	textPart, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Type":              []string{"text/plain; charset=UTF-8"},
		"Content-Transfer-Encoding": []string{"quoted-printable"},
	})
	if err != nil {
		return "", err
	}
	if _, err := textPart.Write([]byte(textBody)); err != nil {
		return "", err
	}

	htmlPart, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Type":              []string{"text/html; charset=UTF-8"},
		"Content-Transfer-Encoding": []string{"quoted-printable"},
	})
	if err != nil {
		return "", err
	}
	if _, err := htmlPart.Write([]byte(htmlBody)); err != nil {
		return "", err
	}

	if err := writer.Close(); err != nil {
		return "", err
	}

	return buf.String(), nil
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
