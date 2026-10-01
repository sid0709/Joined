package employer

import (
	"errors"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

func TestCompanyStage(t *testing.T) {
	if got := companyStage(candidate.StageApplied, "", ""); got != stageNew {
		t.Fatalf("applied -> %s", got)
	}
	if got := companyStage(candidate.StageClosed, "", reasonHired); got != stageHired {
		t.Fatalf("hired -> %s", got)
	}
	if got := companyStage(candidate.StageClosed, stageOffer, reasonRejected); got != stageOffer {
		t.Fatalf("stored stage wins, got %s", got)
	}
	if got := companyStage(candidate.StageInterview, "phone-screen", ""); got != "phone-screen" {
		t.Fatalf("custom stage = %s", got)
	}
}

func TestApplicantPatchAcceptsTagsWithoutColumn(t *testing.T) {
	column, _, stage, ok := applicantPatch("", nil, true)
	if !ok || column != "" || stage != "" {
		t.Fatalf("tags only = %s %s %v", column, stage, ok)
	}
	if _, _, _, ok := applicantPatch("", nil, false); ok {
		t.Fatal("empty patch accepted")
	}
	if _, _, _, ok := applicantPatch("nope", nil, true); ok {
		t.Fatal("bad column accepted")
	}
	column, reason, stage, ok := applicantPatch(stageHired, nil, true)
	if !ok || column != candidate.StageClosed || reason != reasonHired || stage != stageHired {
		t.Fatalf("hired = %s %s %s %v", column, reason, stage, ok)
	}
	custom := map[string]struct{}{"phone-screen": {}}
	column, reason, stage, ok = applicantPatch("phone-screen", custom, false)
	if !ok || column != "" || reason != "" || stage != "phone-screen" {
		t.Fatalf("custom = %s %s %s %v", column, reason, stage, ok)
	}
	if _, _, _, ok := applicantPatch("phone-screen", nil, false); ok {
		t.Fatal("unknown custom stage accepted")
	}
}

func TestNormalizeTagsTrimsAndDedupes(t *testing.T) {
	got := normalizeTags([]string{" Referral ", "Referral", "", "Onsite"})
	if len(got) != 2 || got[0] != "Referral" || got[1] != "Onsite" {
		t.Fatalf("tags = %#v", got)
	}
	if got = normalizeTags(nil); len(got) != 0 {
		t.Fatalf("nil tags = %#v", got)
	}
}

func TestCandidateStage(t *testing.T) {
	column, reason, ok := candidateStage(stageHired)
	if !ok || column != candidate.StageClosed || reason != reasonHired {
		t.Fatalf("hired maps to %s %s %v", column, reason, ok)
	}
	if _, _, ok := candidateStage("nope"); ok {
		t.Fatal("unknown stage accepted")
	}
}

func TestRequireCreator(t *testing.T) {
	if err := RequireCreator(auth.Company{IsCreator: true}); err != nil {
		t.Fatal(err)
	}
	if err := RequireCreator(auth.Company{}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("member: %v", err)
	}
}

func TestPurchaseBounds(t *testing.T) {
	if err := validatePurchase(MinPurchaseCents); err != nil {
		t.Fatal(err)
	}
	if err := validatePurchase(MinPurchaseCents - 1); err == nil {
		t.Fatal("expected a minimum")
	}
	if err := validatePurchase(MaxPurchaseCents + 1); err == nil {
		t.Fatal("expected a maximum")
	}
}
