package jobs

import (
	"context"
	"net/url"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Staged company list statuses, as the migration table shows them.
const (
	// StagedWaiting is a copied company research has not tried.
	StagedWaiting = "waiting"
	// StagedNotFound is a staged company research could not find on the web.
	StagedNotFound = "not_found"
)

// StagedCompanyQuery is the staged-company list's search and page.
type StagedCompanyQuery struct {
	ListQuery
	// HideNotFound leaves out companies research already tried and could not find.
	HideNotFound bool
}

// ParseStagedCompanyQuery reads the staged-company list's query string.
// hide=notFound is the only hide value; anything else shows every staged company.
func ParseStagedCompanyQuery(values url.Values) StagedCompanyQuery {
	return StagedCompanyQuery{
		ListQuery:    ParseListQuery(values.Get("page"), values.Get("pageSize"), values.Get("q")),
		HideNotFound: values.Get("hide") == "notFound",
	}
}

// StagedCompany is one row of the company migration list: a copy waiting in
// staging, or one research could not find.
type StagedCompany struct {
	CompanySummary
	Status       string     `json:"status"`
	ResearchedAt *time.Time `json:"researchedAt,omitempty"`
}

// StagedCompanyList is one page of staged companies.
type StagedCompanyList struct {
	Companies []StagedCompany `json:"companies"`
	Total     int64           `json:"total"`
	Page      int64           `json:"page"`
	PageSize  int64           `json:"pageSize"`
}

type stagedCompanyDoc struct {
	// Company is a named, exported field. Inlining the unexported storedCompany
	// type makes the decoder skip the name, website, and job count.
	Company  storedCompany `bson:",inline"`
	Research struct {
		At    *time.Time `bson:"at"`
		Found *bool      `bson:"found"`
	} `bson:"research"`
}

var stagedCompanyProjection = bson.D{
	{Key: "id", Value: 1},
	{Key: "companyName", Value: 1},
	{Key: "companyUrl", Value: 1},
	{Key: "companyLogo", Value: 1},
	{Key: "jobCount", Value: 1},
	{Key: "overrides", Value: 1},
	{Key: "logoFile.contentType", Value: 1},
	{Key: "research.at", Value: 1},
	{Key: "research.found", Value: 1},
}

// ListStagedCompanies is a page of companies copied into staging, busiest first.
// Published companies are not here; research moves those into the directory.
func (s *Store) ListStagedCompanies(ctx context.Context, query StagedCompanyQuery) (StagedCompanyList, error) {
	filter := stagedCompanyFilter(query)
	coll := s.stagedCompanies()
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return StagedCompanyList{}, err
	}
	opts := options.Find().
		SetSkip((query.Page - 1) * query.PageSize).
		SetLimit(query.PageSize).
		SetSort(bson.D{{Key: "jobCount", Value: -1}, {Key: "companyName", Value: 1}, {Key: "id", Value: 1}}).
		SetProjection(stagedCompanyProjection)
	cursor, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return StagedCompanyList{}, err
	}
	defer cursor.Close(ctx)

	var docs []stagedCompanyDoc
	if err := cursor.All(ctx, &docs); err != nil {
		return StagedCompanyList{}, err
	}
	out := StagedCompanyList{
		Companies: make([]StagedCompany, 0, len(docs)),
		Total:     total,
		Page:      query.Page,
		PageSize:  query.PageSize,
	}
	for _, doc := range docs {
		out.Companies = append(out.Companies, StagedCompany{
			CompanySummary: doc.Company.summary(),
			Status:         stagedStatus(doc.Research.Found),
			ResearchedAt:   doc.Research.At,
		})
	}
	return out, nil
}

func stagedCompanyFilter(query StagedCompanyQuery) bson.D {
	filter := bson.D{}
	if pattern := searchPattern(query.Q); pattern != "" {
		regex := bson.D{{Key: "$regex", Value: pattern}, {Key: "$options", Value: "i"}}
		filter = append(filter, bson.E{Key: "$or", Value: bson.A{
			bson.D{{Key: "companyName", Value: regex}},
			bson.D{{Key: "overrides.name", Value: regex}},
			bson.D{{Key: "companyUrl", Value: regex}},
			bson.D{{Key: "overrides.url", Value: regex}},
		}})
	}
	if query.HideNotFound {
		filter = append(filter, bson.E{Key: researchFoundField, Value: bson.D{{Key: "$ne", Value: false}}})
	}
	return filter
}

// stagedStatus reports not found only when research explicitly missed the company.
// A company research found but has not published yet still reads as waiting.
func stagedStatus(found *bool) string {
	if found != nil && !*found {
		return StagedNotFound
	}
	return StagedWaiting
}
