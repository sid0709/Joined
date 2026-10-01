package employer

import (
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
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
	return candidate.CompanyBoardStage(columnID, stored, closedReason)
}

const (
	maxApplicantTags = 12
	maxTagRunes      = 40
)

// applicantPatch maps a company column onto the candidate board.
// A side-field patch (tags, notes, rating, interviewers) may omit the column.
// Custom stages stay on the company board and do not rewrite the candidate column.
func applicantPatch(columnID string, custom map[string]struct{}, hasSide bool) (column, reason, companyStage string, ok bool) {
	if columnID == "" {
		return "", "", "", hasSide
	}
	if column, reason, ok = candidateStage(columnID); ok {
		return column, reason, columnID, true
	}
	if _, ok := custom[columnID]; ok {
		return "", "", columnID, true
	}
	return "", "", "", false
}

func fixedCompanyStage(id string) bool {
	switch id {
	case stageNew, stageScreening, stageInterview, stageOffer, stageHired, stageRejected:
		return true
	default:
		return false
	}
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
