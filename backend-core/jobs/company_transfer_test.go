package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

const transferCompanyID = "11111111-1111-4111-8111-111111111111"

func TestCompanyTransferKeepsEmptyFieldsNull(t *testing.T) {
	raw, err := json.Marshal(companyTransferFrom(storedCompany{
		ID:          transferCompanyID,
		CompanyName: "Acme",
		CompanyURL:  "acme.example",
	}))
	if err != nil {
		t.Fatal(err)
	}
	var probe map[string]any
	if err := json.Unmarshal(raw, &probe); err != nil {
		t.Fatal(err)
	}
	if probe["name"] != "Acme" || probe["url"] != "acme.example" {
		t.Fatalf("identity = %v", probe)
	}
	for _, key := range []string{"logo", "tagline", "about", "industry", "size", "founded", "replyDays", "headquarters", "companyType", "locations", "specialties", "mission", "values", "benefitCategories"} {
		value, ok := probe[key]
		if !ok || value != nil {
			t.Fatalf("%s = %#v, present %v", key, value, ok)
		}
	}
}

func TestParseCompanyTransfersRejectsABadFile(t *testing.T) {
	about := "Acme builds tools."
	valid := CompanyTransfer{ID: transferCompanyID, Name: textPtr("Acme"), About: &about}
	raw, err := json.Marshal([]CompanyTransfer{valid})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := parseCompanyTransfers(raw); err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{
		`{"id":"` + transferCompanyID + `"}`,
		`[]`,
		`[{"id":"not-an-id","name":"Acme"}]`,
		`[{"id":"` + transferCompanyID + `","name":null}]`,
		`[{"id":"` + transferCompanyID + `","name":"Acme","size":"huge"}]`,
		`[{"id":"` + transferCompanyID + `","name":"Acme","note":"x"}]`,
	} {
		if _, err := parseCompanyTransfers([]byte(body)); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("%s: err = %v", body, err)
		}
	}
}

func TestImportStagedCompanyPublishesAndLeavesStaging(t *testing.T) {
	store, _, _, _ := crawlerTestStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	if _, err := store.stagedCompanies().InsertOne(ctx, bson.D{
		{Key: "id", Value: transferCompanyID},
		{Key: "sourceId", Value: "athens-1"},
		{Key: "companyName", Value: "Acme"},
		{Key: "companyUrl", Value: "acme.example"},
	}); err != nil {
		t.Fatalf("seed: %v", err)
	}
	rows, err := store.ExportStagedCompanies(ctx)
	if err != nil || len(rows) != 1 || rows[0].About != nil || rows[0].Name == nil || *rows[0].Name != "Acme" {
		t.Fatalf("export = %+v, err = %v", rows, err)
	}
	about := "Acme builds tools."
	rows[0].About = &about
	missing := rows[0]
	missing.ID = "22222222-2222-4222-8222-222222222222"
	missing.Name = textPtr("Other")
	raw, err := json.Marshal([]CompanyTransfer{rows[0], missing})
	if err != nil {
		t.Fatal(err)
	}
	result, err := store.ImportStagedCompanies(ctx, raw)
	if err != nil {
		t.Fatal(err)
	}
	if result.Published != 1 || len(result.Unmatched) != 1 || result.Unmatched[0] != missing.ID {
		t.Fatalf("result = %+v", result)
	}
	if left, err := store.stagedCompanies().CountDocuments(ctx, bson.D{}); err != nil || left != 0 {
		t.Fatalf("staged left = %d, err = %v", left, err)
	}
	var published storedCompany
	if err := store.companies().FindOne(ctx, bson.D{{Key: "id", Value: transferCompanyID}}).Decode(&published); err != nil {
		t.Fatal(err)
	}
	if published.publicCompany().About != about || published.displayName() != "Acme" {
		t.Fatalf("published = %+v", published.publicCompany())
	}
	var saved struct {
		Research struct {
			Found bool   `bson:"found"`
			Model string `bson:"model"`
		} `bson:"research"`
	}
	if err := store.companies().FindOne(ctx, bson.D{{Key: "id", Value: transferCompanyID}}).Decode(&saved); err != nil {
		t.Fatal(err)
	}
	if !saved.Research.Found || saved.Research.Model != companyImportModel {
		t.Fatalf("research = %+v", saved.Research)
	}
}

func TestImportDoesNotPublishAnInvalidFile(t *testing.T) {
	raw := []byte(`[{"id":"` + transferCompanyID + `","name":"Acme","size":"huge"}]`)
	if _, err := parseCompanyTransfers(raw); err == nil || !strings.Contains(err.Error(), "size") {
		t.Fatalf("err = %v", err)
	}
}
