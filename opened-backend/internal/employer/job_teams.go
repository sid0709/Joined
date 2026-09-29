package employer

import (
	"context"
	"errors"
	"sort"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const maxJobTeams = 40

func (s *Store) JobTeams(ctx context.Context, companyID string) (JobTeams, error) {
	stored, err := s.storedJobTeams(ctx, companyID)
	if err != nil {
		return JobTeams{}, err
	}
	fromJobs, err := s.jobTeamNames(ctx, companyID)
	if err != nil {
		return JobTeams{}, err
	}
	return JobTeams{Teams: mergeTeams(stored, fromJobs)}, nil
}

func (s *Store) SaveJobTeams(ctx context.Context, companyID string, input JobTeamsWrite) (JobTeams, error) {
	teams := compactList(input.Teams, maxJobTeams, 80)
	from := ""
	to := ""
	if input.Rename != nil {
		from = clip(input.Rename.From, 80)
		to = clip(input.Rename.To, 80)
		if from == "" || to == "" {
			return JobTeams{}, ErrInvalidInput
		}
		teams = replaceTeam(teams, from, to)
		if err := s.renameJobTeam(ctx, companyID, from, to); err != nil {
			return JobTeams{}, err
		}
	}
	_, err := s.collection(jobTeamsCollection).UpdateOne(ctx, bson.D{{Key: "companyId", Value: companyID}}, bson.D{
		{Key: "$set", Value: storedJobTeams{CompanyID: companyID, Teams: teams}},
	}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return JobTeams{}, err
	}
	return s.JobTeams(ctx, companyID)
}

func (s *Store) ensureTeam(ctx context.Context, companyID, name string) error {
	name = clip(name, 80)
	if name == "" {
		return nil
	}
	current, err := s.JobTeams(ctx, companyID)
	if err != nil {
		return err
	}
	for _, team := range current.Teams {
		if strings.EqualFold(team, name) {
			return nil
		}
	}
	if len(current.Teams) >= maxJobTeams {
		return nil
	}
	_, err = s.SaveJobTeams(ctx, companyID, JobTeamsWrite{Teams: append(current.Teams, name)})
	return err
}

func (s *Store) storedJobTeams(ctx context.Context, companyID string) ([]string, error) {
	var doc storedJobTeams
	err := s.collection(jobTeamsCollection).FindOne(ctx, bson.D{{Key: "companyId", Value: companyID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return doc.Teams, nil
}

func (s *Store) jobTeamNames(ctx context.Context, companyID string) ([]string, error) {
	cursor, err := s.collection(jobsCollection).Find(ctx, bson.D{{Key: "companyId", Value: companyID}}, options.Find().SetProjection(bson.D{{Key: "team", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []struct {
		Team string `bson:"team"`
	}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(docs))
	for _, doc := range docs {
		name := strings.TrimSpace(doc.Team)
		if name != "" {
			out = append(out, name)
		}
	}
	return out, nil
}

func (s *Store) renameJobTeam(ctx context.Context, companyID, from, to string) error {
	_, err := s.collection(jobsCollection).UpdateMany(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "team", Value: from},
	}, bson.D{{Key: "$set", Value: bson.D{{Key: "team", Value: to}}}})
	if err != nil {
		return err
	}
	return s.jobs.RenameDirectTeam(ctx, companyID, from, to)
}

func mergeTeams(lists ...[]string) []string {
	return compactList(flatten(lists), maxJobTeams, 80)
}

func flatten(lists [][]string) []string {
	n := 0
	for _, list := range lists {
		n += len(list)
	}
	out := make([]string, 0, n)
	for _, list := range lists {
		out = append(out, list...)
	}
	sort.SliceStable(out, func(i, j int) bool {
		return strings.ToLower(out[i]) < strings.ToLower(out[j])
	})
	return out
}

func replaceTeam(teams []string, from, to string) []string {
	out := make([]string, 0, len(teams)+1)
	found := false
	for _, team := range teams {
		if strings.EqualFold(team, from) {
			out = append(out, to)
			found = true
			continue
		}
		out = append(out, team)
	}
	if !found {
		out = append(out, to)
	}
	return compactList(out, maxJobTeams, 80)
}
