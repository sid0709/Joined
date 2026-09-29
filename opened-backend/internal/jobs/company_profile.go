package jobs

import "strings"

const (
	maxCompanyName   = 80
	maxCompanyURL    = 300
	maxCompanyLogo   = 500
	maxTagline       = 140
	maxAbout         = 2000
	maxIndustry      = 80
	maxCompanyType   = 80
	maxHeadquarters  = 240
	maxLocations     = 480
	maxMission       = 800
	maxListItem      = 80
	maxValueTitle    = 60
	maxValueBody     = 240
	maxBenefitLabel  = 60
	maxSpecialties   = 12
	maxValues        = 6
	maxBenefitGroups = 6
	maxBenefitItems  = 12
	minFoundedYear   = 1800
	maxFoundedYear   = 2100
	maxReplyDays     = 365
)

var companySizes = []string{
	"1–10",
	"11–50",
	"51–200",
	"201–500",
	"501–1,000",
	"1,001–5,000",
	"5,000+",
}

var valueIcons = []string{
	"heart",
	"star",
	"users",
	"check",
	"sparkle",
	"home",
	"pin",
	"code",
	"seat",
	"chat",
}

type companyValue struct {
	Icon        string `json:"icon" bson:"icon"`
	Title       string `json:"title" bson:"title"`
	Description string `json:"description" bson:"description"`
}

type benefitCategory struct {
	Label string   `json:"label" bson:"label"`
	Items []string `json:"items" bson:"items"`
}

type companyProfile struct {
	Tagline           string            `json:"tagline,omitempty" bson:"tagline,omitempty"`
	About             string            `json:"about,omitempty" bson:"about,omitempty"`
	Industry          string            `json:"industry,omitempty" bson:"industry,omitempty"`
	Size              string            `json:"size,omitempty" bson:"size,omitempty"`
	Founded           int               `json:"founded,omitempty" bson:"founded,omitempty"`
	ReplyDays         int               `json:"replyDays,omitempty" bson:"replyDays,omitempty"`
	Headquarters      string            `json:"headquarters,omitempty" bson:"headquarters,omitempty"`
	CompanyType       string            `json:"companyType,omitempty" bson:"companyType,omitempty"`
	Locations         string            `json:"locations,omitempty" bson:"locations,omitempty"`
	Specialties       []string          `json:"specialties,omitempty" bson:"specialties,omitempty"`
	Mission           string            `json:"mission,omitempty" bson:"mission,omitempty"`
	Values            []companyValue    `json:"values,omitempty" bson:"values,omitempty"`
	BenefitCategories []benefitCategory `json:"benefitCategories,omitempty" bson:"benefitCategories,omitempty"`
	// Perks is legacy. Reads fold it into benefit categories; saves omit it.
	Perks []string `json:"-" bson:"perks,omitempty"`
}

// companyOverrides is what an admin saved on top of the copied source company.
// Nil pointers mean "keep the source value". A pointer to "" clears it.
type companyOverrides struct {
	Name    *string        `bson:"name,omitempty"`
	URL     *string        `bson:"url,omitempty"`
	Logo    *string        `bson:"logo,omitempty"`
	Profile companyProfile `bson:"profile,omitempty"`
}

// CompanyWrite is the company page edit form. Every field is sent, including blanks.
type CompanyWrite struct {
	Name              string            `json:"name"`
	URL               string            `json:"url"`
	Logo              string            `json:"logo"`
	Tagline           string            `json:"tagline"`
	About             string            `json:"about"`
	Industry          string            `json:"industry"`
	Size              string            `json:"size"`
	Founded           int               `json:"founded"`
	ReplyDays         int               `json:"replyDays"`
	Headquarters      string            `json:"headquarters"`
	CompanyType       string            `json:"companyType"`
	Locations         string            `json:"locations"`
	Specialties       []string          `json:"specialties"`
	Mission           string            `json:"mission"`
	Values            []companyValue    `json:"values"`
	BenefitCategories []benefitCategory `json:"benefitCategories"`
}

type AdminCompany struct {
	PublicCompany
	JobCount int64 `json:"jobCount"`
}

type CompanySummary struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	URL         string `json:"url,omitempty"`
	Logo        string `json:"logo,omitempty"`
	Industry    string `json:"industry,omitempty"`
	JobCount    int64  `json:"jobCount"`
	HasLogoFile bool   `json:"hasLogoFile,omitempty"`
}

type CompanyList struct {
	Companies []CompanySummary `json:"companies"`
	Total     int64            `json:"total"`
	Page      int64            `json:"page"`
	PageSize  int64            `json:"pageSize"`
}

func (doc storedCompany) displayName() string {
	if doc.Overrides.Name != nil {
		return strings.TrimSpace(*doc.Overrides.Name)
	}
	return strings.TrimSpace(doc.CompanyName)
}

func (doc storedCompany) displayURL() string {
	if doc.Overrides.URL != nil {
		return strings.TrimSpace(*doc.Overrides.URL)
	}
	return strings.TrimSpace(doc.CompanyURL)
}

func (doc storedCompany) displayLogo() string {
	if doc.Overrides.Logo != nil {
		return strings.TrimSpace(*doc.Overrides.Logo)
	}
	return strings.TrimSpace(doc.CompanyLogo)
}

func (doc storedCompany) publicCompany() PublicCompany {
	profile := doc.Overrides.Profile
	return PublicCompany{
		ID:                doc.ID,
		Name:              doc.displayName(),
		URL:               doc.displayURL(),
		Logo:              doc.displayLogo(),
		Tagline:           profile.Tagline,
		About:             profile.About,
		Industry:          profile.Industry,
		Size:              profile.Size,
		Founded:           profile.Founded,
		ReplyDays:         profile.ReplyDays,
		Headquarters:      profile.Headquarters,
		CompanyType:       profile.CompanyType,
		Locations:         profile.Locations,
		Specialties:       nilIfEmpty(profile.Specialties),
		Mission:           profile.Mission,
		Values:            nilValues(profile.Values),
		BenefitCategories: nilBenefits(foldPerks(profile.BenefitCategories, profile.Perks)),
		HasLogoFile:       doc.hasLogoFile(),
		Verified:          doc.VerificationStatus == VerificationApproved,
	}
}

func (doc storedCompany) hasLogoFile() bool {
	return doc.LogoFile.ContentType != ""
}

func (doc storedCompany) adminCompany() AdminCompany {
	return AdminCompany{PublicCompany: doc.publicCompany(), JobCount: doc.JobCount}
}

func (doc storedCompany) summary() CompanySummary {
	return CompanySummary{
		ID:          doc.ID,
		Name:        doc.displayName(),
		URL:         doc.displayURL(),
		Logo:        doc.displayLogo(),
		Industry:    doc.Overrides.Profile.Industry,
		JobCount:    doc.JobCount,
		HasLogoFile: doc.hasLogoFile(),
	}
}

func overridesFrom(input CompanyWrite) (companyOverrides, error) {
	name := truncate(strings.TrimSpace(input.Name), maxCompanyName)
	if name == "" {
		return companyOverrides{}, ErrInvalidInput
	}
	url := strings.TrimSpace(input.URL)
	if url != "" && !validLink(url, maxCompanyURL) {
		return companyOverrides{}, ErrInvalidInput
	}
	logo := strings.TrimSpace(input.Logo)
	if logo != "" && !validLink(logo, maxCompanyLogo) {
		return companyOverrides{}, ErrInvalidInput
	}
	size := strings.TrimSpace(input.Size)
	if size != "" && !contains(companySizes, size) {
		return companyOverrides{}, ErrInvalidInput
	}
	if input.Founded != 0 && (input.Founded < minFoundedYear || input.Founded > maxFoundedYear) {
		return companyOverrides{}, ErrInvalidInput
	}
	if input.ReplyDays < 0 || input.ReplyDays > maxReplyDays {
		return companyOverrides{}, ErrInvalidInput
	}
	return companyOverrides{
		Name: &name,
		URL:  &url,
		Logo: &logo,
		Profile: companyProfile{
			Tagline:           truncate(strings.TrimSpace(input.Tagline), maxTagline),
			About:             truncate(strings.TrimSpace(input.About), maxAbout),
			Industry:          truncate(strings.TrimSpace(input.Industry), maxIndustry),
			Size:              size,
			Founded:           input.Founded,
			ReplyDays:         input.ReplyDays,
			Headquarters:      truncate(strings.TrimSpace(input.Headquarters), maxHeadquarters),
			CompanyType:       truncate(strings.TrimSpace(input.CompanyType), maxCompanyType),
			Locations:         truncate(strings.TrimSpace(input.Locations), maxLocations),
			Specialties:       cleanList(clipItems(input.Specialties, maxListItem), maxSpecialties),
			Mission:           truncate(strings.TrimSpace(input.Mission), maxMission),
			Values:            cleanValues(input.Values),
			BenefitCategories: cleanBenefits(input.BenefitCategories),
		},
	}, nil
}

func validLink(value string, limit int) bool {
	if len(value) > limit || !strings.Contains(value, ".") {
		return false
	}
	lower := strings.ToLower(value)
	if strings.Contains(lower, " ") || strings.HasPrefix(lower, "javascript:") {
		return false
	}
	return true
}

func cleanValues(values []companyValue) []companyValue {
	out := make([]companyValue, 0, min(len(values), maxValues))
	for _, value := range values {
		title := truncate(strings.TrimSpace(value.Title), maxValueTitle)
		if title == "" {
			continue
		}
		icon := strings.TrimSpace(value.Icon)
		if !contains(valueIcons, icon) {
			icon = "star"
		}
		out = append(out, companyValue{
			Icon:        icon,
			Title:       title,
			Description: truncate(strings.TrimSpace(value.Description), maxValueBody),
		})
		if len(out) == maxValues {
			break
		}
	}
	return out
}

func cleanBenefits(groups []benefitCategory) []benefitCategory {
	out := make([]benefitCategory, 0, min(len(groups), maxBenefitGroups))
	for _, group := range groups {
		label := truncate(strings.TrimSpace(group.Label), maxBenefitLabel)
		items := cleanList(clipItems(group.Items, maxListItem), maxBenefitItems)
		if label == "" || len(items) == 0 {
			continue
		}
		out = append(out, benefitCategory{Label: label, Items: items})
		if len(out) == maxBenefitGroups {
			break
		}
	}
	return out
}

func clipItems(items []string, limit int) []string {
	out := make([]string, len(items))
	for i, item := range items {
		out[i] = truncate(item, limit)
	}
	return out
}

func contains(options []string, value string) bool {
	for _, option := range options {
		if option == value {
			return true
		}
	}
	return false
}

func nilIfEmpty(items []string) []string {
	if len(items) == 0 {
		return nil
	}
	return items
}

func nilValues(values []companyValue) []companyValue {
	if len(values) == 0 {
		return nil
	}
	return values
}

// foldPerks keeps a removed perks list visible under Benefits & Perks until the next save.
func foldPerks(groups []benefitCategory, perks []string) []benefitCategory {
	extras := cleanList(clipItems(perks, maxListItem), maxBenefitItems)
	if len(extras) == 0 {
		return groups
	}
	seen := make(map[string]struct{}, len(extras))
	for _, group := range groups {
		for _, item := range group.Items {
			seen[strings.ToLower(item)] = struct{}{}
		}
	}
	fresh := make([]string, 0, len(extras))
	for _, perk := range extras {
		key := strings.ToLower(perk)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		fresh = append(fresh, perk)
	}
	if len(fresh) == 0 {
		return groups
	}
	out := append([]benefitCategory{}, groups...)
	for i, group := range out {
		if strings.EqualFold(group.Label, "Perks") || strings.EqualFold(group.Label, "Benefits & Perks") {
			out[i].Items = append(append([]string{}, group.Items...), fresh...)
			return out
		}
	}
	if len(out) >= maxBenefitGroups {
		last := len(out) - 1
		out[last].Items = append(append([]string{}, out[last].Items...), fresh...)
		return out
	}
	return append(out, benefitCategory{Label: "Perks", Items: fresh})
}

func nilBenefits(groups []benefitCategory) []benefitCategory {
	if len(groups) == 0 {
		return nil
	}
	return groups
}
