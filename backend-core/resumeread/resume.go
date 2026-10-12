// Package resumeread reads a résumé file (PDF, Word, or plain text) into the
// facts a job hunter profile asks for: name, contact, place, links, summary,
// skills, roles, and schools.
//
// A layout parser always runs and handles the common résumé styles without a
// model. When a model is given, it reads the same text and its answers win; a
// model failure keeps the parser's answers. Ported from Acorn's profile reader.
package resumeread

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"unicode/utf8"
)

// Readers a result can report: the model, or the layout parser when no model answered.
const (
	ReaderAI     = "ai"
	ReaderLayout = "layout"
)

const (
	// MaxBytes is the largest résumé file read.
	MaxBytes = 8 << 20
	// minResumeRunes is the least text that still reads as a résumé.
	minResumeRunes = 40
	// maxSummary fits a role's full set of résumé bullets.
	maxSummary  = 4000
	maxTimeline = 24
	maxSkills   = 40
	maxField    = 200
)

// Entry kinds.
const (
	KindRole      = sectionExperience
	KindEducation = sectionEducation
)

var (
	// ErrUnreadable is a résumé file with no usable text.
	ErrUnreadable = errors.New("couldn't read text from that file — try a PDF or Word file with selectable text")
	// ErrUnsupported is a file type the reader does not open.
	ErrUnsupported = errors.New("upload a PDF, Word (.docx), or text file")
	// ErrTooLarge is a file over MaxBytes.
	ErrTooLarge = errors.New("résumé files must be 8 MB or smaller")
)

// Entry is one role or school. Title is the job title or the credential; Org is
// the employer or school; Field is a school's subject when the reader separated it.
// Months and years are strings ("1"–"12", "2024"), empty when the résumé does not say.
type Entry struct {
	ID         string
	Kind       string
	Title      string
	Field      string
	Org        string
	Location   string
	Summary    string
	StartMonth string
	StartYear  string
	EndMonth   string
	EndYear    string
	Current    bool
}

// Resume is what a résumé says about its owner. Empty fields were not found.
type Resume struct {
	FullName   string
	FirstName  string
	MiddleName string
	LastName   string
	Headline   string
	Summary    string
	Email      string
	Phone      string
	City       string
	State      string
	Country    string
	Linkedin   string
	Github     string
	Portfolio  string
	Skills     []string
	Timeline   []Entry
}

// Result is a read résumé and which reader read it.
type Result struct {
	Resume Resume
	Reader string
}

// ReadFile extracts the text of a résumé file and reads it. model may be nil.
func ReadFile(ctx context.Context, model Model, fileName string, data []byte) (Result, error) {
	if len(data) > MaxBytes {
		return Result{}, ErrTooLarge
	}
	text, err := fileText(fileName, data)
	if err != nil {
		return Result{}, err
	}
	return ReadText(ctx, model, text)
}

// ReadText reads résumé text. The layout parser always runs; a model, when
// given, then reads the same text and its answers win.
func ReadText(ctx context.Context, model Model, text string) (Result, error) {
	found, err := fromLayout(text)
	if err != nil {
		return Result{}, err
	}
	reader := ReaderLayout
	if model != nil {
		read, err := readResume(ctx, model, text)
		if err != nil {
			slog.Warn("résumé read by layout only", "error", err)
		} else {
			found = read.apply(found, text)
			reader = ReaderAI
		}
	}
	return Result{Resume: normalize(found), Reader: reader}, nil
}

func normalize(doc Resume) Resume {
	for _, field := range []*string{
		&doc.FullName, &doc.FirstName, &doc.MiddleName, &doc.LastName, &doc.Headline,
		&doc.Email, &doc.Phone, &doc.City, &doc.State, &doc.Country,
		&doc.Linkedin, &doc.Github, &doc.Portfolio,
	} {
		*field = clip(*field, maxField)
	}
	doc.Summary = clip(doc.Summary, maxSummary)
	doc.Skills = dedupeFold(doc.Skills)
	if len(doc.Skills) > maxSkills {
		doc.Skills = doc.Skills[:maxSkills]
	}
	if len(doc.Timeline) > maxTimeline {
		doc.Timeline = doc.Timeline[:maxTimeline]
	}
	for i := range doc.Timeline {
		item := &doc.Timeline[i]
		if item.Kind != KindEducation {
			item.Kind = KindRole
		}
		item.Title = clip(item.Title, maxField)
		item.Field = clip(item.Field, maxField)
		item.Org = clip(item.Org, maxField)
		item.Location = clip(item.Location, maxField)
		item.Summary = clip(item.Summary, maxSummary)
	}
	return doc
}

func clip(value string, max int) string {
	value = strings.TrimSpace(value)
	if len(value) <= max {
		return value
	}
	cut := max
	for cut > 0 && !utf8.RuneStart(value[cut]) {
		cut--
	}
	return strings.TrimSpace(value[:cut])
}

// dedupeFold keeps the first spelling of each value, ignoring case and blanks.
func dedupeFold(values []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		key := strings.ToLower(value)
		if value == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, value)
	}
	return out
}
