package jobs

import (
	"context"
	"net/url"
	"slices"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// Job directory sort keys, as the console sends them.
const (
	JobSortAnalyzed   = "analyzed"
	JobSortPosted     = "posted"
	JobSortTitle      = "title"
	JobSortCompany    = "company"
	JobSortCompletion = "completion"
	JobSortPay        = "pay"
)

var jobSorts = []string{JobSortAnalyzed, JobSortPosted, JobSortTitle, JobSortCompany, JobSortCompletion, JobSortPay}

// JobQuery is the job directory's search, filters, sort, and page.
type JobQuery struct {
	ListQuery
	Source     string
	Workplace  string
	Seniority  string
	Employment string
	// MinCompletion and MaxCompletion bound the completion percentage, both inclusive.
	MinCompletion int
	MaxCompletion int
	// HasPay and HasCompany are FilterYes, FilterNo, or "" for either.
	HasPay     string
	HasCompany string
	Sort       string
	Desc       bool
}

// ParseJobQuery reads the job directory's query string. Unknown values fall back to no
// filter and the default sort, newest analysis first.
func ParseJobQuery(values url.Values) JobQuery {
	query := JobQuery{
		ListQuery:     ParseListQuery(values.Get("page"), values.Get("pageSize"), values.Get("q")),
		Source:        strings.TrimSpace(values.Get("source")),
		Workplace:     strings.TrimSpace(values.Get("workplace")),
		Seniority:     strings.TrimSpace(values.Get("seniority")),
		Employment:    strings.TrimSpace(values.Get("employment")),
		MinCompletion: percent(values.Get("minCompletion"), 0),
		MaxCompletion: percent(values.Get("maxCompletion"), maxCompletion),
		HasPay:        yesNo(values.Get("pay")),
		HasCompany:    yesNo(values.Get("company")),
		Sort:          JobSortAnalyzed,
		Desc:          true,
	}
	if sort := values.Get("sort"); slices.Contains(jobSorts, sort) {
		query.Sort = sort
		query.Desc = values.Get("dir") == "desc"
	}
	return query
}

// JobRow is one directory row: the public job and how complete it is.
type JobRow struct {
	SearchRecord
	Completion int `json:"completion"`
}

// ListSearch is a page of published jobs, searched, filtered, and sorted. Completion
// is worked out in the database so it can be filtered and sorted on.
func (s *Store) ListSearch(ctx context.Context, query JobQuery, now time.Time) (SearchList, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: jobDirectoryFilter(query)}},
		{{Key: "$addFields", Value: bson.D{{Key: "completion", Value: jobCompletion()}}}},
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
			bson.D{{Key: "$sort", Value: jobSort(query)}},
			bson.D{{Key: "$skip", Value: (query.Page - 1) * query.PageSize}},
			bson.D{{Key: "$limit", Value: query.PageSize}},
		}},
	}}})

	cursor, err := s.structured().Aggregate(ctx, pipeline)
	if err != nil {
		return SearchList{}, err
	}
	defer cursor.Close(ctx)
	var facets []struct {
		Total []struct {
			N int64 `bson:"n"`
		} `bson:"total"`
		Rows []struct {
			// Record is a named, exported field. An inline embed of the unexported
			// storedSearchJob type is ignored by the BSON decoder, which is how the
			// jobs table showed blank titles and a year-1 analyzed date.
			Record     storedSearchJob `bson:",inline"`
			Completion int             `bson:"completion"`
		} `bson:"rows"`
	}
	if err := cursor.All(ctx, &facets); err != nil {
		return SearchList{}, err
	}
	out := SearchList{Jobs: []JobRow{}, Page: query.Page, PageSize: query.PageSize}
	if len(facets) > 0 {
		if len(facets[0].Total) > 0 {
			out.Total = facets[0].Total[0].N
		}
		for _, row := range facets[0].Rows {
			out.Jobs = append(out.Jobs, JobRow{SearchRecord: row.Record.view(now), Completion: row.Completion})
		}
	}
	out.Pending, err = s.pendingCount(ctx)
	return out, err
}

func jobDirectoryFilter(query JobQuery) bson.D {
	filter := bson.D{}
	if pattern := searchPattern(query.Q); pattern != "" {
		regex := bson.D{{Key: "$regex", Value: pattern}, {Key: "$options", Value: "i"}}
		or := bson.A{}
		for _, key := range []string{"job.title", "job.company", "job.location", "job.team", "job.skills"} {
			or = append(or, bson.D{{Key: key, Value: regex}})
		}
		filter = append(filter, bson.E{Key: "$or", Value: or})
	}
	exact := func(key, value string) {
		if value != "" {
			filter = append(filter, bson.E{Key: key, Value: value})
		}
	}
	exact("job.source", query.Source)
	exact("job.workplace", query.Workplace)
	exact("job.seniority", query.Seniority)
	exact("job.employment", query.Employment)

	hasPay := bson.A{
		bson.D{{Key: "job.pay.min", Value: bson.D{{Key: "$gt", Value: 0}}}},
		bson.D{{Key: "job.pay.max", Value: bson.D{{Key: "$gt", Value: 0}}}},
		bson.D{{Key: "job.equity", Value: true}},
	}
	switch query.HasPay {
	case FilterYes:
		filter = append(filter, bson.E{Key: "$and", Value: bson.A{bson.D{{Key: "$or", Value: hasPay}}}})
	case FilterNo:
		filter = append(filter, bson.E{Key: "$nor", Value: hasPay})
	}
	switch query.HasCompany {
	case FilterYes:
		filter = append(filter, bson.E{Key: "job.companyId", Value: bson.D{{Key: "$gt", Value: ""}}})
	case FilterNo:
		filter = append(filter, bson.E{Key: "job.companyId", Value: bson.D{{Key: "$in", Value: bson.A{nil, ""}}}})
	}
	return filter
}

// jobCompletion is the share of a public job's facts that are filled in, as a whole
// percentage: a real location, pay, team, linked company, and each part of the write-up.
func jobCompletion() bson.D {
	text := func(path string) bson.D {
		return bson.D{{Key: "$gt", Value: bson.A{bson.D{{Key: "$ifNull", Value: bson.A{path, ""}}}, ""}}}
	}
	list := func(path string) bson.D {
		return bson.D{{Key: "$gt", Value: bson.A{bson.D{{Key: "$size", Value: bson.D{{Key: "$ifNull", Value: bson.A{path, bson.A{}}}}}}, 0}}}
	}
	return percentOf(bson.A{
		bson.D{{Key: "$and", Value: bson.A{text("$job.location"), bson.D{{Key: "$ne", Value: bson.A{"$job.location", locationNotListed}}}}}},
		bson.D{{Key: "$or", Value: bson.A{
			bson.D{{Key: "$gt", Value: bson.A{bson.D{{Key: "$ifNull", Value: bson.A{"$job.pay.max", 0}}}, 0}}},
			bson.D{{Key: "$eq", Value: bson.A{"$job.equity", true}}},
		}}},
		text("$job.team"),
		text("$job.companyId"),
		text("$job.summary"),
		list("$job.skills"),
		list("$job.responsibilities"),
		list("$job.requirements"),
		list("$job.benefits"),
	})
}

func jobSort(query JobQuery) bson.D {
	direction := 1
	if query.Desc {
		direction = -1
	}
	key := map[string]string{
		JobSortAnalyzed:   "analyzedAt",
		JobSortPosted:     "postedAt",
		JobSortTitle:      "job.title",
		JobSortCompany:    "job.company",
		JobSortCompletion: "completion",
		JobSortPay:        "job.pay.max",
	}[query.Sort]
	sort := bson.D{{Key: key, Value: direction}}
	if key != "analyzedAt" {
		sort = append(sort, bson.E{Key: "analyzedAt", Value: -1})
	}
	return append(sort, bson.E{Key: "_id", Value: -1})
}

// publishable reports whether an analysis says enough to publish the job: a real
// title and company, a summary, what the job involves or asks for, and its skills.
func publishable(job SearchJob) bool {
	return job.Title != untitledJob &&
		job.Company != unknownCompany &&
		job.Summary != "" &&
		len(job.Responsibilities)+len(job.Requirements) > 0 &&
		len(job.Skills) > 0
}
