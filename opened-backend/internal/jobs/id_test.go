package jobs

import "testing"

func TestNewPublicIDIsOpaque(t *testing.T) {
	first, err := newPublicID()
	if err != nil {
		t.Fatal(err)
	}
	second, err := newPublicID()
	if err != nil {
		t.Fatal(err)
	}
	if first == second || !isPublicID(first) || !isPublicID(second) {
		t.Fatalf("ids = %q %q", first, second)
	}
	if isPublicID("senior-devops-cyberproof-17cbc3") || isPublicID("") {
		t.Fatal("slug ids must not pass as public ids")
	}
}
