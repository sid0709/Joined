package httpkit

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os/signal"
	"syscall"
	"time"
)

const (
	readHeaderTimeout = 5 * time.Second
	// writeTimeout leaves room for the slowest handlers: copying and analyzing jobs.
	writeTimeout    = 20 * time.Minute
	idleTimeout     = 2 * time.Minute
	shutdownTimeout = 10 * time.Second
	pingTimeout     = 3 * time.Second
)

// Serve listens on addr until SIGINT or SIGTERM, then lets in-flight requests finish.
func Serve(name, addr string, handler http.Handler) error {
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Error("shutdown", "error", err)
		}
	}()

	slog.Info(name+" listening", "addr", addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// Health answers 200 while the database answers a ping.
func Health(db interface{ Ping(context.Context) error }) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), pingTimeout)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			slog.Error("health", "error", err)
			WriteError(w, http.StatusServiceUnavailable, "database unavailable")
			return
		}
		WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}
