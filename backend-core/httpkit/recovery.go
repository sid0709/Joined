package httpkit

import (
	"fmt"
	"net/http"
	"runtime/debug"
)

// Recovery catches panics, records them for Logging, reports them, and answers
// 500 when headers have not been written. http.ErrAbortHandler is re-panicked.
func Recovery(reporter ErrorReporter, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			err := recover()
			if err == nil {
				return
			}
			if err == http.ErrAbortHandler {
				panic(err)
			}
			stack := string(debug.Stack())
			if rec := recordFrom(r.Context()); rec != nil {
				rec.panicErr = fmt.Sprint(err)
				rec.stack = stack
			}
			if reporter != nil {
				reporter.ReportPanic(r.Context(), err, stack)
			}
			if rw, ok := w.(*responseWriter); ok && rw.wrote {
				return
			}
			WriteError(w, http.StatusInternalServerError, "Internal server error")
		}()
		next.ServeHTTP(w, r)
	})
}
