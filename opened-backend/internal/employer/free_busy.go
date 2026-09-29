package employer

import (
	"errors"
	"strings"
	"time"
)

// ErrFreeBusyNotReady is returned until interviewer calendars are connected.
//
// Prerequisite: a company interviewer calendar-connect. That connection does
// not exist. Do not invent OAuth or a new calendar provider to fill this in.
// calendar_connections is the candidate Google calendar (/v1/me/calendar/google/*)
// and is not company free/busy.
var ErrFreeBusyNotReady = errors.New("free/busy is not available until interviewer calendars are connected")

// FreeBusyNotReadyCode is the JSON code on HTTP 503. Clients match this code
// to tell "not ready" from a 500 {"error":"could not complete the request"} crash
// and from other 503s such as "hiring workspace is unavailable".
const FreeBusyNotReadyCode = "free_busy_not_ready"

// FreeBusyBlock is one busy interval in the hiring-profile time zone.
//
//	GET /v1/company/interviews/free-busy?from=YYYY-MM-DD&to=YYYY-MM-DD
//	Auth: company session with interviews.schedule
//	200 {"blocks":[{"date":"YYYY-MM-DD","start":"HH:mm","end":"HH:mm"}]}
//	400 {"error":"..."} when from/to are missing, not YYYY-MM-DD, or from is after to
//	503 {"error":"<ErrFreeBusyNotReady>","code":"free_busy_not_ready"}
//
// Hiring-profile interviewDays, dayStart, dayEnd, interviewLength, and buffer
// stay a client scaffold (proposeSlotsFromAvailability). Do not serve them as free/busy.
type FreeBusyBlock struct {
	Date  string `json:"date"`
	Start string `json:"start"`
	End   string `json:"end"`
}

// FreeBusy reports interviewer busy intervals.
// No company calendar is stored, so a valid range still returns ErrFreeBusyNotReady.
func FreeBusy(from, to string) ([]FreeBusyBlock, error) {
	if err := validateFreeBusyRange(from, to); err != nil {
		return nil, err
	}
	return nil, ErrFreeBusyNotReady
}

func validateFreeBusyRange(from, to string) error {
	start, err := parseFreeBusyDay(from)
	if err != nil {
		return Invalid("from and to must be YYYY-MM-DD")
	}
	end, err := parseFreeBusyDay(to)
	if err != nil {
		return Invalid("from and to must be YYYY-MM-DD")
	}
	if start.After(end) {
		return Invalid("from must be on or before to")
	}
	return nil
}

func parseFreeBusyDay(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	day, err := time.Parse("2006-01-02", value)
	if err != nil || day.Format("2006-01-02") != value {
		return time.Time{}, errors.New("invalid day")
	}
	return day, nil
}
