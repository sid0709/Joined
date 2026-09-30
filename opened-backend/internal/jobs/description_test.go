package jobs

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestSaveSearchJobRequiresOriginalDescription(t *testing.T) {
	// The check runs before any database call, so a zero Store is enough.
	var s Store
	for _, description := range []string{"", "   \n\t"} {
		err := s.saveSearchJob(context.Background(), storedSearchJob{Job: SearchJob{Description: description}})
		if !errors.Is(err, ErrMissingDescription) {
			t.Fatalf("description %q: err = %v, want ErrMissingDescription", description, err)
		}
	}
}

func TestOriginalDescriptionIsTrimmedAndCapped(t *testing.T) {
	if got := originalDescription("  Build things.\n"); got != "Build things." {
		t.Fatalf("got %q", got)
	}
	long := strings.Repeat("a", maxDescriptionRunes+50)
	if got := originalDescription(long); len([]rune(got)) > maxDescriptionRunes {
		t.Fatalf("kept %d runes, want at most %d", len([]rune(got)), maxDescriptionRunes)
	}
}

func TestScoutedListingLeavesSkillsAndVisaToTheModel(t *testing.T) {
	listing := tempListing{Source: ScoutedSource, Title: "Engineer", CompanyName: "Acme"}
	job := keepScoutFilled(SearchJob{Skills: []string{"Go", "SQL"}, Visa: true}, listing)
	if len(job.Skills) != 2 || !job.Visa {
		t.Fatalf("model output was overwritten: skills = %v visa = %v", job.Skills, job.Visa)
	}
}
