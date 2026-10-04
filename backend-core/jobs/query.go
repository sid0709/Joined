package jobs

import (
	"regexp"
	"strconv"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
)

const (
	DefaultPageSize = 25
	// MaxPageSize is the most rows one migration list page returns. The console
	// offers 250, 500, and 1,000 so a person can select a full batch at once.
	MaxPageSize    = 1000
	MaxQueryLength = 200
)

type ListQuery struct {
	Q            string
	Page         int64
	PageSize     int64
	HideAnalyzed bool
}

func ParseListQuery(pageRaw, sizeRaw, qRaw string) ListQuery {
	query := ListQuery{
		Page:     1,
		PageSize: DefaultPageSize,
		Q:        strings.TrimSpace(qRaw),
	}
	if len(query.Q) > MaxQueryLength {
		query.Q = query.Q[:MaxQueryLength]
	}
	if page, err := strconv.ParseInt(pageRaw, 10, 64); err == nil && page > 0 {
		query.Page = page
	}
	if size, err := strconv.ParseInt(sizeRaw, 10, 64); err == nil && size > 0 {
		query.PageSize = size
	}
	if query.PageSize > MaxPageSize {
		query.PageSize = MaxPageSize
	}
	return query
}

func searchPattern(q string) string {
	q = strings.TrimSpace(q)
	if q == "" {
		return ""
	}
	return regexp.QuoteMeta(q)
}

func listFilter(q string) bson.D {
	pattern := searchPattern(q)
	if pattern == "" {
		return bson.D{}
	}
	regex := bson.D{
		{Key: "$regex", Value: pattern},
		{Key: "$options", Value: "i"},
	}
	return bson.D{{
		Key: "$or",
		Value: bson.A{
			bson.D{{Key: "title", Value: regex}},
			bson.D{{Key: "companyName", Value: regex}},
		},
	}}
}
