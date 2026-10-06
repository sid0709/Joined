package candidate

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestExportRedactsSecretsAndOtherPeople(t *testing.T) {
	token := "refresh-token-secret"
	otherEmail := "recruiter@other.test"
	conn := storedConnection{
		UserID:       "user-1",
		Email:        "ada@example.com",
		RefreshToken: token,
		ConnectedAt:  time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC),
	}
	cal, err := json.Marshal(calendarExport(conn))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(cal), token) {
		t.Fatalf("calendar export included the refresh token: %s", cal)
	}

	msgs := messageExports("co-1", "Northwind", []Message{{
		ID:        "m-1",
		ThreadID:  "t-1",
		AuthorID:  "recruiter-9",
		Text:      "See you Tuesday",
		CreatedAt: conn.ConnectedAt,
	}})
	body, err := json.Marshal(msgs)
	if err != nil {
		t.Fatal(err)
	}
	text := string(body)
	if strings.Contains(text, otherEmail) {
		t.Fatalf("message export included another person's email: %s", text)
	}
	if !strings.Contains(text, "recruiter-9") || !strings.Contains(text, "Northwind") {
		t.Fatalf("counterpart id and display name missing: %s", text)
	}

	interview := Interview{ID: "int-1", SelfScheduleToken: "schedule-secret", UserID: "user-1", Company: "Northwind"}
	raw, err := json.Marshal(interview)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "schedule-secret") || strings.Contains(string(raw), "user-1") {
		t.Fatalf("interview json leaked a secret or user id: %s", raw)
	}
}
