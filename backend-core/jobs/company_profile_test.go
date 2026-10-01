package jobs

import "testing"

func TestPublicCompanyPrefersAdminOverrides(t *testing.T) {
	name := "Acme"
	cleared := ""
	doc := storedCompany{
		ID:          "9c0e1a55-2b7d-4f3a-9d11-6a4c8e2b7d30",
		CompanyName: "Old Name",
		CompanyURL:  "https://old.example",
		CompanyLogo: "https://cdn.example/logo.png",
		JobCount:    4,
		Overrides: companyOverrides{
			Name: &name,
			URL:  &cleared,
			Profile: companyProfile{
				Industry: "Software",
				Founded:  2014,
				Values:   []companyValue{{Icon: "heart", Title: "Care"}},
			},
		},
	}

	got := doc.publicCompany()
	if got.Name != "Acme" || got.URL != "" || got.Logo != "https://cdn.example/logo.png" {
		t.Fatalf("identity = %+v", got)
	}
	if got.Industry != "Software" || got.Founded != 2014 || len(got.Values) != 1 {
		t.Fatalf("profile = %+v", got)
	}
	admin := doc.adminCompany()
	if admin.JobCount != 4 || admin.Name != "Acme" {
		t.Fatalf("admin = %+v", admin)
	}
}

func TestOverridesFromRejectsBlankNameAndBadYear(t *testing.T) {
	if _, err := overridesFrom(CompanyWrite{Name: "  "}); err != ErrInvalidInput {
		t.Fatalf("blank name err = %v", err)
	}
	if _, err := overridesFrom(CompanyWrite{Name: "Acme", Founded: 20}); err != ErrInvalidInput {
		t.Fatalf("founded err = %v", err)
	}
	if _, err := overridesFrom(CompanyWrite{Name: "Acme", URL: "not a url"}); err != ErrInvalidInput {
		t.Fatalf("url err = %v", err)
	}
}

func TestOverridesFromCleansProfile(t *testing.T) {
	got, err := overridesFrom(CompanyWrite{
		Name:        "  Acme  ",
		URL:         "acme.example",
		Size:        "11–50",
		Specialties: []string{" Design ", "Design", ""},
		Values: []companyValue{
			{Icon: "nope", Title: " Craft ", Description: " Make it well "},
			{Title: ""},
		},
		BenefitCategories: []benefitCategory{{Label: "Health", Items: []string{"Medical"}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if *got.Name != "Acme" || *got.URL != "acme.example" {
		t.Fatalf("identity = %+v", got)
	}
	if got.Profile.Size != "11–50" || len(got.Profile.Specialties) != 1 || got.Profile.Specialties[0] != "Design" {
		t.Fatalf("profile lists = %+v", got.Profile)
	}
	if len(got.Profile.Values) != 1 || got.Profile.Values[0].Icon != "star" || got.Profile.Values[0].Title != "Craft" {
		t.Fatalf("values = %+v", got.Profile.Values)
	}
	if len(got.Profile.BenefitCategories) != 1 {
		t.Fatalf("groups = %+v", got.Profile)
	}
	if len(got.Profile.Perks) != 0 {
		t.Fatalf("perks = %+v", got.Profile.Perks)
	}
}

func TestPublicCompanyFoldsLegacyPerks(t *testing.T) {
	doc := storedCompany{
		ID: "9c0e1a55-2b7d-4f3a-9d11-6a4c8e2b7d30",
		Overrides: companyOverrides{
			Profile: companyProfile{
				BenefitCategories: []benefitCategory{{Label: "Health", Items: []string{"Medical"}}},
				Perks:             []string{"Remote-first", "Medical"},
			},
		},
		LogoFile: logoFile{ContentType: "image/png"},
	}
	got := doc.publicCompany()
	if !got.HasLogoFile || len(got.BenefitCategories) != 2 {
		t.Fatalf("folded = %+v", got)
	}
	perks := got.BenefitCategories[1]
	if perks.Label != "Perks" || len(perks.Items) != 1 || perks.Items[0] != "Remote-first" {
		t.Fatalf("perks category = %+v", perks)
	}
}

func TestLinkedInLogoHost(t *testing.T) {
	if !linkedInLogoHost("media.licdn.com") || !linkedInLogoHost("static.licdn.com") {
		t.Fatal("expected LinkedIn CDN hosts")
	}
	if linkedInLogoHost("encrypted-tbn0.gstatic.com") || linkedInLogoHost("blacksmith.agency") {
		t.Fatal("expected non-LinkedIn hosts to fetch as the logo URL")
	}
}

func TestLogoContentType(t *testing.T) {
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}
	if LogoContentType(png) != "image/png" {
		t.Fatalf("png = %q", LogoContentType(png))
	}
	if LogoContentType([]byte("not an image")) != "" {
		t.Fatal("expected plain text to be rejected")
	}
}

func TestApplyTempFieldsUpdatesHintsAndKeepsUnparsedPay(t *testing.T) {
	job := SearchJob{
		Title:      "Old",
		Company:    "Old Co",
		Location:   "Austin",
		Workplace:  workplaceRemote,
		Seniority:  senioritySenior,
		Employment: employmentFullTime,
		Pay:        Pay{Min: 100000, Max: 120000, Currency: "USD", Period: payYear},
	}
	kept := applyTempFields(job, TempJobPatch{
		Title:       "New title",
		CompanyName: "New Co",
		Salary:      "Competitive",
	})
	if kept.Title != "New title" || kept.Company != "New Co" || kept.Pay.Min != 100000 || kept.Workplace != workplaceRemote {
		t.Fatalf("kept = %+v", kept)
	}

	updated := applyTempFields(job, TempJobPatch{
		Location:  "Chicago",
		Remote:    "Hybrid",
		Seniority: "Staff Engineer",
		Time:      "Part-time",
		Salary:    "$45 - $60 / hr",
	})
	if updated.Location != "Chicago" || updated.Workplace != workplaceHybrid || updated.Seniority != seniorityLeader || updated.Employment != employmentPartTime {
		t.Fatalf("hints = %+v", updated)
	}
	if updated.Pay.Min != 45 || updated.Pay.Max != 60 || updated.Pay.Period != payHour {
		t.Fatalf("pay = %+v", updated.Pay)
	}
}

func TestNormalizeTempPatchRequiresTitleAndCompany(t *testing.T) {
	if _, err := normalizeTempPatch(TempJobPatch{Title: "Role"}); err != ErrInvalidInput {
		t.Fatalf("err = %v", err)
	}
	got, err := normalizeTempPatch(TempJobPatch{Title: " Role ", CompanyName: " Acme "})
	if err != nil || got.Title != "Role" || got.CompanyName != "Acme" {
		t.Fatalf("got = %+v err = %v", got, err)
	}
}
