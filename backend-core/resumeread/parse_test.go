package resumeread

import (
	"testing"
)

const sampleResume = `Jordan Avery Lee
San Francisco, CA
United States
jordan@example.com
(415) 555-0148
linkedin.com/in/jordan
https://github.com/jordan
https://jordan.dev

Experience
Northwind
Senior Software Engineer
Jan 2022 - Present
Built hiring tools.

Lumen
Software Engineer
Mar 2018 - Dec 2021

Education
State University
B.S. Computer Science
Sep 2011 - May 2015
`

func TestLayoutFillsContactAndTimeline(t *testing.T) {
	next, err := fromLayout(sampleResume)
	if err != nil {
		t.Fatal(err)
	}
	if next.FullName != "Jordan Avery Lee" || next.FirstName != "Jordan" || next.MiddleName != "Avery" || next.LastName != "Lee" {
		t.Fatalf("name = %+v", next)
	}
	if next.Email != "jordan@example.com" || next.Phone != "(415) 555-0148" {
		t.Fatalf("contact = %s %s", next.Email, next.Phone)
	}
	if next.Linkedin != "https://www.linkedin.com/in/jordan" || next.Github == "" || next.Portfolio != "https://jordan.dev" {
		t.Fatalf("links = %s %s %s", next.Linkedin, next.Github, next.Portfolio)
	}
	if next.City != "San Francisco" || next.State != "CA" || next.Country != "United States" {
		t.Fatalf("place = %s %s %s", next.City, next.State, next.Country)
	}
	if len(next.Timeline) < 3 {
		t.Fatalf("timeline = %+v", next.Timeline)
	}
	role := next.Timeline[0]
	if role.Kind != "role" || role.Title != "Senior Software Engineer" || role.Org != "Northwind" || !role.Current || role.StartYear != "2022" {
		t.Fatalf("role = %+v", role)
	}
	school := next.Timeline[len(next.Timeline)-1]
	if school.Kind != "education" || school.Org != "State University" || school.EndYear != "2015" {
		t.Fatalf("school = %+v", school)
	}
}

func TestPlaceReadsStateName(t *testing.T) {
	next, err := fromLayout("Ada Lovelace\nada@example.com\nAustin, Texas 78701\nhttps://linkedin.com/in/ada-lovelace\nExperience\nAnalytical Engines\nMathematician\nJan 2018 - Present\nWrote notes.\n")
	if err != nil {
		t.Fatal(err)
	}
	if next.City != "Austin" || next.State != "TX" || next.Country != "United States" {
		t.Fatalf("place = %s %s %s", next.City, next.State, next.Country)
	}
	if next.Linkedin != "https://www.linkedin.com/in/ada-lovelace" {
		t.Fatalf("linkedin = %s", next.Linkedin)
	}
}

func TestLayoutRejectsShortText(t *testing.T) {
	if _, err := fromLayout("too short"); err != ErrUnreadable {
		t.Fatalf("err = %v", err)
	}
}
