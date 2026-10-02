package auth

import "testing"

func TestAllowsAudienceKeepsRolesApart(t *testing.T) {
	if !AllowsAudience(AudienceJoined, RoleCandidate) || !AllowsAudience(AudienceJoined, RoleEmployee) {
		t.Fatal("joined should accept hunters and recruiters")
	}
	if AllowsAudience(AudienceJoined, RoleScout) || AllowsAudience(RoleScout, RoleCandidate) || AllowsAudience(RoleScout, RoleEmployee) {
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
