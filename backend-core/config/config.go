// Package config reads the settings every backend service shares. Each service
// composes the parts it needs and reads its own settings with Env.
package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// DefaultOpenRouterMaxSearches caps the web searches behind one research answer: enough
// to find a company's own site and a profile or two, few enough to stay fast.
const DefaultOpenRouterMaxSearches = 4

const (
	defaultDestDB              = "JoinedDB"
	defaultDestCollection      = "temp_jobs"
	defaultJobsCollection      = "jobs"
	defaultCompaniesCollection = "companies"
	defaultTempCompanies       = "temp_companies"
	defaultOpenAIModel         = "gpt-4o-mini"
	defaultOpenAIBaseURL       = "https://api.openai.com/v1"
	defaultOpenRouterModel     = "deepseek/deepseek-chat"
	defaultOpenRouterBaseURL   = "https://openrouter.ai/api/v1"
	envFileName                = ".env"
)

// Database is the MongoDB every service shares: one set of accounts, jobs, and companies.
type Database struct {
	MongoURI            string
	DestDB              string
	DestCollection      string
	JobsCollection      string
	CompaniesCollection string
	// TempCompaniesCollection holds companies that are not in the directory yet.
	TempCompaniesCollection string
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

// OpenRouter is the model Joined admin uses for job analysis, company research,
// company autofill, and Acorn's AI. Chat completions and web search both go through
// OpenRouter's OpenAI-compatible API.
type OpenRouter struct {
	APIKey  string
	Model   string
	BaseURL string
	// MaxSearches caps the web searches behind one research answer.
	MaxSearches int
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

// ErrorReporting is the error tracker DSN. Empty means no error tracking.
type ErrorReporting struct {
	SentryDSN string
}

// LoadEnvFile reads .env from the working directory. Variables already set in
// the environment win.
func LoadEnvFile() {
	loadEnvFile(envFileName)
}

func LoadDatabase() (Database, error) {
	db := Database{
		MongoURI:                strings.TrimSpace(os.Getenv("MONGO_URI")),
		DestDB:                  Env("DEST_DB", defaultDestDB),
		DestCollection:          Env("DEST_COLLECTION", defaultDestCollection),
		JobsCollection:          Env("JOBS_COLLECTION", defaultJobsCollection),
		CompaniesCollection:     Env("COMPANIES_COLLECTION", defaultCompaniesCollection),
		TempCompaniesCollection: Env("TEMP_COMPANIES_COLLECTION", defaultTempCompanies),
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

func LoadOpenRouter() OpenRouter {
	return OpenRouter{
		APIKey:      strings.TrimSpace(os.Getenv("OPENROUTER_API_KEY")),
		Model:       Env("OPENROUTER_MODEL", defaultOpenRouterModel),
		BaseURL:     Env("OPENROUTER_BASE_URL", defaultOpenRouterBaseURL),
		MaxSearches: EnvInt("OPENROUTER_MAX_SEARCHES", DefaultOpenRouterMaxSearches),
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

// MetricsAddr is where the Prometheus metrics listener binds (METRICS_ADDR).
// Blank, the default, leaves it off. It must not be the public HTTP_ADDR.
func MetricsAddr() string {
	return strings.TrimSpace(Env("METRICS_ADDR", ""))
}

// PrometheusURL is the Prometheus server the admin console reads (PROMETHEUS_URL).
// Blank leaves system monitoring unconfigured.
func PrometheusURL() string {
	return strings.TrimRight(strings.TrimSpace(Env("PROMETHEUS_URL", "")), "/")
}

// SearchEnsureIndex returns whether the job search text index should be created at startup.
// Defaults to false. Set SEARCH_ENSURE_INDEX=true to enable in development.
func SearchEnsureIndex() bool {
	explicit := strings.TrimSpace(os.Getenv("SEARCH_ENSURE_INDEX"))
	return explicit == "true" || explicit == "1"
}

// JobsExpiryCheckerEnabled reports whether the in-process dead-link checker should run.
// Defaults to false. Set JOBS_EXPIRY_CHECKER_ENABLED=true to turn it on.
func JobsExpiryCheckerEnabled() bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv("JOBS_EXPIRY_CHECKER_ENABLED")))
	return value == "true" || value == "1"
}

// LoadErrorReporting reads SENTRY_DSN from the environment.
func LoadErrorReporting() ErrorReporting {
	return ErrorReporting{
		SentryDSN: strings.TrimSpace(os.Getenv("SENTRY_DSN")),
	}
}

// Env returns the trimmed value of key, or fallback when it is unset or blank.
func Env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

// EnvInt returns key as a positive whole number, or fallback when it is unset or not one.
func EnvInt(key string, fallback int) int {
	value, err := strconv.Atoi(Env(key, ""))
	if err != nil || value < 1 {
		return fallback
	}
	return value
}

// EnvDuration returns key as a positive duration, or fallback when it is unset or not one.
func EnvDuration(key string, fallback time.Duration) time.Duration {
	value := Env(key, "")
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil || parsed < 1 {
		return fallback
	}
	return parsed
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
