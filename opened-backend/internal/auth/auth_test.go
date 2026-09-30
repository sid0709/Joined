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
		Mode:     RoleEmployee,
	})
	if err != ErrInvalidInput {
		t.Fatalf("employee without company = %v", err)
	}
	got, err := normalizeSignup(Signup{
		Name:     "Ada Lovelace",
		Email:    "ada@example.com",
		Password: "long-enough",
		Mode:     RoleCandidate,
		Company:  &CompanyChoice{Name: "Northwind"},
	})
	if err != nil || got.Company != nil || got.Mode != RoleCandidate {
		t.Fatalf("candidate = %+v %v", got, err)
	}
}

func TestNormalizeSignupScoutHasNoCompany(t *testing.T) {
	_, err := normalizeSignup(Signup{
		Name:     "Ada Lovelace",
		Email:    "ada@example.com",
		Password: "long-enough",
		Mode:     RoleScout,
		Company:  &CompanyChoice{Name: "Northwind"},
	})
	if err != ErrInvalidInput {
		t.Fatalf("scout with company = %v", err)
	}
	got, err := normalizeSignup(Signup{
		Name:     "Ada Lovelace",
		Email:    "ada@example.com",
		Password: "long-enough",
		Mode:     RoleScout,
	})
	if err != nil || got.Mode != RoleScout || got.Company != nil {
		t.Fatalf("scout = %+v %v", got, err)
	}
}

func TestAllowsAudienceKeepsRolesApart(t *testing.T) {
	if !AllowsAudience(AudienceOpened, RoleCandidate) || !AllowsAudience(AudienceOpened, RoleEmployee) {
		t.Fatal("opened should accept hunters and recruiters")
	}
	if AllowsAudience(AudienceOpened, RoleScout) || AllowsAudience(RoleScout, RoleCandidate) || AllowsAudience(RoleScout, RoleEmployee) {
		t.Fatal("a role should not sign in to the other app")
	}
	if !AllowsAudience(RoleScout, RoleScout) {
		t.Fatal("a scout should sign in to scoutwell")
	}
}

func TestValidHiringRoleAcceptsEinsteinRoles(t *testing.T) {
	for _, role := range []string{"admin", "recruiter", "viewer", "hiring_manager", "interviewer", "finance"} {
		if !validHiringRole(role) {
			t.Fatalf("%s should be a hiring role", role)
		}
	}
	for _, role := range []string{"owner", "hm", "hiring-manager", "", "superadmin"} {
		if validHiringRole(role) {
			t.Fatalf("%s should not be stored as a hiring role", role)
		}
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
