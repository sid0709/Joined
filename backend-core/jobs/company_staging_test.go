package jobs

import (
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestFoundProfileNeedsMoreThanANameAndWebsite(t *testing.T) {
	for _, tc := range []struct {
		name    string
		company CompanyWrite
		want    bool
	}{
		{"name and website only", CompanyWrite{Name: "Acme", URL: "https://acme.example"}, false},
		{"tagline only", CompanyWrite{Name: "Acme", Tagline: "Payments"}, false},
		{"about", CompanyWrite{About: "Acme moves money."}, true},
		{"industry", CompanyWrite{Industry: "Fintech"}, true},
		{"size", CompanyWrite{Size: "51-200"}, true},
	} {
		if got := foundProfile(tc.company); got != tc.want {
			t.Errorf("%s: foundProfile = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestUnresearchedCopyKeepsPublishedAndOwnedCompanies(t *testing.T) {
	filter := unresearchedCopy()
	keys := map[string]bool{}
	for _, element := range filter {
		keys[element.Key] = true
	}
	for _, key := range []string{"sourceId", researchFoundField, "verificationStatus", "createdBy", "claimed"} {
		if !keys[key] {
			t.Errorf("filter does not check %s: %v", key, filter)
		}
	}
}

func TestWithoutFieldsKeepsEveryOtherField(t *testing.T) {
	doc := bson.D{{Key: "_id", Value: bson.NewObjectID()}, {Key: "id", Value: "c1"}, {Key: "research", Value: bson.D{}}, {Key: "sourceId", Value: "s1"}}
	got := withoutFields(doc, "_id", "research")
	if len(got) != 2 || stringField(got, "id") != "c1" || stringField(got, "sourceId") != "s1" {
		t.Fatalf("withoutFields = %v", got)
	}
	if stringField(got, "_id") != "" || stringField(got, "missing") != "" {
		t.Fatalf("unexpected field in %v", got)
	}
}
