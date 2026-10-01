package candidate

import "testing"

func TestMatchOpenApplicationRequiresUniqueName(t *testing.T) {
	apps := []Application{
		{ID: "1", Title: "Product Designer", Company: "Northwind", ColumnID: StageApplied},
		{ID: "2", Title: "Data Analyst", Company: "Harbor", ColumnID: StageApplied},
	}
	hit, ok := MatchOpenApplication("Interview with Northwind", "Product Designer round 1", apps)
	if !ok || hit.ID != "1" {
		t.Fatalf("expected Northwind, got %+v %v", hit, ok)
	}
	if _, ok := MatchOpenApplication("Lunch", "no company here", apps); ok {
		t.Fatal("unrelated event must not match")
	}
}

func TestMatchOpenApplicationIgnoresClosed(t *testing.T) {
	apps := []Application{
		{ID: "1", Title: "Designer", Company: "Northwind", ColumnID: StageClosed},
	}
	if _, ok := MatchOpenApplication("Northwind Designer interview", "", apps); ok {
		t.Fatal("closed applications are not open matches")
	}
}

func TestMatchOpenApplicationAmbiguousCompany(t *testing.T) {
	apps := []Application{
		{ID: "1", Title: "Designer", Company: "Northwind", ColumnID: StageApplied},
		{ID: "2", Title: "Engineer", Company: "Northwind", ColumnID: StageApplied},
	}
	if _, ok := MatchOpenApplication("Northwind chat", "", apps); ok {
		t.Fatal("two Northwind apps must not match on company alone")
	}
	hit, ok := MatchOpenApplication("Northwind Engineer screen", "", apps)
	if !ok || hit.ID != "2" {
		t.Fatalf("role+company should unique-match, got %+v %v", hit, ok)
	}
}
