package savedsearch

import (
	"context"
	"time"
)

// DueAlerts is the hook a future job-alert sender calls. It does not send mail.
type DueAlerts interface {
	ListDue(ctx context.Context, now time.Time, limit int) ([]SavedSearch, error)
	MarkAlerted(ctx context.Context, id string, now time.Time) error
}

// Store persists saved searches. Tests use Memory; production uses MongoStore.
type Store interface {
	Insert(ctx context.Context, search SavedSearch) error
	Get(ctx context.Context, userID, id string) (SavedSearch, error)
	ListByUser(ctx context.Context, userID string) ([]SavedSearch, error)
	Replace(ctx context.Context, search SavedSearch) error
	Delete(ctx context.Context, userID, id string) error
	CountByUser(ctx context.Context, userID string) (int, error)
	ListDue(ctx context.Context, now time.Time, limit int) ([]SavedSearch, error)
	MarkAlerted(ctx context.Context, id string, now time.Time) error
}

var (
	_ Store     = (*Memory)(nil)
	_ Store     = (*MongoStore)(nil)
	_ DueAlerts = (*Service)(nil)
)
