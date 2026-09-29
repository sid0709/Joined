package candidate

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"strings"
	"time"
	"unicode"

	"go.mongodb.org/mongo-driver/v2/bson"
)

const (
	// scheduleTokenBytes is the self-schedule secret. 32 bytes is not the interview id.
	scheduleTokenBytes = 32
	// selfScheduleTTL matches opened-frontend DEFAULT_SLOT_HORIZON_DAYS.
	selfScheduleTTL = 14 * 24 * time.Hour
)

// applySelfScheduleSecret mints a token and expiry when missing and points
// selfScheduleUrl at /schedule/{token}. An empty origin rewrites a stored URL
// in place so previously issued interview-id links keep their host.
func applySelfScheduleSecret(item *Interview, origin string, now time.Time) error {
	if item.SelfScheduleToken == "" {
		token, err := newScheduleToken()
		if err != nil {
			return err
		}
		item.SelfScheduleToken = token
	}
	if item.SelfScheduleExpiresAt.IsZero() {
		item.SelfScheduleExpiresAt = now.UTC().Add(selfScheduleTTL)
	}
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	if origin != "" {
		item.SelfScheduleURL = publicScheduleURL(origin, item.SelfScheduleToken)
		return nil
	}
	item.SelfScheduleURL = rewriteScheduleURL(item.SelfScheduleURL, item.SelfScheduleToken)
	return nil
}

func newScheduleToken() (string, error) {
	raw := make([]byte, scheduleTokenBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

func isScheduleToken(value string) bool {
	if len(value) != scheduleTokenBytes*2 {
		return false
	}
	for _, r := range value {
		if !unicode.Is(unicode.ASCII_Hex_Digit, r) {
			return false
		}
	}
	return true
}

// scheduleKeyField is the interview lookup for a public /schedule/{key}.
// A 32-byte hex key is the secret. Anything else is a legacy interview id.
func scheduleKeyField(key string) (field, value string, ok bool) {
	key = strings.TrimSpace(key)
	if key == "" {
		return "", "", false
	}
	if isScheduleToken(key) {
		return "selfScheduleToken", strings.ToLower(key), true
	}
	return "id", key, true
}

func rewriteScheduleURL(raw, token string) string {
	raw = strings.TrimSpace(raw)
	token = strings.TrimSpace(token)
	if raw == "" || token == "" {
		return raw
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return raw
	}
	parsed.Path = selfSchedulePath + token
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String()
}

func needsSelfScheduleSecret(item Interview) bool {
	if !item.SelfSchedule || item.SelfScheduleToken != "" {
		return false
	}
	return item.CompanyStatus == CompanyStatusAwaiting || item.CompanyStatus == ""
}

func isPublicSchedule(item Interview) bool {
	if item.SelfSchedule || item.SelfScheduleToken != "" {
		return true
	}
	return strings.TrimSpace(item.SelfScheduleURL) != ""
}

func scheduleExpired(item Interview, now time.Time) bool {
	if item.SelfScheduleExpiresAt.IsZero() {
		return false
	}
	return now.After(item.SelfScheduleExpiresAt)
}

func awaitingSchedule(item Interview) bool {
	return item.CompanyStatus == CompanyStatusAwaiting || item.CompanyStatus == ""
}

func lockedSchedule(item Interview) bool {
	return item.CompanyStatus == StatusScheduled
}

// lockPublicSchedule moves an awaiting self-schedule round to scheduled.
// The same slot again is a no-op. A different slot after lock conflicts.
// When proposed slots exist, the pick must be one of them.
func lockPublicSchedule(item Interview, date, start, end string, now time.Time) (Interview, error) {
	if !isPublicSchedule(item) {
		return Interview{}, ErrNotFound
	}
	date = strings.TrimSpace(date)
	start = strings.TrimSpace(start)
	end = strings.TrimSpace(end)
	if !datePattern.MatchString(date) || !timePattern.MatchString(start) || !timePattern.MatchString(end) {
		return Interview{}, ErrInvalidInput
	}
	if lockedSchedule(item) {
		if item.Date == date && item.Start == start && item.End == end {
			return item, nil
		}
		return Interview{}, ErrScheduleTaken
	}
	if !awaitingSchedule(item) {
		return Interview{}, ErrScheduleTaken
	}
	if scheduleExpired(item, now) {
		return Interview{}, ErrScheduleExpired
	}
	if len(item.ProposedSlots) > 0 && !slotOffered(item.ProposedSlots, date, start, end) {
		return Interview{}, ErrSlotNotOffered
	}
	item.Date = date
	item.Start = start
	item.End = end
	item.CompanyStatus = StatusScheduled
	item.Status = StatusScheduled
	return item, nil
}

func slotOffered(slots []ProposedSlot, date, start, end string) bool {
	for _, slot := range slots {
		if slot.Date == date && slot.Start == start && slot.End == end {
			return true
		}
	}
	return false
}

func presentPublicSchedule(item Interview, now time.Time) (PublicSchedule, error) {
	if !isPublicSchedule(item) {
		return PublicSchedule{}, ErrNotFound
	}
	if awaitingSchedule(item) && !lockedSchedule(item) && scheduleExpired(item, now) {
		return PublicSchedule{}, ErrScheduleExpired
	}
	return publicScheduleView(item), nil
}

func publicScheduleView(item Interview) PublicSchedule {
	status := item.CompanyStatus
	if status == "" {
		status = CompanyStatusAwaiting
		if item.Date != "" {
			status = StatusScheduled
		}
	}
	slots := item.ProposedSlots
	if len(slots) == 0 {
		slots = nil
	}
	var expires *time.Time
	if status == CompanyStatusAwaiting && !item.SelfScheduleExpiresAt.IsZero() {
		when := item.SelfScheduleExpiresAt.UTC()
		expires = &when
	}
	return PublicSchedule{
		Company:       item.Company,
		Role:          item.Role,
		Round:         item.Round,
		Format:        item.Format,
		Where:         publicWhere(item),
		MeetingURL:    strings.TrimSpace(item.MeetingURL),
		Status:        status,
		Mode:          item.ScheduleMode,
		ProposedSlots: slots,
		Date:          item.Date,
		Start:         item.Start,
		End:           item.End,
		ExpiresAt:     expires,
	}
}

func publicWhere(item Interview) string {
	where := strings.TrimSpace(item.Where)
	if where == "" || where == item.Format {
		return ""
	}
	return where
}

func sameLockedSlot(before, after Interview) bool {
	return before.CompanyStatus == after.CompanyStatus &&
		before.Status == after.Status &&
		before.Date == after.Date &&
		before.Start == after.Start &&
		before.End == after.End
}

// PublicSchedule loads the candidate page for a token or a legacy interview id.
func (s *Store) PublicSchedule(ctx context.Context, key string, now time.Time) (PublicSchedule, error) {
	item, err := s.interviewByScheduleKey(ctx, key)
	if err != nil {
		return PublicSchedule{}, err
	}
	return presentPublicSchedule(item, now)
}

// AcceptPublicSchedule locks an awaiting round onto date/start/end.
func (s *Store) AcceptPublicSchedule(ctx context.Context, key, date, start, end string, now time.Time) (PublicSchedule, error) {
	item, err := s.interviewByScheduleKey(ctx, key)
	if err != nil {
		return PublicSchedule{}, err
	}
	next, err := lockPublicSchedule(item, date, start, end, now)
	if err != nil {
		return PublicSchedule{}, err
	}
	if !sameLockedSlot(item, next) {
		next, err = s.saveInterviewByID(ctx, next)
		if err != nil {
			return PublicSchedule{}, err
		}
	}
	return presentPublicSchedule(next, now)
}

// BackfillSelfScheduleSecretsOne stores a token on one awaiting self-schedule row.
func (s *Store) BackfillSelfScheduleSecretsOne(ctx context.Context, item Interview, now time.Time) (Interview, error) {
	items, err := s.BackfillSelfScheduleSecrets(ctx, []Interview{item}, now)
	if err != nil {
		return Interview{}, err
	}
	if len(items) == 0 {
		return item, nil
	}
	return items[0], nil
}

// BackfillSelfScheduleSecrets stores a token on awaiting self-schedule rows
// that were created when the URL still used the interview id.
func (s *Store) BackfillSelfScheduleSecrets(ctx context.Context, items []Interview, now time.Time) ([]Interview, error) {
	if len(items) == 0 {
		return items, nil
	}
	out := make([]Interview, len(items))
	copy(out, items)
	for i := range out {
		if !needsSelfScheduleSecret(out[i]) {
			continue
		}
		minted, err := s.mintSelfScheduleOnce(ctx, out[i], now)
		if err != nil {
			return nil, err
		}
		out[i] = minted
	}
	return out, nil
}

func (s *Store) mintSelfScheduleOnce(ctx context.Context, item Interview, now time.Time) (Interview, error) {
	if err := applySelfScheduleSecret(&item, "", now); err != nil {
		return Interview{}, err
	}
	result, err := s.collection(interviewsCollection).UpdateOne(ctx, bson.D{
		{Key: "id", Value: item.ID},
		{Key: "$or", Value: bson.A{
			bson.D{{Key: "selfScheduleToken", Value: bson.D{{Key: "$exists", Value: false}}}},
			bson.D{{Key: "selfScheduleToken", Value: ""}},
		}},
	}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "selfScheduleToken", Value: item.SelfScheduleToken},
		{Key: "selfScheduleExpiresAt", Value: item.SelfScheduleExpiresAt},
		{Key: "selfScheduleUrl", Value: item.SelfScheduleURL},
	}}})
	if err != nil {
		return Interview{}, err
	}
	if result.MatchedCount == 0 {
		return s.interviewByScheduleKey(ctx, item.ID)
	}
	return normalizeInterview(item), nil
}

func (s *Store) interviewByScheduleKey(ctx context.Context, key string) (Interview, error) {
	field, value, ok := scheduleKeyField(key)
	if !ok {
		return Interview{}, ErrNotFound
	}
	var item Interview
	err := s.collection(interviewsCollection).FindOne(ctx, bson.D{{Key: field, Value: value}}).Decode(&item)
	if notFound(err) {
		return Interview{}, ErrNotFound
	}
	if err != nil {
		return Interview{}, err
	}
	return normalizeInterview(item), nil
}

func (s *Store) saveInterviewByID(ctx context.Context, item Interview) (Interview, error) {
	if item.ID == "" {
		return Interview{}, ErrNotFound
	}
	item = normalizeInterview(item)
	result, err := s.collection(interviewsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: item.ID}}, item)
	if err != nil {
		return Interview{}, err
	}
	if result.MatchedCount == 0 {
		return Interview{}, ErrNotFound
	}
	return item, nil
}
