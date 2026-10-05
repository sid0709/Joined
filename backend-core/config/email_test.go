package config

import (
	"testing"
)

func TestLoadEmailDefaults(t *testing.T) {
	t.Setenv("EMAIL_PROVIDER", "")
	t.Setenv("EMAIL_FROM", "")
	t.Setenv("EMAIL_SMTP_HOST", "")
	t.Setenv("EMAIL_SMTP_PORT", "")
	t.Setenv("EMAIL_SMTP_USER", "")
	t.Setenv("EMAIL_SMTP_PASSWORD", "")
	t.Setenv("EMAIL_SMTP_INSECURE", "")
	t.Setenv("EMAIL_RESEND_API_KEY", "")
	t.Setenv("EMAIL_PRODUCT_NAME", "")
	t.Setenv("EMAIL_APP_BASE_URL", "")

	cfg := LoadEmail("http://localhost:6002")
	if cfg.Provider != "log" {
		t.Errorf("provider = %q, want log", cfg.Provider)
	}
	if cfg.ProductName != "Joined" {
		t.Errorf("product name = %q, want Joined", cfg.ProductName)
	}
	if cfg.AppBaseURL != "http://localhost:6002" {
		t.Errorf("app base url = %q, want frontend origin", cfg.AppBaseURL)
	}
	if cfg.SMTPInsecure {
		t.Error("SMTPInsecure should be false by default")
	}
}

func TestLoadEmailAppBaseURLOverride(t *testing.T) {
	t.Setenv("EMAIL_APP_BASE_URL", "https://app.example.com/")
	cfg := LoadEmail("http://localhost:6002")
	if cfg.AppBaseURL != "https://app.example.com" {
		t.Errorf("app base url = %q, want override without trailing slash", cfg.AppBaseURL)
	}
}

func TestLoadEmailSMTPInsecure(t *testing.T) {
	t.Setenv("EMAIL_SMTP_INSECURE", "true")
	cfg := LoadEmail("http://localhost:6002")
	if !cfg.SMTPInsecure {
		t.Error("EMAIL_SMTP_INSECURE=true should set SMTPInsecure")
	}
}
