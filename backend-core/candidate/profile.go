package candidate

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	maxHeadline    = 120
	maxAbout       = 600
	maxPhone       = 20
	maxLocation    = 80
	maxAddressLine = 120
	maxSkill       = 40
	maxSkills      = 24
	maxRoles       = 8
	maxExperience  = 20
	maxText        = 400
)

func (s *Store) GetProfile(ctx context.Context, userID string, now time.Time) (Profile, error) {
	user, created, err := s.accounts.Account(ctx, userID)
	if err != nil {
		return Profile{}, err
	}
	var stored storedProfile
	err = s.collection(profilesCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&stored)
	if notFound(err) {
		profile := emptyProfile(user.Name, user.Email, created)
		return profile, nil
	}
	if err != nil {
		return Profile{}, err
	}
	return viewProfile(stored, user.Name, user.Email, created), nil
}

func (s *Store) PatchProfile(ctx context.Context, userID string, patch ProfilePatch, now time.Time) (Profile, error) {
	current, err := s.GetProfile(ctx, userID, now)
	if err != nil {
		return Profile{}, err
	}
	next, name, err := applyProfilePatch(current, patch)
	if err != nil {
		return Profile{}, err
	}
	if name != current.Name {
		if err := s.accounts.SetName(ctx, userID, name); err != nil {
			return Profile{}, err
		}
		next.Name = name
	}
	stored := storedFromProfile(userID, next, now)
	_, err = s.collection(profilesCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: userID}}, bson.D{
		{Key: "$set", Value: stored},
	}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return Profile{}, err
	}
	return s.GetProfile(ctx, userID, now)
}

type ProfilePatch struct {
	Name          *string           `json:"name"`
	Phone         *string           `json:"phone"`
	Headline      *string           `json:"headline"`
	Location      *string           `json:"location"`
	HomeAddress   *HomeAddress      `json:"homeAddress"`
	About         *string           `json:"about"`
	Status        *Status           `json:"status"`
	TargetRoles   *[]string         `json:"targetRoles"`
	Locations     *[]string         `json:"locations"`
	Workplace     *string           `json:"workplace"`
	SalaryFloor   *int              `json:"salaryFloor"`
	Currency      *string           `json:"currency"`
	Authorization *string           `json:"authorization"`
	NoticePeriod  *string           `json:"noticePeriod"`
	Skills        *[]string         `json:"skills"`
	Experience    *[]ExperienceItem `json:"experience"`
	Education     *[]EducationItem  `json:"education"`
	Personal      *Personal         `json:"personal"`
	Links         *Links            `json:"links"`
	Disclosures   *Disclosures      `json:"disclosures"`
	Visibility    *Visibility       `json:"visibility"`
}

func emptyProfile(name, email string, created time.Time) Profile {
	return Profile{
		Name:          name,
		Email:         email,
		Phone:         "",
		Headline:      "",
		Location:      "",
		HomeAddress:   HomeAddress{},
		About:         "",
		MemberSince:   memberSince(created),
		Status:        Status{Label: "Open to work", Variant: "success"},
		TargetRoles:   []string{},
		Locations:     []string{},
		Workplace:     DefaultWorkplace,
		SalaryFloor:   0,
		Currency:      DefaultCurrency,
		Authorization: "",
		NoticePeriod:  "",
		Skills:        []string{},
		Experience:    []ExperienceItem{},
		Education:     []EducationItem{},
		Visibility:    Visibility{OpenToWork: true, RecruiterSearch: true, HideFromEmployer: false},
	}
}

func viewProfile(stored storedProfile, name, email string, created time.Time) Profile {
	profile := Profile{
		Name:          name,
		Email:         email,
		Phone:         stored.Phone,
		Headline:      stored.Headline,
		Location:      stored.Location,
		HomeAddress:   stored.HomeAddress,
		About:         stored.About,
		MemberSince:   memberSince(created),
		Status:        stored.Status,
		TargetRoles:   stored.TargetRoles,
		Locations:     stored.Locations,
		Workplace:     stored.Workplace,
		SalaryFloor:   stored.SalaryFloor,
		Currency:      stored.Currency,
		Authorization: stored.Authorization,
		NoticePeriod:  stored.NoticePeriod,
		Skills:        stored.Skills,
		Experience:    stored.Experience,
		Education:     stored.Education,
		Personal:      stored.Personal,
		Links:         stored.Links,
		Disclosures:   stored.Disclosures,
		Visibility:    stored.Visibility,
	}
	return normalizeProfile(profile)
}

func storedFromProfile(userID string, profile Profile, now time.Time) storedProfile {
	profile = normalizeProfile(profile)
	return storedProfile{
		UserID:        userID,
		Phone:         profile.Phone,
		Headline:      profile.Headline,
		Location:      profile.Location,
		HomeAddress:   profile.HomeAddress,
		About:         profile.About,
		Status:        profile.Status,
		TargetRoles:   profile.TargetRoles,
		Locations:     profile.Locations,
		Workplace:     profile.Workplace,
		SalaryFloor:   profile.SalaryFloor,
		Currency:      profile.Currency,
		Authorization: profile.Authorization,
		NoticePeriod:  profile.NoticePeriod,
		Skills:        profile.Skills,
		Experience:    profile.Experience,
		Education:     profile.Education,
		Personal:      profile.Personal,
		Links:         profile.Links,
		Disclosures:   profile.Disclosures,
		Visibility:    profile.Visibility,
		UpdatedAt:     now.UTC(),
	}
}

func applyProfilePatch(current Profile, patch ProfilePatch) (Profile, string, error) {
	name := current.Name
	if patch.Name != nil {
		name = strings.TrimSpace(*patch.Name)
		if name == "" || len([]rune(name)) > 80 {
			return Profile{}, "", ErrInvalidInput
		}
	}
	if patch.Phone != nil {
		phone := strings.TrimSpace(*patch.Phone)
		if phone != "" && !validPhone(phone) {
			return Profile{}, "", ErrInvalidInput
		}
		current.Phone = phone
	}
	if patch.Headline != nil {
		current.Headline = clip(*patch.Headline, maxHeadline)
	}
	if patch.Location != nil {
		current.Location = clip(*patch.Location, maxLocation)
	}
	if patch.HomeAddress != nil {
		current.HomeAddress = HomeAddress{
			Line:       clip(patch.HomeAddress.Line, maxAddressLine),
			City:       clip(patch.HomeAddress.City, maxLocation),
			Region:     clip(patch.HomeAddress.Region, maxLocation),
			PostalCode: clip(patch.HomeAddress.PostalCode, 16),
			Country:    clip(patch.HomeAddress.Country, maxLocation),
		}
	}
	if patch.About != nil {
		current.About = clip(*patch.About, maxAbout)
	}
	if patch.Status != nil && strings.TrimSpace(patch.Status.Label) != "" {
		current.Status = *patch.Status
	}
	if patch.TargetRoles != nil {
		current.TargetRoles = clipList(*patch.TargetRoles, maxRoles, maxSkill)
	}
	if patch.Locations != nil {
		current.Locations = clipList(*patch.Locations, maxRoles, maxLocation)
	}
	if patch.Workplace != nil {
		switch *patch.Workplace {
		case "remote", "hybrid", "onsite", "":
			current.Workplace = *patch.Workplace
			if current.Workplace == "" {
				current.Workplace = DefaultWorkplace
			}
		default:
			return Profile{}, "", ErrInvalidInput
		}
	}
	if patch.SalaryFloor != nil {
		if *patch.SalaryFloor < 0 {
			return Profile{}, "", ErrInvalidInput
		}
		current.SalaryFloor = *patch.SalaryFloor
	}
	if patch.Currency != nil {
		currency := strings.ToUpper(strings.TrimSpace(*patch.Currency))
		if currency == "" {
			currency = DefaultCurrency
		}
		if len(currency) != 3 {
			return Profile{}, "", ErrInvalidInput
		}
		current.Currency = currency
	}
	if patch.Authorization != nil {
		current.Authorization = clip(*patch.Authorization, 40)
	}
	if patch.NoticePeriod != nil {
		current.NoticePeriod = clip(*patch.NoticePeriod, 16)
	}
	if patch.Skills != nil {
		current.Skills = clipList(*patch.Skills, maxSkills, maxSkill)
	}
	if patch.Experience != nil {
		items, err := normalizeExperience(*patch.Experience)
		if err != nil {
			return Profile{}, "", err
		}
		current.Experience = items
	}
	if patch.Education != nil {
		items, err := normalizeEducation(*patch.Education)
		if err != nil {
			return Profile{}, "", err
		}
		current.Education = items
	}
	if patch.Personal != nil {
		personal, err := normalizePersonal(*patch.Personal)
		if err != nil {
			return Profile{}, "", err
		}
		current.Personal = personal
	}
	if patch.Links != nil {
		links, err := normalizeLinks(*patch.Links)
		if err != nil {
			return Profile{}, "", err
		}
		current.Links = links
	}
	if patch.Disclosures != nil {
		current.Disclosures = normalizeDisclosures(*patch.Disclosures)
	}
	if patch.Visibility != nil {
		current.Visibility = *patch.Visibility
	}
	return normalizeProfile(current), name, nil
}

func normalizeExperience(items []ExperienceItem) ([]ExperienceItem, error) {
	if len(items) > maxExperience {
		return nil, ErrInvalidInput
	}
	out := make([]ExperienceItem, 0, len(items))
	for _, item := range items {
		role := clip(item.Role, maxSkill)
		company := clip(item.Company, maxSkill)
		if role == "" || company == "" {
			return nil, ErrInvalidInput
		}
		id, err := itemID(item.ID)
		if err != nil {
			return nil, err
		}
		dates, err := normalizeRange(item.DateRange)
		if err != nil {
			return nil, err
		}
		out = append(out, ExperienceItem{
			ID:        id,
			Role:      role,
			Company:   company,
			Period:    periodOf(dates, item.Period),
			Summary:   clip(item.Summary, maxText),
			DateRange: dates,
		})
	}
	return out, nil
}

func normalizeProfile(profile Profile) Profile {
	if profile.TargetRoles == nil {
		profile.TargetRoles = []string{}
	}
	if profile.Locations == nil {
		profile.Locations = []string{}
	}
	if profile.Skills == nil {
		profile.Skills = []string{}
	}
	if profile.Experience == nil {
		profile.Experience = []ExperienceItem{}
	}
	if profile.Education == nil {
		profile.Education = []EducationItem{}
	}
	if profile.Workplace == "" {
		profile.Workplace = DefaultWorkplace
	}
	if profile.Currency == "" {
		profile.Currency = DefaultCurrency
	}
	if profile.Status.Label == "" {
		profile.Status = Status{Label: "Open to work", Variant: "success"}
	}
	return profile
}

func memberSince(created time.Time) string {
	if created.IsZero() {
		created = time.Now()
	}
	return fmt.Sprintf("Member since %d", created.UTC().Year())
}

func clip(value string, max int) string {
	value = strings.TrimSpace(value)
	runes := []rune(value)
	if len(runes) > max {
		return string(runes[:max])
	}
	return value
}

func clipList(values []string, maxItems, maxItem int) []string {
	out := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = clip(value, maxItem)
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, value)
		if len(out) == maxItems {
			break
		}
	}
	return out
}

func validPhone(value string) bool {
	if len(value) > maxPhone {
		return false
	}
	digits := 0
	for i, r := range value {
		if unicode.IsDigit(r) {
			digits++
			continue
		}
		if r == '+' && i == 0 {
			continue
		}
		if r == ' ' || r == '-' || r == '(' || r == ')' {
			continue
		}
		return false
	}
	return digits >= 8 && digits <= 15
}
