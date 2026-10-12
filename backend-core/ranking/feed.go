package ranking

import (
	"context"
	"fmt"
	"time"

	"github.com/sid0709/Joined/backend-core/fitscore"
	"github.com/sid0709/Joined/backend-core/jobschema"
)

// Fan-out limits: a new job reaches at most fanOutUsers profiles per vector, and
// only those at least fanOutMinSimilarity close.
const (
	fanOutUsers         = 200
	fanOutMinSimilarity = 0.6
	// fanOutJobsPerBatch bounds one users query batch (each job adds up to four searches).
	fanOutJobsPerBatch = 32
)

// RebuildFeed recomputes a user's "For you" feed from scratch.
func (s *Service) RebuildFeed(ctx context.Context, userID string) error {
	if !s.Ready() {
		return nil
	}
	now := time.Now()
	user, err := s.users.load(ctx, userID, now)
	if err != nil {
		return err
	}
	if user == nil || user.Features.Empty() {
		return nil
	}
	index := s.index.Load()
	req := Request{UserID: userID, Sort: SortRecommended, List: ListAll, Now: now}.normalized()
	list, err := s.rankFull(ctx, req, ModeProfile, ArmControl, Parsed{}, user, index, index.Match(Filter{}), s.control, newStageTimer())
	if err != nil {
		return fmt.Errorf("rank feed: %w", err)
	}
	s.storeFeed(ctx, user, list)
	return nil
}

// FanOut inserts newly indexed jobs into the feeds of the users they match.
// titles and bodies are the jobs' embeddings, by job id.
func (s *Service) FanOut(ctx context.Context, jobs []JobFeatures, titles, bodies map[string][]float32) error {
	if s.qdrant == nil || len(jobs) == 0 {
		return nil
	}
	now := time.Now()
	for start := 0; start < len(jobs); start += fanOutJobsPerBatch {
		batch := jobs[start:min(start+fanOutJobsPerBatch, len(jobs))]
		var queries []Query
		var owners []int
		for i, job := range batch {
			if title, ok := titles[job.JobID]; ok {
				for r := 0; r < maxTargetRoles; r++ {
					queries = append(queries, Query{Using: roleVector(r), Dense: title, Limit: fanOutUsers})
					owners = append(owners, i)
				}
			}
			if body, ok := bodies[job.JobID]; ok {
				queries = append(queries, Query{Using: vectorProfile, Dense: body, Limit: fanOutUsers})
				owners = append(owners, i)
			}
		}
		results, err := s.qdrant.QueryUsers(ctx, s.cfg.UsersCollection, queries, fanOutMinSimilarity)
		if err != nil {
			return err
		}
		type match struct {
			profile ProfileFeatures
			sig     signals
		}
		perJob := make([]map[string]*match, len(batch))
		for q, hits := range results {
			job := owners[q]
			if perJob[job] == nil {
				perJob[job] = map[string]*match{}
			}
			isProfile := queries[q].Using == vectorProfile
			for _, hit := range hits {
				profile, ok := profileFromPayload(hit.Payload)
				if !ok {
					continue
				}
				m, seen := perJob[job][profile.UserID]
				if !seen {
					m = &match{profile: profile}
					perJob[job][profile.UserID] = m
				}
				if isProfile {
					m.sig.profileBody = max(m.sig.profileBody, hit.Score)
				} else {
					m.sig.roleTitle = max(m.sig.roleTitle, hit.Score)
				}
			}
		}
		feeds := map[string][]Scored{}
		for i, matches := range perJob {
			job := batch[i]
			for _, m := range matches {
				profile := m.profile
				fit := fitProfileFromFeatures(profile)
				sc := &scoringContext{now: now, profile: &profile, fitProfile: &fit, tax: s.tax}
				features, _ := computeFeatures(sc, &job, m.sig)
				score := s.control.Score(ModeProfile, &features)
				if !job.PostedAt.IsZero() && now.Sub(job.PostedAt) < newJobAge {
					score += newJobBoost
				}
				key := profile.UserID + ":" + profile.Hash
				feeds[key] = append(feeds[key], Scored{ID: job.JobID, Score: score})
			}
		}
		for key, items := range feeds {
			if err := s.cache.AddToFeed(ctx, key, items, s.cfg.FeedSize); err != nil {
				s.log.Warn("ranking fan-out", "error", err, "feed", key)
			}
		}
	}
	return nil
}

// fitProfileFromFeatures rebuilds the fit scorer's view of a profile from stored
// features, for scoring without loading the profile (the fan-out).
func fitProfileFromFeatures(p ProfileFeatures) fitscore.Profile {
	locations := append([]string{}, p.Cities...)
	if p.WantsRemote {
		locations = append(locations, "Remote")
	}
	out := fitscore.Profile{
		TargetRoles: p.TargetRoles,
		Locations:   locations,
		Workplace:   workplaceName(p.Workplace),
		SalaryFloor: int(p.SalaryFloorUSD),
		Skills:      p.Skills,
	}
	if p.CurrentTitle != "" {
		out.ExperienceTitles = []string{p.CurrentTitle}
	}
	if level := levelName(p.Seniority); level != "" && level != jobschema.SeniorityMiddle {
		out.Headline = level + " " + p.CurrentTitle
	}
	if p.NeedsVisa {
		out.Authorization = authorizationNeedsSponsor
	}
	return out
}
