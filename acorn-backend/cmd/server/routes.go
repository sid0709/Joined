package main

import (
	"log/slog"
	"net/http"

	"github.com/sid0709/OpenSeat/acorn-backend/acornapi"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

// routes serves Acorn under /acorn. /health is this process's own: the deploy
// checks it, and it answers while the database does.
func routes(origins []string, health, acorn http.Handler, logger *slog.Logger, reporter httpkit.ErrorReporter) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /health", health)
	mux.Handle(acornapi.Prefix+"/", acorn)
	mux.Handle(acornapi.GooglePrefix+"/", acorn)
	wrapped := httpkit.CORS(origins, mux)
	wrapped = httpkit.Wrap(logger, reporter, wrapped)
	return wrapped
}
