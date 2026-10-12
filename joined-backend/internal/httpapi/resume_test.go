package httpapi

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/Joined/backend-core/candidate"
	"github.com/sid0709/Joined/backend-core/resumeread"
)

func resumeRequest(t *testing.T, field, name string, data []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	part, err := form.CreateFormFile(field, name)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := form.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/me/profile/resume", &body)
	req.Header.Set("Content-Type", form.FormDataContentType())
	req.Header.Set("Authorization", "Bearer candidate-token")
	return req
}

func TestProfileResumeRejectsUnreadableFiles(t *testing.T) {
	// The store is never reached: each file is refused before the profile is read.
	people := candidate.NewStore(nil, "", nil, nil, nil)
	handler := New(nil, nil, people, nil, nil, nil, Options{Sessions: testSessions()})
	cases := map[string]struct {
		req  *http.Request
		want string
	}{
		"unsupported": {resumeRequest(t, resumeFormField, "resume.doc", []byte("binary")), resumeread.ErrUnsupported.Error()},
		"image only":  {resumeRequest(t, resumeFormField, "scan.pdf", []byte("%PDF-1.4\n%%EOF")), resumeread.ErrUnreadable.Error()},
		"no file":     {resumeRequest(t, "other", "resume.pdf", []byte("x")), "choose a résumé file"},
	}
	for name, tc := range cases {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, tc.req)
		if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), tc.want) {
			t.Errorf("%s: status = %d body = %s", name, rec.Code, rec.Body.String())
		}
	}
}
