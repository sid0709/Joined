package jobs

import "testing"

func TestNormalizeCompanyWebsite(t *testing.T) {
	got, err := NormalizeCompanyWebsite("acme.com")
	if err != nil || got != "https://acme.com" {
		t.Fatalf("acme.com = %q, %v", got, err)
	}
	got, err = NormalizeCompanyWebsite("https://jobs.acme.com/about")
	if err != nil || got != "https://jobs.acme.com/about" {
		t.Fatalf("full url = %q, %v", got, err)
	}
	for _, raw := range []string{"", "localhost", "http://127.0.0.1", "not a url"} {
		if _, err := NormalizeCompanyWebsite(raw); err != ErrInvalidInput {
			t.Fatalf("%q err = %v", raw, err)
		}
	}
}
