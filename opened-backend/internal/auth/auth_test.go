package auth

import "testing"

func TestNormalizeSignupRejectsShortPassword(t *testing.T) {
	_, err := normalizeSignup(Signup{Name: "Ada Lovelace", Email: "ada@example.com", Password: "short"})
	if err != ErrInvalidInput {
		t.Fatalf("err = %v", err)
	}
}

func TestNormalizeSignupLowercasesEmail(t *testing.T) {
	got, err := normalizeSignup(Signup{Name: "Ada Lovelace", Email: " Ada@Example.com ", Password: "long-enough"})
	if err != nil {
		t.Fatal(err)
	}
	if got.Email != "ada@example.com" || got.Name != "Ada Lovelace" {
		t.Fatalf("signup = %+v", got)
	}
}

func TestNormalizeSignupEmployeeRequiresCompany(t *testing.T) {
	_, err := normalizeSignup(Signup{
		Name:     "Ada Lovelace",
		Email:    "ada@example.com",
		Password: "long-enough",
		Mode:     modeEmployee,
	})
	if err != ErrInvalidInput {
		t.Fatalf("employee without company = %v", err)
	}
	got, err := normalizeSignup(Signup{
		Name:     "Ada Lovelace",
		Email:    "ada@example.com",
		Password: "long-enough",
		Mode:     modeCandidate,
		Company:  &CompanyChoice{Name: "Northwind"},
	})
	if err != nil || got.Company != nil || got.Mode != modeCandidate {
		t.Fatalf("candidate = %+v %v", got, err)
	}
}

func TestRemovesCompanyOnlyForCreator(t *testing.T) {
	if !removesCompany("user-1", "user-1") {
		t.Fatal("creator should remove the company")
	}
	if removesCompany("", "user-1") || removesCompany("user-2", "user-1") {
		t.Fatal("linking or another owner should leave the company")
	}
}

func TestNormalizeCompanyRequiresOnePath(t *testing.T) {
	if _, err := normalizeCompany(CompanyChoice{}); err != ErrInvalidInput {
		t.Fatalf("empty = %v", err)
	}
	if _, err := normalizeCompany(CompanyChoice{ID: "4f1c0b3a-6d2e-4a18-8c77-1b9e0d4a6f21", Name: "Northwind"}); err != ErrInvalidInput {
		t.Fatalf("both = %v", err)
	}
	got, err := normalizeCompany(CompanyChoice{Name: "Northwind", URL: "northwind.example"})
	if err != nil || got.URL != "https://northwind.example" {
		t.Fatalf("create = %+v %v", got, err)
	}
}

func TestPasswordRoundTrip(t *testing.T) {
	hash, err := hashPassword("long-enough")
	if err != nil {
		t.Fatal(err)
	}
	if !checkPassword(hash, "long-enough") || checkPassword(hash, "wrong-password") {
		t.Fatal("password check mismatch")
	}
}
