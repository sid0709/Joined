package employer

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"github.com/sid0709/OpenSeat/opened-backend/internal/candidate"
)

func TestMergeOfferPatchPersistsCompAndClearsNotes(t *testing.T) {
	now := time.Date(2026, 9, 29, 18, 0, 0, 0, time.UTC)
	sent := now.Add(-2 * time.Hour)
	current := &candidate.OfferRecord{
		Status:     candidate.OfferSent,
		TemplateID: "otmpl-1",
		SentAt:     &sent,
		Notes:      "old",
		Comp:       &candidate.CompPackage{Currency: "USD"},
	}
	raw := json.RawMessage(`{
		"notes": null,
		"expiresAt": "2026-10-15",
		"comp": {"baseSalaryCents": 18000000, "currency": "eur", "equityNote": " 0.10% ", "startDate": "2026-11-02"}
	}`)
	next, write, err := mergeApplicantOffer(current, raw, "", stageOffer, nil, now)
	if err != nil || !write {
		t.Fatalf("merge = %v write %v", err, write)
	}
	if next.Status != candidate.OfferSent || next.Notes != "" || next.ExpiresAt != "2026-10-15" {
		t.Fatalf("offer = %+v", next)
	}
	if next.SentAt == nil || !next.SentAt.Equal(sent) {
		t.Fatalf("sentAt restamped: %+v", next.SentAt)
	}
	if next.Comp == nil || next.Comp.Currency != "EUR" || next.Comp.EquityNote != "0.10%" || next.Comp.StartDate != "2026-11-02" {
		t.Fatalf("comp = %+v", next.Comp)
	}
	if next.Comp.BaseSalaryCents == nil || *next.Comp.BaseSalaryCents != 18000000 {
		t.Fatalf("base = %+v", next.Comp)
	}
	body, err := json.Marshal(presentOffer(next))
	if err != nil {
		t.Fatal(err)
	}
	encoded := string(body)
	for _, key := range []string{`"status"`, `"templateId"`, `"sentAt"`, `"expiresAt"`, `"baseSalaryCents"`, `"equityNote"`, `"startDate"`} {
		if !strings.Contains(encoded, key) {
			t.Fatalf("missing %s in %s", key, encoded)
		}
	}
}

func TestMergeOfferPatchRejectsBadStatusAndComp(t *testing.T) {
	now := time.Date(2026, 9, 29, 18, 0, 0, 0, time.UTC)
	current := &candidate.OfferRecord{Status: candidate.OfferDraft}
	_, _, err := mergeApplicantOffer(current, json.RawMessage(`{"status":"nope"}`), "", stageOffer, nil, now)
	if !errors.Is(err, ErrInvalidInput) || err.Error() != "Offer status is invalid." {
		t.Fatalf("status err = %v", err)
	}
	_, _, err = mergeApplicantOffer(current, json.RawMessage(`{"status":null}`), "", stageOffer, nil, now)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("null status = %v", err)
	}
	_, _, err = mergeApplicantOffer(current, json.RawMessage(`{"comp":{"baseSalaryCents":-5}}`), "", stageOffer, nil, now)
	if !errors.Is(err, ErrInvalidInput) || !strings.Contains(err.Error(), "zero or more") {
		t.Fatalf("comp err = %v", err)
	}
	_, _, err = mergeApplicantOffer(current, json.RawMessage(`{"expiresAt":"09/29/2026"}`), "", stageOffer, nil, now)
	if !errors.Is(err, ErrInvalidInput) || err.Error() != "Expiry must be YYYY-MM-DD." {
		t.Fatalf("expiry err = %v", err)
	}
	_, _, err = mergeApplicantOffer(current, json.RawMessage(`{"sentAt":"yesterday"}`), "", stageOffer, nil, now)
	if !errors.Is(err, ErrInvalidInput) || err.Error() != "Sent time is invalid." {
		t.Fatalf("sent err = %v", err)
	}
}

func TestMergeOfferTransitionAndApprovalGate(t *testing.T) {
	now := time.Date(2026, 9, 29, 18, 0, 0, 0, time.UTC)
	current := &candidate.OfferRecord{Status: candidate.OfferDraft, TemplateID: "exec"}
	templates := []candidate.OfferTemplate{{ID: "exec", Name: "Executive", RequiresApproval: true}}
	_, _, err := mergeApplicantOffer(current, json.RawMessage(`{"status":"accepted"}`), "", stageInterview, templates, now)
	if !errors.Is(err, ErrInvalidInput) || !strings.Contains(err.Error(), "Cannot move offer from Draft to Accepted") {
		t.Fatalf("jump = %v", err)
	}
	_, _, err = mergeApplicantOffer(current, json.RawMessage(`{"status":"sent"}`), stageOffer, stageOffer, templates, now)
	if !errors.Is(err, ErrInvalidInput) || err.Error() != "Get approval before sending this offer." {
		t.Fatalf("approval gate = %v", err)
	}
	approved := &candidate.OfferRecord{Status: candidate.OfferApproved, TemplateID: "exec"}
	next, write, err := mergeApplicantOffer(approved, json.RawMessage(`{"status":"sent"}`), stageOffer, stageOffer, templates, now)
	if err != nil || !write || next.Status != candidate.OfferSent || next.SentAt == nil || !next.SentAt.Equal(now) {
		t.Fatalf("send = %+v err %v", next, err)
	}
	if next.RespondedAt != nil {
		t.Fatalf("responded = %+v", next.RespondedAt)
	}
}

func TestColumnRulesDraftAndHire(t *testing.T) {
	now := time.Date(2026, 9, 29, 18, 0, 0, 0, time.UTC)
	draft, write, err := mergeApplicantOffer(nil, nil, stageOffer, stageInterview, nil, now)
	if err != nil || !write || draft.Status != candidate.OfferDraft {
		t.Fatalf("draft = %+v write %v err %v", draft, write, err)
	}
	if draft.Comp == nil || draft.Comp.Currency != defaultOfferCurrency {
		t.Fatalf("comp = %+v", draft.Comp)
	}

	sent := &candidate.OfferRecord{Status: candidate.OfferSent}
	kept, write, err := mergeApplicantOffer(sent, json.RawMessage(`{"notes":"ping"}`), stageOffer, stageOffer, nil, now)
	if err != nil || !write || kept.Status != candidate.OfferSent || kept.Notes != "ping" {
		t.Fatalf("kept = %+v err %v", kept, err)
	}

	reset, write, err := mergeApplicantOffer(sent, nil, stageOffer, stageInterview, nil, now)
	if err != nil || !write || reset.Status != candidate.OfferDraft {
		t.Fatalf("reset = %+v err %v", reset, err)
	}

	hired, write, err := mergeApplicantOffer(&candidate.OfferRecord{Status: candidate.OfferDraft}, nil, stageHired, stageOffer, nil, now)
	if err != nil || !write || hired.Status != candidate.OfferAccepted || hired.SentAt == nil || hired.RespondedAt == nil {
		t.Fatalf("hired = %+v err %v", hired, err)
	}
	if !hired.SentAt.Equal(now) || !hired.RespondedAt.Equal(now) {
		t.Fatalf("stamps = %v %v", hired.SentAt, hired.RespondedAt)
	}

	again := now.Add(time.Hour)
	acceptedAt := now
	already := &candidate.OfferRecord{Status: candidate.OfferAccepted, SentAt: &acceptedAt, RespondedAt: &acceptedAt}
	same, write, err := mergeApplicantOffer(already, nil, stageHired, stageHired, nil, again)
	if err != nil || write || same.RespondedAt == nil || !same.RespondedAt.Equal(acceptedAt) {
		t.Fatalf("already hired write %v offer %+v err %v", write, same, err)
	}
}

func TestOfferApprovalRequestAndDecision(t *testing.T) {
	now := time.Date(2026, 9, 29, 18, 0, 0, 0, time.UTC)
	note := "need a second look"
	next, approval, err := requestOfferApproval(&candidate.OfferRecord{Status: candidate.OfferDraft, Notes: "keep"}, ApprovalRequest{
		Note:        &note,
		ApproverIDs: []string{" user-1 ", "user-1", "user-2"},
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	if next.Status != candidate.OfferPendingApproval || next.Notes != "keep" || !strings.HasPrefix(approval.ID, "oapr-") {
		t.Fatalf("request = %+v %+v", next, approval)
	}
	if approval.Status != candidate.OfferApprovalPending || len(approval.ApproverIDs) != 2 || approval.ApproverIDs[0] != "user-1" {
		t.Fatalf("approval = %+v", approval)
	}
	if !approval.RequestedAt.Equal(now) || !approval.DecidedAt.IsZero() {
		t.Fatalf("times = %v %v", approval.RequestedAt, approval.DecidedAt)
	}

	_, _, err = requestOfferApproval(&candidate.OfferRecord{Status: candidate.OfferSent}, ApprovalRequest{}, now)
	if !errors.Is(err, ErrInvalidInput) || !strings.Contains(err.Error(), "Cannot move offer from Sent") {
		t.Fatalf("sent request = %v", err)
	}

	decided, approval, err := decideOfferApproval(next, approval.ID, ApprovalDecision{Status: candidate.OfferApprovalApproved}, "user-1", now.Add(time.Minute))
	if err != nil || decided.Status != candidate.OfferApproved || approval.DecidedBy != "user-1" || approval.DecidedAt.IsZero() {
		t.Fatalf("decide = %+v %+v err %v", decided, approval, err)
	}
	rejected, approval, err := decideOfferApproval(decided, approval.ID, ApprovalDecision{Status: candidate.OfferApprovalRejected}, "user-2", now.Add(2*time.Minute))
	if err != nil || rejected.Status != candidate.OfferDraft || approval.Status != candidate.OfferApprovalRejected {
		t.Fatalf("reject = %+v %+v err %v", rejected, approval, err)
	}
	body, err := json.Marshal(approval)
	if err != nil {
		t.Fatal(err)
	}
	encoded := string(body)
	for _, key := range []string{`"approverIds"`, `"decidedBy"`, `"requestedAt"`, `"decidedAt"`, `"status"`} {
		if !strings.Contains(encoded, key) {
			t.Fatalf("missing %s in %s", key, encoded)
		}
	}
	if _, _, err := decideOfferApproval(rejected, "oapr-other", ApprovalDecision{Status: candidate.OfferApprovalApproved}, "user-1", now); !errors.Is(err, ErrNotFound) {
		t.Fatalf("mismatch = %v", err)
	}
	if _, _, err := decideOfferApproval(rejected, approval.ID, ApprovalDecision{Status: "maybe"}, "user-1", now); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad decision = %v", err)
	}
}

func TestMintEsignAndHirePacket(t *testing.T) {
	now := time.Date(2026, 9, 29, 18, 0, 0, 0, time.UTC)
	current := &candidate.OfferRecord{Status: candidate.OfferApproved}
	next, esign, err := mintOfferEsign(current, "app 1", "http://127.0.0.1:3002/", "  Executive letter  ", now)
	if err != nil {
		t.Fatal(err)
	}
	if esign.Status != candidate.OfferEsignPending || esign.DocumentTitle != "Executive letter" || esign.SignURL != "http://127.0.0.1:3002/offer/sign/app%201" {
		t.Fatalf("esign = %+v", esign)
	}
	if esign.SentAt == nil || !esign.SentAt.Equal(now) || next.Esign == nil || next.Status != candidate.OfferApproved {
		t.Fatalf("stored = %+v", next)
	}
	fallback, _, err := mintOfferEsign(nil, "app-1", "", "", now)
	if err != nil || fallback.Esign.SignURL != "https://joined.app/offer/sign/app-1" || fallback.Status != candidate.OfferDraft {
		t.Fatalf("fallback = %+v err %v", fallback, err)
	}
	encoded, err := json.Marshal(esign)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(encoded), `"signUrl"`) || !strings.Contains(string(encoded), `"documentTitle"`) {
		t.Fatalf("esign json = %s", encoded)
	}

	packetOffer, packet, err := upsertHirePacket(&candidate.OfferRecord{Status: candidate.OfferAccepted}, HirePacketInput{
		StartDate: "2026-11-02", OwnerNote: "day one", HandoffTarget: "people-ops@example.com",
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	if packet.Status != candidate.HirePacketDraft || packet.StartDate != "2026-11-02" || packet.OwnerNote != "day one" || len(packet.Checklist) != len(defaultHireLabels) {
		t.Fatalf("packet = %+v", packet)
	}
	if packet.Checklist[0].Label != defaultHireLabels[0] || packet.Checklist[0].Status != candidate.HireItemTodo || !strings.HasPrefix(packet.Checklist[0].ID, "hire-") {
		t.Fatalf("item = %+v", packet.Checklist[0])
	}
	if packetOffer.HirePacket == nil || packetOffer.Status != candidate.OfferAccepted || packet.GeneratedAt.IsZero() {
		t.Fatalf("offer packet = %+v", packetOffer)
	}
	ready := packetOffer
	ready.HirePacket.Status = candidate.HirePacketReady
	reset := true
	again, packet2, err := upsertHirePacket(ready, HirePacketInput{ResetChecklist: &reset, StartDate: "2026-11-02"}, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if packet2.Status != candidate.HirePacketReady || packet2.Checklist[0].ID == packet.Checklist[0].ID || again.Status != candidate.OfferAccepted {
		t.Fatalf("reset = %+v", packet2)
	}
	if _, _, err := upsertHirePacket(current, HirePacketInput{StartDate: "11/02/2026"}, now); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad start = %v", err)
	}
	body, err := json.Marshal(packet)
	if err != nil {
		t.Fatal(err)
	}
	text := string(body)
	for _, key := range []string{`"checklist"`, `"handoffTarget"`, `"ownerNote"`, `"generatedAt"`, `"startDate"`} {
		if !strings.Contains(text, key) {
			t.Fatalf("missing %s in %s", key, text)
		}
	}
}

func TestMarkEsignSignedAndDeclined(t *testing.T) {
	now := time.Date(2026, 9, 29, 18, 0, 0, 0, time.UTC)
	sent := now.Add(-time.Hour)
	current := &candidate.OfferRecord{
		Status:      candidate.OfferSent,
		RespondedAt: nil,
		Esign: &candidate.OfferEsign{
			Status:        candidate.OfferEsignPending,
			DocumentTitle: "Executive letter",
			SignURL:       "https://joined.app/offer/sign/app-1",
			SentAt:        &sent,
		},
	}
	signed, esign, err := markOfferEsign(current, " signed ", now)
	if err != nil {
		t.Fatal(err)
	}
	if esign.Status != candidate.OfferEsignSigned || esign.SignedAt == nil || !esign.SignedAt.Equal(now) {
		t.Fatalf("signed = %+v", esign)
	}
	if esign.DocumentTitle != "Executive letter" || esign.SignURL == "" || esign.SentAt == nil || !esign.SentAt.Equal(sent) {
		t.Fatalf("kept link = %+v", esign)
	}
	if signed.Status != candidate.OfferSent || signed.RespondedAt != nil {
		t.Fatalf("offer status changed: %+v", signed)
	}
	if current.Esign.Status != candidate.OfferEsignPending || current.Esign.SignedAt != nil {
		t.Fatalf("mutated source: %+v", current.Esign)
	}
	body, err := json.Marshal(esign)
	if err != nil {
		t.Fatal(err)
	}
	encoded := string(body)
	for _, key := range []string{`"status":"signed"`, `"signedAt"`, `"signUrl"`, `"documentTitle"`, `"sentAt"`} {
		if !strings.Contains(encoded, key) {
			t.Fatalf("missing %s in %s", key, encoded)
		}
	}

	later := now.Add(2 * time.Hour)
	declined, esign, err := markOfferEsign(signed, candidate.OfferEsignDeclined, later)
	if err != nil {
		t.Fatal(err)
	}
	if esign.Status != candidate.OfferEsignDeclined || esign.SignedAt == nil || !esign.SignedAt.Equal(now) {
		t.Fatalf("decline cleared signedAt: %+v", esign)
	}
	if declined.Status != candidate.OfferSent {
		t.Fatalf("offer = %s", declined.Status)
	}
	again, esign, err := markOfferEsign(declined, candidate.OfferEsignSigned, later)
	if err != nil || esign.SignedAt == nil || !esign.SignedAt.Equal(later) || again.Esign.Status != candidate.OfferEsignSigned {
		t.Fatalf("resign = %+v err %v", esign, err)
	}

	if _, _, err := markOfferEsign(current, "accepted", now); !errors.Is(err, ErrInvalidInput) || err.Error() != "E-sign status must be signed or declined." {
		t.Fatalf("bad status = %v", err)
	}
	if _, _, err := markOfferEsign(nil, candidate.OfferEsignSigned, now); !errors.Is(err, ErrInvalidInput) || err.Error() != "Create a sign link before marking signed." {
		t.Fatalf("missing = %v", err)
	}
	none := &candidate.OfferRecord{Status: candidate.OfferDraft, Esign: &candidate.OfferEsign{Status: candidate.OfferEsignNone}}
	if _, _, err := markOfferEsign(none, candidate.OfferEsignDeclined, now); !errors.Is(err, ErrInvalidInput) || err.Error() != "Create a sign link before marking declined." {
		t.Fatalf("none = %v", err)
	}
	if view := esignView(nil); view.Status != candidate.OfferEsignNone {
		t.Fatalf("view = %+v", view)
	}
	if view := esignView(signed); view.Status != candidate.OfferEsignSigned || view.SignedAt == nil {
		t.Fatalf("signed view = %+v", view)
	}
}

func TestHirePacketReadySentAndChecklist(t *testing.T) {
	now := time.Date(2026, 9, 29, 18, 0, 0, 0, time.UTC)
	ready, packet, err := setHirePacketStatus(&candidate.OfferRecord{Status: candidate.OfferAccepted}, HirePacketStatusInput{Status: " ready "}, now)
	if err != nil {
		t.Fatal(err)
	}
	if packet.Status != candidate.HirePacketReady || len(packet.Checklist) != len(defaultHireLabels) || packet.GeneratedAt.IsZero() {
		t.Fatalf("ready = %+v", packet)
	}
	if ready.Status != candidate.OfferAccepted {
		t.Fatalf("offer status = %s", ready.Status)
	}
	itemID := packet.Checklist[0].ID
	note := "  welcome  "
	target := "people-ops@example.com"
	sent, packet, err := setHirePacketStatus(ready, HirePacketStatusInput{Status: candidate.HirePacketSent, OwnerNote: &note, HandoffTarget: &target}, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if packet.Status != candidate.HirePacketSent || packet.Checklist[0].ID != itemID || packet.OwnerNote != "welcome" || packet.HandoffTarget != target {
		t.Fatalf("sent = %+v", packet)
	}
	if sent.HirePacket == nil || sent.Status != candidate.OfferAccepted {
		t.Fatalf("stored = %+v", sent)
	}
	back, packet, err := setHirePacketStatus(sent, HirePacketStatusInput{Status: candidate.HirePacketReady}, now.Add(2*time.Minute))
	if err != nil || packet.Status != candidate.HirePacketReady || packet.OwnerNote != "welcome" || packet.Checklist[0].ID != itemID {
		t.Fatalf("back to ready = %+v err %v", packet, err)
	}
	blank := ""
	cleared, packet, err := setHirePacketStatus(back, HirePacketStatusInput{Status: candidate.HirePacketSent, OwnerNote: &blank}, now)
	if err != nil || packet.OwnerNote != "" || packet.HandoffTarget != target {
		t.Fatalf("clear note = %+v err %v", packet, err)
	}
	if _, _, err := setHirePacketStatus(ready, HirePacketStatusInput{Status: candidate.HirePacketDraft}, now); !errors.Is(err, ErrInvalidInput) || err.Error() != "Hire packet status must be ready or sent." {
		t.Fatalf("draft status = %v", err)
	}
	if _, _, err := setHirePacketStatus(ready, HirePacketStatusInput{Status: "none"}, now); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("none status = %v", err)
	}

	done, packet, err := patchHirePacketItem(cleared, itemID, HirePacketItemInput{Status: candidate.HireItemDone})
	if err != nil {
		t.Fatal(err)
	}
	if packet.Status != candidate.HirePacketSent || packet.Checklist[0].Status != candidate.HireItemDone || packet.Checklist[1].Status != candidate.HireItemTodo {
		t.Fatalf("done = %+v", packet.Checklist)
	}
	if cleared.HirePacket.Checklist[0].Status != candidate.HireItemTodo {
		t.Fatal("source checklist mutated")
	}
	undone, packet, err := patchHirePacketItem(done, itemID, HirePacketItemInput{Status: " todo "})
	if err != nil || packet.Checklist[0].Status != candidate.HireItemTodo || undone.HirePacket.Status != candidate.HirePacketSent {
		t.Fatalf("undone = %+v err %v", packet, err)
	}
	skipped, packet, err := patchHirePacketItem(undone, itemID, HirePacketItemInput{Status: candidate.HireItemSkipped})
	if err != nil || packet.Checklist[0].Status != candidate.HireItemSkipped {
		t.Fatalf("skipped = %+v err %v", packet, err)
	}
	body, err := json.Marshal(packet)
	if err != nil {
		t.Fatal(err)
	}
	encoded := string(body)
	for _, key := range []string{`"status":"sent"`, `"checklist"`, `"id"`, itemID, `"skipped"`} {
		if !strings.Contains(encoded, key) {
			t.Fatalf("missing %s in %s", key, encoded)
		}
	}
	if _, _, err := patchHirePacketItem(skipped, "hire-missing", HirePacketItemInput{Status: candidate.HireItemDone}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing item = %v", err)
	}
	if _, _, err := patchHirePacketItem(skipped, itemID, HirePacketItemInput{Status: "later"}); !errors.Is(err, ErrInvalidInput) || err.Error() != "Checklist item status must be todo, done, or skipped." {
		t.Fatalf("bad item = %v", err)
	}
	if _, _, err := patchHirePacketItem(nil, itemID, HirePacketItemInput{Status: candidate.HireItemDone}); !errors.Is(err, ErrInvalidInput) || err.Error() != "Generate a hire packet before updating the checklist." {
		t.Fatalf("no packet = %v", err)
	}
	draftOnly := &candidate.OfferRecord{Status: candidate.OfferDraft, HirePacket: &candidate.HirePacket{Status: candidate.HirePacketDraft, Checklist: []candidate.HirePacketItem{{ID: "hire-1", Label: "Welcome", Status: candidate.HireItemTodo}}}}
	toggled, packet, err := patchHirePacketItem(draftOnly, "hire-1", HirePacketItemInput{Status: candidate.HireItemDone})
	if err != nil || packet.Status != candidate.HirePacketDraft || toggled.HirePacket.Checklist[0].Status != candidate.HireItemDone {
		t.Fatalf("draft toggle = %+v err %v", packet, err)
	}
}

func TestEsignAndHirePacketRoleGates(t *testing.T) {
	denied := []struct{ role, perm string }{
		{RoleInterviewer, PermOffersSend},
		{RoleInterviewer, PermOffersHire},
		{RoleHiringManager, PermOffersSend},
		{RoleHiringManager, PermOffersHire},
		{RoleFinance, PermOffersSend},
		{RoleFinance, PermOffersHire},
		{RoleViewer, PermOffersSend},
		{RoleViewer, PermOffersHire},
	}
	for _, tc := range denied {
		err := AuthorizeCompany(tc.role, tc.perm)
		if !errors.Is(err, ErrForbidden) || !strings.Contains(err.Error(), tc.perm) {
			t.Fatalf("%s %s = %v", tc.role, tc.perm, err)
		}
	}
	for _, role := range []string{RoleOwner, RoleAdmin, RoleRecruiter} {
		if err := AuthorizeCompany(role, PermOffersSend); err != nil {
			t.Fatalf("%s send: %v", role, err)
		}
		if err := AuthorizeCompany(role, PermOffersHire); err != nil {
			t.Fatalf("%s hire: %v", role, err)
		}
	}
}

func TestNormalizeOfferTemplates(t *testing.T) {
	longName := strings.Repeat("n", 140)
	items := []candidate.OfferTemplate{{
		Name:             "  " + longName,
		Body:             "  Dear {{name}}  ",
		RequiresApproval: true,
		RequiresEsign:    true,
		DefaultComp:      &candidate.CompPackage{Currency: "usd", BonusCents: intPtr(50000)},
	}}
	for i := 0; i < maxOfferTemplates; i++ {
		items = append(items, candidate.OfferTemplate{ID: "otmpl-" + strings.Repeat("a", i+1), Name: "Extra"})
	}
	items = append(items, candidate.OfferTemplate{Name: "   "})
	got, err := normalizeOfferTemplates(items)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != maxOfferTemplates {
		t.Fatalf("len = %d", len(got))
	}
	if !strings.HasPrefix(got[0].ID, "otmpl-") || len([]rune(got[0].Name)) != maxOfferTemplateName {
		t.Fatalf("first = %+v", got[0])
	}
	if got[0].Body != "  Dear {{name}}  " || !got[0].RequiresApproval || !got[0].RequiresEsign {
		t.Fatalf("body = %+v", got[0])
	}
	if got[0].DefaultComp == nil || got[0].DefaultComp.Currency != "USD" || got[0].DefaultComp.BonusCents == nil || *got[0].DefaultComp.BonusCents != 50000 {
		t.Fatalf("default comp = %+v", got[0].DefaultComp)
	}
	kept, err := assignOfferTemplates(nil, got)
	if err != nil || len(kept) != maxOfferTemplates {
		t.Fatalf("keep = %d err %v", len(kept), err)
	}
	cleared, err := assignOfferTemplates([]candidate.OfferTemplate{}, got)
	if err != nil || len(cleared) != 0 {
		t.Fatalf("clear = %+v err %v", cleared, err)
	}
	_, err = normalizeOfferTemplates([]candidate.OfferTemplate{{
		Name:        "Bad",
		DefaultComp: &candidate.CompPackage{BaseSalaryCents: intPtr(-1)},
	}})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad comp = %v", err)
	}

	view := viewJob(storedJob{Title: "Engineer", OfferTemplates: got[:1]}, Pipeline{})
	body, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"offerTemplates"`) || !strings.Contains(string(body), `"requiresApproval":true`) || !strings.Contains(string(body), `"requiresEsign":true`) {
		t.Fatalf("job json = %s", body)
	}
	person := viewApplicant(candidate.Application{ID: "app-1", Offer: &candidate.OfferRecord{Status: candidate.OfferDraft}}, auth.User{Name: "Ada"}, candidate.Profile{}, "Engineer")
	if person.Offer == nil || person.Offer.Status != candidate.OfferDraft {
		t.Fatalf("applicant = %+v", person.Offer)
	}
	empty := viewApplicant(candidate.Application{ID: "app-2"}, auth.User{}, candidate.Profile{}, "")
	if empty.Offer != nil {
		t.Fatalf("empty offer = %+v", empty.Offer)
	}
}

func intPtr(value int) *int { return &value }
