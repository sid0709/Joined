package jobs

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	minCompanyNameChars = 2
	maxCompanyNameChars = 120
)

// CompanyMatch is a company a scout can attach to a submission.
type CompanyMatch struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	URL  string `json:"url,omitempty"`
	Logo string `json:"logo,omitempty"`
}

// ScoutCompany is the small company page a scout can create: legal name, website, and logo.
type ScoutCompany struct {
	LegalName string
	Website   string
	LogoType  string
	Logo      []byte
}

// NormalizeCompanyWebsite accepts "acme.com" or a full http(s) URL and returns a public URL.
func NormalizeCompanyWebsite(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", ErrInvalidInput
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	parsed, err := safeLogoURL(raw)
	if err != nil || !strings.Contains(parsed.Hostname(), ".") {
		return "", ErrInvalidInput
	}
	parsed.Fragment = ""
	return parsed.String(), nil
}

// CreateScoutCompany adds an unclaimed company, or returns the one that already has this name.
func (s *Store) CreateScoutCompany(ctx context.Context, input ScoutCompany, now time.Time) (CompanyMatch, bool, error) {
	name := strings.Join(strings.Fields(input.LegalName), " ")
	count := utf8.RuneCountInString(name)
	if count < minCompanyNameChars || count > maxCompanyNameChars {
		return CompanyMatch{}, false, ErrInvalidInput
	}
	website, err := NormalizeCompanyWebsite(input.Website)
	if err != nil {
		return CompanyMatch{}, false, err
	}
	if existing, ok, err := s.companyByName(ctx, name); err != nil {
		return CompanyMatch{}, false, err
	} else if ok {
		return existing, false, nil
	}

	id, err := newPublicID()
	if err != nil {
		return CompanyMatch{}, false, err
	}
	doc := bson.D{
		{Key: "id", Value: id},
		{Key: "companyName", Value: name},
		{Key: "companyUrl", Value: website},
		{Key: "companyKey", Value: companySlug(name)},
		{Key: "companyLogo", Value: ""},
		{Key: "jobCount", Value: 0},
		{Key: "jobIds", Value: bson.A{}},
		{Key: "source", Value: ScoutedSource},
		{Key: "claimed", Value: false},
		{Key: "createdAt", Value: now.UTC()},
	}
	if len(input.Logo) > 0 {
		doc = append(doc, bson.E{Key: "logoFile", Value: logoFile{ContentType: input.LogoType, Data: input.Logo}})
	}
	if _, err := s.companies().InsertOne(ctx, doc); err != nil {
		return CompanyMatch{}, false, err
	}
	return CompanyMatch{ID: id, Name: name, URL: website}, true, nil
}

func (s *Store) companyByName(ctx context.Context, name string) (CompanyMatch, bool, error) {
	key := companySlug(name)
	var found struct {
		ID   string `bson:"id"`
		Name string `bson:"companyName"`
		URL  string `bson:"companyUrl"`
		Logo string `bson:"companyLogo"`
	}
	filter := bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "companyKey", Value: key}},
		bson.D{{Key: "companyName", Value: bson.D{
			{Key: "$regex", Value: "^" + regexp.QuoteMeta(name) + "$"},
			{Key: "$options", Value: "i"},
		}}},
	}}}
	err := s.findCompanyOrStaged(ctx, filter, &found, options.FindOne().SetProjection(bson.D{
		{Key: "id", Value: 1},
		{Key: "companyName", Value: 1},
		{Key: "companyUrl", Value: 1},
		{Key: "companyLogo", Value: 1},
	}))
	if errors.Is(err, mongo.ErrNoDocuments) {
		return CompanyMatch{}, false, nil
	}
	if err != nil {
		return CompanyMatch{}, false, err
	}
	if found.ID == "" {
		return CompanyMatch{}, false, nil
	}
	return CompanyMatch{ID: found.ID, Name: found.Name, URL: found.URL, Logo: found.Logo}, true, nil
}
