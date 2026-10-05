package config

import (
	"fmt"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/auth"
)

// Email holds email provider configuration.
type Email struct {
	Provider string
	From     string
	// SMTP fields
	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPassword string
	// Resend fields
	ResendAPIKey string
	// Template configuration
	ProductName string
	AppBaseURL  string
}

// LoadEmail reads email configuration from environment variables.
func LoadEmail() Email {
	return Email{
		Provider:     strings.ToLower(Env("EMAIL_PROVIDER", "log")),
		From:         Env("EMAIL_FROM", ""),
		SMTPHost:     Env("EMAIL_SMTP_HOST", ""),
		SMTPPort:     Env("EMAIL_SMTP_PORT", ""),
		SMTPUser:     Env("EMAIL_SMTP_USER", ""),
		SMTPPassword: Env("EMAIL_SMTP_PASSWORD", ""),
		ResendAPIKey: Env("EMAIL_RESEND_API_KEY", ""),
		ProductName:  Env("EMAIL_PRODUCT_NAME", "OpenSeat"),
		AppBaseURL:   Env("EMAIL_APP_BASE_URL", "http://localhost:3000"),
	}
}

// NewEmailSender creates an EmailSender based on the configuration.
func (e Email) NewEmailSender() (auth.EmailSender, error) {
	hasSMTP := e.SMTPHost != "" && e.SMTPPort != "" && e.SMTPUser != "" && e.SMTPPassword != ""
	hasResend := e.ResendAPIKey != ""

	if err := auth.ValidateProviderConfig(e.Provider, e.From, hasSMTP, hasResend); err != nil {
		return nil, err
	}

	templateConfig := auth.EmailTemplateConfig{
		ProductName: e.ProductName,
		AppBaseURL:  strings.TrimRight(e.AppBaseURL, "/"),
	}

	switch e.Provider {
	case "log", "":
		return auth.DevEmailSender{}, nil
	case "smtp":
		return &auth.SMTPProvider{
			Host:     e.SMTPHost,
			Port:     e.SMTPPort,
			Username: e.SMTPUser,
			Password: e.SMTPPassword,
			From:     e.From,
			Config:   templateConfig,
		}, nil
	case "resend":
		return &auth.ResendProvider{
			APIKey: e.ResendAPIKey,
			From:   e.From,
			Config: templateConfig,
		}, nil
	default:
		return nil, fmt.Errorf("unknown email provider: %s", e.Provider)
	}
}
