package main

import (
	"net/http"

	"github.com/sid0709/OpenSeat/backend-core/bashapi"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

// routes sends each product's prefix to that product's handler. /health is the
// server's own: the deploy checks it, and it answers while the database does.
func routes(origins []string, health, bash http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /health", health)
	mux.Handle(bashapi.Prefix+"/", bash)
	return httpkit.CORS(origins, mux)
}
