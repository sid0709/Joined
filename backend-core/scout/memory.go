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
	earnings      []Earning
	payouts       []Payout
	audit         []AuditEntry
}

func newMemDocs() *memDocs {
	return &memDocs{
		profiles:      map[string]Profile{},
		submissions:   []Submission{},
		idempotency:   map[string]idempotencyRecord{},
		notifications: []Notification{},
		earnings:      []Earning{},
		payouts:       []Payout{},
		audit:         []AuditEntry{},
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
		accounts:       accounts,
		docs:           newMemDocs(),
		now:            now,
		config:         DefaultConfig(),
		payoutProvider: NewFakeProvider(),
		screener:       NewFakeScreener(ScreeningClear),
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

func (m *memDocs) applyProfile(userID string, apply func(*Profile)) (Profile, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	profile, ok := m.profiles[userID]
	if !ok {
		return Profile{}, ErrNotFound
	}
	apply(&profile)
	m.profiles[userID] = profile
	return profile, nil
}

func (m *memDocs) releaseDue(now time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.earnings {
		if m.earnings[i].Status == EarningHeld && !m.earnings[i].HoldUntil.After(now) {
			m.earnings[i].Status = EarningReleased
			released := now
			m.earnings[i].ReleasedAt = &released
		}
	}
}

func earningFilterValue(filter bson.D, key string) string {
	for _, field := range filter {
		if field.Key == key {
			value, _ := field.Value.(string)
			return value
		}
	}
	return ""
}

func (m *memDocs) listEarnings(filter bson.D) []Earning {
	userID := earningFilterValue(filter, "scoutUserId")
	status := earningFilterValue(filter, "status")
	submissionID := earningFilterValue(filter, "submissionId")
	payoutID := earningFilterValue(filter, "payoutId")
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []Earning{}
	for _, earning := range m.earnings {
		if userID != "" && earning.ScoutUserID != userID {
			continue
		}
		if status != "" && earning.Status != status {
			continue
		}
		if submissionID != "" && earning.SubmissionID != submissionID {
			continue
		}
		if payoutID != "" && earning.PayoutID != payoutID {
			continue
		}
		copied := earning
		copied.fill()
		out = append(out, copied)
	}
	return out
}

func (m *memDocs) setEarningStatus(id bson.ObjectID, status string) (Earning, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.earnings {
		if m.earnings[i].ObjectID != id {
			continue
		}
		m.earnings[i].Status = status
		copied := m.earnings[i]
		copied.fill()
		return copied, nil
	}
	return Earning{}, ErrNotFound
}

func (m *memDocs) earningByID(id bson.ObjectID) (Earning, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, earning := range m.earnings {
		if earning.ObjectID == id {
			earning.fill()
			return earning, nil
		}
	}
	return Earning{}, ErrNotFound
}

func (m *memDocs) insertEarning(earning Earning) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.earnings = append(m.earnings, earning)
}

func (m *memDocs) insertPayout(payout Payout) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.payouts = append(m.payouts, payout)
}

func (m *memDocs) hasPaidPayout(userID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, payout := range m.payouts {
		if payout.ScoutUserID == userID && payout.Status == PayoutPaid {
			return true
		}
	}
	return false
}

func (m *memDocs) markEarningsProcessing(ids []bson.ObjectID, payoutID string) {
	want := map[bson.ObjectID]struct{}{}
	for _, id := range ids {
		want[id] = struct{}{}
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.earnings {
		if _, ok := want[m.earnings[i].ObjectID]; !ok {
			continue
		}
		if m.earnings[i].Status != EarningReleased {
			continue
		}
		m.earnings[i].Status = EarningProcessing
		m.earnings[i].PayoutID = payoutID
	}
}

func (m *memDocs) payout(id string) (Payout, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, payout := range m.payouts {
		if payout.ObjectID.Hex() == id {
			copied := payout
			copied.fill()
			return copied, nil
		}
	}
	return Payout{}, ErrNotFound
}

func (m *memDocs) listPayouts(userID, cursorValue string, limit int) (List[Payout], error) {
	if _, err := cursorFilter(bson.D{}, cursorValue); err != nil {
		return List[Payout]{}, err
	}
	limit = listLimit(limit)
	m.mu.Lock()
	owned := []Payout{}
	for i := len(m.payouts) - 1; i >= 0; i-- {
		if m.payouts[i].ScoutUserID == userID {
			copied := m.payouts[i]
			copied.fill()
			owned = append(owned, copied)
		}
	}
	m.mu.Unlock()
	if cursorValue != "" {
		cut := -1
		for i, payout := range owned {
			if payout.ID == cursorValue {
				cut = i
				break
			}
		}
		if cut >= 0 {
			owned = owned[cut+1:]
		}
	}
	next := ""
	if len(owned) > limit {
		owned = owned[:limit]
		next = owned[len(owned)-1].ID
	}
	return List[Payout]{Data: owned, NextCursor: next}, nil
}

func (m *memDocs) settlePayoutEarnings(payoutID string, now time.Time, paid bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.earnings {
		if m.earnings[i].PayoutID != payoutID || m.earnings[i].Status != EarningProcessing {
			continue
		}
		if paid {
			m.earnings[i].Status = EarningPaid
			paidAt := now
			m.earnings[i].PaidAt = &paidAt
			continue
		}
		m.earnings[i].Status = EarningReleased
		m.earnings[i].PayoutID = ""
	}
}

func (m *memDocs) finishPayout(id, status, note string, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.payouts {
		if m.payouts[i].ObjectID.Hex() != id {
			continue
		}
		m.payouts[i].Status = status
		m.payouts[i].Note = note
		decided := now
		m.payouts[i].DecidedAt = &decided
		return nil
	}
	return ErrNotFound
}

func (m *memDocs) metricRows(userID string) []metricRow {
	m.mu.Lock()
	defer m.mu.Unlock()
	rows := []metricRow{}
	for _, sub := range m.submissions {
		if sub.ScoutUserID != userID {
			continue
		}
		rows = append(rows, metricRow{Status: sub.Status, Expired: sub.Expired, Interviews: sub.Interviews, SubmittedAt: sub.SubmittedAt, JobID: sub.JobID})
	}
	return rows
}

func (m *memDocs) findSubmissions(filter bson.D, limit int64) []Submission {
	userID := earningFilterValue(filter, "scoutUserId")
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []Submission{}
	for i := len(m.submissions) - 1; i >= 0; i-- {
		sub := m.submissions[i]
		if userID != "" && sub.ScoutUserID != userID {
			continue
		}
		copied := sub
		copied.fill()
		out = append(out, copied)
		if limit > 0 && int64(len(out)) >= limit {
			break
		}
	}
	return out
}

func (m *memDocs) addAudit(entry AuditEntry) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.audit = append(m.audit, entry)
}

func (m *memDocs) auditTrail(subjectID string) []AuditEntry {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []AuditEntry{}
	for i := len(m.audit) - 1; i >= 0; i-- {
		if m.audit[i].SubjectID == subjectID {
			out = append(out, m.audit[i])
		}
	}
	return out
}

// MemoryAddReleasedEarning credits released balance for payout tests.
func MemoryAddReleasedEarning(s *Store, userID string, amountCents int64) {
	if mem, ok := s.docs.(*memDocs); ok {
		now := s.now().UTC()
		earning := Earning{
			ObjectID:    bson.NewObjectID(),
			ScoutUserID: userID,
			Type:        RewardApproval,
			Amount:      cents(amountCents),
			Status:      EarningReleased,
			Description: "test",
			HoldUntil:   now,
			CreatedAt:   now,
			ReleasedAt:  &now,
		}
		earning.fill()
		mem.insertEarning(earning)
	}
}

// MemoryAddPaidPayout records a prior paid payout so the first-payout gate is skipped.
func MemoryAddPaidPayout(s *Store, userID string) {
	if mem, ok := s.docs.(*memDocs); ok {
		now := s.now().UTC()
		payout := Payout{
			ObjectID:    bson.NewObjectID(),
			ScoutUserID: userID,
			Amount:      cents(MinPayoutCents),
			Method:      PayoutMethod{Type: payoutBank, Label: "Bank", Last4: "1234"},
			Status:      PayoutPaid,
			RequestedAt: now,
			DecidedAt:   &now,
		}
		payout.fill()
		mem.insertPayout(payout)
	}
}
