package scout

import (
	"bytes"
	"context"
	"log/slog"
	"sort"
	"strconv"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Paths Maya (extension) and Leo (Scout website) mount on scoutwell-backend.
const (
	NotificationsPath = "GET /v1/scout/notifications"
	MarkReadPath      = "POST /v1/scout/notifications/read"
	// SinceQuery is the change-feed cursor: items with id greater than this value.
	SinceQuery = "since"
)

// Submission change events the extension polls for. Inbox kinds stay separate.
const (
	EventAccepted  = "accepted"
	EventRejected  = "rejected"
	EventPublished = "published"
	EventEarned    = "earned"
)

// Notification kinds and tones. Tones map onto design-system badge variants.
const (
	kindDecision     = "decision"
	kindReward       = "reward"
	kindLevel        = "level"
	kindPayout       = "payout"
	kindVerification = "verification"

	toneAccent  = "accent"
	toneSuccess = "success"
	toneWarning = "warning"
	toneDanger  = "danger"
	toneNeutral = "neutral"
)

// NotificationQuery pages the inbox (cursor, newest first) or the change feed
// (since, oldest first). When SinceSet is true, Cursor is ignored.
type NotificationQuery struct {
	Since    string
	SinceSet bool
	Cursor   string
	Limit    int
}

// NotificationPage is one notifications response: a page plus unread count.
type NotificationPage struct {
	Data       []Notification `json:"data"`
	NextCursor string         `json:"next_cursor"`
	Unread     int64          `json:"unread_count"`
}

type notice struct {
	kind, tone, title, body, subjectID, event, key string
}

func changeNotice(kind, tone, title, body, subjectID, event, keyID string) notice {
	key := ""
	if event != "" && keyID != "" {
		key = event + ":" + keyID
	}
	return notice{kind: kind, tone: tone, title: title, body: body, subjectID: subjectID, event: event, key: key}
}

// notify stores an in-app notification. Failures are logged, never returned:
// a missed notification must not undo the decision that caused it.
func (s *Store) notify(ctx context.Context, userID string, n notice) {
	if n.event == "" && (n.kind == kindDecision || n.kind == kindReward) {
		profile, err := s.storedProfile(ctx, userID)
		if err == nil && ((n.kind == kindDecision && !profile.NotifyDecisions) || (n.kind == kindReward && !profile.NotifyRewards)) {
			return
		}
	}
	row := Notification{
		ObjectID:    bson.NewObjectID(),
		ScoutUserID: userID,
		Kind:        n.kind,
		Tone:        n.tone,
		Title:       n.title,
		Body:        n.body,
		SubjectID:   n.subjectID,
		Event:       n.event,
		Key:         n.key,
		CreatedAt:   s.now().UTC(),
	}
	if err := s.insertNotification(ctx, row); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return
		}
		slog.Error("scout notify", "user", userID, "kind", n.kind, "event", n.event, "error", err)
	}
}

func (s *Store) notifyDecision(ctx context.Context, sub Submission, status, reason string) {
	job := sub.Title + " at " + sub.CompanyName
	subject := sub.ID
	if subject == "" {
		subject = sub.ObjectID.Hex()
	}
	switch status {
	case StatusApproved:
		s.notify(ctx, sub.ScoutUserID, changeNotice(kindDecision, toneSuccess, "Job approved", job+" is live in the job pool.", subject, EventAccepted, subject))
	case StatusRejected:
		s.notify(ctx, sub.ScoutUserID, changeNotice(kindDecision, toneDanger, "Submission rejected", job+": "+reason+".", subject, EventRejected, subject))
	case StatusDuplicate:
		s.notify(ctx, sub.ScoutUserID, changeNotice(kindDecision, toneNeutral, "Marked duplicate", job+" was already in the pool.", subject, EventRejected, subject))
	case StatusNeedsReview:
		s.notify(ctx, sub.ScoutUserID, notice{kind: kindDecision, tone: toneWarning, title: "Waiting on a moderator", body: job + " passed the automatic checks and is in the review queue.", subjectID: subject})
	}
}

func (s *Store) notifyPublished(ctx context.Context, sub Submission) {
	subject := sub.ID
	if subject == "" {
		subject = sub.ObjectID.Hex()
	}
	job := sub.Title + " at " + sub.CompanyName
	s.notify(ctx, sub.ScoutUserID, changeNotice(kindDecision, toneSuccess, "Job published", job+" is live in search.", subject, EventPublished, subject))
}

func (s *Store) notifyRewardImpl(ctx context.Context, userID string, earning Earning) {
	body := formatMoney(earning.Amount) + " for " + earning.JobTitle
	if earning.Status == EarningHeld {
		body += ", held until " + earning.HoldUntil.Format("Jan 2")
	}
	keyID := earning.ID
	if keyID == "" {
		keyID = earning.ObjectID.Hex()
	}
	s.notify(ctx, userID, changeNotice(kindReward, toneSuccess, rewardTitle(earning.Type), body+".", earning.SubmissionID, EventEarned, keyID))
}

func rewardTitle(kind string) string {
	switch kind {
	case RewardApproval:
		return "Approval reward"
	case RewardApply:
		return "Apply reward"
	case RewardInterview:
		return "Interview reward"
	case RewardHire:
		return "Hire reward"
	default:
		return "Reward"
	}
}

func (s *Store) notifyLevel(ctx context.Context, userID, from, to string) {
	tone := toneSuccess
	title := "Promoted to " + Rule(to).Label
	if levelIndex(to) < levelIndex(from) {
		tone = toneWarning
		title = "Moved to " + Rule(to).Label
	}
	s.notify(ctx, userID, notice{kind: kindLevel, tone: tone, title: title, body: "Your daily limit is now " + strconv.Itoa(Rule(to).DailyLimit) + " submissions."})
}

func levelIndex(level string) int {
	for i, id := range levelOrder {
		if id == level {
			return i
		}
	}
	return 0
}

// ListNotifications pages a scout's notifications. With SinceSet, items are
// oldest first after that id (change feed). Otherwise newest first (inbox).
func (s *Store) ListNotifications(ctx context.Context, userID string, query NotificationQuery) (NotificationPage, error) {
	items, next, err := s.listNotificationRows(ctx, userID, query)
	if err != nil {
		return NotificationPage{}, err
	}
	unread, err := s.UnreadCount(ctx, userID)
	if err != nil {
		return NotificationPage{}, err
	}
	if items == nil {
		items = []Notification{}
	}
	return NotificationPage{Data: items, NextCursor: next, Unread: unread}, nil
}

func (s *Store) listNotificationRows(ctx context.Context, userID string, query NotificationQuery) ([]Notification, string, error) {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.listNotifications(userID, query)
	}
	filter := bson.D{{Key: "scoutUserId", Value: userID}}
	sort := bson.D{{Key: "_id", Value: -1}}
	var err error
	if query.SinceSet {
		filter, err = sinceFilter(filter, query.Since)
		sort = bson.D{{Key: "_id", Value: 1}}
	} else {
		filter, err = cursorFilter(filter, query.Cursor)
	}
	if err != nil {
		return nil, "", err
	}
	limit := listLimit(query.Limit)
	cursor, err := s.collection(notificationsCollection).Find(ctx, filter,
		options.Find().SetSort(sort).SetLimit(int64(limit+1)))
	if err != nil {
		return nil, "", err
	}
	items := []Notification{}
	if err := cursor.All(ctx, &items); err != nil {
		return nil, "", err
	}
	items, next := clipNotificationPage(items, limit)
	return items, next, nil
}

// UnreadCount is how many notifications the scout has not read.
func (s *Store) UnreadCount(ctx context.Context, userID string) (int64, error) {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.unreadCount(userID), nil
	}
	return s.collection(notificationsCollection).CountDocuments(ctx, bson.D{{Key: "scoutUserId", Value: userID}, {Key: "read", Value: false}})
}

// MarkRead marks some notifications read, or every one when ids is empty.
func (s *Store) MarkRead(ctx context.Context, userID string, ids []string) error {
	if mem, ok := s.docs.(*memDocs); ok {
		mem.markRead(userID, ids)
		return nil
	}
	filter := bson.D{{Key: "scoutUserId", Value: userID}, {Key: "read", Value: false}}
	if len(ids) > 0 {
		oids := make([]bson.ObjectID, 0, len(ids))
		for _, id := range ids {
			if oid, err := bson.ObjectIDFromHex(id); err == nil {
				oids = append(oids, oid)
			}
		}
		filter = append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$in", Value: oids}}})
	}
	_, err := s.collection(notificationsCollection).UpdateMany(ctx, filter, bson.D{{Key: "$set", Value: bson.D{{Key: "read", Value: true}}}})
	return err
}

func (s *Store) insertNotification(ctx context.Context, row Notification) error {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.insertNotification(row)
	}
	_, err := s.collection(notificationsCollection).InsertOne(ctx, row)
	return err
}

// sinceFilter pages oldest-first by _id: the cursor is the last id already seen.
func sinceFilter(filter bson.D, since string) (bson.D, error) {
	if since == "" {
		return filter, nil
	}
	id, err := bson.ObjectIDFromHex(since)
	if err != nil {
		return nil, &ValidationError{Fields: []FieldError{{Field: SinceQuery, Detail: "invalid cursor"}}}
	}
	return append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$gt", Value: id}}}), nil
}

// clipNotificationPage keeps at most limit items and returns the next cursor.
func clipNotificationPage(items []Notification, limit int) ([]Notification, string) {
	next := ""
	if len(items) > limit {
		items = items[:limit]
		next = items[len(items)-1].ObjectID.Hex()
	}
	for i := range items {
		items[i].fill()
	}
	return items, next
}

// pageNotifications orders a scout's rows for one request. since pages oldest
// first after that id; otherwise newest first.
func pageNotifications(items []Notification, query NotificationQuery) (NotificationPage, error) {
	limit := listLimit(query.Limit)
	if query.SinceSet {
		after, err := parsePageCursor(query.Since, SinceQuery)
		if err != nil {
			return NotificationPage{}, err
		}
		filtered := make([]Notification, 0, len(items))
		for _, item := range items {
			if after == (bson.ObjectID{}) || compareObjectID(item.ObjectID, after) > 0 {
				filtered = append(filtered, item)
			}
		}
		sortNotifications(filtered, true)
		data, next := clipNotificationPage(filtered, limit)
		return NotificationPage{Data: data, NextCursor: next}, nil
	}
	before, err := parsePageCursor(query.Cursor, "cursor")
	if err != nil {
		return NotificationPage{}, err
	}
	filtered := make([]Notification, 0, len(items))
	for _, item := range items {
		if before == (bson.ObjectID{}) || compareObjectID(item.ObjectID, before) < 0 {
			filtered = append(filtered, item)
		}
	}
	sortNotifications(filtered, false)
	data, next := clipNotificationPage(filtered, limit)
	return NotificationPage{Data: data, NextCursor: next}, nil
}

func parsePageCursor(raw, field string) (bson.ObjectID, error) {
	if raw == "" {
		return bson.ObjectID{}, nil
	}
	id, err := bson.ObjectIDFromHex(raw)
	if err != nil {
		return bson.ObjectID{}, &ValidationError{Fields: []FieldError{{Field: field, Detail: "invalid cursor"}}}
	}
	return id, nil
}

func compareObjectID(a, b bson.ObjectID) int {
	return bytes.Compare(a[:], b[:])
}

func sortNotifications(items []Notification, oldestFirst bool) {
	sort.SliceStable(items, func(i, j int) bool {
		cmp := compareObjectID(items[i].ObjectID, items[j].ObjectID)
		if oldestFirst {
			return cmp < 0
		}
		return cmp > 0
	})
}
