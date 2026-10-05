package auth

import (
	"strings"
	"testing"
)

func TestRenderVerificationEmail(t *testing.T) {
	cfg := EmailTemplateConfig{
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	}

	content, err := RenderVerificationEmail(cfg, "Alice", "abc123token")
	if err != nil {
		t.Fatalf("RenderVerificationEmail failed: %v", err)
	}

	if content.Subject != "Verify your TestApp account" {
		t.Errorf("got subject %q, want %q", content.Subject, "Verify your TestApp account")
	}

	if !strings.Contains(content.TextBody, "Alice") {
		t.Error("text body missing recipient name")
	}
	if !strings.Contains(content.TextBody, "TestApp") {
		t.Error("text body missing product name")
	}
	if !strings.Contains(content.TextBody, "https://example.com/verify?token=abc123token") {
		t.Error("text body missing verification link")
	}

	if !strings.Contains(content.HTMLBody, "Alice") {
		t.Error("html body missing recipient name")
	}
	if !strings.Contains(content.HTMLBody, "TestApp") {
		t.Error("html body missing product name")
	}
	if !strings.Contains(content.HTMLBody, "https://example.com/verify?token=abc123token") {
		t.Error("html body missing verification link")
	}
}

func TestRenderPasswordResetEmail(t *testing.T) {
	cfg := EmailTemplateConfig{
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	}

	content, err := RenderPasswordResetEmail(cfg, "Bob", "xyz789token")
	if err != nil {
		t.Fatalf("RenderPasswordResetEmail failed: %v", err)
	}

	if content.Subject != "Reset your TestApp password" {
		t.Errorf("got subject %q, want %q", content.Subject, "Reset your TestApp password")
	}

	if !strings.Contains(content.TextBody, "Bob") {
		t.Error("text body missing recipient name")
	}
	if !strings.Contains(content.TextBody, "TestApp") {
		t.Error("text body missing product name")
	}
	if !strings.Contains(content.TextBody, "https://example.com/reset-password?token=xyz789token") {
		t.Error("text body missing reset link")
	}

	if !strings.Contains(content.HTMLBody, "Bob") {
		t.Error("html body missing recipient name")
	}
	if !strings.Contains(content.HTMLBody, "TestApp") {
		t.Error("html body missing product name")
	}
	if !strings.Contains(content.HTMLBody, "https://example.com/reset-password?token=xyz789token") {
		t.Error("html body missing reset link")
	}
}

func TestRenderPasswordResetEmailWithoutName(t *testing.T) {
	cfg := EmailTemplateConfig{
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	}

	content, err := RenderPasswordResetEmail(cfg, "", "xyz789token")
	if err != nil {
		t.Fatalf("RenderPasswordResetEmail failed: %v", err)
	}

	if strings.Contains(content.TextBody, "Hi ,") {
		t.Error("text body should not have trailing comma when name is empty")
	}
	if strings.Contains(content.HTMLBody, "Hi ,") {
		t.Error("html body should not have trailing comma when name is empty")
	}
}

func TestRenderDuplicateSignupEmail(t *testing.T) {
	cfg := EmailTemplateConfig{
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com",
	}

	content, err := RenderDuplicateSignupEmail(cfg)
	if err != nil {
		t.Fatalf("RenderDuplicateSignupEmail failed: %v", err)
	}

	if content.Subject != "Account security notice - TestApp" {
		t.Errorf("got subject %q, want %q", content.Subject, "Account security notice - TestApp")
	}

	if !strings.Contains(content.TextBody, "TestApp") {
		t.Error("text body missing product name")
	}
	if !strings.Contains(content.TextBody, "https://example.com/forgot-password") {
		t.Error("text body missing forgot password link")
	}

	if !strings.Contains(content.HTMLBody, "TestApp") {
		t.Error("html body missing product name")
	}
	if !strings.Contains(content.HTMLBody, "https://example.com/forgot-password") {
		t.Error("html body missing forgot password link")
	}
}

func TestRenderEmailWithTrailingSlash(t *testing.T) {
	cfg := EmailTemplateConfig{
		ProductName: "TestApp",
		AppBaseURL:  "https://example.com/",
	}

	content, err := RenderVerificationEmail(cfg, "Alice", "token123")
	if err != nil {
		t.Fatalf("RenderVerificationEmail failed: %v", err)
	}

	if strings.Contains(content.TextBody, "example.com//verify") {
		t.Error("verification link should not have double slash")
	}
}
