package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/openai"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type ModelReader interface {
	Model() string
	JSON(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error)
}

const maxAnalyzeIDs = 25

var (
	ErrNoSelection = errors.New("select at least one temp job")
	ErrTooMany     = errors.New("select at most 25 temp jobs")
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

func (s *Store) AnalyzeSelected(ctx context.Context, reader ModelReader, tempJobIDs []string, now time.Time) (AnalyzeBatch, error) {
	ids, err := normalizeSelection(tempJobIDs)
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

	batch := AnalyzeBatch{
		Model:    reader.Model(),
		Analyzed: []SearchRecord{},
		Failed:   []AnalyzeFailure{},
	}
	for _, id := range ids {
		record, err := s.analyzeOne(ctx, reader, id, now)
		if err != nil {
			if IsMissingAPIKey(err) {
				return AnalyzeBatch{}, err
			}
			batch.Failed = append(batch.Failed, AnalyzeFailure{TempJobID: id, Error: err.Error()})
			continue
		}
		batch.Analyzed = append(batch.Analyzed, record)
	}
	return batch, nil
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

func (s *Store) analyzeOne(ctx context.Context, reader ModelReader, tempJobID string, now time.Time) (SearchRecord, error) {
	listing, err := s.listingForAnalysis(ctx, tempJobID)
	if err != nil {
		return SearchRecord{}, err
	}
	payload, err := reader.JSON(ctx, extractSystemPrompt, listingPrompt(listing), json.RawMessage(extractionSchema))
	if err != nil {
		return SearchRecord{}, err
	}
	extracted, err := parseExtraction(payload)
	if err != nil {
		return SearchRecord{}, fmt.Errorf("read structured job: %w", err)
	}

	record := storedSearchJob{
		ID:         listing.ID,
		TempJobID:  listing.ID.Hex(),
		PostedAt:   listing.PostedAt,
		ApplyLink:  listing.ApplyLink,
		AnalyzedAt: now.UTC(),
		Model:      reader.Model(),
		Job: buildSearchJob(
			searchID(listing.Title, listing.CompanyName, listing.ID.Hex()),
			listing.Title,
			listing.CompanyName,
			listing.PostedAt,
			now,
			listingHints{
				Location:   listing.Metadata.Details.Location,
				Remote:     listing.Metadata.Details.Remote,
				Seniority:  listing.Metadata.Details.Seniority,
				Employment: listing.Metadata.Details.Time,
			},
			extracted,
		),
	}
	if err := s.saveSearchJob(ctx, record); err != nil {
		return SearchRecord{}, err
	}
	return record.view(now), nil
}

func (s *Store) listingForAnalysis(ctx context.Context, tempJobID string) (tempListing, error) {
	if tempJobID == "" {
		return s.nextTempListing(ctx)
	}
	objectID, err := bson.ObjectIDFromHex(tempJobID)
	if err != nil {
		return tempListing{}, ErrInvalidID
	}
	return s.tempListing(ctx, objectID)
}

func IsMissingAPIKey(err error) bool {
	return errors.Is(err, openai.ErrMissingAPIKey)
}
