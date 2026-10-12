package deepseek

import "testing"

func TestApproachForSortsTheThreeLanes(t *testing.T) {
	cases := []struct{ model, want string }{
		{"openai/gpt-6-luna", ApproachChat},
		{"openai/gpt-6-luna:nitro", ApproachChat},
		{"perplexity/sonar-pro", ApproachChat},
		{"openai/gpt-6-luna:batch", ApproachBatch},
		{"anthropic/claude-sonnet-5:batch", ApproachBatch},
		{"typesafe/jev-1.13", ApproachDecisions},
		{"openai/gpt-decision", ApproachDecisions},
		{"perplexity/pplx-decision", ApproachDecisions},
	}
	for _, tc := range cases {
		if got := ApproachFor(tc.model); got != tc.want {
			t.Errorf("ApproachFor(%q) = %q, want %q", tc.model, got, tc.want)
		}
	}
}

func TestNativeSearchIsPerplexitySonarOnly(t *testing.T) {
	if !IsNativeSearch("perplexity/sonar-pro") || !IsNativeSearch("Perplexity/Sonar") {
		t.Fatal("sonar should search on its own")
	}
	if IsNativeSearch("perplexity/pplx-decision") || IsNativeSearch("openai/gpt-6-luna") || IsNativeSearch("perplexity/sonar:batch") {
		t.Fatal("only the perplexity sonar chat model is native search")
	}
}

func TestCheckApproachRejectsAMismatchedModel(t *testing.T) {
	if err := CheckApproach(ApproachChat, "openai/gpt-6-luna"); err != nil {
		t.Fatal(err)
	}
	if err := CheckApproach(ApproachChat, "openai/gpt-6-luna:batch"); err == nil {
		t.Fatal("batch model on chat")
	}
	if err := CheckApproach(ApproachChat, "typesafe/jev-1.13"); err == nil {
		t.Fatal("decision model on chat")
	}
	if err := CheckApproach(ApproachBatch, "openai/gpt-6-luna"); err == nil {
		t.Fatal("chat model on batch")
	}
	if err := CheckApproach(ApproachBatch, "google/gemini-2.5-flash:batch"); err != nil {
		t.Fatal(err)
	}
	if err := CheckApproach(ApproachDecisions, "typesafe/jev-1.13"); err != nil {
		t.Fatal(err)
	}
	if err := CheckApproach(ApproachDecisions, "openai/gpt-decision"); err != nil {
		t.Fatal(err)
	}
	if err := CheckApproach("embed", "openai/gpt-6-luna"); err == nil {
		t.Fatal("unknown approach")
	}
}
