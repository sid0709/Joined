package auth

import (
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/config"
)

func TestNewEmailSenderLog(t *testing.T) {
	sender, err := NewEmailSender(config.Email{
		Provider:    "log",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	})
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}
	if _, ok := sender.(DevEmailSender); !ok {
		t.Errorf("expected DevEmailSender, got %T", sender)
	}
}

func TestNewEmailSenderEmpty(t *testing.T) {
	sender, err := NewEmailSender(config.Email{
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	})
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}
	if _, ok := sender.(DevEmailSender); !ok {
		t.Errorf("expected DevEmailSender for empty provider, got %T", sender)
	}
}

func TestNewEmailSenderSMTP(t *testing.T) {
	sender, err := NewEmailSender(config.Email{
		Provider:     "smtp",
		From:         "noreply@example.com",
		SMTPHost:     "smtp.example.com",
		SMTPPort:     "587",
		SMTPUser:     "user@example.com",
		SMTPPassword: "password",
		ProductName:  "TestApp",
		AppBaseURL:   "https://example.com",
	})
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}
	smtpProvider, ok := sender.(*SMTPProvider)
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
	if smtpProvider.Insecure {
		t.Error("Insecure should be false by default")
	}
}

func TestNewEmailSenderSMTPInsecure(t *testing.T) {
	sender, err := NewEmailSender(config.Email{
		Provider:     "smtp",
		From:         "noreply@example.com",
		SMTPHost:     "smtp.example.com",
		SMTPPort:     "587",
		SMTPUser:     "user@example.com",
		SMTPPassword: "password",
		SMTPInsecure: true,
		ProductName:  "Joined",
		AppBaseURL:   "http://localhost:6002",
	})
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}
	smtpProvider, ok := sender.(*SMTPProvider)
	if !ok {
		t.Fatalf("expected *SMTPProvider, got %T", sender)
	}
	if !smtpProvider.Insecure {
		t.Error("expected Insecure to be set")
	}
}

func TestNewEmailSenderSMTPMissingConfig(t *testing.T) {
	_, err := NewEmailSender(config.Email{
		Provider:    "smtp",
		From:        "noreply@example.com",
		SMTPHost:    "smtp.example.com",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	})
	if err == nil {
		t.Fatal("expected error for incomplete SMTP config, got nil")
	}
}

func TestNewEmailSenderSMTPMissingFrom(t *testing.T) {
	_, err := NewEmailSender(config.Email{
		Provider:     "smtp",
		SMTPHost:     "smtp.example.com",
		SMTPPort:     "587",
		SMTPUser:     "user@example.com",
		SMTPPassword: "password",
		ProductName:  "TestApp",
		AppBaseURL:   "https://example.com",
	})
	if err == nil {
		t.Fatal("expected error for missing FROM, got nil")
	}
}

func TestNewEmailSenderResend(t *testing.T) {
	sender, err := NewEmailSender(config.Email{
		Provider:     "resend",
		From:         "noreply@example.com",
		ResendAPIKey: "re_test_key",
		ProductName:  "TestApp",
		AppBaseURL:   "https://example.com",
	})
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}
	resendProvider, ok := sender.(*ResendProvider)
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

func TestNewEmailSenderResendMissingConfig(t *testing.T) {
	_, err := NewEmailSender(config.Email{
		Provider:    "resend",
		From:        "noreply@example.com",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	})
	if err == nil {
		t.Fatal("expected error for missing Resend API key, got nil")
	}
}

func TestNewEmailSenderUnknownProvider(t *testing.T) {
	_, err := NewEmailSender(config.Email{
		Provider:    "sendgrid",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	})
	if err == nil {
		t.Fatal("expected error for unknown provider, got nil")
	}
}

func TestNewEmailSenderTrimsBaseURL(t *testing.T) {
	sender, err := NewEmailSender(config.Email{
		Provider:    "log",
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com/",
	})
	if err != nil {
		t.Fatalf("NewEmailSender failed: %v", err)
	}
	if sender == nil {
		t.Fatal("expected sender")
	}
}
