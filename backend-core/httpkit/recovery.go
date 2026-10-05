package httpkit

import (
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
)

// Recovery wraps next with panic recovery. It logs the panic with the stack trace
// and answers 500 with an error response. It also reports the panic to the configured
// error reporter.
func Recovery(logger *slog.Logger, reporter ErrorReporter, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				stack := string(debug.Stack())
				requestID := RequestID(r.Context())
				
				logger.Error("panic recovered",
					"request_id", requestID,
					"error", fmt.Sprintf("%v", err),
					"stack", stack,
				)
				
				if reporter != nil {
					reporter.ReportPanic(r.Context(), err, stack)
				}
				
				WriteError(w, http.StatusInternalServerError, "Internal server error")
			}
		}()
		
		next.ServeHTTP(w, r)
	})
}
