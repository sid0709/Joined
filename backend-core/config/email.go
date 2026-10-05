package config

import (
	"strings"
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
	// SMTPInsecure continues without STARTTLS. Local development only.
	SMTPInsecure bool
	// Resend fields
	ResendAPIKey string
	// Template configuration
	ProductName string
	AppBaseURL  string
}

const defaultEmailProductName = "Joined"

// LoadEmail reads email configuration from environment variables.
// defaultAppBaseURL is the service frontend origin; EMAIL_APP_BASE_URL overrides it.
func LoadEmail(defaultAppBaseURL string) Email {
	return Email{
		Provider:     strings.ToLower(Env("EMAIL_PROVIDER", "log")),
		From:         Env("EMAIL_FROM", ""),
		SMTPHost:     Env("EMAIL_SMTP_HOST", ""),
		SMTPPort:     Env("EMAIL_SMTP_PORT", ""),
		SMTPUser:     Env("EMAIL_SMTP_USER", ""),
		SMTPPassword: Env("EMAIL_SMTP_PASSWORD", ""),
		SMTPInsecure: envFlag("EMAIL_SMTP_INSECURE"),
		ResendAPIKey: Env("EMAIL_RESEND_API_KEY", ""),
		ProductName:  Env("EMAIL_PRODUCT_NAME", defaultEmailProductName),
		AppBaseURL:   strings.TrimRight(Env("EMAIL_APP_BASE_URL", defaultAppBaseURL), "/"),
	}
}

func envFlag(key string) bool {
	value := strings.ToLower(Env(key, ""))
	return value == "true" || value == "1"
}
