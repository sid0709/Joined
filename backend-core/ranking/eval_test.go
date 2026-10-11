package ranking

import (
	"context"
	"math"
	"testing"
)

func TestNDCGAndRecall(t *testing.T) {
	if got := NDCG([]int{2, 1, 0}, []int{2, 1}, 10); math.Abs(got-1) > 1e-9 {
		t.Fatalf("ideal order NDCG = %v, want 1", got)
	}
	if got := NDCG([]int{0, 1, 2}, []int{2, 1}, 10); got >= 1 || got <= 0 {
		t.Fatalf("reversed order NDCG = %v, want between 0 and 1", got)
	}
	if got := NDCG([]int{0, 0}, nil, 10); got != 0 {
		t.Fatalf("nothing relevant NDCG = %v", got)
	}
	if got := Recall([]int{1, 0, 2, 0}, 4, 10); got != 0.5 {
		t.Fatalf("Recall = %v, want 0.5", got)
	}
}

func TestGoldenSetParsesAndCoversFamilies(t *testing.T) {
	cases, err := GoldenSet()
	if err != nil {
		t.Fatal(err)
	}
	if len(cases) < 50 {
		t.Fatalf("golden set has %d cases, want at least 50", len(cases))
	}
	tax := DefaultTaxonomy()
	for _, c := range cases {
		if c.Profile == nil && c.Query == "" {
			t.Errorf("case %q has neither a profile nor a query", c.Name)
		}
		for family := range c.Grades {
			if _, ok := tax.Occupation(family); !ok {
				t.Errorf("case %q grades unknown family %q", c.Name, family)
			}
		}
	}
}

func TestEvaluateRunsProfileCases(t *testing.T) {
	s, _ := newTestService(t, nil)
	cases, err := GoldenSet()
	if err != nil {
		t.Fatal(err)
	}
	report, err := s.Evaluate(context.Background(), cases)
	if err != nil {
		t.Fatal(err)
	}
	scored := 0
	for _, c := range report.Cases {
		if c.Skipped != "" {
			continue
		}
		scored++
		if c.NDCG < 0 || c.NDCG > 1 || c.Recall < 0 || c.Recall > 1 {
			t.Fatalf("case %q has out-of-range scores %+v", c.Name, c)
		}
		if c.Name == "profile: ml engineer" && c.NDCG < 0.8 {
			t.Fatalf("ML profile NDCG@10 = %.2f on the test catalog, want >= 0.8", c.NDCG)
		}
	}
	if scored == 0 || report.MeanNDCG <= 0 {
		t.Fatalf("no case was scored: %+v", report)
	}
}
