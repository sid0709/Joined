package auth

import (
	"fmt"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/config"
)

// NewEmailSender creates an EmailSender from service email configuration.
func NewEmailSender(cfg config.Email) (EmailSender, error) {
	hasSMTP := cfg.SMTPHost != "" && cfg.SMTPPort != "" && cfg.SMTPUser != "" && cfg.SMTPPassword != ""
	hasResend := cfg.ResendAPIKey != ""

	if err := ValidateProviderConfig(cfg.Provider, cfg.From, hasSMTP, hasResend); err != nil {
		return nil, err
	}

	templateConfig := EmailTemplateConfig{
		ProductName: cfg.ProductName,
		AppBaseURL:  strings.TrimRight(cfg.AppBaseURL, "/"),
	}

	switch strings.ToLower(cfg.Provider) {
	case "log", "":
		return DevEmailSender{}, nil
	case "smtp":
		return &SMTPProvider{
			Host:     cfg.SMTPHost,
			Port:     cfg.SMTPPort,
			Username: cfg.SMTPUser,
			Password: cfg.SMTPPassword,
			From:     cfg.From,
			Insecure: cfg.SMTPInsecure,
			Config:   templateConfig,
		}, nil
	case "resend":
		return &ResendProvider{
			APIKey: cfg.ResendAPIKey,
			From:   cfg.From,
			Config: templateConfig,
		}, nil
	default:
		return nil, fmt.Errorf("unknown email provider: %s", cfg.Provider)
	}
}
