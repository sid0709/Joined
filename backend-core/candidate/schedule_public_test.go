package candidate

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestAcceptSlotLocksAwaitingInterview(t *testing.T) {
	now := time.Date(2026, 10, 1, 15, 0, 0, 0, time.UTC)
	item := awaitingSelfSchedule(t, now)

	if item.SelfScheduleToken == item.ID || !isScheduleToken(item.SelfScheduleToken) {
		t.Fatalf("token = %q id = %q", item.SelfScheduleToken, item.ID)
	}
	wantURL := publicScheduleURL("http://127.0.0.1:6002", item.SelfScheduleToken)
	if item.SelfScheduleURL != wantURL {
		t.Fatalf("url = %q", item.SelfScheduleURL)
	}
	if strings.Contains(item.SelfScheduleURL, item.ID) {
		t.Fatalf("url still uses the interview id: %q", item.SelfScheduleURL)
	}
	if field, value, ok := scheduleKeyField(strings.ToUpper(item.SelfScheduleToken)); !ok || field != "selfScheduleToken" || value != item.SelfScheduleToken {
		t.Fatalf("token key = %q %q ok=%v", field, value, ok)
	}
	if field, value, ok := scheduleKeyField(item.ID); !ok || field != "id" || value != item.ID {
		t.Fatalf("legacy key = %q %q ok=%v", field, value, ok)
	}
	if _, _, ok := scheduleKeyField("  "); ok {
		t.Fatal("blank key should not resolve")
	}

	locked, err := lockPublicSchedule(item, "2026-10-06", "11:00", "11:45", now)
	if err != nil {
		t.Fatal(err)
	}
	if locked.CompanyStatus != StatusScheduled || locked.Status != StatusScheduled {
		t.Fatalf("status = %s / %s", locked.CompanyStatus, locked.Status)
	}
	if locked.Date != "2026-10-06" || locked.Start != "11:00" || locked.End != "11:45" {
		t.Fatalf("slot = %s %s %s", locked.Date, locked.Start, locked.End)
	}
	if locked.SelfScheduleToken != item.SelfScheduleToken {
		t.Fatal("lock cleared the schedule token")
	}

	again, err := lockPublicSchedule(locked, " 2026-10-06 ", "11:00", "11:45", now)
	if err != nil {
		t.Fatal(err)
	}
	if again.Date != locked.Date || again.CompanyStatus != StatusScheduled {
		t.Fatalf("idempotent = %+v", again)
	}
	if _, err := lockPublicSchedule(locked, "2026-10-07", "11:00", "11:45", now); !errors.Is(err, ErrScheduleTaken) {
		t.Fatalf("different slot = %v", err)
	}

	view, err := presentPublicSchedule(locked, now.Add(30*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if view.Status != StatusScheduled || view.Date != "2026-10-06" || view.Company != "Acme" || view.Role != "Designer" {
		t.Fatalf("view = %+v", view)
	}
	if view.ExpiresAt != nil {
		t.Fatal("locked view should not advertise the accept deadline")
	}

	open, err := presentPublicSchedule(item, now)
	if err != nil {
		t.Fatal(err)
	}
	if open.Status != CompanyStatusAwaiting || open.Mode != "self_schedule" || open.ExpiresAt == nil {
		t.Fatalf("open = %+v", open)
	}
}

func TestAcceptSlotRequiresAnOfferedTime(t *testing.T) {
	now := time.Date(2026, 10, 1, 15, 0, 0, 0, time.UTC)
	item := awaitingSelfSchedule(t, now)
	item.ProposedSlots = []ProposedSlot{{Date: "2026-10-05", Start: "09:00", End: "09:45"}}

	if _, err := lockPublicSchedule(item, "2026-10-06", "11:00", "11:45", now); !errors.Is(err, ErrSlotNotOffered) {
		t.Fatalf("unoffered = %v", err)
	}
	locked, err := lockPublicSchedule(item, "2026-10-05", "09:00", "09:45", now)
	if err != nil {
		t.Fatal(err)
	}
	if locked.CompanyStatus != StatusScheduled || locked.Start != "09:00" {
		t.Fatalf("locked = %+v", locked)
	}
}

func TestAcceptSlotRejectsExpiredAndClosedRounds(t *testing.T) {
	now := time.Date(2026, 10, 1, 15, 0, 0, 0, time.UTC)
	item := awaitingSelfSchedule(t, now)
	later := item.SelfScheduleExpiresAt.Add(time.Minute)
	if _, err := lockPublicSchedule(item, "2026-10-06", "11:00", "11:45", later); !errors.Is(err, ErrScheduleExpired) {
		t.Fatalf("expired accept = %v", err)
	}
	if _, err := presentPublicSchedule(item, later); !errors.Is(err, ErrScheduleExpired) {
		t.Fatalf("expired read = %v", err)
	}

	item.SelfScheduleExpiresAt = time.Time{}
	if _, err := lockPublicSchedule(item, "2026-10-06", "11:00", "11:45", later); err != nil {
		t.Fatalf("unset expiry should stay open: %v", err)
	}
	if _, err := lockPublicSchedule(item, "nope", "11:00", "11:45", now); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad date = %v", err)
	}

	closed := item
	closed.CompanyStatus = "attended"
	if _, err := lockPublicSchedule(closed, "2026-10-06", "11:00", "11:45", now); !errors.Is(err, ErrScheduleTaken) {
		t.Fatalf("attended = %v", err)
	}
	fixed := Interview{ID: "iv-fixed", CompanyStatus: CompanyStatusAwaiting}
	if _, err := presentPublicSchedule(fixed, now); !errors.Is(err, ErrNotFound) {
		t.Fatalf("fixed = %v", err)
	}
}

func TestLegacyScheduleURLRewritesToToken(t *testing.T) {
	id := "11111111-1111-4111-8111-111111111111"
	item := Interview{
		ID:              id,
		SelfSchedule:    true,
		CompanyStatus:   CompanyStatusAwaiting,
		SelfScheduleURL: "http://127.0.0.1:6002/schedule/" + id + "?legacy=1",
	}
	now := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	if err := applySelfScheduleSecret(&item, "", now); err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(item.SelfScheduleURL, "/schedule/"+item.SelfScheduleToken) {
		t.Fatalf("url = %q", item.SelfScheduleURL)
	}
	if strings.Contains(item.SelfScheduleURL, id) {
		t.Fatalf("legacy id remains in %q", item.SelfScheduleURL)
	}
	if !item.SelfScheduleExpiresAt.Equal(now.Add(selfScheduleTTL)) {
		t.Fatalf("expiry = %s", item.SelfScheduleExpiresAt)
	}
	if !needsSelfScheduleSecret(Interview{SelfSchedule: true, CompanyStatus: CompanyStatusAwaiting}) {
		t.Fatal("missing token should backfill")
	}
	if needsSelfScheduleSecret(item) {
		t.Fatal("minted token should not backfill again")
	}
}

func TestPublicScheduleJSONOmitsCandidateIdentity(t *testing.T) {
	item := Interview{
		Company:       "Acme",
		Role:          "Designer",
		Round:         "Round 1",
		Format:        "video",
		Where:         "video",
		MeetingURL:    "https://meet.example.com/a",
		ScheduleMode:  "self_schedule",
		CompanyStatus: CompanyStatusAwaiting,
		SelfSchedule:  true,
		CandidateName: "Ada Lovelace",
		UserID:        "user-1",
		ApplicationID: "app-1",
		CompanyID:     "co-1",
	}
	view := publicScheduleView(item)
	raw, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	body := string(raw)
	for _, secret := range []string{"Ada Lovelace", "user-1", "app-1", "co-1", "selfScheduleToken"} {
		if strings.Contains(body, secret) {
			t.Fatalf("body leaked %q: %s", secret, body)
		}
	}
	if view.Where != "" || view.MeetingURL != "https://meet.example.com/a" {
		t.Fatalf("join = %+v", view)
	}
}

func awaitingSelfSchedule(t *testing.T, now time.Time) Interview {
	t.Helper()
	item, err := buildInterview("user-1", Application{ID: "app-1", Company: "Acme", Title: "Designer"}, InterviewInput{
		Round:        "Round 1",
		Format:       "video",
		OpenSlot:     true,
		Status:       StatusUnconfirmed,
		MeetingURL:   "https://meet.example.com/a",
		Where:        "https://meet.example.com/a",
		ScheduleMode: "self_schedule",
		SelfSchedule: true,
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	item.CompanyStatus = CompanyStatusAwaiting
	if err := applySelfScheduleSecret(&item, "http://127.0.0.1:6002", now); err != nil {
		t.Fatal(err)
	}
	return item
}
