package employer

import "github.com/sid0709/OpenSeat/opened-backend/internal/candidate"

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
