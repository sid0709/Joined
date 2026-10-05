package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/openai"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type ModelReader interface {
	Model() string
	JSON(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error)
	// JSONWebSearch is how analyze reads a posting when web search is on: the model
	// must search, including for a published salary the posting leaves out.
	// JSON reads the posting alone when migration turns web search off.
	WebResearcher
}

const (
	maxAnalyzeIDs      = 100
	analyzeConcurrency = 32
)

var (
	ErrNoSelection = errors.New("select at least one temp job")
	ErrTooMany     = errors.New("select at most 100 temp jobs")
)

type AnalyzeFailure struct {
	TempJobID string `json:"tempJobId"`
	Error     string `json:"error"`
}

type AnalyzeBatch struct {
	Model    string           `json:"model"`
	Analyzed []SearchRecord   `json:"analyzed"`
	Failed   []AnalyzeFailure `json:"failed"`
}

// AnalyzeScoutSelected turns selected temp_scout_jobs into search records.
func (s *Store) AnalyzeScoutSelected(ctx context.Context, reader ModelReader, ids []string, now time.Time) (AnalyzeBatch, error) {
	ids, err := normalizeSelection(ids)
	if err != nil {
		return AnalyzeBatch{}, err
	}
	if reader == nil {
		return AnalyzeBatch{}, openai.ErrMissingAPIKey
	}
	if !s.analyzeMu.TryLock() {
		return AnalyzeBatch{}, ErrAnalyzeInProgress
	}
	defer s.analyzeMu.Unlock()

	return analyzeAll(ctx, ids, analyzeConcurrency, reader.Model(), func(ctx context.Context, id string) (SearchRecord, error) {
		listing, err := s.listingFrom(ctx, s.scoutTemp(), id)
		if err != nil {
			return SearchRecord{}, err
		}
		return s.writeAnalysis(ctx, reader, listing, now)
	})
}

// analyzeAll runs every selected job at once, up to limit in flight.
// Results stay in selection order. A missing API key stops the batch.
func analyzeAll(
	ctx context.Context,
	ids []string,
	limit int,
	model string,
	analyze func(context.Context, string) (SearchRecord, error),
) (AnalyzeBatch, error) {
	if limit < 1 {
		limit = 1
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	slots := make([]analyzeSlot, len(ids))
	sem := make(chan struct{}, limit)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var fatal error

	for i, id := range ids {
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			select {
			case <-ctx.Done():
				slots[i] = analyzeSlot{failed: true, fail: AnalyzeFailure{TempJobID: id, Error: ctx.Err().Error()}}
				return
			case sem <- struct{}{}:
			}
			defer func() { <-sem }()

			mu.Lock()
			stopped := fatal != nil
			mu.Unlock()
			if stopped {
				return
			}

			record, err := analyze(ctx, id)
			if err == nil {
				slots[i] = analyzeSlot{ok: true, record: record}
				return
			}
			if IsMissingAPIKey(err) {
				mu.Lock()
				if fatal == nil {
					fatal = err
				}
				mu.Unlock()
				cancel()
				return
			}
			mu.Lock()
			stopped = fatal != nil
			mu.Unlock()
			if stopped && (errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)) {
				return
			}
			slots[i] = analyzeSlot{failed: true, fail: AnalyzeFailure{TempJobID: id, Error: err.Error()}}
		}(i, id)
	}
	wg.Wait()
	if fatal != nil {
		return AnalyzeBatch{}, fatal
	}

	batch := AnalyzeBatch{
		Model:    model,
		Analyzed: []SearchRecord{},
		Failed:   []AnalyzeFailure{},
	}
	for _, slot := range slots {
		switch {
		case slot.ok:
			batch.Analyzed = append(batch.Analyzed, slot.record)
		case slot.failed:
			batch.Failed = append(batch.Failed, slot.fail)
		}
	}
	return batch, nil
}

type analyzeSlot struct {
	record SearchRecord
	fail   AnalyzeFailure
	ok     bool
	failed bool
}

func normalizeSelection(ids []string) ([]string, error) {
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	if len(out) == 0 {
		return nil, ErrNoSelection
	}
	if len(out) > maxAnalyzeIDs {
		return nil, ErrTooMany
	}
	return out, nil
}

func (s *Store) writeAnalysis(ctx context.Context, reader ModelReader, listing tempListing, now time.Time) (SearchRecord, error) {
	record, err := s.analysisRecord(ctx, reader, listing, now, true)
	if err != nil {
		return SearchRecord{}, err
	}
	if err := s.saveSearchJob(ctx, record); err != nil {
		return SearchRecord{}, err
	}
	return record.view(now), nil
}

// analysisRecord reads a temp job with the model and builds its public record, unsaved.
// webSearch tells the model to look past the posting, including for a published salary.
func (s *Store) analysisRecord(ctx context.Context, reader ModelReader, listing tempListing, now time.Time, webSearch bool) (storedSearchJob, error) {
	if originalDescription(listing.Description) == "" {
		return storedSearchJob{}, ErrMissingDescription
	}
	payload, err := readExtraction(ctx, reader, listing, webSearch)
	if err != nil {
		return storedSearchJob{}, err
	}
	extracted, err := parseExtraction(payload)
	if err != nil {
		return storedSearchJob{}, fmt.Errorf("read structured job: %w", err)
	}

	publicID, companyID, err := s.searchIdentity(ctx, listing)
	if err != nil {
		return storedSearchJob{}, err
	}
	if listing.CompanyPublicID != "" {
		companyID = listing.CompanyPublicID
	}
	job := keepScoutFilled(buildSearchJob(
		publicID,
		companyID,
		listing.Title,
		listing.CompanyName,
		listing.PostedAt,
		now,
		listingHints{
			Location:   listing.Metadata.Details.Location,
			Remote:     listing.Metadata.Details.Remote,
			Seniority:  listing.Metadata.Details.Seniority,
			Employment: listing.Metadata.Details.Time,
			Salary:     listing.Metadata.Details.Salary,
		},
		extracted,
	), listing)
	job.Description = originalDescription(listing.Description)
	return storedSearchJob{
		ID:              listing.ID,
		TempJobID:       listing.ID.Hex(),
		PostedAt:        listing.PostedAt,
		ApplyLink:       listing.ApplyLink,
		AnalyzedAt:      now.UTC(),
		Model:           reader.Model(),
		CreatedBy:       strings.TrimSpace(listing.CreatedBy),
		Source:          strings.TrimSpace(listing.Source),
		SourceRef:       strings.TrimSpace(listing.SourceRef),
		SourceCompanyID: listing.sourceCompanyID(),
		Job:             job,
	}, nil
}

// readExtraction asks the model for the structured posting. With web search it must
// look the company up; without it, the posting is the only source.
func readExtraction(ctx context.Context, reader ModelReader, listing tempListing, webSearch bool) ([]byte, error) {
	user := listingPrompt(listing)
	schema := json.RawMessage(extractionSchema)
	if !webSearch {
		return reader.JSON(ctx, extractSystemPromptNoSearch, user, schema)
	}
	payload, _, err := reader.JSONWebSearch(ctx, extractSystemPrompt, user, schema)
	return payload, err
}

func (s *Store) listingFrom(ctx context.Context, coll *mongo.Collection, idHex string) (tempListing, error) {
	objectID, err := bson.ObjectIDFromHex(idHex)
	if err != nil {
		return tempListing{}, ErrInvalidID
	}
	var listing tempListing
	err = coll.FindOne(ctx, bson.D{{Key: "_id", Value: objectID}}).Decode(&listing)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return tempListing{}, ErrNotFound
	}
	return listing, err
}

func IsMissingAPIKey(err error) bool {
	return errors.Is(err, openai.ErrMissingAPIKey)
}
