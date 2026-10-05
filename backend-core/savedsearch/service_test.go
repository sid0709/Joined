package savedsearch

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestCreateListGetUpdateDelete(t *testing.T) {
	ctx := context.Background()
	svc := NewService(NewMemory())
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)

	created, err := svc.Create(ctx, "user-a", Input{
		Name:  "Remote Go",
		Query: "golang",
		Filters: Filters{
			Location:  "San Francisco",
			Workplace: "remote",
			Remote:    true,
			SalaryMin: 150000,
			SortBy:    "newest",
			Source:    "hidden",
		},
		AlertFrequency: AlertDaily,
	}, now)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created.ID == "" || created.UserID != "user-a" || created.Query != "golang" {
		t.Fatalf("created = %+v", created)
	}
	if created.AlertFrequency != AlertDaily || created.Filters.Location != "San Francisco" {
		t.Fatalf("created filters = %+v", created)
	}

	listed, err := svc.List(ctx, "user-a")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(listed) != 1 || listed[0].ID != created.ID {
		t.Fatalf("list = %+v", listed)
	}

	got, err := svc.Get(ctx, "user-a", created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Name != "Remote Go" {
		t.Fatalf("get name = %q", got.Name)
	}

	daily := AlertWeekly
	updated, err := svc.Update(ctx, "user-a", created.ID, Patch{AlertFrequency: &daily}, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.AlertFrequency != AlertWeekly || updated.UpdatedAt.Equal(created.UpdatedAt) {
		t.Fatalf("updated = %+v", updated)
	}

	if err := svc.Delete(ctx, "user-a", created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := svc.Get(ctx, "user-a", created.ID); err != ErrNotFound {
		t.Fatalf("get after delete = %v, want not found", err)
	}
}

func TestUserCannotReadOrEditAnotherUsersSearch(t *testing.T) {
	ctx := context.Background()
	svc := NewService(NewMemory())
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)

	owned, err := svc.Create(ctx, "user-a", Input{Query: "rust"}, now)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if _, err := svc.Get(ctx, "user-b", owned.ID); err != ErrNotFound {
		t.Fatalf("cross-user get = %v, want not found", err)
	}
	listed, err := svc.List(ctx, "user-b")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(listed) != 0 {
		t.Fatalf("user-b list = %+v", listed)
	}
	name := "stolen"
	if _, err := svc.Update(ctx, "user-b", owned.ID, Patch{Name: &name}, now); err != ErrNotFound {
		t.Fatalf("cross-user update = %v, want not found", err)
	}
	if err := svc.Delete(ctx, "user-b", owned.ID); err != ErrNotFound {
		t.Fatalf("cross-user delete = %v, want not found", err)
	}
}

func TestPerUserCap(t *testing.T) {
	ctx := context.Background()
	svc := NewService(NewMemory())
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	for i := 0; i < MaxPerUser; i++ {
		if _, err := svc.Create(ctx, "user-a", Input{Query: "q"}, now); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}
	if _, err := svc.Create(ctx, "user-a", Input{Query: "overflow"}, now); err != ErrLimitReached {
		t.Fatalf("over cap = %v, want limit reached", err)
	}
	if _, err := svc.Create(ctx, "user-b", Input{Query: "ok"}, now); err != nil {
		t.Fatalf("other user should not share the cap: %v", err)
	}
}

func TestDefaultNameAndOffFrequency(t *testing.T) {
	ctx := context.Background()
	svc := NewService(NewMemory())
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)

	fromQuery, err := svc.Create(ctx, "user-a", Input{Query: "staff engineer"}, now)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if fromQuery.Name != "staff engineer" || fromQuery.AlertFrequency != AlertOff {
		t.Fatalf("from query = %+v", fromQuery)
	}

	untitled, err := svc.Create(ctx, "user-a", Input{}, now)
	if err != nil {
		t.Fatalf("untitled: %v", err)
	}
	if untitled.Name != DefaultName {
		t.Fatalf("untitled name = %q", untitled.Name)
	}
}

func TestInvalidFiltersAndFrequency(t *testing.T) {
	ctx := context.Background()
	svc := NewService(NewMemory())
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)

	if _, err := svc.Create(ctx, "user-a", Input{Filters: Filters{SalaryMin: -1}}, now); err != ErrInvalidInput {
		t.Fatalf("negative salary = %v", err)
	}
	if _, err := svc.Create(ctx, "user-a", Input{Filters: Filters{SalaryMin: 200, SalaryMax: 100}}, now); err != ErrInvalidInput {
		t.Fatalf("inverted salary = %v", err)
	}
	if _, err := svc.Create(ctx, "user-a", Input{Filters: Filters{SortBy: "pay"}}, now); err != ErrInvalidInput {
		t.Fatalf("bad sort = %v", err)
	}
	if _, err := svc.Create(ctx, "user-a", Input{AlertFrequency: "hourly"}, now); err != ErrInvalidInput {
		t.Fatalf("bad frequency = %v", err)
	}
	if _, err := svc.Create(ctx, "", Input{Query: "x"}, now); err != ErrUnauthorized {
		t.Fatalf("empty user = %v", err)
	}
}

func TestAlertDueAndListDueHook(t *testing.T) {
	ctx := context.Background()
	svc := NewService(NewMemory())
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)

	off, err := svc.Create(ctx, "user-a", Input{Query: "off", AlertFrequency: AlertOff}, now)
	if err != nil {
		t.Fatalf("off: %v", err)
	}
	daily, err := svc.Create(ctx, "user-a", Input{Query: "daily", AlertFrequency: AlertDaily}, now)
	if err != nil {
		t.Fatalf("daily: %v", err)
	}
	weekly, err := svc.Create(ctx, "user-b", Input{Query: "weekly", AlertFrequency: AlertWeekly}, now)
	if err != nil {
		t.Fatalf("weekly: %v", err)
	}

	if off.AlertDue(now) {
		t.Fatal("off should never be due")
	}
	if !daily.AlertDue(now) || !weekly.AlertDue(now) {
		t.Fatal("never-alerted daily/weekly should be due immediately")
	}

	due, err := svc.ListDue(ctx, now, 10)
	if err != nil {
		t.Fatalf("list due: %v", err)
	}
	if len(due) != 2 {
		t.Fatalf("due count = %d, want 2 (off excluded)", len(due))
	}

	if err := svc.MarkAlerted(ctx, daily.ID, now); err != nil {
		t.Fatalf("mark: %v", err)
	}
	if dueAfter, err := svc.ListDue(ctx, now.Add(time.Hour), 10); err != nil {
		t.Fatalf("list due after mark: %v", err)
	} else if len(dueAfter) != 1 || dueAfter[0].ID != weekly.ID {
		t.Fatalf("after mark = %+v", dueAfter)
	}

	if later, err := svc.ListDue(ctx, now.Add(DailyInterval), 10); err != nil {
		t.Fatalf("list due next day: %v", err)
	} else if len(later) != 2 {
		t.Fatalf("next day due = %d, want daily again plus weekly", len(later))
	}

	if err := svc.MarkAlerted(ctx, weekly.ID, now); err != nil {
		t.Fatalf("mark weekly: %v", err)
	}
	midWeek, err := svc.ListDue(ctx, now.Add(3*DailyInterval), 10)
	if err != nil {
		t.Fatalf("mid week: %v", err)
	}
	for _, search := range midWeek {
		if search.ID == weekly.ID {
			t.Fatal("weekly should not be due three days after last alert")
		}
	}
}

func TestAlertDueCutoff(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	daily := SavedSearch{AlertFrequency: AlertDaily, LastAlertedAt: now.Add(-DailyInterval)}
	if !daily.AlertDue(now) {
		t.Fatal("daily should be due exactly at the interval")
	}
	almost := SavedSearch{AlertFrequency: AlertDaily, LastAlertedAt: now.Add(-DailyInterval + time.Second)}
	if almost.AlertDue(now) {
		t.Fatal("daily should not be due one second before the interval")
	}
}

func TestQueryTruncatedToMax(t *testing.T) {
	ctx := context.Background()
	svc := NewService(NewMemory())
	long := strings.Repeat("a", MaxQueryLength+20)
	created, err := svc.Create(ctx, "user-a", Input{Query: long}, time.Now())
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if len(created.Query) != MaxQueryLength {
		t.Fatalf("query length = %d, want %d", len(created.Query), MaxQueryLength)
	}
}
