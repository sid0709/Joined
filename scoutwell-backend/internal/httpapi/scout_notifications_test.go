package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/scout"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestNotificationsSinceAndMarkRead(t *testing.T) {
	handler, store := testExtensionHandler(t)
	sub := scout.Submission{
		ObjectID:    bson.NewObjectID(),
		ScoutUserID: testScoutID,
		Title:       "Staff Engineer",
		CompanyName: "Acme Labs",
	}
	scout.MemoryNotifyDecision(store, sub, scout.StatusApproved, "")
	scout.MemoryNotifyDecision(store, sub, scout.StatusApproved, "")

	req := httptest.NewRequest(http.MethodGet, "/v1/scout/notifications?since=&limit=25", nil)
	req.Header.Set("Authorization", "Bearer "+testSession)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	var page scout.NotificationPage
	if err := json.Unmarshal(rec.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Data) != 1 || page.Unread != 1 || page.Data[0].Event != scout.EventAccepted {
		t.Fatalf("page = %+v", page)
	}

	next := httptest.NewRequest(http.MethodGet, "/v1/scout/notifications?since="+page.Data[0].ID, nil)
	next.Header.Set("Authorization", "Bearer "+testSession)
	nextRec := httptest.NewRecorder()
	handler.ServeHTTP(nextRec, next)
	if nextRec.Code != http.StatusOK {
		t.Fatalf("since status = %d body = %s", nextRec.Code, nextRec.Body.String())
	}
	var again scout.NotificationPage
	if err := json.Unmarshal(nextRec.Body.Bytes(), &again); err != nil {
		t.Fatal(err)
	}
	if len(again.Data) != 0 {
		t.Fatalf("since last id returned %+v", again.Data)
	}

	body, _ := json.Marshal(map[string][]string{"ids": {page.Data[0].ID}})
	read := httptest.NewRequest(http.MethodPost, "/v1/scout/notifications/read", bytes.NewReader(body))
	read.Header.Set("Authorization", "Bearer "+testSession)
	read.Header.Set("Content-Type", "application/json")
	readRec := httptest.NewRecorder()
	handler.ServeHTTP(readRec, read)
	if readRec.Code != http.StatusNoContent {
		t.Fatalf("mark-read status = %d body = %s", readRec.Code, readRec.Body.String())
	}

	after := httptest.NewRequest(http.MethodGet, "/v1/scout/notifications?since=", nil)
	after.Header.Set("Authorization", "Bearer "+testSession)
	afterRec := httptest.NewRecorder()
	handler.ServeHTTP(afterRec, after)
	var marked scout.NotificationPage
	if err := json.Unmarshal(afterRec.Body.Bytes(), &marked); err != nil {
		t.Fatal(err)
	}
	if marked.Unread != 0 || !marked.Data[0].Read {
		t.Fatalf("after mark-read %+v", marked)
	}
}

func TestNotificationsInvalidSince(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/scout/notifications?since=not-an-id", nil)
	req.Header.Set("Authorization", "Bearer "+testSession)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	var problem httpkit.Problem
	if err := json.Unmarshal(rec.Body.Bytes(), &problem); err != nil {
		t.Fatal(err)
	}
	if problem.Code != "validation_failed" {
		t.Fatalf("problem = %+v", problem)
	}
}
