package employer

import (
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

const (
	scheduleModeFixed   = "fixed"
	scheduleModePropose = "propose"
	scheduleModeSelf    = "self_schedule"

	interviewAwaiting  = candidate.CompanyStatusAwaiting
	interviewScheduled = "scheduled"

	// maxProposedSlots matches joined-frontend MAX_PROPOSED_SLOTS.
	maxProposedSlots = 5
)

// schedulePlan is the validated company round written onto the interview.
type schedulePlan struct {
	Mode            string
	CompanyStatus   string
	CandidateStatus string
	OpenSlot        bool
	Where           string
	MeetingURL      string
	ProposedSlots   []candidate.ProposedSlot
	SelfSchedule    bool
	Date            string
	Start           string
	End             string
}

func planSchedule(input ScheduleInput) (schedulePlan, error) {
	mode := strings.ToLower(strings.TrimSpace(input.Mode))
	if mode == "" {
		mode = scheduleModeFixed
	}
	switch mode {
	case scheduleModeFixed, scheduleModePropose, scheduleModeSelf:
	default:
		return schedulePlan{}, ErrInvalidInput
	}
	if input.SelfSchedule && mode == scheduleModeFixed {
		mode = scheduleModeSelf
	}
	slots := normalizeProposedSlots(input.ProposedSlots)
	where, meeting := resolveJoin(input.Where, input.MeetingURL)
	plan := schedulePlan{
		Mode:          mode,
		Where:         where,
		MeetingURL:    meeting,
		Date:          strings.TrimSpace(input.Date),
		Start:         strings.TrimSpace(input.Start),
		End:           strings.TrimSpace(input.End),
		ProposedSlots: slots,
	}
	switch mode {
	case scheduleModePropose:
		if len(slots) == 0 {
			return schedulePlan{}, ErrInvalidInput
		}
		plan.CompanyStatus = interviewAwaiting
		plan.CandidateStatus = candidate.StatusUnconfirmed
		plan.OpenSlot = true
		// The client may echo the first offer as date/start/end. That echo is
		// not a lock — PATCH date/start/end locks the round.
		plan.Date, plan.Start, plan.End = "", "", ""
	case scheduleModeSelf:
		plan.SelfSchedule = true
		plan.CompanyStatus = interviewAwaiting
		plan.CandidateStatus = candidate.StatusUnconfirmed
		plan.OpenSlot = true
		plan.Date, plan.Start, plan.End = "", "", ""
	default:
		plan.ProposedSlots = nil
		plan.CompanyStatus = interviewScheduled
		plan.CandidateStatus = candidate.StatusScheduled
	}
	return plan, nil
}

func resolveJoin(where, meetingURL string) (string, string) {
	where = clipJoin(where)
	meetingURL = clipJoin(meetingURL)
	if where == "" {
		where = meetingURL
	}
	if meetingURL == "" && isHTTP(where) {
		meetingURL = where
	}
	return where, meetingURL
}

func clipJoin(value string) string {
	value = strings.TrimSpace(value)
	runes := []rune(value)
	if len(runes) > candidate.MaxWhereLen {
		return string(runes[:candidate.MaxWhereLen])
	}
	return value
}

func isHTTP(value string) bool {
	lower := strings.ToLower(value)
	return strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "http://")
}

func normalizeProposedSlots(slots []candidate.ProposedSlot) []candidate.ProposedSlot {
	if len(slots) == 0 {
		return nil
	}
	out := make([]candidate.ProposedSlot, 0, min(len(slots), maxProposedSlots))
	for _, slot := range slots {
		slot.Date = strings.TrimSpace(slot.Date)
		slot.Start = strings.TrimSpace(slot.Start)
		slot.End = strings.TrimSpace(slot.End)
		if !validDate(slot.Date) || !validTime(slot.Start) || !validTime(slot.End) {
			continue
		}
		out = append(out, slot)
		if len(out) == maxProposedSlots {
			break
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func validDate(value string) bool {
	if len(value) != 10 || value[4] != '-' || value[7] != '-' {
		return false
	}
	for i := 0; i < len(value); i++ {
		if i == 4 || i == 7 {
			continue
		}
		if value[i] < '0' || value[i] > '9' {
			return false
		}
	}
	return true
}

func validTime(value string) bool {
	if len(value) != 5 || value[2] != ':' {
		return false
	}
	for i := 0; i < len(value); i++ {
		if i == 2 {
			continue
		}
		if value[i] < '0' || value[i] > '9' {
			return false
		}
	}
	return true
}

func (input InterviewUpdate) anyField() bool {
	return input.Status != nil || input.Where != nil || input.MeetingURL != nil || input.ProposedSlots != nil || input.Date != nil || input.Start != nil || input.End != nil
}

// applyInterviewUpdate mutates a company round. attendance is set when the
// caller should run the attended / no-show wallet path.
func applyInterviewUpdate(item candidate.Interview, input InterviewUpdate) (candidate.Interview, string, bool, error) {
	if !input.anyField() {
		return candidate.Interview{}, "", false, ErrInvalidInput
	}
	attendance := ""
	if input.Status != nil {
		attendance = strings.TrimSpace(*input.Status)
		if attendance != "" && attendance != "attended" && attendance != "no-show" {
			return candidate.Interview{}, "", false, ErrInvalidInput
		}
	}
	changed := false
	locking := input.Date != nil || input.Start != nil || input.End != nil
	if locking {
		if input.Date == nil || input.Start == nil || input.End == nil {
			return candidate.Interview{}, "", false, ErrInvalidInput
		}
		date := strings.TrimSpace(*input.Date)
		start := strings.TrimSpace(*input.Start)
		end := strings.TrimSpace(*input.End)
		if !validDate(date) || !validTime(start) || !validTime(end) {
			return candidate.Interview{}, "", false, ErrInvalidInput
		}
		if item.CompanyStatus == "attended" || item.CompanyStatus == "no-show" {
			return candidate.Interview{}, "", false, ErrInvalidInput
		}
		if input.ProposedSlots != nil {
			return candidate.Interview{}, "", false, ErrInvalidInput
		}
		item.Date = date
		item.Start = start
		item.End = end
		if item.CompanyStatus == interviewAwaiting || item.CompanyStatus == "" {
			item.CompanyStatus = interviewScheduled
			item.Status = candidate.StatusScheduled
		}
		changed = true
	}
	if input.ProposedSlots != nil {
		if item.CompanyStatus != interviewAwaiting {
			return candidate.Interview{}, "", false, ErrInvalidInput
		}
		slots := normalizeProposedSlots(*input.ProposedSlots)
		if len(slots) == 0 {
			return candidate.Interview{}, "", false, ErrInvalidInput
		}
		item.ProposedSlots = slots
		changed = true
	}
	if input.Where != nil {
		item.Where = clipJoin(*input.Where)
		if item.Where == "" {
			item.Where = item.Format
		}
		changed = true
	}
	if input.MeetingURL != nil {
		item.MeetingURL = clipJoin(*input.MeetingURL)
		if (item.Where == "" || item.Where == item.Format) && item.MeetingURL != "" {
			item.Where = item.MeetingURL
		}
		changed = true
	}
	if attendance != "" && item.CompanyStatus == interviewAwaiting {
		return candidate.Interview{}, "", false, ErrInvalidInput
	}
	if attendance != "" {
		changed = true
	}
	if !changed {
		return candidate.Interview{}, "", false, ErrInvalidInput
	}
	return item, attendance, true, nil
}

func presentedWhere(item candidate.Interview) string {
	where := strings.TrimSpace(item.Where)
	if where == "" || where == item.Format {
		return ""
	}
	return where
}
