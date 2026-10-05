package auth

import (
	"bytes"
	"html/template"
	"strings"
	texttemplate "text/template"
)

// EmailTemplateConfig holds the application-specific values for email templates.
type EmailTemplateConfig struct {
	ProductName string
	AppBaseURL  string
}

// VerificationEmailContent is the rendered verification email in both formats.
type VerificationEmailContent struct {
	Subject  string
	TextBody string
	HTMLBody string
}

// PasswordResetEmailContent is the rendered password reset email in both formats.
type PasswordResetEmailContent struct {
	Subject  string
	TextBody string
	HTMLBody string
}

// DuplicateSignupContent is the rendered duplicate signup notice email.
type DuplicateSignupContent struct {
	Subject  string
	TextBody string
	HTMLBody string
}

// RenderVerificationEmail builds verification email content.
func RenderVerificationEmail(cfg EmailTemplateConfig, name, token string) (VerificationEmailContent, error) {
	baseURL := strings.TrimRight(cfg.AppBaseURL, "/")
	verifyURL := baseURL + "/verify?token=" + token

	textTmpl := `Hi {{.Name}},

Welcome to {{.ProductName}}! Please verify your email address by clicking the link below:

{{.VerifyURL}}

This link will expire in 24 hours.

If you didn't create an account with {{.ProductName}}, you can safely ignore this email.

Thanks,
The {{.ProductName}} Team`

	htmlTmpl := `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
	<h2 style="color: #2563eb;">Welcome to {{.ProductName}}!</h2>
	<p>Hi {{.Name}},</p>
	<p>Please verify your email address by clicking the button below:</p>
	<p style="margin: 30px 0;">
		<a href="{{.VerifyURL}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email Address</a>
	</p>
	<p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
	<p style="color: #666; font-size: 14px; word-break: break-all;">{{.VerifyURL}}</p>
	<p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
	<p style="color: #666; font-size: 14px;">If you didn't create an account with {{.ProductName}}, you can safely ignore this email.</p>
	<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
	<p style="color: #999; font-size: 12px;">Thanks,<br>The {{.ProductName}} Team</p>
</body>
</html>`

	data := map[string]string{
		"Name":        name,
		"ProductName": cfg.ProductName,
		"VerifyURL":   verifyURL,
	}

	text, err := renderTextTemplate(textTmpl, data)
	if err != nil {
		return VerificationEmailContent{}, err
	}

	html, err := renderHTMLTemplate(htmlTmpl, data)
	if err != nil {
		return VerificationEmailContent{}, err
	}

	return VerificationEmailContent{
		Subject:  "Verify your " + cfg.ProductName + " account",
		TextBody: text,
		HTMLBody: html,
	}, nil
}

// RenderPasswordResetEmail builds password reset email content.
func RenderPasswordResetEmail(cfg EmailTemplateConfig, name, token string) (PasswordResetEmailContent, error) {
	baseURL := strings.TrimRight(cfg.AppBaseURL, "/")
	resetURL := baseURL + "/reset-password?token=" + token

	textTmpl := `Hi{{if .Name}} {{.Name}}{{end}},

You requested to reset your password for {{.ProductName}}. Click the link below to set a new password:

{{.ResetURL}}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Thanks,
The {{.ProductName}} Team`

	htmlTmpl := `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
	<h2 style="color: #2563eb;">Password Reset Request</h2>
	<p>Hi{{if .Name}} {{.Name}}{{end}},</p>
	<p>You requested to reset your password for {{.ProductName}}. Click the button below to set a new password:</p>
	<p style="margin: 30px 0;">
		<a href="{{.ResetURL}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Password</a>
	</p>
	<p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
	<p style="color: #666; font-size: 14px; word-break: break-all;">{{.ResetURL}}</p>
	<p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour.</p>
	<p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
	<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
	<p style="color: #999; font-size: 12px;">Thanks,<br>The {{.ProductName}} Team</p>
</body>
</html>`

	data := map[string]string{
		"Name":        name,
		"ProductName": cfg.ProductName,
		"ResetURL":    resetURL,
	}

	text, err := renderTextTemplate(textTmpl, data)
	if err != nil {
		return PasswordResetEmailContent{}, err
	}

	html, err := renderHTMLTemplate(htmlTmpl, data)
	if err != nil {
		return PasswordResetEmailContent{}, err
	}

	return PasswordResetEmailContent{
		Subject:  "Reset your " + cfg.ProductName + " password",
		TextBody: text,
		HTMLBody: html,
	}, nil
}

// RenderDuplicateSignupEmail builds duplicate signup notice content.
func RenderDuplicateSignupEmail(cfg EmailTemplateConfig) (DuplicateSignupContent, error) {
	baseURL := strings.TrimRight(cfg.AppBaseURL, "/")

	textTmpl := `Hi,

Someone tried to create an account with your email address on {{.ProductName}}.

If this was you and you've forgotten your password, you can reset it by visiting {{.BaseURL}}/forgot-password

If this wasn't you, you can safely ignore this email. Your account is secure and no changes have been made.

Thanks,
The {{.ProductName}} Team`

	htmlTmpl := `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
	<h2 style="color: #2563eb;">Account Security Notice</h2>
	<p>Hi,</p>
	<p>Someone tried to create an account with your email address on {{.ProductName}}.</p>
	<p>If this was you and you've forgotten your password, you can reset it by visiting:</p>
	<p style="margin: 20px 0;">
		<a href="{{.BaseURL}}/forgot-password" style="color: #2563eb; text-decoration: none;">{{.BaseURL}}/forgot-password</a>
	</p>
	<p style="color: #666; font-size: 14px; margin-top: 30px;">If this wasn't you, you can safely ignore this email. Your account is secure and no changes have been made.</p>
	<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
	<p style="color: #999; font-size: 12px;">Thanks,<br>The {{.ProductName}} Team</p>
</body>
</html>`

	data := map[string]string{
		"ProductName": cfg.ProductName,
		"BaseURL":     baseURL,
	}

	text, err := renderTextTemplate(textTmpl, data)
	if err != nil {
		return DuplicateSignupContent{}, err
	}

	html, err := renderHTMLTemplate(htmlTmpl, data)
	if err != nil {
		return DuplicateSignupContent{}, err
	}

	return DuplicateSignupContent{
		Subject:  "Account security notice - " + cfg.ProductName,
		TextBody: text,
		HTMLBody: html,
	}, nil
}

func renderTextTemplate(tmplStr string, data any) (string, error) {
	tmpl, err := texttemplate.New("email").Parse(tmplStr)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func renderHTMLTemplate(tmplStr string, data any) (string, error) {
	tmpl, err := template.New("email").Parse(tmplStr)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}
