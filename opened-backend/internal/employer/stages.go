package employer

import (
	"strings"

	"github.com/sid0709/OpenSeat/opened-backend/internal/candidate"
)

const (
	stageNew       = "new"
	stageScreening = "screening"
	stageInterview = "interview"
	stageOffer     = "offer"
	stageHired     = "hired"
	stageRejected  = "rejected"

	reasonHired    = "Hired"
	reasonRejected = "Rejected"
)

func companyStage(columnID, stored, closedReason string) string {
	switch stored {
	case stageNew, stageScreening, stageInterview, stageOffer, stageHired, stageRejected:
		return stored
	}
	switch columnID {
	case candidate.StageScreening:
		return stageScreening
	case candidate.StageInterview:
		return stageInterview
	case candidate.StageOffer:
		return stageOffer
	case candidate.StageClosed:
		if closedReason == reasonHired {
			return stageHired
		}
		return stageRejected
	default:
		return stageNew
	}
}

const (
	maxApplicantTags = 12
	maxTagRunes      = 40
)

// applicantPatch maps a company column onto the candidate board.
// A tags-only patch leaves the stage alone; a missing column with no tags is invalid.
func applicantPatch(columnID string, hasTags bool) (column, reason, companyStage string, ok bool) {
	if columnID == "" {
		return "", "", "", hasTags
	}
	column, reason, ok = candidateStage(columnID)
	if !ok {
		return "", "", "", false
	}
	return column, reason, columnID, true
}

func normalizeTags(values []string) []string {
	out := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if len([]rune(value)) > maxTagRunes {
			value = string([]rune(value)[:maxTagRunes])
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
		if len(out) == maxApplicantTags {
			break
		}
	}
	return out
}

func candidateStage(company string) (columnID, closedReason string, ok bool) {
	switch company {
	case stageNew:
		return candidate.StageApplied, "", true
	case stageScreening:
		return candidate.StageScreening, "", true
	case stageInterview:
		return candidate.StageInterview, "", true
	case stageOffer:
		return candidate.StageOffer, "", true
	case stageHired:
		return candidate.StageClosed, reasonHired, true
	case stageRejected:
		return candidate.StageClosed, reasonRejected, true
	default:
		return "", "", false
	}
}
