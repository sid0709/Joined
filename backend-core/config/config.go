// Package config reads the settings every backend service shares. Each service
// composes the parts it needs and reads its own settings with Env.
package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

const (
	defaultSourceDB            = "AthensDB"
	defaultSourceCollection    = "jobs"
	defaultDestDB              = "OpenedDB"
	defaultDestCollection      = "temp_jobs"
	defaultJobsCollection      = "jobs"
	defaultSourceCompanies     = "companies"
	defaultCompaniesCollection = "companies"
	defaultOpenAIModel         = "gpt-4o-mini"
	defaultOpenAIBaseURL       = "https://api.openai.com/v1"
	envFileName                = ".env"
)

// Database is the MongoDB every service shares: one set of accounts, jobs, and companies.
type Database struct {
	MongoURI            string
	SourceDB            string
	SourceCollection    string
	DestDB              string
	DestCollection      string
	JobsCollection      string
	SourceCompanies     string
	CompaniesCollection string
}

func (d Database) SourceName() string {
	return d.SourceDB + "." + d.SourceCollection
}

func (d Database) DestName() string {
	return d.DestDB + "." + d.DestCollection
}

// OpenAI is the model a service uses to read and research job posts.
type OpenAI struct {
	APIKey string
	Model  string
	// SearchModel answers web-search requests. Blank means Model.
	SearchModel string
	BaseURL     string
}

// Google is the OAuth client from Google Cloud and where Sign in with Google
// returns to: the app's frontend callback page, registered on that client.
type Google struct {
	ClientID          string
	ClientSecret      string
	SignInRedirectURL string
}

// HTTP is where a service listens and which browser origins may call it.
type HTTP struct {
	Addr    string
	Origins []string
}

// LoadEnvFile reads .env from the working directory. Variables already set in
// the environment win.
func LoadEnvFile() {
	loadEnvFile(envFileName)
}

func LoadDatabase() (Database, error) {
	db := Database{
		MongoURI:            strings.TrimSpace(os.Getenv("MONGO_URI")),
		SourceDB:            Env("SOURCE_DB", defaultSourceDB),
		SourceCollection:    Env("SOURCE_COLLECTION", defaultSourceCollection),
		DestDB:              Env("DEST_DB", defaultDestDB),
		DestCollection:      Env("DEST_COLLECTION", defaultDestCollection),
		JobsCollection:      Env("JOBS_COLLECTION", defaultJobsCollection),
		SourceCompanies:     Env("SOURCE_COMPANIES", defaultSourceCompanies),
		CompaniesCollection: Env("COMPANIES_COLLECTION", defaultCompaniesCollection),
	}
	if db.MongoURI == "" {
		return Database{}, fmt.Errorf("MONGO_URI is required")
	}
	return db, nil
}

func LoadOpenAI() OpenAI {
	return OpenAI{
		APIKey:      strings.TrimSpace(os.Getenv("OPENAI_API_KEY")),
		Model:       Env("OPENAI_MODEL", defaultOpenAIModel),
		SearchModel: strings.TrimSpace(os.Getenv("OPENAI_SEARCH_MODEL")),
		BaseURL:     Env("OPENAI_BASE_URL", defaultOpenAIBaseURL),
	}
}

func LoadGoogle() Google {
	return Google{
		ClientID:          Env("GOOGLE_CLIENT_ID", ""),
		ClientSecret:      Env("GOOGLE_CLIENT_SECRET", ""),
		SignInRedirectURL: Env("GOOGLE_SIGNIN_REDIRECT_URL", ""),
	}
}

// LoadHTTP reads HTTP_ADDR and CORS_ORIGINS, falling back to the service's defaults.
func LoadHTTP(defaultAddr string, defaultOrigins []string) (HTTP, error) {
	cfg := HTTP{
		Addr:    Env("HTTP_ADDR", defaultAddr),
		Origins: splitList(Env("CORS_ORIGINS", strings.Join(defaultOrigins, ","))),
	}
	if len(cfg.Origins) == 0 {
		return HTTP{}, fmt.Errorf("CORS_ORIGINS is required")
	}
	return cfg, nil
}

// Env returns the trimmed value of key, or fallback when it is unset or blank.
func Env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
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
