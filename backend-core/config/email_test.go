package config

import (
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/auth"
)

func TestEmailNewEmailSenderLog(t *testing.T) {
	cfg := Email{
		Provider:    "log",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	}

	sender, err := cfg.NewEmailSender()
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}

	if _, ok := sender.(auth.DevEmailSender); !ok {
		t.Errorf("expected DevEmailSender, got %T", sender)
	}
}

func TestEmailNewEmailSenderEmpty(t *testing.T) {
	cfg := Email{
		Provider:    "",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	}

	sender, err := cfg.NewEmailSender()
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}

	if _, ok := sender.(auth.DevEmailSender); !ok {
		t.Errorf("expected DevEmailSender for empty provider, got %T", sender)
	}
}

func TestEmailNewEmailSenderSMTP(t *testing.T) {
	cfg := Email{
		Provider:     "smtp",
		From:         "noreply@example.com",
		SMTPHost:     "smtp.example.com",
		SMTPPort:     "587",
		SMTPUser:     "user@example.com",
		SMTPPassword: "password",
		ProductName:  "TestApp",
		AppBaseURL:   "https://example.com",
	}

	sender, err := cfg.NewEmailSender()
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}

	smtpProvider, ok := sender.(*auth.SMTPProvider)
	if !ok {
		t.Fatalf("expected *SMTPProvider, got %T", sender)
	}

	if smtpProvider.Host != "smtp.example.com" {
		t.Errorf("got host %q, want %q", smtpProvider.Host, "smtp.example.com")
	}
	if smtpProvider.Port != "587" {
		t.Errorf("got port %q, want %q", smtpProvider.Port, "587")
	}
	if smtpProvider.Username != "user@example.com" {
		t.Errorf("got username %q, want %q", smtpProvider.Username, "user@example.com")
	}
	if smtpProvider.From != "noreply@example.com" {
		t.Errorf("got from %q, want %q", smtpProvider.From, "noreply@example.com")
	}
	if smtpProvider.Config.ProductName != "TestApp" {
		t.Errorf("got product name %q, want %q", smtpProvider.Config.ProductName, "TestApp")
	}
	if smtpProvider.Config.AppBaseURL != "https://example.com" {
		t.Errorf("got app base url %q, want %q", smtpProvider.Config.AppBaseURL, "https://example.com")
	}
}

func TestEmailNewEmailSenderSMTPMissingConfig(t *testing.T) {
	cfg := Email{
		Provider:    "smtp",
		From:        "noreply@example.com",
		SMTPHost:    "smtp.example.com",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	}

	_, err := cfg.NewEmailSender()
	if err == nil {
		t.Fatal("expected error for incomplete SMTP config, got nil")
	}
}

func TestEmailNewEmailSenderSMTPMissingFrom(t *testing.T) {
	cfg := Email{
		Provider:     "smtp",
		SMTPHost:     "smtp.example.com",
		SMTPPort:     "587",
		SMTPUser:     "user@example.com",
		SMTPPassword: "password",
		ProductName:  "TestApp",
		AppBaseURL:   "https://example.com",
	}

	_, err := cfg.NewEmailSender()
	if err == nil {
		t.Fatal("expected error for missing FROM, got nil")
	}
}

func TestEmailNewEmailSenderResend(t *testing.T) {
	cfg := Email{
		Provider:     "resend",
		From:         "noreply@example.com",
		ResendAPIKey: "re_test_key",
		ProductName:  "TestApp",
		AppBaseURL:   "https://example.com",
	}

	sender, err := cfg.NewEmailSender()
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}

	resendProvider, ok := sender.(*auth.ResendProvider)
	if !ok {
		t.Fatalf("expected *ResendProvider, got %T", sender)
	}

	if resendProvider.APIKey != "re_test_key" {
		t.Errorf("got api key %q, want %q", resendProvider.APIKey, "re_test_key")
	}
	if resendProvider.From != "noreply@example.com" {
		t.Errorf("got from %q, want %q", resendProvider.From, "noreply@example.com")
	}
	if resendProvider.Config.ProductName != "TestApp" {
		t.Errorf("got product name %q, want %q", resendProvider.Config.ProductName, "TestApp")
	}
}

func TestEmailNewEmailSenderResendMissingConfig(t *testing.T) {
	cfg := Email{
		Provider:    "resend",
		From:        "noreply@example.com",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	}

	_, err := cfg.NewEmailSender()
	if err == nil {
		t.Fatal("expected error for missing Resend API key, got nil")
	}
}

func TestEmailNewEmailSenderUnknownProvider(t *testing.T) {
	cfg := Email{
		Provider:    "sendgrid",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	}

	_, err := cfg.NewEmailSender()
	if err == nil {
		t.Fatal("expected error for unknown provider, got nil")
	}
}

func TestEmailNewEmailSenderTrimsBaseURL(t *testing.T) {
	cfg := Email{
		Provider:    "log",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com/",
	}

	_, err := cfg.NewEmailSender()
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}
}
