package acornapi

import (
	"net/http"
)

// Résumé generation, recommendation and storage are not part of Acorn's Go backend.
// These routes keep the extension's contract and answer with nothing: no file, no
// match, no preview. The extension treats each as "no résumé available".

func (s *Server) noJobResume(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "jobId": r.PathValue("jobId"), "resumeId": nil, "stack": nil})
}

func (s *Server) noLibraryResume(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "resumeId": r.PathValue("resumeId"), "stack": nil})
}

func (s *Server) noGeneratedResume(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "generationId": r.PathValue("generationId"), "resumeId": nil})
}

func (s *Server) emptyPreview(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "html": ""})
}

func (s *Server) noGenerate(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "inputId": ""})
}

func (s *Server) generateForJob(w http.ResponseWriter, r *http.Request) {
	s.noGenerate(w, r)
}

func (s *Server) noContinue(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "inputId": "", "recovered": false, "resumedFromStep": nil, "jobDescription": nil, "task": nil,
	})
}

func (s *Server) noPoll(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "completed", "generationId": nil, "resumeId": nil})
}

func (s *Server) noRecommend(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"recommendedResumeId": "", "recommendedResumeStack": "", "recommendedResumeReason": nil})
}
