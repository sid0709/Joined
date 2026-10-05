package httpkit

import "context"

// ErrorReporter sends errors and panics to an external error tracking service.
type ErrorReporter interface {
	// ReportPanic sends a panic to the error tracker with its stack trace.
	ReportPanic(ctx context.Context, err any, stack string)
}

// NoOpReporter is the default ErrorReporter that does nothing.
type NoOpReporter struct{}

func (NoOpReporter) ReportPanic(ctx context.Context, err any, stack string) {}
