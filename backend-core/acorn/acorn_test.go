package acorn

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

// fakeModel answers each call from a queue of replies, in order.
type fakeModel struct {
	replies []string
	calls   []string
}

func (f *fakeModel) JSON(_ context.Context, system, user string, _ json.RawMessage) ([]byte, error) {
	f.calls = append(f.calls, system[:20]+"|"+user)
	if len(f.replies) == 0 {
		return nil, context.DeadlineExceeded
	}
	reply := f.replies[0]
	f.replies = f.replies[1:]
	return []byte(reply), nil
}
func (f *fakeModel) Model() string { return "fake" }
func (f *fakeModel) Ready() bool   { return true }

const basePlan = `{"goal":"g","actions":[
 {"action":"fill","element_index":1,"element_indexes":null,"expected_label":"Why this role?","expected_role":"textarea","value":"draft","file":null,"reason":null,"ms":null},
 {"action":"fill","element_index":2,"element_indexes":null,"expected_label":"Did you use AI to apply?","expected_role":"combobox","value":"Yes","file":null,"reason":null,"ms":null},
 {"action":"fill","element_index":3,"element_indexes":null,"expected_label":"Name","expected_role":"textbox","value":"Jordan","file":null,"reason":null,"ms":null}
],"forbidden_actions":[],"validation":{"required_element_indexes":[1,2,3],"stop_before_submit":true},"unresolved_items":[]}`

func TestAnalyzePipeline(t *testing.T) {
	model := &fakeModel{replies: []string{
		basePlan,
		`{"classifications":[{"element_index":2,"kind":"application_ai"},{"element_index":1,"kind":"other"}]}`,
		`{"answers":[{"element_index":1,"value":"Because of the Heroku migration."},{"element_index":3,"value":"Jordan Lee"},{"element_index":99,"value":"ignored"}]}`,
	}}
	got, err := New(model).Analyze(context.Background(), "PROFILE", "tree", map[string]any{"job": map[string]any{"title": "Dev"}})
	if err != nil {
		t.Fatal(err)
	}
	values := map[int]string{}
	for _, row := range planActions(got.Plan) {
		index, _ := elementIndex(row)
		values[index], _ = row["value"].(string)
	}
	if values[2] != "No" {
		t.Errorf("AI-use answer = %q, want No", values[2])
	}
	if values[1] != "Because of the Heroku migration." || values[3] != "Jordan Lee" {
		t.Errorf("typed answers not rewritten: %v", values)
	}
	if !strings.Contains(model.calls[0], `"recommendedResumeAvailable": false`) {
		t.Errorf("planner was not told no résumé is available:\n%s", model.calls[0])
	}
	if len(model.calls) != 3 {
		t.Errorf("model calls = %d, want 3", len(model.calls))
	}
}

func TestAnalyzeFailsOpenWhenHelpersFail(t *testing.T) {
	model := &fakeModel{replies: []string{basePlan, "not json", "not json"}}
	got, err := New(model).Analyze(context.Background(), "PROFILE", "tree", nil)
	if err != nil {
		t.Fatal(err)
	}
	if v := planActions(got.Plan)[0]["value"]; v != "draft" {
		t.Errorf("draft changed to %v", v)
	}
}

func TestAnalyzeRejectsBadPlanAndEmptyTree(t *testing.T) {
	if _, err := New(&fakeModel{replies: []string{`{"goal":"g"}`}}).Analyze(context.Background(), "P", "tree", nil); err == nil {
		t.Error("plan missing fields should fail")
	}
	if _, err := New(&fakeModel{}).Analyze(context.Background(), "P", "  ", nil); err == nil {
		t.Error("empty tree should fail")
	}
}

func TestMatchOptionRecoversListedString(t *testing.T) {
	model := &fakeModel{replies: []string{`{"matched_option":"b. no, i am not a veteran","confidence":0.9,"reason":"r"}`}}
	got, err := New(model).MatchOption(context.Background(), "No", []string{"A. Yes", "B. No, I am not a veteran"}, "Veteran", "")
	if err != nil {
		t.Fatal(err)
	}
	if got.MatchedOption == nil || *got.MatchedOption != "B. No, I am not a veteran" {
		t.Fatalf("matched = %v", got.MatchedOption)
	}
}

func TestMatchOptionMissingInput(t *testing.T) {
	got, err := New(&fakeModel{}).MatchOption(context.Background(), "", []string{"x"}, "", "")
	if err != nil || got.MatchedOption != nil || got.Reason != "Missing value or options" {
		t.Fatalf("got %+v err %v", got, err)
	}
}

func TestAnswerAndExtractJD(t *testing.T) {
	svc := New(&fakeModel{replies: []string{
		`{"answers":[{"element_index":1,"value":" Hello. "}]}`,
		`{"hasJobDescription":true,"jobDescription":" Senior Go dev ","reason":""}`,
		`{"hasJobDescription":false,"jobDescription":null,"reason":""}`,
	}})
	qa, err := svc.Answer(context.Background(), "P", "Why?", nil)
	if err != nil || qa.Answer != "Hello." {
		t.Fatalf("qa = %+v err %v", qa, err)
	}
	jd, err := svc.ExtractJD(context.Background(), "page", nil)
	if err != nil || !jd.HasJobDescription || *jd.JobDescription != "Senior Go dev" || jd.Reason != "Job description found" {
		t.Fatalf("jd = %+v err %v", jd, err)
	}
	none, err := svc.ExtractJD(context.Background(), "page", nil)
	if err != nil || none.HasJobDescription || none.JobDescription != nil || none.Reason != noJDReason {
		t.Fatalf("none = %+v err %v", none, err)
	}
	if _, err := svc.ExtractJD(context.Background(), "", nil); err == nil {
		t.Error("no page text should fail")
	}
}

func TestMetaToPageText(t *testing.T) {
	tree := map[string]any{"tag": "div", "title": "Jobs", "url": "https://x", "children": []any{
		map[string]any{"tag": "h1", "text": "Go  Dev"},
		map[string]any{"tag": "button", "text": "Apply"},
		map[string]any{"tag": "p", "text": "Build things"},
	}}
	if got := MetaToPageText(tree); got != "Jobs\n\nhttps://x\n\nGo Dev Build things" {
		t.Errorf("tree text = %q", got)
	}
	if got := MetaToPageText(" plain "); got != "plain" {
		t.Errorf("string = %q", got)
	}
	if got := MetaToPageText(nil); got != "" {
		t.Errorf("nil = %q", got)
	}
}

func TestApplicantProfileText(t *testing.T) {
	text := ApplicantProfileText("u1", candidate.Profile{
		Name: "Jordan Q Lee", Email: "j@example.com", Authorization: "Authorized, no sponsorship",
		HomeAddress: candidate.HomeAddress{City: "Austin", Region: "TX"}, SalaryFloor: 120000, Currency: "USD",
		Experience: []candidate.ExperienceItem{{Role: "Engineer", Company: "Acme"}},
	})
	var parsed struct {
		Settings map[string]any `json:"settings"`
	}
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		t.Fatalf("profile text is not JSON: %v", err)
	}
	s := parsed.Settings
	if s["firstName"] != "Jordan" || s["lastName"] != "Lee" || s["city"] != "Austin" || s["desiredSalary"] != "120000 USD" {
		t.Errorf("settings = %v", s)
	}
	if s["phone"] != nil || s["linkedin"] != nil {
		t.Errorf("empty fields must be null: %v", s)
	}
	if strings.Contains(text, `<`) {
		t.Error("HTML must not be escaped")
	}
}
