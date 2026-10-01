package employer

import (
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func TestNormalizeStagesDropsFixedAndCaps(t *testing.T) {
	items := []PipelineStageDef{
		{ID: "interview", Title: "Interview", Kind: stageKindCustom},
		{ID: "panel", Title: "Panel", Kind: stageKindFixed},
		{ID: "blank", Title: "   ", Kind: stageKindCustom},
		{ID: "onsite", Title: "  Onsite ", Kind: stageKindCustom, RequiresFeedback: true, RequiresScorecard: true},
	}
	for i := 0; i < maxCustomStages; i++ {
		items = append(items, PipelineStageDef{ID: "extra-" + string(rune('a'+i)), Title: "Extra", Kind: stageKindCustom})
	}
	got, err := normalizeStages(items)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != maxCustomStages {
		t.Fatalf("len = %d", len(got))
	}
	if got[0].ID != "onsite" || got[0].Title != "Onsite" || !got[0].RequiresFeedback || !got[0].RequiresScorecard || got[0].Kind != stageKindCustom {
		t.Fatalf("first = %+v", got[0])
	}
}

func TestNormalizeStagesRejectsBadSlugAndDuplicates(t *testing.T) {
	_, err := normalizeStages([]PipelineStageDef{{ID: "Phone Screen", Title: "Phone", Kind: stageKindCustom}})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("slug err = %v", err)
	}
	_, err = normalizeStages([]PipelineStageDef{
		{ID: "onsite", Title: "A", Kind: stageKindCustom},
		{ID: "onsite", Title: "B", Kind: stageKindCustom},
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("dup err = %v", err)
	}
	got, err := normalizeStages([]PipelineStageDef{{Title: "Debrief", Kind: stageKindCustom}})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || !slugSafe(got[0].ID) || got[0].Title != "Debrief" {
		t.Fatalf("generated = %+v", got)
	}
}

func TestNormalizeFeedbackGate(t *testing.T) {
	got := normalizeFeedbackGate(FeedbackGateConfig{
		RequireNotesOnAdvance:  true,
		RequireScorecardStages: []string{" offer ", "", "offer", "onsite"},
	})
	if !got.RequireNotesOnAdvance || got.RequireRatingOnAdvance {
		t.Fatalf("flags = %+v", got)
	}
	if len(got.RequireScorecardStages) != 2 || got.RequireScorecardStages[0] != "offer" || got.RequireScorecardStages[1] != "onsite" {
		t.Fatalf("stages = %#v", got.RequireScorecardStages)
	}
}

func TestNormalizeScorecardTemplate(t *testing.T) {
	got, err := normalizeScorecardTemplate(&ScorecardTemplate{
		Criteria: []ScorecardCriterion{
			{Label: "  Role fit ", Description: "  depth ", MaxScore: 0},
			{Label: "   ", MaxScore: 3},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.Name != defaultScorecardName || len(got.Criteria) != 1 {
		t.Fatalf("template = %+v", got)
	}
	if got.Criteria[0].Label != "Role fit" || got.Criteria[0].MaxScore != defaultCriterionMax || got.Criteria[0].Description != "depth" || !slugSafe(got.Criteria[0].ID) {
		t.Fatalf("criterion = %+v", got.Criteria[0])
	}
	empty, err := normalizeScorecardTemplate(&ScorecardTemplate{Name: "Empty"})
	if err != nil || empty != nil {
		t.Fatalf("empty = %+v %v", empty, err)
	}
	_, err = normalizeScorecardTemplate(&ScorecardTemplate{
		Criteria: []ScorecardCriterion{{ID: "Not Slug", Label: "Fit", MaxScore: 5}},
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("slug err = %v", err)
	}
}

func TestNormalizeInterviewGuide(t *testing.T) {
	prompts := []string{"  Hello ", "", "x", "y", "z", "a", "b", "c"}
	got, err := normalizeInterviewGuide(&InterviewGuide{
		Sections: []InterviewGuideSection{
			{Title: " Opening ", Prompts: prompts},
			{Title: "  ", Prompts: []string{"dropped"}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.Title != defaultGuideTitle || len(got.Sections) != 1 {
		t.Fatalf("guide = %+v", got)
	}
	if got.Sections[0].Title != "Opening" || len(got.Sections[0].Prompts) != maxGuidePrompts || got.Sections[0].Prompts[0] != "Hello" {
		t.Fatalf("section = %+v", got.Sections[0])
	}
	empty, err := normalizeInterviewGuide(&InterviewGuide{Title: "None"})
	if err != nil || empty != nil {
		t.Fatalf("empty = %+v %v", empty, err)
	}
}

func TestNormalizeScorecardSubmission(t *testing.T) {
	template := &ScorecardTemplate{
		ID:   "tmpl-1",
		Name: "Interview scorecard",
		Criteria: []ScorecardCriterion{
			{ID: "crit-1", Label: "Role fit", MaxScore: 5},
			{ID: "crit-2", Label: "Craft", MaxScore: 5},
		},
	}
	overall := 4.5
	got, err := normalizeScorecard(ScorecardInput{
		TemplateID:  "tmpl-1",
		InterviewID: " iv-1 ",
		Overall:     &overall,
		Scores: []ScorecardScore{
			{CriterionID: "crit-2", Score: 4, Note: "  sharp "},
			{CriterionID: "crit-1", Score: 5},
		},
	}, template, "app-1", "user-1", time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if got.ApplicantID != "app-1" || got.TemplateID != "tmpl-1" || got.InterviewID != "iv-1" || got.SubmittedBy != "user-1" || len(got.Scores) != 2 {
		t.Fatalf("submission = %+v", got)
	}
	if got.Scores[0].CriterionID != "crit-1" || got.Scores[0].Score != 5 || got.Scores[1].Note != "sharp" || got.Overall == nil || *got.Overall != overall {
		t.Fatalf("scores = %+v", got)
	}
	if _, err := normalizeScorecard(ScorecardInput{TemplateID: "other", Scores: got.Scores}, template, "app-1", "user-1", time.Now()); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("template err = %v", err)
	}
	if _, err := normalizeScorecard(ScorecardInput{}, nil, "app-1", "user-1", time.Now()); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("missing template err = %v", err)
	}
	if _, err := normalizeScorecard(ScorecardInput{
		TemplateID: "tmpl-1",
		Scores:     []ScorecardScore{{CriterionID: "crit-1", Score: 0}, {CriterionID: "crit-2", Score: 6}},
	}, template, "app-1", "user-1", time.Now()); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("range err = %v", err)
	}
}

func TestFeedbackGateConflict(t *testing.T) {
	gate := FeedbackGateConfig{RequireNotesOnAdvance: true, RequireRatingOnAdvance: true, RequireScorecardStages: []string{"offer"}}
	err := feedbackGate(advanceCheck{from: stageNew, to: stageScreening, gate: gate})
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("notes conflict = %v", err)
	}
	if err.Error() != notesRequiredReason {
		t.Fatalf("reason = %q", err.Error())
	}
	err = feedbackGate(advanceCheck{from: stageNew, to: stageScreening, notes: "  strong  ", gate: gate})
	if !errors.Is(err, ErrConflict) || err.Error() != ratingRequiredReason {
		t.Fatalf("rating = %v", err)
	}
	err = feedbackGate(advanceCheck{from: stageInterview, to: stageOffer, notes: "yes", rating: 4, gate: gate})
	if !errors.Is(err, ErrConflict) || err.Error() != scorecardRequiredReason {
		t.Fatalf("scorecard = %v", err)
	}
	if err := feedbackGate(advanceCheck{from: stageInterview, to: stageOffer, notes: "yes", rating: 4, hasScorecard: true, gate: gate}); err != nil {
		t.Fatal(err)
	}
	if err := feedbackGate(advanceCheck{from: stageOffer, to: stageRejected, gate: gate}); err != nil {
		t.Fatal(err)
	}
	if err := feedbackGate(advanceCheck{from: stageNew, to: stageNew, gate: gate}); err != nil {
		t.Fatal(err)
	}
	custom := []PipelineStageDef{{ID: "onsite", Title: "Onsite", Kind: stageKindCustom, RequiresFeedback: true, RequiresScorecard: true}}
	err = feedbackGate(advanceCheck{from: stageInterview, to: "onsite", rating: 3, custom: custom})
	if !errors.Is(err, ErrConflict) || err.Error() != notesRequiredReason {
		t.Fatalf("custom notes = %v", err)
	}
	err = feedbackGate(advanceCheck{from: stageInterview, to: "onsite", notes: "ready", rating: 3, custom: custom})
	if !errors.Is(err, ErrConflict) || err.Error() != scorecardRequiredReason {
		t.Fatalf("custom scorecard = %v", err)
	}
}

func TestPipelinePutKeepsUntouchedFields(t *testing.T) {
	var put PipelinePut
	if err := json.Unmarshal([]byte(`{"feedbackGate":{"requireNotesOnAdvance":true,"requireRatingOnAdvance":false,"requireScorecardStages":["onsite"]}}`), &put); err != nil {
		t.Fatal(err)
	}
	patch, err := put.patch()
	if err != nil {
		t.Fatal(err)
	}
	existing := storedJob{CustomStages: []PipelineStageDef{{ID: "onsite", Title: "Onsite", Kind: stageKindCustom}}}
	doc := applyPipeline(existing, patch)
	if len(doc.CustomStages) != 1 || doc.CustomStages[0].ID != "onsite" {
		t.Fatalf("stages wiped: %+v", doc.CustomStages)
	}
	if doc.FeedbackGate == nil || !doc.FeedbackGate.RequireNotesOnAdvance || len(doc.FeedbackGate.RequireScorecardStages) != 1 {
		t.Fatalf("gate = %+v", doc.FeedbackGate)
	}
	if doc.ScorecardTemplate != nil || doc.InterviewGuide != nil {
		t.Fatal("template or guide set")
	}

	var clear PipelinePut
	if err := json.Unmarshal([]byte(`{"scorecardTemplate":null}`), &clear); err != nil {
		t.Fatal(err)
	}
	patch, err = clear.patch()
	if err != nil {
		t.Fatal(err)
	}
	doc = applyPipeline(storedJob{ScorecardTemplate: &ScorecardTemplate{ID: "tmpl-1", Name: "Interview scorecard", Criteria: []ScorecardCriterion{{ID: "crit-1", Label: "Fit", MaxScore: 5}}}}, patch)
	if doc.ScorecardTemplate != nil {
		t.Fatal("template not cleared")
	}

	var bad PipelinePut
	if err := json.Unmarshal([]byte(`{"stages":[{"id":"Phone Screen","title":"Phone","kind":"custom"}]}`), &bad); err != nil {
		t.Fatal(err)
	}
	if _, err := bad.patch(); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad slug = %v", err)
	}
}

func TestViewJobReturnsPipelineEval(t *testing.T) {
	gate := FeedbackGateConfig{RequireNotesOnAdvance: true, RequireScorecardStages: []string{"offer"}}
	guide := &InterviewGuide{ID: "guide-1", Title: "Interview guide", Sections: []InterviewGuideSection{{ID: "sec-1", Title: "Opening", Prompts: []string{"Hello"}}}}
	doc := storedJob{
		Title:             "Engineer",
		CustomStages:      []PipelineStageDef{{ID: "onsite", Title: "Onsite", Kind: stageKindCustom}},
		FeedbackGate:      &gate,
		InterviewGuide:    guide,
		ScorecardTemplate: &ScorecardTemplate{ID: "tmpl-1", Name: "Interview scorecard", Criteria: []ScorecardCriterion{{ID: "crit-1", Label: "Fit", MaxScore: 5}}},
	}
	view := viewJob(doc, Pipeline{})
	if len(view.CustomStages) != 1 || view.FeedbackGate == nil || !view.FeedbackGate.RequireNotesOnAdvance {
		t.Fatalf("view = %+v", view)
	}
	if view.ScorecardTemplate == nil || view.ScorecardTemplate.ID != "tmpl-1" || view.InterviewGuide == nil || view.InterviewGuide.ID != "guide-1" {
		t.Fatalf("eval = %+v %+v", view.ScorecardTemplate, view.InterviewGuide)
	}
	cfg := pipelineConfig(storedJob{})
	if len(cfg.Stages) != 0 || cfg.FeedbackGate.RequireNotesOnAdvance || cfg.FeedbackGate.RequireScorecardStages == nil {
		t.Fatalf("empty pipeline = %+v", cfg)
	}
	carried := carryPipeline(storedJob{Title: "Next"}, doc)
	if carried.Title != "Next" || len(carried.CustomStages) != 1 || carried.FeedbackGate == nil {
		t.Fatalf("carried = %+v", carried)
	}
}

func TestNormalizeInterviewerIDs(t *testing.T) {
	got := normalizeInterviewerIDs([]string{" user-1 ", "user-1", "", "user-2"})
	if len(got) != 2 || got[0] != "user-1" || got[1] != "user-2" {
		t.Fatalf("ids = %#v", got)
	}
}
