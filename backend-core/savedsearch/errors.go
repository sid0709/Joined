package savedsearch

import "errors"

var (
	ErrNotFound     = errors.New("saved search not found")
	ErrInvalidInput = errors.New("invalid saved search")
	ErrLimitReached = errors.New("saved search limit reached")
	ErrUnauthorized = errors.New("sign in required")
	ErrMissingStore = errors.New("saved searches are unavailable")
)
