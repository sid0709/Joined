package ranking

import (
	"reflect"
	"testing"
)

func TestTokensFoldAbbreviationsAndPlurals(t *testing.T) {
	got := Tokens("Sr. ML Engineers (Remote) – Node.js & C++ for the Analytics team")
	want := []string{"senior", "machine", "learning", "engineer", "remote", "node.js", "c++", "analytics"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Tokens = %v, want %v", got, want)
	}
	if got := Tokens("Développeur Émilie"); !reflect.DeepEqual(got, []string{"developpeur", "emilie"}) {
		t.Fatalf("accents not folded: %v", got)
	}
}

func TestDefaultTaxonomyParses(t *testing.T) {
	tax := DefaultTaxonomy()
	if len(tax.Occupations()) < 40 {
		t.Fatalf("occupations = %d, want a broad taxonomy", len(tax.Occupations()))
	}
	for _, occupation := range tax.Occupations() {
		if occupation.SOC == "" || occupation.Title == "" || len(occupation.Aliases) == 0 {
			t.Errorf("occupation %q is missing its SOC code, title, or aliases", occupation.ID)
		}
	}
}

func TestClassifyTitle(t *testing.T) {
	tax := DefaultTaxonomy()
	cases := map[string]string{
		"Senior Machine Learning Engineer":            "machine-learning",
		"AI/ML Engineer":                              "machine-learning",
		"Staff Software Engineer, Payments":           "software-engineering",
		"Senior Frontend Developer (React)":           "frontend-engineering",
		"Marketing Manager":                           "marketing-management",
		"Senior Product Marketing Manager":            "product-marketing",
		"Site Reliability Engineer (Senior or Staff)": "devops",
		"Data Scientist II":                           "data-science",
		"RN - ICU Night Shift":                        "nursing",
		"Account Executive, Mid-Market":               "sales",
		"Product Designer":                            "product-design",
	}
	for title, want := range cases {
		got := tax.ClassifyTitle(title)
		if len(got) == 0 || got[0] != want {
			t.Errorf("ClassifyTitle(%q) = %v, want first %q", title, got, want)
		}
	}
	if got := tax.ClassifyTitle("Untitled"); len(got) != 0 {
		t.Errorf("unknown title classified as %v", got)
	}
}

func TestOccupationAffinity(t *testing.T) {
	tax := DefaultTaxonomy()
	if got := tax.OccupationAffinity([]string{"machine-learning"}, []string{"machine-learning"}); got != 1 {
		t.Fatalf("same family = %v", got)
	}
	if got := tax.OccupationAffinity([]string{"machine-learning"}, []string{"data-science"}); got != relatedAffinity {
		t.Fatalf("related family = %v", got)
	}
	if got := tax.OccupationAffinity([]string{"machine-learning"}, []string{"nursing"}); got != 0 {
		t.Fatalf("unrelated family = %v", got)
	}
}

func TestSkills(t *testing.T) {
	tax := DefaultTaxonomy()
	got := tax.SkillIDs([]string{"ReactJS", "react", "K8s", "Amazon Web Services", "Terraform Cloud", ""})
	want := []string{"react", "kubernetes", "aws", "terraform cloud"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("SkillIDs = %v, want %v", got, want)
	}
	if got := tax.SkillsIn("remote senior python engineer with machine learning and react native"); !reflect.DeepEqual(got, []string{"python", "machine-learning", "react-native"}) {
		t.Fatalf("SkillsIn = %v", got)
	}
}

// genericTitleWords name no family on their own; an alias that folds down to one
// of them would claim every "... Manager" or "... Engineer" title.
var genericTitleWords = map[string]bool{
	"manager": true, "engineer": true, "developer": true, "director": true, "analyst": true,
	"specialist": true, "administrator": true, "technician": true, "support": true, "lead": true,
	"associate": true, "coordinator": true, "senior": true, "head": true, "officer": true,
}

func TestNoAliasFoldsToAGenericWord(t *testing.T) {
	for _, occupation := range DefaultTaxonomy().Occupations() {
		for _, alias := range append([]string{occupation.Title}, occupation.Aliases...) {
			phrase := Phrase(alias)
			if phrase == "" || genericTitleWords[phrase] {
				t.Errorf("%s alias %q folds to %q", occupation.ID, alias, phrase)
			}
		}
	}
	if got := DefaultTaxonomy().ClassifyTitle("Customer Success Manager"); len(got) != 1 || got[0] != "customer-success" {
		t.Fatalf("Customer Success Manager = %v", got)
	}
}

func TestAmbiguousShorthandIsNotExpanded(t *testing.T) {
	tax := DefaultTaxonomy()
	if got := tax.ClassifyTitle("DevOps Engineer (2 PM - 11 PM)"); len(got) == 0 || got[0] != "devops" || containsValue(got, "product-management") {
		t.Fatalf("a shift time is not a product manager: %v", got)
	}
	for _, term := range Tokens("React Native, RN Skia") {
		if term == "nurse" || term == "registered" {
			t.Fatalf("RN (React Native) expanded into %q", term)
		}
	}
	if got := tax.ClassifyTitle("RN - ICU Night Shift"); len(got) == 0 || got[0] != "nursing" {
		t.Fatalf("an RN title is still a nurse: %v", got)
	}
	for _, term := range Tokens("You will be responsible for the CV pipeline") {
		if term == "backend" || term == "computer" {
			t.Fatalf("ordinary words expanded into %q", term)
		}
	}
}
