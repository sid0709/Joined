package jobs

import (
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestJobDirectoryRowDecodesTheNestedJob(t *testing.T) {
	when := time.Date(2026, 10, 3, 16, 26, 0, 0, time.UTC)
	id := bson.NewObjectID()
	raw, err := bson.Marshal(bson.D{
		{Key: "_id", Value: id},
		{Key: "tempJobId", Value: id.Hex()},
		{Key: "postedAt", Value: when},
		{Key: "applyLink", Value: "https://jobs.example/apply"},
		{Key: "analyzedAt", Value: when},
		{Key: "model", Value: "deepseek-flash"},
		{Key: "job", Value: bson.D{
			{Key: "id", Value: "pub1"},
			{Key: "title", Value: "Software Development Engineer II"},
			{Key: "company", Value: "NationsBenefits"},
			{Key: "location", Value: "Florida"},
			{Key: "workplace", Value: "remote"},
			{Key: "seniority", Value: "middle"},
			{Key: "employment", Value: "full_time"},
			{Key: "source", Value: "aggregated"},
			{Key: "pay", Value: bson.D{{Key: "min", Value: 0}, {Key: "max", Value: 0}, {Key: "currency", Value: "USD"}, {Key: "period", Value: "year"}}},
			{Key: "skills", Value: bson.A{"Go"}},
			{Key: "summary", Value: "Builds payments."},
		}},
		{Key: "completion", Value: 78},
	})
	if err != nil {
		t.Fatal(err)
	}

	var direct storedSearchJob
	if err := bson.Unmarshal(raw, &direct); err != nil {
		t.Fatal(err)
	}
	if direct.Job.Title != "Software Development Engineer II" || !direct.AnalyzedAt.Equal(when) {
		t.Fatalf("direct decode = title %q analyzed %s", direct.Job.Title, direct.AnalyzedAt)
	}

	var row struct {
		Record     storedSearchJob `bson:",inline"`
		Completion int             `bson:"completion"`
	}
	if err := bson.Unmarshal(raw, &row); err != nil {
		t.Fatal(err)
	}
	if row.Completion != 78 {
		t.Fatalf("completion = %d", row.Completion)
	}
	if row.Record.Job.Title != "Software Development Engineer II" || row.Record.Job.Company != "NationsBenefits" || row.Record.Job.Location != "Florida" {
		t.Fatalf("job decoded as %+v", row.Record.Job)
	}
	if !row.Record.AnalyzedAt.Equal(when) {
		t.Fatalf("analyzedAt = %s", row.Record.AnalyzedAt)
	}
	if row.Record.ID != id {
		t.Fatalf("id = %s", row.Record.ID.Hex())
	}
}

func TestStagedCompanyRowDecodesCopiedFields(t *testing.T) {
	raw, err := bson.Marshal(bson.D{
		{Key: "id", Value: "c1"},
		{Key: "sourceId", Value: "src1"},
		{Key: "companyName", Value: "NationsBenefits"},
		{Key: "companyUrl", Value: "https://nationsbenefits.com"},
		{Key: "companyLogo", Value: "https://logo.example/n.png"},
		{Key: "jobCount", Value: 12},
		{Key: "research", Value: bson.D{}},
	})
	if err != nil {
		t.Fatal(err)
	}
	var doc stagedCompanyDoc
	if err := bson.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	if doc.Company.CompanyName != "NationsBenefits" || doc.Company.CompanyURL != "https://nationsbenefits.com" || doc.Company.JobCount != 12 {
		t.Fatalf("decoded company = %+v", doc.Company)
	}
	row := StagedCompany{CompanySummary: doc.Company.summary(), Status: stagedStatus(doc.Research.Found)}
	if row.Name != "NationsBenefits" || row.URL != "https://nationsbenefits.com" || row.JobCount != 12 || row.Status != StagedWaiting {
		t.Fatalf("row = %+v", row)
	}
}
