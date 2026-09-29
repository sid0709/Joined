package httpapi

import (
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/candidate"
)

func (s *Server) getProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	profile, err := s.people.GetProfile(r.Context(), session.User.ID, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (s *Server) patchProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	var patch candidate.ProfilePatch
	if !decodeBody(w, r, &patch) {
		return
	}
	profile, err := s.people.PatchProfile(r.Context(), session.User.ID, patch, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (s *Server) getSavedJobs(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	ids, err := s.people.SavedJobIDs(r.Context(), session.User.ID)
	if !writeCandidate(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobIds": ids})
}

func (s *Server) putSavedJob(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	err := s.people.SaveJob(r.Context(), session.User.ID, r.PathValue("jobId"), time.Now())
	if !writeCandidate(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) deleteSavedJob(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	err := s.people.UnsaveJob(r.Context(), session.User.ID, r.PathValue("jobId"))
	if !writeCandidate(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) getApplications(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	items, err := s.people.ListBoard(r.Context(), session.User.ID)
	if !writeCandidate(w, err) {
		return
	}
	ids, err := s.people.AppliedJobIDs(r.Context(), session.User.ID)
	if !writeCandidate(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"applications": items, "appliedJobIds": ids})
}

func (s *Server) postApplication(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	var input candidate.ApplyInput
	if !decodeBody(w, r, &input) {
		return
	}
	app, err := s.people.Apply(r.Context(), session.User.ID, input, time.Now())
	if err == candidate.ErrAlreadyApplied {
		writeJSON(w, http.StatusOK, app)
		return
	}
	if !writeCandidate(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, app)
}

func (s *Server) patchApplication(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	var patch candidate.ApplicationPatch
	if !decodeBody(w, r, &patch) {
		return
	}
	if jobID, isSaved := candidate.IsSavedBoardID(id); isSaved {
		stage := candidate.StageApplied
		if patch.ColumnID != nil {
			stage = *patch.ColumnID
		}
		app, err := s.people.Apply(r.Context(), session.User.ID, candidate.ApplyInput{JobID: jobID, Stage: stage}, time.Now())
		if err != nil && err != candidate.ErrAlreadyApplied {
			if !writeCandidate(w, err) {
				return
			}
		}
		if patch.ColumnID != nil && app.ColumnID != *patch.ColumnID {
			app, err = s.people.PatchApplication(r.Context(), session.User.ID, app.ID, patch, time.Now())
			if !writeCandidate(w, err) {
				return
			}
		}
		writeJSON(w, http.StatusOK, app)
		return
	}
	app, err := s.people.PatchApplication(r.Context(), session.User.ID, id, patch, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, app)
}

func (s *Server) deleteApplication(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if jobID, isSaved := candidate.IsSavedBoardID(id); isSaved {
		err := s.people.UnsaveJob(r.Context(), session.User.ID, jobID)
		if !writeCandidate(w, err) {
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	err := s.people.RemoveApplication(r.Context(), session.User.ID, id)
	if !writeCandidate(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) getInterviews(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	items, err := s.people.ListInterviews(r.Context(), session.User.ID)
	if !writeCandidate(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"interviews": items})
}

func (s *Server) postInterview(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	var input candidate.InterviewInput
	if !decodeBody(w, r, &input) {
		return
	}
	item, err := s.people.CreateInterview(r.Context(), session.User.ID, input, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) patchInterview(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	var patch candidate.InterviewPatch
	if !decodeBody(w, r, &patch) {
		return
	}
	item, err := s.people.PatchInterview(r.Context(), session.User.ID, r.PathValue("id"), patch, time.Now())
	if !writeCandidate(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, item)
}
