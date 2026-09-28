package candidate

import "errors"

var (
	ErrNotFound        = errors.New("not found")
	ErrInvalidInput    = errors.New("check the form and try again")
	ErrAlreadyApplied  = errors.New("you already applied to this job")
	ErrNeedsApplication = errors.New("add an application before scheduling an interview")
	ErrForbidden       = errors.New("not allowed")
	ErrNotConfigured   = errors.New("Google Calendar is not configured")
	ErrDuplicate       = errors.New("already exists")
)
