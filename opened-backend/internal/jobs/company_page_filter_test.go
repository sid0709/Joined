package jobs

import "testing"

func TestCompanyPageFilterByDepartmentAndLocation(t *testing.T) {
	page := CompanyPage{Jobs: []catalogJob{
		{SearchJob: SearchJob{ID: "1", Team: "Design", Location: "NYC"}},
		{SearchJob: SearchJob{ID: "2", Team: "Data", Location: "Austin"}},
		{SearchJob: SearchJob{ID: "3", Team: "Design", Location: "Austin"}},
	}}
	if got := page.Filtered("  ", ""); len(got.Jobs) != 3 {
		t.Fatalf("blank filter = %d", len(got.Jobs))
	}
	byTeam := page.Filtered(" design ", "")
	if len(byTeam.Jobs) != 2 || byTeam.Jobs[0].ID != "1" || byTeam.Jobs[1].ID != "3" {
		t.Fatalf("department = %+v", byTeam.Jobs)
	}
	both := page.Filtered("Design", "austin")
	if len(both.Jobs) != 1 || both.Jobs[0].ID != "3" {
		t.Fatalf("both = %+v", both.Jobs)
	}
	none := page.Filtered("Nope", "")
	if none.Jobs == nil || len(none.Jobs) != 0 {
		t.Fatalf("none = %#v", none.Jobs)
	}
	if len(page.Jobs) != 3 {
		t.Fatal("filter mutated the source page")
	}
}
