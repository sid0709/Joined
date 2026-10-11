package ranking

import (
	"fmt"
	"hash/fnv"
)

// Ranking modes. Each has its own weight set: a typed query is led by relevance,
// a blank query by the profile, and a blank query without a profile by freshness.
const (
	ModeQuery     = "query"
	ModeProfile   = "profile"
	ModeAnonymous = "anonymous"
)

// Experiment arms.
const (
	ArmControl = "v0"
	ArmLearned = "ltr"
)

// Model scores one candidate's features; higher ranks first.
type Model interface {
	Name() string
	Score(mode string, f *Features) float64
}

// linearWeights are the hand-tuned v0 weights for each mode. Every weight set sums
// to 1, so a v0 score reads as a 0–1 quality and stays comparable across modes
// (feeds mix scores computed at different times).
var linearWeights = map[string]map[int]float64{
	ModeQuery: {
		FFusion: 0.22, FQueryTitleSim: 0.14, FQueryBodySim: 0.08, FLexical: 0.10,
		FExactTitle: 0.10, FCompanyMatch: 0.05, FQueryOccupation: 0.06, FQuerySkills: 0.05,
		FRoleTitleSim: 0.03, FProfileOccupation: 0.03, FSkillJaccard: 0.02, FSeniority: 0.02,
		FLocation: 0.02, FPay: 0.01, FVisa: 0.01, FRecency: 0.04, FApplicants: 0.01, FCompany: 0.01,
	},
	ModeProfile: {
		FRoleTitleSim: 0.20, FProfileBodySim: 0.08, FProfileOccupation: 0.14, FFit: 0.10,
		FSkillJaccard: 0.08, FSkillCoverage: 0.05, FSeniority: 0.07, FLocation: 0.07, FPay: 0.05,
		FVisa: 0.04, FFusion: 0.02, FRecency: 0.06, FApplicants: 0.02, FCompany: 0.01, FHasPay: 0.01,
	},
	ModeAnonymous: {
		FRecency: 0.60, FCompany: 0.15, FHasPay: 0.10, FApplicants: 0.15,
	},
}

// LinearModel is the v0 ranker: a weighted sum per mode.
type LinearModel struct{}

// Name is the model id logged with impressions.
func (LinearModel) Name() string { return "linear-" + FeatureVersion }

// Score is Σ wᵢ·fᵢ for the mode's weight set.
func (LinearModel) Score(mode string, f *Features) float64 {
	weights, ok := linearWeights[mode]
	if !ok {
		weights = linearWeights[ModeQuery]
	}
	total := 0.0
	for i, w := range weights {
		total += w * float64(f[i])
	}
	return total
}

// LearnedModel is a LightGBM LambdaMART model trained on impression logs
// (tools/ranking/train_ltr.py), evaluated natively from its text format.
type LearnedModel struct {
	name  string
	model *lgbmModel
}

// LoadLearnedModel reads a LightGBM text model. Its feature count must match FeatureCount.
func LoadLearnedModel(path string) (*LearnedModel, error) {
	model, err := parseLGBM(path)
	if err != nil {
		return nil, fmt.Errorf("load ranking model %s: %w", path, err)
	}
	if model.features != FeatureCount {
		return nil, fmt.Errorf("ranking model %s has %d features, want %d (%s)", path, model.features, FeatureCount, FeatureVersion)
	}
	return &LearnedModel{name: "lgbm-" + FeatureVersion, model: model}, nil
}

// Name is the model id logged with impressions.
func (m *LearnedModel) Name() string { return m.name }

// Score runs the ensemble. The mode is one of the features (has_query, has_profile),
// so one model serves every mode.
func (m *LearnedModel) Score(_ string, f *Features) float64 {
	var row [FeatureCount]float64
	for i, v := range f {
		row[i] = float64(v)
	}
	return m.model.predict(row[:])
}

// Arm picks the experiment arm for a user: a stable hash, so a user always sees
// the same ranker. Signed-out visitors and percent 0 stay on control.
func Arm(userID, experiment string, percent int, hasModel bool) string {
	if userID == "" || percent <= 0 || !hasModel {
		return ArmControl
	}
	h := fnv.New32a()
	_, _ = h.Write([]byte(experiment + ":" + userID))
	if int(h.Sum32()%100) < percent {
		return ArmLearned
	}
	return ArmControl
}
