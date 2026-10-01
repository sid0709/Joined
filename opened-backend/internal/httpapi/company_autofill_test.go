package httpapi

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
	"github.com/sid0709/OpenSeat/opened-backend/internal/openai"
)

func TestAutofillFailureTellsTheAdminWhatToDo(t *testing.T) {
	cases := []struct {
		err    error
		status int
	}{
		{openai.ErrMissingAPIKey, http.StatusServiceUnavailable},
		{jobs.ErrMissingResearcher, http.StatusServiceUnavailable},
		{jobs.ErrInvalidInput, http.StatusBadRequest},
		{context.DeadlineExceeded, http.StatusGatewayTimeout},
		{errors.New("model request failed"), http.StatusBadGateway},
	}
	for _, tc := range cases {
		if status, message := autofillFailure(tc.err); status != tc.status || message == "" {
			t.Errorf("%v: got %d %q, want %d", tc.err, status, message, tc.status)
		}
	}
}
