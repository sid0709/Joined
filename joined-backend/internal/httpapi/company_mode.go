package httpapi

import (
	"net/http"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

const companyModeDisabledMessage = "company mode is not enabled"

func requireCompanyMode(enabled bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !enabled {
			httpkit.WriteError(w, http.StatusForbidden, companyModeDisabledMessage)
			return
		}
		next.ServeHTTP(w, r)
	})
}
