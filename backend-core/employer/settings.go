package employer

import (
	"context"
	"errors"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Domain struct {
	Name     string `json:"name" bson:"name"`
	Verified bool   `json:"verified" bson:"verified"`
}

type Settings struct {
	Domains    []Domain `json:"domains"`
	Policy     string   `json:"policy"`
	DailyCap   int      `json:"dailyCap"`
	FaceCheck  bool     `json:"faceCheck"`
	AutoReply  bool     `json:"autoReply"`
	Digest     string   `json:"digest"`
	SpendAlert bool     `json:"spendAlert"`
}

type storedSettings struct {
	CompanyID  string   `bson:"companyId"`
	Domains    []Domain `bson:"domains"`
	Policy     string   `bson:"policy"`
	DailyCap   int      `bson:"dailyCap"`
	FaceCheck  bool     `bson:"faceCheck"`
	AutoReply  bool     `bson:"autoReply"`
	Digest     string   `bson:"digest"`
	SpendAlert bool     `bson:"spendAlert"`
}

func (s *Store) Settings(ctx context.Context, company auth.Company) (Settings, error) {
	var doc storedSettings
	err := s.collection(settingsCollection).FindOne(ctx, bson.D{{Key: "companyId", Value: company.ID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return defaultSettings(company.URL), nil
	}
	if err != nil {
		return Settings{}, err
	}
	return viewSettings(doc), nil
}

func (s *Store) SaveSettings(ctx context.Context, company auth.Company, input Settings) (Settings, error) {
	next := normalizeSettings(input, company.URL)
	_, err := s.collection(settingsCollection).UpdateOne(ctx, bson.D{{Key: "companyId", Value: company.ID}}, bson.D{
		{Key: "$set", Value: storedSettings{
			CompanyID: company.ID, Domains: next.Domains, Policy: next.Policy, DailyCap: next.DailyCap,
			FaceCheck: next.FaceCheck, AutoReply: next.AutoReply, Digest: next.Digest, SpendAlert: next.SpendAlert,
		}},
	}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return Settings{}, err
	}
	return next, nil
}

func (s *Store) Page(ctx context.Context, companyID string) (jobs.AdminCompany, error) {
	page, err := s.jobs.GetAdminCompany(ctx, companyID)
	if err != nil {
		return jobs.AdminCompany{}, ErrNotFound
	}
	return page, nil
}

func (s *Store) SavePage(ctx context.Context, companyID string, input jobs.CompanyWrite) (jobs.AdminCompany, error) {
	page, err := s.jobs.UpdateCompany(ctx, companyID, input)
	return employerCompany(page, err)
}

func (s *Store) SaveLogo(ctx context.Context, companyID, contentType string, data []byte) (jobs.AdminCompany, error) {
	page, err := s.jobs.SaveCompanyLogo(ctx, companyID, contentType, data)
	return employerCompany(page, err)
}

func (s *Store) ClearLogo(ctx context.Context, companyID string) (jobs.AdminCompany, error) {
	page, err := s.jobs.ClearCompanyLogo(ctx, companyID)
	return employerCompany(page, err)
}

func employerCompany(page jobs.AdminCompany, err error) (jobs.AdminCompany, error) {
	if errors.Is(err, jobs.ErrNotFound) {
		return jobs.AdminCompany{}, ErrNotFound
	}
	if errors.Is(err, jobs.ErrInvalidInput) {
		return jobs.AdminCompany{}, ErrInvalidInput
	}
	return page, err
}

func defaultSettings(website string) Settings {
	settings := Settings{
		Domains:    []Domain{},
		Policy:     policyAccept,
		DailyCap:   5,
		FaceCheck:  true,
		AutoReply:  true,
		Digest:     "daily",
		SpendAlert: true,
	}
	if host := emailDomain(website); host != "" {
		settings.Domains = []Domain{{Name: host, Verified: true}}
	}
	return settings
}

func normalizeSettings(input Settings, website string) Settings {
	next := defaultSettings(website)
	if input.Policy == policyAccept || input.Policy == policyCap || input.Policy == policyDirect {
		next.Policy = input.Policy
	}
	if input.DailyCap >= minDailyCap && input.DailyCap <= maxDailyCap {
		next.DailyCap = input.DailyCap
	}
	next.FaceCheck = input.FaceCheck
	next.AutoReply = input.AutoReply
	next.SpendAlert = input.SpendAlert
	switch input.Digest {
	case "instant", "daily", "weekly":
		next.Digest = input.Digest
	}
	host := emailDomain(website)
	seen := map[string]struct{}{}
	domains := make([]Domain, 0, len(input.Domains))
	for _, domain := range input.Domains {
		name := strings.ToLower(strings.TrimSpace(domain.Name))
		if name == "" || strings.Contains(name, " ") || !strings.Contains(name, ".") {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		domains = append(domains, Domain{Name: name, Verified: name == host})
		if len(domains) == 8 {
			break
		}
	}
	if len(domains) > 0 {
		next.Domains = domains
	}
	return next
}

func viewSettings(doc storedSettings) Settings {
	domains := doc.Domains
	if domains == nil {
		domains = []Domain{}
	}
	return Settings{
		Domains: domains, Policy: doc.Policy, DailyCap: doc.DailyCap, FaceCheck: doc.FaceCheck,
		AutoReply: doc.AutoReply, Digest: doc.Digest, SpendAlert: doc.SpendAlert,
	}
}
