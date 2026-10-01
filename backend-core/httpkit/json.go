// Package httpkit is the HTTP plumbing every backend service shares: JSON and
// problem responses, bearer tokens, CORS, health, and serving with a graceful stop.
package httpkit

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const (
	// RequestTimeout bounds an ordinary request's database work.
	RequestTimeout = 30 * time.Second
	// MaxWriteBody caps a JSON write body.
	MaxWriteBody = 128 << 10
)

func WriteJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Error("write json", "error", err)
	}
}

func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]string{"error": message})
}

// BearerToken is the token in "Authorization: Bearer <token>", or "" without one.
func BearerToken(r *http.Request) string {
	value := strings.TrimSpace(r.Header.Get("Authorization"))
	token, ok := strings.CutPrefix(value, "Bearer ")
	if !ok {
		return ""
	}
	return strings.TrimSpace(token)
}
