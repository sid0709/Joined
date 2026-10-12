package jobs

import (
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestListingPromptIncludesExtraMetadata(t *testing.T) {
	listing := tempListing{
		Title:       "Engineer",
		CompanyName: "Acme",
		Description: "Build things.",
	}
	listing.Metadata.Details.Location = "Remote"
	listing.Metadata.Details.Remote = "remote"
	listing.Metadata.Details.Seniority = "Senior"
	listing.Metadata.Details.Time = "full-time"
	listing.Metadata.Details.Salary = "$150K"
	listing.Metadata.Extra = bson.M{
		"workMode":    "remote",
		"badges":      []string{"Early applicant"},
		"companySize": "51-200",
	}

	prompt := listingPrompt(listing)
	if !strings.Contains(prompt, "Location hint: Remote") || !strings.Contains(prompt, "Workplace hint: remote") {
		t.Fatalf("missing analyzer hints:\n%s", prompt)
	}
	if !strings.Contains(prompt, "Extra metadata:") || !strings.Contains(prompt, "Early applicant") {
		t.Fatalf("missing extra metadata hint:\n%s", prompt)
	}
	if strings.Count(prompt, "workMode") != 0 {
		t.Fatalf("extra hint should skip fields already in details:\n%s", prompt)
	}
}
