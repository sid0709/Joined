package scout

import (
	"context"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// documents is the storage seam Submit, Idempotent, and EnsureProfile use.
// Production Store leaves this nil and talks to Mongo; tests inject memory.
type documents interface {
	upsertProfile(ctx context.Context, userID string, now time.Time) (Profile, error)
	countSubmissionsSince(ctx context.Context, userID string, since time.Time) (int64, error)
	submissionByExternalRef(ctx context.Context, userID, ref string) (Submission, error)
	matches(ctx context.Context, query MatchQuery, self bson.ObjectID) ([]Match, error)
	insertSubmission(ctx context.Context, sub Submission) error
	insertIdempotency(ctx context.Context, rec idempotencyRecord) error
	findIdempotency(ctx context.Context, userID, route, key string) (idempotencyRecord, error)
	finishIdempotency(ctx context.Context, userID, route, key string, status int, body []byte) error
	deleteIdempotency(ctx context.Context, userID, route, key string) error
}

// MemoryAccounts is an in-memory Accounts implementation for tests.
type MemoryAccounts struct {
	UsersByID map[string]auth.User
}

func (m *MemoryAccounts) Account(_ context.Context, userID string) (auth.User, time.Time, error) {
	if m == nil || m.UsersByID == nil {
		return auth.User{}, time.Time{}, auth.ErrNotFound
	}
	user, ok := m.UsersByID[userID]
	if !ok {
		return auth.User{}, time.Time{}, auth.ErrNotFound
	}
	return user, time.Time{}, nil
}

func (m *MemoryAccounts) SetName(_ context.Context, userID, name string) error {
	if m.UsersByID == nil {
		return auth.ErrNotFound
	}
	user, ok := m.UsersByID[userID]
	if !ok {
		return auth.ErrNotFound
	}
	user.Name = name
	m.UsersByID[userID] = user
	return nil
}

func (m *MemoryAccounts) Users(_ context.Context, ids []string) (map[string]auth.User, error) {
	out := make(map[string]auth.User, len(ids))
	for _, id := range ids {
		if user, ok := m.UsersByID[id]; ok {
			out[id] = user
		}
	}
	return out, nil
}

func (m *MemoryAccounts) SearchUserIDs(_ context.Context, _ string) ([]string, error) {
	return nil, nil
}

type memDocs struct {
	mu            sync.Mutex
	profiles      map[string]Profile
	submissions   []Submission
	idempotency   map[string]idempotencyRecord
	notifications []Notification
}

func newMemDocs() *memDocs {
	return &memDocs{
		profiles:      map[string]Profile{},
		submissions:   []Submission{},
		idempotency:   map[string]idempotencyRecord{},
		notifications: []Notification{},
	}
}

func idempotencyMapKey(userID, route, key string) string {
	return userID + "\x00" + route + "\x00" + key
}

func duplicateKey(message string) error {
	return mongo.WriteException{WriteErrors: []mongo.WriteError{{Code: 11000, Message: message}}}
}

func (m *memDocs) upsertProfile(_ context.Context, userID string, now time.Time) (Profile, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if profile, ok := m.profiles[userID]; ok {
		return profile, nil
	}
	profile := Profile{
		UserID:          userID,
		Level:           LevelProbation,
		Verification:    VerificationNone,
		NotifyDecisions: true,
		NotifyRewards:   true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	m.profiles[userID] = profile
	return profile, nil
}

func (m *memDocs) countSubmissionsSince(_ context.Context, userID string, since time.Time) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var n int64
	for _, sub := range m.submissions {
		if sub.ScoutUserID == userID && !sub.SubmittedAt.Before(since) {
			n++
		}
	}
	return n, nil
}

func (m *memDocs) submissionByExternalRef(_ context.Context, userID, ref string) (Submission, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, sub := range m.submissions {
		if sub.ScoutUserID == userID && sub.ExternalRef == ref {
			copied := sub
			copied.fill()
			return copied, nil
		}
	}
	return Submission{}, ErrNotFound
}

func (m *memDocs) matches(_ context.Context, _ MatchQuery, _ bson.ObjectID) ([]Match, error) {
	return nil, nil
}

func (m *memDocs) insertSubmission(_ context.Context, sub Submission) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if sub.ExternalRef != "" {
		for _, existing := range m.submissions {
			if existing.ScoutUserID == sub.ScoutUserID && existing.ExternalRef == sub.ExternalRef {
				return duplicateKey("externalRef")
			}
		}
	}
	m.submissions = append(m.submissions, sub)
	return nil
}

func (m *memDocs) insertIdempotency(_ context.Context, rec idempotencyRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := idempotencyMapKey(rec.UserID, rec.Route, rec.Key)
	if _, exists := m.idempotency[key]; exists {
		return duplicateKey("idempotency")
	}
	m.idempotency[key] = rec
	return nil
}

func (m *memDocs) findIdempotency(_ context.Context, userID, route, key string) (idempotencyRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.idempotency[idempotencyMapKey(userID, route, key)]
	if !ok {
		return idempotencyRecord{}, ErrNotFound
	}
	if rec.Body != nil {
		rec.Body = append([]byte(nil), rec.Body...)
	}
	return rec, nil
}

func (m *memDocs) finishIdempotency(_ context.Context, userID, route, key string, status int, body []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	mapKey := idempotencyMapKey(userID, route, key)
	rec, ok := m.idempotency[mapKey]
	if !ok {
		return ErrNotFound
	}
	rec.Done = true
	rec.Status = status
	rec.Body = append([]byte(nil), body...)
	m.idempotency[mapKey] = rec
	return nil
}

func (m *memDocs) deleteIdempotency(_ context.Context, userID, route, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.idempotency, idempotencyMapKey(userID, route, key))
	return nil
}

func (m *memDocs) acceptTerms(userID string, at time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	profile, ok := m.profiles[userID]
	if !ok {
		profile = Profile{UserID: userID, Level: LevelProbation, Verification: VerificationNone, NotifyDecisions: true, NotifyRewards: true, CreatedAt: at, UpdatedAt: at}
	}
	profile.TermsAcceptedAt = &at
	profile.UpdatedAt = at
	m.profiles[userID] = profile
}

func (m *memDocs) submissionCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.submissions)
}

func (m *memDocs) profile(userID string) (Profile, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	profile, ok := m.profiles[userID]
	if !ok {
		return Profile{}, ErrNotFound
	}
	return profile, nil
}

func (m *memDocs) insertNotification(row Notification) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if row.Key != "" {
		for _, existing := range m.notifications {
			if existing.Key == row.Key {
				return duplicateKey("notification key")
			}
		}
	}
	copied := row
	m.notifications = append(m.notifications, copied)
	return nil
}

func (m *memDocs) listNotifications(userID string, query NotificationQuery) ([]Notification, string, error) {
	m.mu.Lock()
	owned := make([]Notification, 0)
	for _, item := range m.notifications {
		if item.ScoutUserID == userID {
			copied := item
			owned = append(owned, copied)
		}
	}
	m.mu.Unlock()
	page, err := pageNotifications(owned, query)
	if err != nil {
		return nil, "", err
	}
	return page.Data, page.NextCursor, nil
}

func (m *memDocs) unreadCount(userID string) int64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	var n int64
	for _, item := range m.notifications {
		if item.ScoutUserID == userID && !item.Read {
			n++
		}
	}
	return n
}

func (m *memDocs) markRead(userID string, ids []string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	want := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		want[id] = struct{}{}
	}
	for i, item := range m.notifications {
		if item.ScoutUserID != userID || item.Read {
			continue
		}
		if len(want) > 0 {
			if _, ok := want[item.ObjectID.Hex()]; !ok {
				continue
			}
		}
		m.notifications[i].Read = true
	}
}

// NewMemoryStore returns a Store that persists on in-memory collections.
// Automatic checks are disabled. Tests use this instead of a live MongoDB.
func NewMemoryStore(accounts Accounts, now func() time.Time) *Store {
	if now == nil {
		now = time.Now
	}
	s := &Store{
		accounts: accounts,
		docs:     newMemDocs(),
		now:      now,
		config:   DefaultConfig(),
	}
	s.notifyReward = func(ctx context.Context, userID string, earning Earning) {
		s.notifyRewardImpl(ctx, userID, earning)
	}
	return s
}

// MemoryAcceptTerms records scout terms on an in-memory store.
func MemoryAcceptTerms(s *Store, userID string) {
	if mem, ok := s.docs.(*memDocs); ok {
		mem.acceptTerms(userID, s.now().UTC())
	}
}

// MemoryNotifyDecision writes one status-change notification on an in-memory store.
func MemoryNotifyDecision(s *Store, sub Submission, status, reason string) {
	if sub.ObjectID == (bson.ObjectID{}) {
		sub.ObjectID = bson.NewObjectID()
	}
	sub.fill()
	s.notifyDecision(context.Background(), sub, status, reason)
}
func MemorySubmissionCount(s *Store) int {
	if mem, ok := s.docs.(*memDocs); ok {
		return mem.submissionCount()
	}
	return 0
}
