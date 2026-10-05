package scout

import (
	"context"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestRewardTitleApply(t *testing.T) {
	if got := rewardTitle(RewardApply); got != "Apply reward" {
		t.Errorf("rewardTitle(%q) = %q, want %q", RewardApply, got, "Apply reward")
	}
}

func testNotificationID(offset int) bson.ObjectID {
	return bson.NewObjectIDFromTimestamp(time.Unix(1_700_000_000+int64(offset), 0))
}

func testNotifications(t *testing.T) []Notification {
	t.Helper()
	return []Notification{
		{ObjectID: testNotificationID(1), ScoutUserID: "scout-1", Title: "one", Event: EventAccepted},
		{ObjectID: testNotificationID(2), ScoutUserID: "scout-1", Title: "two", Event: EventRejected},
		{ObjectID: testNotificationID(3), ScoutUserID: "scout-1", Title: "three", Event: EventPublished},
		{ObjectID: testNotificationID(4), ScoutUserID: "other", Title: "other"},
	}
}

func TestPageNotificationsSinceOldestFirst(t *testing.T) {
	items := testNotifications(t)[:3]
	page, err := pageNotifications(items, NotificationQuery{SinceSet: true, Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Data) != 2 || page.Data[0].Title != "one" || page.Data[1].Title != "two" {
		t.Fatalf("page = %+v", page.Data)
	}
	if page.NextCursor != items[1].ObjectID.Hex() {
		t.Fatalf("next = %q, want id 2", page.NextCursor)
	}

	next, err := pageNotifications(items, NotificationQuery{SinceSet: true, Since: page.NextCursor, Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(next.Data) != 1 || next.Data[0].Title != "three" || next.NextCursor != "" {
		t.Fatalf("second page = %+v next %q", next.Data, next.NextCursor)
	}

	empty, err := pageNotifications(items, NotificationQuery{SinceSet: true, Since: next.Data[0].ObjectID.Hex()})
	if err != nil {
		t.Fatal(err)
	}
	if len(empty.Data) != 0 || empty.NextCursor != "" {
		t.Fatalf("third page = %+v", empty)
	}
}

func TestPageNotificationsSinceReturnsEachOnce(t *testing.T) {
	items := testNotifications(t)[:3]
	seen := map[string]int{}
	since := ""
	for {
		page, err := pageNotifications(items, NotificationQuery{SinceSet: true, Since: since, Limit: 1})
		if err != nil {
			t.Fatal(err)
		}
		if len(page.Data) == 0 {
			break
		}
		id := page.Data[0].ObjectID.Hex()
		seen[id]++
		if seen[id] > 1 {
			t.Fatalf("id %s returned %d times", id, seen[id])
		}
		if page.NextCursor == "" {
			break
		}
		if page.NextCursor != id {
			t.Fatalf("next_cursor = %q, want %q", page.NextCursor, id)
		}
		since = page.NextCursor
	}
	if len(seen) != 3 {
		t.Fatalf("seen = %v", seen)
	}
}

func TestPageNotificationsNewestFirstCursor(t *testing.T) {
	items := testNotifications(t)[:3]
	page, err := pageNotifications(items, NotificationQuery{Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Data) != 2 || page.Data[0].Title != "three" || page.Data[1].Title != "two" {
		t.Fatalf("newest page = %+v", page.Data)
	}
	older, err := pageNotifications(items, NotificationQuery{Cursor: page.NextCursor, Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(older.Data) != 1 || older.Data[0].Title != "one" {
		t.Fatalf("older page = %+v", older.Data)
	}
}

func TestPageNotificationsInvalidSince(t *testing.T) {
	_, err := pageNotifications(nil, NotificationQuery{SinceSet: true, Since: "not-an-id"})
	var fields *ValidationError
	if err == nil || !asValidation(err, &fields) || !hasField(fields, SinceQuery) {
		t.Fatalf("err = %v, want since validation", err)
	}
}

func TestNotifyDecisionWritesOncePerStatus(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	sub := Submission{
		ObjectID:    bson.NewObjectID(),
		ScoutUserID: "scout-1",
		Title:       "Staff Engineer",
		CompanyName: "Acme",
	}
	sub.fill()

	store.notifyDecision(ctx, sub, StatusApproved, "")
	store.notifyDecision(ctx, sub, StatusApproved, "")

	page, err := store.ListNotifications(ctx, "scout-1", NotificationQuery{SinceSet: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Data) != 1 {
		t.Fatalf("len = %d, want 1: %+v", len(page.Data), page.Data)
	}
	if page.Data[0].Event != EventAccepted || page.Unread != 1 {
		t.Fatalf("page = %+v unread %d", page.Data[0], page.Unread)
	}

	again, err := store.ListNotifications(ctx, "scout-1", NotificationQuery{
		SinceSet: true,
		Since:    page.Data[0].ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(again.Data) != 0 {
		t.Fatalf("since last id returned %+v", again.Data)
	}
}

func TestNotifyRejectedAndPublishedAndEarned(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	sub := Submission{
		ObjectID:    bson.NewObjectID(),
		ScoutUserID: "scout-1",
		Title:       "Designer",
		CompanyName: "Acme",
	}
	sub.fill()

	store.notifyDecision(ctx, sub, StatusRejected, "not an official source")
	store.notifyPublished(ctx, sub)
	earning := Earning{
		ObjectID:     bson.NewObjectID(),
		SubmissionID: sub.ID,
		JobTitle:     sub.Title,
		Type:         RewardApply,
		Amount:       cents(50),
		Status:       EarningReleased,
	}
	earning.fill()
	store.notifyRewardImpl(ctx, "scout-1", earning)
	store.notifyRewardImpl(ctx, "scout-1", earning)

	page, err := store.ListNotifications(ctx, "scout-1", NotificationQuery{SinceSet: true, Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Data) != 3 {
		t.Fatalf("len = %d, want 3: %+v", len(page.Data), page.Data)
	}
	got := map[string]int{}
	for _, item := range page.Data {
		got[item.Event]++
	}
	if got[EventRejected] != 1 || got[EventPublished] != 1 || got[EventEarned] != 1 {
		t.Fatalf("events = %v", got)
	}
}

func TestStatusEventWritesWhenInboxPreferenceOff(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	mem := store.docs.(*memDocs)
	profile, err := mem.profile("scout-1")
	if err != nil {
		t.Fatal(err)
	}
	profile.NotifyDecisions = false
	profile.NotifyRewards = false
	mem.mu.Lock()
	mem.profiles["scout-1"] = profile
	mem.mu.Unlock()

	sub := Submission{ObjectID: bson.NewObjectID(), ScoutUserID: "scout-1", Title: "PM", CompanyName: "Acme"}
	sub.fill()
	store.notifyDecision(ctx, sub, StatusApproved, "")
	page, err := store.ListNotifications(ctx, "scout-1", NotificationQuery{SinceSet: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Data) != 1 || page.Data[0].Event != EventAccepted {
		t.Fatalf("page = %+v", page.Data)
	}
}

func TestMarkReadClearsUnread(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	sub := Submission{ObjectID: bson.NewObjectID(), ScoutUserID: "scout-1", Title: "PM", CompanyName: "Acme"}
	sub.fill()
	store.notifyDecision(ctx, sub, StatusApproved, "")
	page, err := store.ListNotifications(ctx, "scout-1", NotificationQuery{SinceSet: true})
	if err != nil {
		t.Fatal(err)
	}
	if page.Unread != 1 {
		t.Fatalf("unread = %d", page.Unread)
	}
	if err := store.MarkRead(ctx, "scout-1", []string{page.Data[0].ID}); err != nil {
		t.Fatal(err)
	}
	after, err := store.ListNotifications(ctx, "scout-1", NotificationQuery{SinceSet: true})
	if err != nil {
		t.Fatal(err)
	}
	if after.Unread != 0 || !after.Data[0].Read {
		t.Fatalf("after mark-read unread=%d read=%v", after.Unread, after.Data[0].Read)
	}
}
