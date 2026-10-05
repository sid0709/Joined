package httpkit

import (
	"context"
	"log/slog"
)

// ErrorReporter sends panics to an external error tracking service.
type ErrorReporter interface {
	ReportPanic(ctx context.Context, err any, stack string)
}

// NoOpReporter is the default ErrorReporter that does nothing.
type NoOpReporter struct{}

func (NoOpReporter) ReportPanic(context.Context, any, string) {}

// NewReporter returns the error reporter for dsn. When dsn is set but no
// tracker adapter is installed yet, it warns and still returns a no-op.
func NewReporter(dsn string) ErrorReporter {
	if dsn == "" {
		return NoOpReporter{}
	}
	slog.Warn("SENTRY_DSN is set but no error tracker adapter is installed yet; errors are only logged")
	return NoOpReporter{}
}
