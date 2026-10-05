package account

import "testing"

func TestGoogleLink(t *testing.T) {
	link, err := googleLink("", "subject-1")
	if err != nil || !link {
		t.Fatalf("first visit link=%v err=%v", link, err)
	}
	link, err = googleLink("subject-1", "subject-1")
	if err != nil || link {
		t.Fatalf("same subject link=%v err=%v", link, err)
	}
	if _, err = googleLink("subject-1", "subject-2"); err != ErrGoogleMismatch {
		t.Fatalf("different subject err=%v", err)
	}
}

func TestGoogleAccountName(t *testing.T) {
	if got := googleAccountName("  Jordan Lee  ", "j@example.com"); got != "Jordan Lee" {
		t.Fatalf("name = %q", got)
	}
	if got := googleAccountName("", "jordan@example.com"); got != "jordan" {
		t.Fatalf("email local part = %q", got)
	}
	if got := googleAccountName("", "@example.com"); got != "" {
		t.Fatalf("blank local part = %q", got)
	}
}
