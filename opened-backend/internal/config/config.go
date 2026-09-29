package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

const (
	defaultHTTPAddr            = "127.0.0.1:8080"
	defaultAdminOrigins        = "http://127.0.0.1:3010,http://localhost:3010"
	defaultSourceDB            = "AthensDB"
	defaultSourceCollection    = "jobs"
	defaultDestDB              = "OpenedDB"
	defaultDestCollection      = "temp_jobs"
	defaultJobsCollection      = "jobs"
	defaultSourceCompanies     = "companies"
	defaultCompaniesCollection = "companies"
	defaultOpenAIModel         = "gpt-4o-mini"
	defaultOpenAIBaseURL       = "https://api.openai.com/v1"
	defaultFrontendOrigin      = "http://127.0.0.1:3002"
	envFileName                = ".env"
)

type Config struct {
	MongoURI            string
	HTTPAddr            string
	AdminOrigins        []string
	SourceDB            string
	SourceCollection    string
	DestDB              string
	DestCollection      string
	JobsCollection      string
	SourceCompanies     string
	CompaniesCollection string
	OpenAIAPIKey        string
	OpenAIModel         string
	OpenAIBaseURL       string
	FrontendOrigin      string
	GoogleClientID      string
	GoogleClientSecret  string
	GoogleRedirectURL   string
}

func (c Config) SourceName() string {
	return c.SourceDB + "." + c.SourceCollection
}

func (c Config) DestName() string {
	return c.DestDB + "." + c.DestCollection
}

func Load() (Config, error) {
	loadEnvFile(envFileName)

	cfg := Config{
		MongoURI:            strings.TrimSpace(os.Getenv("MONGO_URI")),
		HTTPAddr:            envOr("HTTP_ADDR", defaultHTTPAddr),
		AdminOrigins:        splitList(envOr("ADMIN_ORIGINS", defaultAdminOrigins)),
		SourceDB:            envOr("SOURCE_DB", defaultSourceDB),
		SourceCollection:    envOr("SOURCE_COLLECTION", defaultSourceCollection),
		DestDB:              envOr("DEST_DB", defaultDestDB),
		DestCollection:      envOr("DEST_COLLECTION", defaultDestCollection),
		JobsCollection:      envOr("JOBS_COLLECTION", defaultJobsCollection),
		SourceCompanies:     envOr("SOURCE_COMPANIES", defaultSourceCompanies),
		CompaniesCollection: envOr("COMPANIES_COLLECTION", defaultCompaniesCollection),
		OpenAIAPIKey:        strings.TrimSpace(os.Getenv("OPENAI_API_KEY")),
		OpenAIModel:         envOr("OPENAI_MODEL", defaultOpenAIModel),
		OpenAIBaseURL:       envOr("OPENAI_BASE_URL", defaultOpenAIBaseURL),
		FrontendOrigin:      strings.TrimRight(envOr("FRONTEND_ORIGIN", defaultFrontendOrigin), "/"),
		GoogleClientID:      strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")),
		GoogleClientSecret:  strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET")),
		GoogleRedirectURL:   strings.TrimSpace(os.Getenv("GOOGLE_REDIRECT_URL")),
	}
	if cfg.MongoURI == "" {
		return Config{}, fmt.Errorf("MONGO_URI is required")
	}
	if len(cfg.AdminOrigins) == 0 {
		return Config{}, fmt.Errorf("ADMIN_ORIGINS is required")
	}
	return cfg, nil
}

func Redact(err error, uri string) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	if uri != "" {
		msg = strings.ReplaceAll(msg, uri, "mongodb://[redacted]")
	}
	parsed, parseErr := url.Parse(uri)
	if parseErr == nil && parsed.User != nil {
		if password, ok := parsed.User.Password(); ok && password != "" {
			msg = strings.ReplaceAll(msg, password, "[redacted]")
		}
		if username := parsed.User.Username(); username != "" {
			msg = strings.ReplaceAll(msg, username, "[redacted]")
		}
	}
	return msg
}

func envOr(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func splitList(value string) []string {
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			items = append(items, part)
		}
	}
	return items
}

func loadEnvFile(path string) {
	contents, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(contents), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		_ = os.Setenv(key, value)
	}
}
