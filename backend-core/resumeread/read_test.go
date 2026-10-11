package resumeread

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
)

type fakeModel struct {
	answer string
	err    error
}

func (m fakeModel) JSON(context.Context, string, string, json.RawMessage) ([]byte, error) {
	return []byte(m.answer), m.err
}

const modelAnswer = `{
  "fullName": "Jordan Avery Lee", "firstName": "Jordan", "middleName": "Avery", "lastName": "Lee",
  "headline": "Senior Full-Stack Engineer", "summary": "Engineer with ten years of experience.",
  "skills": ["Go", "TypeScript", "go"],
  "email": "jordan.lee@example.com", "phone": "(555) 999-0000",
  "city": "Fresno", "state": "California", "country": "USA",
  "linkedin": "linkedin.com/in/jordan-lee-01", "github": "", "portfolio": "",
  "experience": [{"title": "Senior Full-Stack Engineer", "company": "Northwind", "location": "San Francisco, CA",
    "startMonth": "1", "startYear": "2022", "endMonth": "", "endYear": "", "current": true,
    "highlights": ["• Optimized queries.", "Shipped notifications."]}],
  "education": [{"degree": "Bachelor of Science", "field": "Computer Science", "school": "State University",
    "location": "Berkeley, CA", "startMonth": "8", "startYear": "2009", "endMonth": "13", "endYear": "2013"}]
}`

func TestReadWithModel(t *testing.T) {
	result, err := ReadText(context.Background(), fakeModel{answer: modelAnswer}, titleThenCompany)
	if err != nil {
		t.Fatal(err)
	}
	doc := result.Resume
	if result.Reader != ReaderAI {
		t.Fatalf("reader = %s", result.Reader)
	}
	if doc.State != "CA" || doc.Country != unitedStates || doc.Headline != "Senior Full-Stack Engineer" {
		t.Fatalf("place = %s %s %q", doc.State, doc.Country, doc.Headline)
	}
	if doc.Phone != "(555) 010-2233" {
		t.Fatalf("a phone the résumé does not contain must not replace the parsed one: %s", doc.Phone)
	}
	if doc.Linkedin != linkedinBase+"jordan-lee-01" {
		t.Fatalf("linkedin = %s", doc.Linkedin)
	}
	if !reflect.DeepEqual(doc.Skills, []string{"Go", "TypeScript"}) || doc.Summary != "Engineer with ten years of experience." {
		t.Fatalf("skills/summary = %v %q", doc.Skills, doc.Summary)
	}
	if len(doc.Timeline) != 2 || doc.Timeline[0].Summary != "Optimized queries.\nShipped notifications." {
		t.Fatalf("timeline = %+v", doc.Timeline)
	}
	school := doc.Timeline[1]
	if school.Title != "Bachelor of Science" || school.Field != "Computer Science" || school.EndMonth != "" || school.EndYear != "2013" {
		t.Fatalf("school = %+v", school)
	}
}

func TestReadFallsBackToLayout(t *testing.T) {
	result, err := ReadText(context.Background(), fakeModel{err: errors.New("model down")}, titleThenCompany)
	if err != nil {
		t.Fatal(err)
	}
	if result.Reader != ReaderLayout || result.Resume.City != "Fresno" || len(result.Resume.Timeline) != 3 {
		t.Fatalf("result = %s %+v", result.Reader, result.Resume)
	}
}

func TestReadWithoutModelStaysOnLayout(t *testing.T) {
	result, err := ReadText(context.Background(), nil, titleThenCompany)
	if err != nil {
		t.Fatal(err)
	}
	doc := result.Resume
	if result.Reader != ReaderLayout {
		t.Fatalf("reader = %s", result.Reader)
	}
	if doc.Summary != "Engineer with ten years of experience." {
		t.Fatalf("summary = %q", doc.Summary)
	}
	if !reflect.DeepEqual(doc.Skills, []string{"Go", "TypeScript"}) {
		t.Fatalf("skills = %v", doc.Skills)
	}
}

func TestSkillsDropLabelsAndSentences(t *testing.T) {
	text := "Sam Park\nsam@example.com\nTECHNICAL SKILLS\nLanguages: Go, Python, TypeScript\nTools • Docker • CI/CD\n" +
		"I enjoy building developer tools for large teams every day.\n"
	got := skillsFrom(nonEmptyLines(text))
	want := []string{"Go", "Python", "TypeScript", "Tools", "Docker", "CI/CD"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("skills = %v", got)
	}
}

func TestReadFileDocx(t *testing.T) {
	var buf bytes.Buffer
	archive := zip.NewWriter(&buf)
	part, err := archive.Create("word/document.xml")
	if err != nil {
		t.Fatal(err)
	}
	body := `<w:document><w:body>` +
		`<w:p><w:r><w:t>Jordan Avery Lee</w:t></w:r></w:p>` +
		`<w:p><w:r><w:t>Fresno, CA</w:t><w:tab/><w:t>jordan.lee@example.com</w:t></w:r></w:p>` +
		`<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>` +
		`<w:p><w:r><w:t>Software Engineer</w:t><w:tab/><w:t>Jan 2020 – Present</w:t></w:r></w:p>` +
		`<w:p><w:r><w:t>Northwind</w:t></w:r></w:p>` +
		`</w:body></w:document>`
	if _, err := part.Write([]byte(body)); err != nil {
		t.Fatal(err)
	}
	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
	result, err := ReadFile(context.Background(), nil, "Resume.DOCX", buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	doc := result.Resume
	if doc.FullName != "Jordan Avery Lee" || doc.Email != "jordan.lee@example.com" || doc.City != "Fresno" {
		t.Fatalf("contact = %+v", doc)
	}
	assertEntry(t, doc.Timeline, 0, Entry{Kind: KindRole, Title: "Software Engineer", Org: "Northwind", StartMonth: "1", StartYear: "2020", Current: true})
}

func TestReadFileRejectsUnsupportedAndLarge(t *testing.T) {
	if _, err := ReadFile(context.Background(), nil, "resume.doc", []byte("binary")); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("doc err = %v", err)
	}
	if _, err := ReadFile(context.Background(), nil, "resume.pdf", make([]byte, MaxBytes+1)); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("large err = %v", err)
	}
	if _, err := ReadFile(context.Background(), nil, "scan.pdf", []byte("%PDF-1.4\n%%EOF")); !errors.Is(err, ErrUnreadable) {
		t.Fatalf("image-only err = %v", err)
	}
}
