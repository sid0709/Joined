package candidate

import (
	"regexp"
	"time"
)

const (
	boardNew       = "new"
	boardScreening = "screening"
	boardInterview = "interview"
	boardOffer     = "offer"
	boardHired     = "hired"
	boardRejected  = "rejected"

	reasonBoardHired = "Hired"

	maxCompanyStageSlug = 80
	maxStageHistory     = 64
)

var companyStageSlug = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// CompanyBoardStage is the hiring column: a stored company stage, else the candidate column.
func CompanyBoardStage(columnID, stored, closedReason string) string {
	switch stored {
	case boardNew, boardScreening, boardInterview, boardOffer, boardHired, boardRejected:
		return stored
	}
	if stored != "" && len(stored) <= maxCompanyStageSlug && companyStageSlug.MatchString(stored) {
		return stored
	}
	switch columnID {
	case StageScreening:
		return boardScreening
	case StageInterview:
		return boardInterview
	case StageOffer:
		return boardOffer
	case StageClosed:
		if closedReason == reasonBoardHired {
			return boardHired
		}
		return boardRejected
	default:
		return boardNew
	}
}

// recordStageEntry stores when the company column changes.
// A first change on an older application seeds the stage being left at the apply time.
func recordStageEntry(app *Application, previous, next string, at time.Time) {
	if app == nil || next == "" || previous == next {
		return
	}
	at = at.UTC()
	if len(app.StageHistory) == 0 && previous != "" {
		anchor := app.StageEnteredAt
		if anchor.IsZero() {
			anchor = appliedAnchor(*app, at)
		}
		app.StageHistory = append(app.StageHistory, StageVisit{Stage: previous, EnteredAt: anchor.UTC()})
	}
	app.StageHistory = append(app.StageHistory, StageVisit{Stage: next, EnteredAt: at})
	if len(app.StageHistory) > maxStageHistory {
		app.StageHistory = append([]StageVisit(nil), app.StageHistory[len(app.StageHistory)-maxStageHistory:]...)
	}
	app.StageEnteredAt = at
}

func appliedAnchor(app Application, fallback time.Time) time.Time {
	if n := len(app.Activity); n > 0 && !app.Activity[n-1].Date.IsZero() {
		return app.Activity[n-1].Date.UTC()
	}
	if !app.Updated.IsZero() {
		return app.Updated.UTC()
	}
	return fallback.UTC()
}
