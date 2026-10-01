package scout

import (
	"unicode/utf8"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

const (
	minLegalNameChars = 2
	maxLegalNameChars = 120
)

// NormalizeScoutCompany checks the three fields a scout may set on a new company.
func NormalizeScoutCompany(legalName, website string, logo []byte) (jobs.ScoutCompany, error) {
	problems := &ValidationError{}
	name := clean(legalName)
	count := utf8.RuneCountInString(name)
	switch {
	case count == 0:
		problems.add("legal_name", "required")
	case count < minLegalNameChars:
		problems.add("legal_name", "must be at least 2 characters")
	case count > maxLegalNameChars:
		problems.add("legal_name", "must be at most 120 characters")
	}
	site, err := jobs.NormalizeCompanyWebsite(website)
	if err != nil {
		problems.add("url", "enter the company's website, like acme.com")
	}
	logoType := ""
	if len(logo) > jobs.MaxLogoBytes {
		problems.add("logo", "must be a PNG, JPEG, WebP, or GIF under 2 MB")
	} else if len(logo) > 0 {
		logoType = jobs.LogoContentType(logo)
		if logoType == "" {
			problems.add("logo", "must be a PNG, JPEG, WebP, or GIF under 2 MB")
		}
	}
	if err := problems.orNil(); err != nil {
		return jobs.ScoutCompany{}, err
	}
	return jobs.ScoutCompany{LegalName: name, Website: site, LogoType: logoType, Logo: logo}, nil
}
