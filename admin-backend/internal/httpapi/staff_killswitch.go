package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
)

func (s *Server) registerKillSwitches(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/admin/kill-switches", s.listKillSwitches)
	mux.HandleFunc("PUT /v1/admin/kill-switches/{name}", s.putKillSwitch)
}

type killSwitchFlip struct {
	Enabled *bool  `json:"enabled"`
	Note    string `json:"note"`
}

func (s *Server) listKillSwitches(w http.ResponseWriter, r *http.Request) {
	if s.switches == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "Kill switches are unavailable.")
		return
	}
	list, err := s.switches.List(r.Context())
	if err != nil {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusInternalServerError, "internal_error", "Something went wrong. Try again."))
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"switches": list})
}

func (s *Server) putKillSwitch(w http.ResponseWriter, r *http.Request) {
	if s.switches == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "Kill switches are unavailable.")
		return
	}
	var body killSwitchFlip
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &body) {
		return
	}
	if body.Enabled == nil {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusUnprocessableEntity, "validation_failed", "enabled is required."))
		return
	}
	name := killswitch.Name(r.PathValue("name"))
	result, err := s.switches.Set(r.Context(), name, *body.Enabled, adminActor(r), body.Note, time.Now())
	if errors.Is(err, killswitch.ErrUnknown) {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusUnprocessableEntity, "validation_failed", "Unknown kill switch."))
		return
	}
	if err != nil {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusInternalServerError, "internal_error", "Something went wrong. Try again."))
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}
