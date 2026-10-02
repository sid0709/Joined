package acornapi

import (
	"encoding/base64"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// RuntimeFile is a file on this server the extension can attach to an upload field.
type RuntimeFile struct {
	// Path is the file on disk; empty means none is configured.
	Path string
	// Key names the file in the extension's pipeline.
	Key string
}

func (s *Server) runtimeFile(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	if s.files.Path == "" {
		writeError(w, http.StatusNotFound, "ACORN_RUNTIME_FILE_PATH is not set")
		return
	}
	data, err := os.ReadFile(s.files.Path)
	if err != nil {
		writeError(w, http.StatusNotFound, "Runtime file not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"file": map[string]string{
		"key":      s.files.Key,
		"name":     filepath.Base(s.files.Path),
		"mimeType": mimeType(s.files.Path),
		"base64":   base64.StdEncoding.EncodeToString(data),
	}})
}

func mimeType(path string) string {
	switch ext := strings.ToLower(filepath.Ext(path)); ext {
	case ".pdf":
		return "application/pdf"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".doc":
		return "application/msword"
	case ".txt":
		return "text/plain"
	default:
		if found := mime.TypeByExtension(ext); found != "" {
			return found
		}
		return "application/octet-stream"
	}
}
