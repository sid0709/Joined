package employer

import (
	"testing"

	"github.com/sid0709/OpenSeat/opened-backend/internal/candidate"
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
