package jobs

import (
	"context"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// Company directory sort keys, as the console sends them.
const (
	CompanySortName       = "name"
	CompanySortJobs       = "jobs"
	CompanySortCompletion = "completion"
	CompanySortFounded    = "founded"
	CompanySortResearched = "researched"
)

// Yes/no filter values.
const (
	FilterYes = "yes"
	FilterNo  = "no"
)

const maxCompletion = 100

var companySorts = []string{CompanySortName, CompanySortJobs, CompanySortCompletion, CompanySortFounded, CompanySortResearched}

// CompanyQuery is the directory's search, filters, sort, and page.
type CompanyQuery struct {
	ListQuery
	Industry    string
	Size        string
	CompanyType string
	// MinCompletion and MaxCompletion bound the completion percentage, both inclusive.
	MinCompletion int
	MaxCompletion int
	// HasLogo and Verified are FilterYes, FilterNo, or "" for either.
	HasLogo  string
	Verified string
	Sort     string
	Desc     bool
}

// ParseCompanyQuery reads the directory's query string. Unknown values fall back to
// no filter and the default sort.
func ParseCompanyQuery(values url.Values) CompanyQuery {
	query := CompanyQuery{
		ListQuery:     ParseListQuery(values.Get("page"), values.Get("pageSize"), values.Get("q")),
		Industry:      strings.TrimSpace(values.Get("industry")),
		Size:          strings.TrimSpace(values.Get("size")),
		CompanyType:   strings.TrimSpace(values.Get("type")),
		MinCompletion: percent(values.Get("minCompletion"), 0),
		MaxCompletion: percent(values.Get("maxCompletion"), maxCompletion),
		HasLogo:       yesNo(values.Get("logo")),
		Verified:      yesNo(values.Get("verified")),
		Sort:          CompanySortName,
		Desc:          values.Get("dir") == "desc",
	}
	if sort := values.Get("sort"); slices.Contains(companySorts, sort) {
		query.Sort = sort
	}
	return query
}

// CompanyRow is one directory row: the company's main fields and how complete its
// public page is.
type CompanyRow struct {
	CompanySummary
	Tagline      string     `json:"tagline,omitempty"`
	Size         string     `json:"size,omitempty"`
	CompanyType  string     `json:"companyType,omitempty"`
	Headquarters string     `json:"headquarters,omitempty"`
	Founded      int        `json:"founded,omitempty"`
	Locations    string     `json:"locations,omitempty"`
	Verification string     `json:"verification,omitempty"`
	Completion   int        `json:"completion"`
	ResearchedAt *time.Time `json:"researchedAt,omitempty"`
}

type CompanyDirectory struct {
	Companies []CompanyRow `json:"companies"`
	Total     int64        `json:"total"`
	Page      int64        `json:"page"`
	PageSize  int64        `json:"pageSize"`
}

// ListCompanies is a page of published companies, searched, filtered, and sorted.
// Completion is worked out in the database so it can be filtered and sorted on.
func (s *Store) ListCompanies(ctx context.Context, query CompanyQuery) (CompanyDirectory, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: companyDirectoryFilter(query)}},
		{{Key: "$addFields", Value: bson.D{
			{Key: "completion", Value: companyCompletion()},
			{Key: "sortName", Value: bson.D{{Key: "$toLower", Value: bson.D{{Key: "$ifNull", Value: bson.A{"$overrides.name", "$companyName"}}}}}},
		}}},
	}
	if query.MinCompletion > 0 || query.MaxCompletion < maxCompletion {
		pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.D{{Key: "completion", Value: bson.D{
			{Key: "$gte", Value: query.MinCompletion},
			{Key: "$lte", Value: query.MaxCompletion},
		}}}}})
	}
	pipeline = append(pipeline, bson.D{{Key: "$facet", Value: bson.D{
		{Key: "total", Value: bson.A{bson.D{{Key: "$count", Value: "n"}}}},
		{Key: "rows", Value: bson.A{
			bson.D{{Key: "$sort", Value: companySort(query)}},
			bson.D{{Key: "$skip", Value: (query.Page - 1) * query.PageSize}},
			bson.D{{Key: "$limit", Value: query.PageSize}},
			bson.D{{Key: "$project", Value: bson.D{{Key: "logoFile.data", Value: 0}, {Key: "jobIds", Value: 0}}}},
		}},
	}}})

	cursor, err := s.companies().Aggregate(ctx, pipeline)
	if err != nil {
		return CompanyDirectory{}, err
	}
	defer cursor.Close(ctx)
	var facets []struct {
		Total []struct {
			N int64 `bson:"n"`
		} `bson:"total"`
		Rows []struct {
			// Company is a named, exported field. Inlining the unexported storedCompany
			// type makes the decoder skip the company, so the directory would be blank.
			Company    storedCompany `bson:",inline"`
			Completion int           `bson:"completion"`
			Research   struct {
				At *time.Time `bson:"at"`
			} `bson:"research"`
		} `bson:"rows"`
	}
	if err := cursor.All(ctx, &facets); err != nil {
		return CompanyDirectory{}, err
	}
	out := CompanyDirectory{Companies: []CompanyRow{}, Page: query.Page, PageSize: query.PageSize}
	if len(facets) == 0 {
		return out, nil
	}
	if len(facets[0].Total) > 0 {
		out.Total = facets[0].Total[0].N
	}
	for _, row := range facets[0].Rows {
		profile := row.Company.Overrides.Profile
		out.Companies = append(out.Companies, CompanyRow{
			CompanySummary: row.Company.summary(),
			Tagline:        profile.Tagline,
			Size:           profile.Size,
			CompanyType:    profile.CompanyType,
			Headquarters:   profile.Headquarters,
			Founded:        profile.Founded,
			Locations:      profile.Locations,
			Verification:   row.Company.VerificationStatus,
			Completion:     row.Completion,
			ResearchedAt:   row.Research.At,
		})
	}
	return out, nil
}

func companyDirectoryFilter(query CompanyQuery) bson.D {
	filter := bson.D{}
	if pattern := searchPattern(query.Q); pattern != "" {
		regex := bson.D{{Key: "$regex", Value: pattern}, {Key: "$options", Value: "i"}}
		or := bson.A{}
		for _, key := range []string{
			"companyName", "overrides.name", "companyUrl", "overrides.url",
			"overrides.profile.industry", "overrides.profile.tagline", "overrides.profile.headquarters",
			"overrides.profile.locations", "overrides.profile.specialties",
		} {
			or = append(or, bson.D{{Key: key, Value: regex}})
		}
		filter = append(filter, bson.E{Key: "$or", Value: or})
	}
	exact := func(key, value string) {
		if value != "" {
			filter = append(filter, bson.E{Key: key, Value: value})
		}
	}
	exact("overrides.profile.industry", query.Industry)
	exact("overrides.profile.size", query.Size)
	exact("overrides.profile.companyType", query.CompanyType)

	hasLogo := bson.A{
		bson.D{{Key: "companyLogo", Value: bson.D{{Key: "$gt", Value: ""}}}},
		bson.D{{Key: "overrides.logo", Value: bson.D{{Key: "$gt", Value: ""}}}},
		bson.D{{Key: "logoFile.contentType", Value: bson.D{{Key: "$gt", Value: ""}}}},
	}
	switch query.HasLogo {
	case FilterYes:
		filter = append(filter, bson.E{Key: "$and", Value: bson.A{bson.D{{Key: "$or", Value: hasLogo}}}})
	case FilterNo:
		filter = append(filter, bson.E{Key: "$nor", Value: hasLogo})
	}
	switch query.Verified {
	case FilterYes:
		filter = append(filter, bson.E{Key: "verificationStatus", Value: VerificationApproved})
	case FilterNo:
		filter = append(filter, bson.E{Key: "verificationStatus", Value: bson.D{{Key: "$ne", Value: VerificationApproved}}})
	}
	return filter
}

// companyCompletion is the share of a public company page's fields that are filled in,
// as a whole percentage: logo, website, and each profile field Joined shows.
func companyCompletion() bson.D {
	text := func(paths ...string) bson.D {
		filled := bson.A{}
		for _, path := range paths {
			filled = append(filled, bson.D{{Key: "$gt", Value: bson.A{bson.D{{Key: "$ifNull", Value: bson.A{path, ""}}}, ""}}})
		}
		return bson.D{{Key: "$or", Value: filled}}
	}
	list := func(path string) bson.D {
		return bson.D{{Key: "$gt", Value: bson.A{bson.D{{Key: "$size", Value: bson.D{{Key: "$ifNull", Value: bson.A{path, bson.A{}}}}}}, 0}}}
	}
	checks := bson.A{
		text("$companyLogo", "$overrides.logo", "$logoFile.contentType"),
		text("$companyUrl", "$overrides.url"),
		text("$overrides.profile.tagline"),
		text("$overrides.profile.about"),
		text("$overrides.profile.industry"),
		text("$overrides.profile.size"),
		bson.D{{Key: "$gt", Value: bson.A{bson.D{{Key: "$ifNull", Value: bson.A{"$overrides.profile.founded", 0}}}, 0}}},
		text("$overrides.profile.headquarters"),
		text("$overrides.profile.companyType"),
		text("$overrides.profile.locations"),
		list("$overrides.profile.specialties"),
		text("$overrides.profile.mission"),
		list("$overrides.profile.values"),
		bson.D{{Key: "$or", Value: bson.A{list("$overrides.profile.benefitCategories"), list("$overrides.profile.perks")}}},
	}
	return percentOf(checks)
}

func companySort(query CompanyQuery) bson.D {
	direction := 1
	if query.Desc {
		direction = -1
	}
	key := map[string]string{
		CompanySortName:       "sortName",
		CompanySortJobs:       "jobCount",
		CompanySortCompletion: "completion",
		CompanySortFounded:    "overrides.profile.founded",
		CompanySortResearched: "research.at",
	}[query.Sort]
	sort := bson.D{{Key: key, Value: direction}}
	if key != "sortName" {
		sort = append(sort, bson.E{Key: "sortName", Value: 1})
	}
	return append(sort, bson.E{Key: "id", Value: 1})
}

// percentOf is the whole percentage of checks that are true.
func percentOf(checks bson.A) bson.D {
	ones := bson.A{}
	for _, check := range checks {
		ones = append(ones, bson.D{{Key: "$cond", Value: bson.A{check, 1, 0}}})
	}
	return bson.D{{Key: "$round", Value: bson.A{
		bson.D{{Key: "$multiply", Value: bson.A{
			bson.D{{Key: "$divide", Value: bson.A{bson.D{{Key: "$add", Value: ones}}, len(checks)}}},
			maxCompletion,
		}}},
		0,
	}}}
}

func percent(raw string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value < 0 || value > maxCompletion {
		return fallback
	}
	return value
}

func yesNo(raw string) string {
	if raw == FilterYes || raw == FilterNo {
		return raw
	}
	return ""
}
