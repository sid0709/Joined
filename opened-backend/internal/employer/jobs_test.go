package employer

import (
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/jobschema"
)

func TestNormalizeJobStoresCurrencyAndLists(t *testing.T) {
	got, err := normalizeJob(JobInput{
		Title:            "Product Designer",
		Team:             " Design ",
		Location:         "Chicago, IL",
		Workplace:        jobschema.WorkplaceHybrid,
		PayMin:           130000,
		PayMax:           160000,
		Currency:         "eur",
		Summary:          "Shape the product.",
		Skills:           []string{"Figma", "figma", "Research", "Prototyping"},
		Responsibilities: []string{" Ship files "},
		Requirements:     []string{"Portfolio"},
		Description:      "Full posting.",
		Status:           statusOpen,
	}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if got.Currency != jobschema.CurrencyEUR || got.Team != "Design" || got.Policy != policyAccept {
		t.Fatalf("job = %+v", got)
	}
	if len(got.Skills) != 3 || got.Skills[0] != "Figma" {
		t.Fatalf("skills = %v", got.Skills)
	}
	if len(got.Responsibilities) != 1 || got.Description != "Full posting." {
		t.Fatalf("copy = %+v", got)
	}
}

func TestReplaceTeamRenamesAndDedupes(t *testing.T) {
	got := replaceTeam([]string{"Design", "Data"}, "Data", "Analytics")
	if len(got) != 2 || got[0] != "Design" || got[1] != "Analytics" {
		t.Fatalf("got = %v", got)
	}
}
