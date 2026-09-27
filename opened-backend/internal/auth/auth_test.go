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
