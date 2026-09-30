package employer

import "errors"

var (
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("check the form and try again")
	ErrInsufficient = errors.New("not enough balance to schedule this interview")
	ErrConflict     = errors.New("that change is not available")
	ErrForbidden    = errors.New("only the company creator can do this")
)

type forbiddenError struct{ reason string }

func (e *forbiddenError) Error() string { return e.reason }

func (e *forbiddenError) Unwrap() error { return ErrForbidden }

// Forbidden is a 403 whose message is safe to show in the hiring UI.
func Forbidden(reason string) error {
	if reason == "" {
		return ErrForbidden
	}
	return &forbiddenError{reason: reason}
}

type invalidError struct{ reason string }

func (e *invalidError) Error() string { return e.reason }

func (e *invalidError) Unwrap() error { return ErrInvalidInput }

// Invalid is a 400 whose message is safe to show in the hiring UI.
func Invalid(reason string) error {
	if reason == "" {
		return ErrInvalidInput
	}
	return &invalidError{reason: reason}
}
