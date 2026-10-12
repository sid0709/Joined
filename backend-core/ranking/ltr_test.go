package ranking

import (
	"context"
	"math"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/sid0709/Joined/backend-core/candidate"
)

// testdata/ltr_model.txt was trained by tools/ranking/train_ltr.py on synthetic
// pages whose labels follow role_title_sim, fit, and location, so it must score
// a strong profile match above a weak one.
func TestLearnedModelLoadsAndPrefersFit(t *testing.T) {
	model, err := LoadLearnedModel("testdata/ltr_model.txt")
	if err != nil {
		t.Fatal(err)
	}
	var strong, weak Features
	strong[FRoleTitleSim], strong[FFit], strong[FLocation], strong[FHasProfile] = 0.95, 0.9, 1, 1
	weak[FRoleTitleSim], weak[FFit], weak[FLocation], weak[FHasProfile] = 0.2, 0.1, 0, 1
	if model.Score(ModeProfile, &strong) <= model.Score(ModeProfile, &weak) {
		t.Fatal("the learned model should rank the strong match first")
	}
}

func TestLearnedArmServesTheModel(t *testing.T) {
	s, events := newTestService(t, nil)
	model, err := LoadLearnedModel("testdata/ltr_model.txt")
	if err != nil {
		t.Fatal(err)
	}
	s.learned = model
	s.cfg.LTRPercent = 100
	s.users.source = &fakeProfiles{profiles: map[string]candidate.Profile{"u1": mlProfile()}}
	res, err := s.Search(context.Background(), Request{UserID: "u1", Sort: SortRecommended, Now: testNow})
	if err != nil {
		t.Fatal(err)
	}
	if res.Arm != ArmLearned || res.Model != model.Name() {
		t.Fatalf("arm/model = %s/%s, want the learned model", res.Arm, res.Model)
	}
	if got := events.events[len(events.events)-1]; got.Arm != ArmLearned || got.Model != model.Name() {
		t.Fatalf("impression logged arm/model %s/%s", got.Arm, got.Model)
	}
	if _, err := LoadLearnedModel("testdata/missing.txt"); err == nil {
		t.Fatal("a missing model file must be an error")
	}
}

// testdata/ltr_predictions.tsv holds LightGBM's own predictions (Python, 4.5.0) for
// rows of the training data — including an all-zero row and a NaN — so the Go
// evaluator must reproduce them exactly.
func TestLGBMEvaluatorMatchesLightGBM(t *testing.T) {
	model, err := parseLGBM("testdata/ltr_model.txt")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("testdata/ltr_predictions.tsv")
	if err != nil {
		t.Fatal(err)
	}
	checked := 0
	for _, line := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
		fields := strings.Split(line, "\t")
		want, _ := strconv.ParseFloat(fields[0], 64)
		row := make([]float64, len(fields)-1)
		for i, field := range fields[1:] {
			row[i], _ = strconv.ParseFloat(field, 64)
		}
		if got := model.predict(row); math.Abs(got-want) > 1e-9 {
			t.Fatalf("row %d: got %.12f, LightGBM says %.12f", checked, got, want)
		}
		checked++
	}
	if checked < 50 {
		t.Fatalf("checked only %d rows", checked)
	}
}
