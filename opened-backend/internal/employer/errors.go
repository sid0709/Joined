package employer

import "errors"

var (
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("check the form and try again")
	ErrInsufficient = errors.New("not enough balance to schedule this interview")
	ErrConflict     = errors.New("that change is not available")
	ErrForbidden    = errors.New("only the company creator can do this")
)
