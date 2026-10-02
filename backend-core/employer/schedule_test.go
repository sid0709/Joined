package employer

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

func TestPlanFixedScheduleKeepsScheduledAndJoinFields(t *testing.T) {
	plan, err := planSchedule(ScheduleInput{
		Date:       "2026-10-02",
		Start:      "10:00",
		End:        "10:45",
		Format:     "video",
		Where:      "  https://meet.example.com/room  ",
		MeetingURL: "https://meet.example.com/room",
	})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Mode != scheduleModeFixed || plan.CompanyStatus != interviewScheduled || plan.CandidateStatus != candidate.StatusScheduled {
		t.Fatalf("plan = %+v", plan)
	}
	if plan.OpenSlot || plan.SelfSchedule || plan.ProposedSlots != nil {
		t.Fatalf("fixed plan should lock a slot: %+v", plan)
	}
	if plan.Where != "https://meet.example.com/room" || plan.MeetingURL != "https://meet.example.com/room" {
		t.Fatalf("join = %q %q", plan.Where, plan.MeetingURL)
	}
}

func TestPlanProposeAwaitsAndKeepsSlots(t *testing.T) {
	plan, err := planSchedule(ScheduleInput{
		Mode: scheduleModePropose,
		ProposedSlots: []candidate.ProposedSlot{
			{Date: "2026-10-05", Start: "09:00", End: "09:45"},
			{Date: "bad", Start: "09:00", End: "09:45"},
			{Date: "2026-10-06", Start: "11:00", End: "11:45"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if plan.CompanyStatus != interviewAwaiting || plan.CandidateStatus != candidate.StatusUnconfirmed || !plan.OpenSlot {
		t.Fatalf("status = %+v", plan)
	}
	if len(plan.ProposedSlots) != 2 || plan.Date != "" || plan.Start != "" || plan.End != "" {
		t.Fatalf("slots = %+v date %s", plan.ProposedSlots, plan.Date)
	}
	if plan.SelfSchedule {
		t.Fatal("propose should not mint self-schedule")
	}
}

func TestPlanSelfScheduleMintsAwaitingWithoutALockedDate(t *testing.T) {
	plan, err := planSchedule(ScheduleInput{
		Mode:         scheduleModeSelf,
		SelfSchedule: true,
		Start:        "10:00",
		End:          "10:45",
		MeetingURL:   "https://zoom.example.com/j/1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !plan.SelfSchedule || plan.CompanyStatus != interviewAwaiting || plan.Date != "" || plan.Start != "" {
		t.Fatalf("plan = %+v", plan)
	}
	if plan.Where != "https://zoom.example.com/j/1" || plan.MeetingURL != plan.Where {
		t.Fatalf("join = %q %q", plan.Where, plan.MeetingURL)
	}
}

func TestPlanSelfScheduleFlagUpgradesFixedMode(t *testing.T) {
	plan, err := planSchedule(ScheduleInput{SelfSchedule: true, Date: "2026-10-02", Start: "10:00", End: "10:45"})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Mode != scheduleModeSelf || !plan.SelfSchedule || plan.CompanyStatus != interviewAwaiting {
		t.Fatalf("plan = %+v", plan)
	}
}

func TestPlanRejectsUnknownModeAndEmptyPropose(t *testing.T) {
	if _, err := planSchedule(ScheduleInput{Mode: "whenever"}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("mode err = %v", err)
	}
	if _, err := planSchedule(ScheduleInput{Mode: scheduleModePropose}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty propose err = %v", err)
	}
	if _, err := planSchedule(ScheduleInput{
		Mode:          scheduleModePropose,
		ProposedSlots: []candidate.ProposedSlot{{Date: "nope", Start: "09:00", End: "09:45"}},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid slots err = %v", err)
	}
}

func TestPlanTruncatesProposedSlots(t *testing.T) {
	slots := make([]candidate.ProposedSlot, 0, maxProposedSlots+2)
	for i := 0; i < maxProposedSlots+2; i++ {
		slots = append(slots, candidate.ProposedSlot{Date: "2026-10-08", Start: "09:00", End: "09:45"})
	}
	plan, err := planSchedule(ScheduleInput{Mode: scheduleModePropose, ProposedSlots: slots})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.ProposedSlots) != maxProposedSlots {
		t.Fatalf("len = %d", len(plan.ProposedSlots))
	}
}

func TestViewInterviewReturnsScheduleFields(t *testing.T) {
	expires := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	view := viewInterview(candidate.Interview{
		ID:                    "iv-1",
		ApplicationID:         "app-1",
		Format:                "video",
		Where:                 "https://meet.example.com/a",
		MeetingURL:            "https://meet.example.com/a",
		ScheduleMode:          scheduleModePropose,
		CompanyStatus:         interviewAwaiting,
		SelfScheduleURL:       "http://127.0.0.1:6002/schedule/iv-1",
		SelfScheduleExpiresAt: expires,
		ProposedSlots: []candidate.ProposedSlot{
			{Date: "2026-10-05", Start: "09:00", End: "09:45"},
		},
		Interviewers: []candidate.Interviewer{},
	}, "Designer")
	if view.Status != interviewAwaiting || view.Mode != scheduleModePropose {
		t.Fatalf("view = %+v", view)
	}
	if view.Where != "https://meet.example.com/a" || view.MeetingURL != view.Where {
		t.Fatalf("join = %+v", view)
	}
	if view.SelfScheduleURL != "http://127.0.0.1:6002/schedule/iv-1" || len(view.ProposedSlots) != 1 {
		t.Fatalf("offer = %+v", view)
	}
	if view.SelfScheduleExpiresAt == nil || !view.SelfScheduleExpiresAt.Equal(expires) {
		t.Fatalf("expiry = %v", view.SelfScheduleExpiresAt)
	}

	legacy := viewInterview(candidate.Interview{Format: "video", Where: "video", CompanyStatus: interviewScheduled}, "Designer")
	if legacy.Where != "" || legacy.Status != interviewScheduled || legacy.SelfScheduleURL != "" {
		t.Fatalf("legacy = %+v", legacy)
	}

	locked := viewInterview(candidate.Interview{
		Format:          "video",
		CompanyStatus:   interviewScheduled,
		SelfScheduleURL: "http://127.0.0.1:6002/schedule/iv-2",
	}, "Designer")
	if locked.SelfScheduleURL != "" {
		t.Fatalf("locked url = %q", locked.SelfScheduleURL)
	}
}

func TestApplyInterviewUpdateLocksAndReoffers(t *testing.T) {
	expires := time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC)
	awaiting := candidate.Interview{
		ID:                    "iv-1",
		CompanyID:             "co-1",
		Format:                "video",
		Where:                 "video",
		CompanyStatus:         interviewAwaiting,
		Status:                candidate.StatusUnconfirmed,
		SelfScheduleToken:     "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		SelfScheduleExpiresAt: expires,
		ProposedSlots:         []candidate.ProposedSlot{{Date: "2026-10-05", Start: "09:00", End: "09:45"}},
	}
	locked, attendance, _, err := applyInterviewUpdate(awaiting, InterviewUpdate{
		Date:  strPtr("2026-10-06"),
		Start: strPtr("11:00"),
		End:   strPtr("11:45"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if attendance != "" || locked.CompanyStatus != interviewScheduled || locked.Status != candidate.StatusScheduled {
		t.Fatalf("locked = %+v attendance %q", locked, attendance)
	}
	if locked.Date != "2026-10-06" || locked.Start != "11:00" || locked.End != "11:45" {
		t.Fatalf("time = %s %s %s", locked.Date, locked.Start, locked.End)
	}
	if locked.SelfScheduleToken == "" || !locked.SelfScheduleExpiresAt.Equal(expires) {
		t.Fatalf("company lock cleared the schedule secret: %+v", locked)
	}

	reoffered, _, _, err := applyInterviewUpdate(awaiting, InterviewUpdate{
		ProposedSlots: &[]candidate.ProposedSlot{{Date: "2026-10-07", Start: "15:00", End: "15:45"}},
		MeetingURL:    strPtr("https://meet.example.com/new"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if reoffered.CompanyStatus != interviewAwaiting || len(reoffered.ProposedSlots) != 1 || reoffered.ProposedSlots[0].Date != "2026-10-07" {
		t.Fatalf("reoffer = %+v", reoffered)
	}
	if reoffered.MeetingURL != "https://meet.example.com/new" || reoffered.Where != reoffered.MeetingURL {
		t.Fatalf("join = %q %q", reoffered.Where, reoffered.MeetingURL)
	}
}

func TestApplyInterviewUpdateRejectsBadPatches(t *testing.T) {
	awaiting := candidate.Interview{CompanyStatus: interviewAwaiting, Format: "video", Where: "video"}
	scheduled := candidate.Interview{CompanyStatus: interviewScheduled, Format: "onsite", Where: "HQ"}
	if _, _, _, err := applyInterviewUpdate(scheduled, InterviewUpdate{}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty = %v", err)
	}
	if _, _, _, err := applyInterviewUpdate(scheduled, InterviewUpdate{Status: strPtr("cancelled")}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("status = %v", err)
	}
	if _, _, _, err := applyInterviewUpdate(scheduled, InterviewUpdate{
		ProposedSlots: &[]candidate.ProposedSlot{{Date: "2026-10-07", Start: "15:00", End: "15:45"}},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("slots on scheduled = %v", err)
	}
	if _, _, _, err := applyInterviewUpdate(awaiting, InterviewUpdate{Date: strPtr("2026-10-07")}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("partial lock = %v", err)
	}
	if _, _, _, err := applyInterviewUpdate(awaiting, InterviewUpdate{
		Date:          strPtr("2026-10-07"),
		Start:         strPtr("15:00"),
		End:           strPtr("15:45"),
		ProposedSlots: &[]candidate.ProposedSlot{{Date: "2026-10-08", Start: "09:00", End: "09:45"}},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("lock and reoffer = %v", err)
	}
	if _, _, _, err := applyInterviewUpdate(awaiting, InterviewUpdate{Status: strPtr("attended")}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("attend while awaiting = %v", err)
	}
	if _, _, _, err := applyInterviewUpdate(candidate.Interview{CompanyStatus: "attended"}, InterviewUpdate{
		Date: strPtr("2026-10-07"), Start: strPtr("15:00"), End: strPtr("15:45"),
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("reschedule attended = %v", err)
	}

	updated, attendance, _, err := applyInterviewUpdate(scheduled, InterviewUpdate{Status: strPtr("no-show"), Where: strPtr("  1 Market St ")})
	if err != nil {
		t.Fatal(err)
	}
	if attendance != "no-show" || updated.Where != "1 Market St" {
		t.Fatalf("attendance = %q where %q", attendance, updated.Where)
	}
}

func TestClipJoinMatchesFrontendLimit(t *testing.T) {
	long := strings.Repeat("a", candidate.MaxWhereLen+10)
	got := clipJoin(long)
	if len([]rune(got)) != candidate.MaxWhereLen {
		t.Fatalf("len = %d", len([]rune(got)))
	}
}

func strPtr(value string) *string {
	return &value
}
