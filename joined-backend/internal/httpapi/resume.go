package httpapi

import (
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/sid0709/Joined/backend-core/candidate"
	"github.com/sid0709/Joined/backend-core/httpkit"
	"github.com/sid0709/Joined/backend-core/killswitch"
	"github.com/sid0709/Joined/backend-core/resumeread"
)

const (
	// resumeFormField is the multipart field a résumé file arrives in.
	resumeFormField = "resume"
	// multipartOverhead is the form framing allowed on top of the file itself.
	multipartOverhead = 64 << 10
)

// profileResumeResponse is the filled profile and which reader read the résumé.
type profileResumeResponse struct {
	Profile candidate.Profile `json:"profile"`
	Reader  string            `json:"reader"`
}

// postProfileResume reads an uploaded résumé (PDF, Word, or text) and fills the
// job hunter's profile with what it says.
func (s *Server) postProfileResume(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireCandidate(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, resumeread.MaxBytes+multipartOverhead)
	if err := r.ParseMultipartForm(resumeread.MaxBytes); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, resumeread.ErrTooLarge.Error())
		return
	}
	file, header, err := r.FormFile(resumeFormField)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "choose a résumé file")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, resumeread.MaxBytes+1))
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, resumeread.ErrUnreadable.Error())
		return
	}
	result, err := resumeread.ReadFile(r.Context(), s.resumeModel(r), header.Filename, data)
	if errors.Is(err, resumeread.ErrUnreadable) || errors.Is(err, resumeread.ErrUnsupported) || errors.Is(err, resumeread.ErrTooLarge) {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !writeCandidate(w, err) {
		return
	}
	profile, err := s.people.FillFromResume(r.Context(), session.User.ID, result.Resume, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	s.noteProfileChanged(session.User.ID)
	httpkit.WriteJSON(w, http.StatusOK, profileResumeResponse{Profile: profile, Reader: result.Reader})
}

// resumeModel is the model that reads résumés, or nil to leave the layout parser
// in charge: no reader, no API key, or Acorn AI switched off.
func (s *Server) resumeModel(r *http.Request) resumeread.Model {
	if s.reader == nil || !killswitch.On(s.switches, r.Context(), killswitch.AcornAI) {
		return nil
	}
	if ready, ok := s.reader.(interface{ Ready() bool }); ok && !ready.Ready() {
		return nil
	}
	return s.reader
}
