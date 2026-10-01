package jobschema

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"
)

type enumFile struct {
	Currency         string            `json:"currency"`
	Currencies       []string          `json:"currencies"`
	Workplace        []enumOption      `json:"workplace"`
	Seniority        []enumOption      `json:"seniority"`
	Employment       []enumOption      `json:"employment"`
	PayPeriod        []enumOption      `json:"payPeriod"`
	SeniorityAliases map[string]string `json:"seniorityAliases"`
	Industries       []string          `json:"industries"`
	CompanyTypes     []string          `json:"companyTypes"`
	CompanySizes     []string          `json:"companySizes"`
	ValueIcons       []string          `json:"valueIcons"`
	MaxBenefits      int               `json:"maxBenefits"`
}

type enumOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

func TestEnumsMatchSharedFile(t *testing.T) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("caller")
	}
	raw, err := os.ReadFile(filepath.Join(filepath.Dir(file), "..", "..", "packages", "job-schema", "enums.json"))
	if err != nil {
		t.Fatal(err)
	}
	var shared enumFile
	if err := json.Unmarshal(raw, &shared); err != nil {
		t.Fatal(err)
	}
	if shared.Currency != CurrencyUSD {
		t.Fatalf("currency = %q", shared.Currency)
	}
	if !reflect.DeepEqual(shared.Currencies, Currencies()) {
		t.Fatalf("currencies = %v", shared.Currencies)
	}
	if got := values(shared.Workplace); !reflect.DeepEqual(got, Workplaces()) {
		t.Fatalf("workplaces = %v", got)
	}
	if got := values(shared.Seniority); !reflect.DeepEqual(got, Seniorities()) {
		t.Fatalf("seniorities = %v", got)
	}
	if got := values(shared.Employment); !reflect.DeepEqual(got, Employments()) {
		t.Fatalf("employments = %v", got)
	}
	if got := values(shared.PayPeriod); !reflect.DeepEqual(got, PayPeriods()) {
		t.Fatalf("pay periods = %v", got)
	}
	if !reflect.DeepEqual(shared.SeniorityAliases, seniorityAliases) {
		t.Fatalf("aliases = %#v", shared.SeniorityAliases)
	}
	if shared.MaxBenefits != MaxBenefits {
		t.Fatalf("max benefits = %d", shared.MaxBenefits)
	}
	for name, pair := range map[string][2][]string{
		"industries":    {shared.Industries, Industries()},
		"company types": {shared.CompanyTypes, CompanyTypes()},
		"company sizes": {shared.CompanySizes, CompanySizes()},
		"value icons":   {shared.ValueIcons, ValueIcons()},
	} {
		if !reflect.DeepEqual(pair[0], pair[1]) {
			t.Fatalf("%s = %v", name, pair[0])
		}
	}
}

func TestCanonicalSeniorityAcceptsLegacyNames(t *testing.T) {
	cases := map[string]string{
		"entry":   SeniorityJunior,
		"Junior":  SeniorityJunior,
		"mid":     SeniorityMiddle,
		"senior":  SenioritySenior,
		"lead":    SeniorityLeader,
		"Leader":  SeniorityLeader,
		"manager": SeniorityManager,
	}
	for input, want := range cases {
		got, ok := CanonicalSeniority(input)
		if !ok || got != want {
			t.Errorf("CanonicalSeniority(%q) = %q, %v", input, got, ok)
		}
	}
	if _, ok := CanonicalSeniority("intern-track"); ok {
		t.Fatal("unknown level was accepted")
	}
}

func values(options []enumOption) []string {
	out := make([]string, len(options))
	for i, option := range options {
		out[i] = option.Value
	}
	return out
}

func TestCompanyEnumsEndWithOtherAndFoldUnknownValues(t *testing.T) {
	for name, list := range map[string][]string{"industries": Industries(), "types": CompanyTypes(), "sizes": CompanySizes()} {
		if list[len(list)-1] != Other {
			t.Fatalf("%s do not end with Other: %v", name, list)
		}
	}
	if got := CanonicalOrOther(" software ", Industries()); got != "Software" {
		t.Fatalf("got %q", got)
	}
	if got := CanonicalOrOther("Fintech", Industries()); got != Other {
		t.Fatalf("got %q", got)
	}
	if got := CanonicalOrOther("  ", Industries()); got != "" {
		t.Fatalf("blank became %q", got)
	}
}
