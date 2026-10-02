package candidate

import (
	"errors"
	"testing"
	"time"
)

func TestBuildInterviewOpenSlotAllowsUnlockedTime(t *testing.T) {
	item, err := buildInterview("user-1", Application{ID: "app-1", Company: "Acme", Title: "Designer"}, InterviewInput{
		Round:        "Round 1",
		Format:       "video",
		OpenSlot:     true,
		Status:       StatusUnconfirmed,
		MeetingURL:   "https://meet.example.com/a",
		Where:        "https://meet.example.com/a",
		ScheduleMode: "self_schedule",
		SelfSchedule: true,
	}, time.Time{})
	if err != nil {
		t.Fatal(err)
	}
	if item.Date != "" || item.Start != "" || item.Status != StatusUnconfirmed {
		t.Fatalf("item = %+v", item)
	}
	if item.MeetingURL != "https://meet.example.com/a" || item.Where != item.MeetingURL || !item.SelfSchedule {
		t.Fatalf("join = %+v", item)
	}
	if item.ID == "" {
		t.Fatal("missing id")
	}
}

func TestBuildInterviewStillRequiresALockedTime(t *testing.T) {
	_, err := buildInterview("user-1", Application{ID: "app-1"}, InterviewInput{Round: "Round 1"}, time.Time{})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v", err)
	}
	item, err := buildInterview("user-1", Application{ID: "app-1", Title: "Designer"}, InterviewInput{
		Round: "Round 1",
		Date:  "2026-10-02",
		Start: "10:00",
		End:   "10:45",
	}, time.Time{})
	if err != nil {
		t.Fatal(err)
	}
	if item.Format != "video" || item.Where != "video" || item.Date != "2026-10-02" {
		t.Fatalf("item = %+v", item)
	}
}

func TestPublicScheduleURLUsesFrontendOrigin(t *testing.T) {
	got := publicScheduleURL("http://127.0.0.1:6002/", "iv 1")
	if got != "http://127.0.0.1:6002/schedule/iv%201" {
		t.Fatalf("url = %q", got)
	}
	if publicScheduleURL("", "iv-1") != "" || publicScheduleURL("http://127.0.0.1:6002", "") != "" {
		t.Fatal("expected an empty url without origin and id")
	}
}
