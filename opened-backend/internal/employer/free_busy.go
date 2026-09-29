package employer

import "errors"

// ErrFreeBusyNotReady is returned until interviewer calendars are connected.
// calendar_connections is the candidate's Google calendar and is not company free/busy.
var ErrFreeBusyNotReady = errors.New("free/busy is not available until interviewer calendars are connected")

// FreeBusyBlock is one busy interval in the hiring-profile time zone.
//
// Next contract — not implemented, no route is registered:
//
//	GET /v1/company/interviews/free-busy?from=YYYY-MM-DD&to=YYYY-MM-DD
//	Auth: company session with interviews.schedule
//	200 {"blocks":[{"date":"YYYY-MM-DD","start":"HH:mm","end":"HH:mm"}]}
//
// Hiring-profile interviewDays, dayStart, dayEnd, interviewLength, and buffer
// stay a client scaffold (proposeSlotsFromAvailability). Do not serve them as free/busy.
type FreeBusyBlock struct {
	Date  string `json:"date"`
	Start string `json:"start"`
	End   string `json:"end"`
}

// FreeBusy reports interviewer busy intervals. No company calendar is stored.
func FreeBusy(from, to string) ([]FreeBusyBlock, error) {
	_, _ = from, to
	return nil, ErrFreeBusyNotReady
}
