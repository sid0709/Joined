package scout

import "time"

const (
	LevelProbation = "probation"
	LevelTrusted   = "trusted"
	LevelExpert    = "expert"
)

// LevelRule is one row of the level table in docs/13-platform-scout.md.
type LevelRule struct {
	ID                  string  `json:"id"`
	Label               string  `json:"label"`
	DailyLimit          int     `json:"daily_limit"`
	AutoApprove         bool    `json:"auto_approve"`
	SpotCheckRate       float64 `json:"spot_check_rate"`
	ApprovalReward      Money   `json:"approval_reward"`
	InterviewMultiplier float64 `json:"interview_multiplier"`
}

// Currency every scout reward is paid in.
const Currency = "USD"

var levelOrder = []string{LevelProbation, LevelTrusted, LevelExpert}

var levelRules = map[string]LevelRule{
	LevelProbation: {
		ID:                  LevelProbation,
		Label:               "Probation",
		DailyLimit:          10,
		AutoApprove:         false,
		ApprovalReward:      Money{AmountCents: 0, Currency: Currency},
		InterviewMultiplier: 1,
	},
	LevelTrusted: {
		ID:                  LevelTrusted,
		Label:               "Trusted",
		DailyLimit:          50,
		AutoApprove:         true,
		ApprovalReward:      Money{AmountCents: 150, Currency: Currency},
		InterviewMultiplier: 1,
	},
	LevelExpert: {
		ID:                  LevelExpert,
		Label:               "Expert",
		DailyLimit:          150,
		AutoApprove:         true,
		SpotCheckRate:       0.1,
		ApprovalReward:      Money{AmountCents: 250, Currency: Currency},
		InterviewMultiplier: 1.25,
	},
}

// Promotion thresholds. Falling below them demotes an expert back to trusted.
type PromotionRule struct {
	MinApproved                int     `json:"min_approved"`
	MinApprovalRate            float64 `json:"min_approval_rate"`
	MaxDuplicateExpiredRate    float64 `json:"max_duplicate_expired_rate"`
	MinInterviewProducingRate  float64 `json:"min_interview_producing_rate"`
	DemoteBelowApprovalRate    float64 `json:"demote_below_approval_rate"`
	DemoteMinDecidedSubmission int     `json:"demote_min_decided"`
}

var promotion = PromotionRule{
	MinApproved:               30,
	MinApprovalRate:           0.9,
	MaxDuplicateExpiredRate:   0.05,
	MinInterviewProducingRate: 0.1,
	// R-SC-01 in docs/32-trust-and-safety.md.
	DemoteBelowApprovalRate:    0.6,
	DemoteMinDecidedSubmission: 10,
}

// Rule returns the rule for a level, defaulting unknown values to probation.
func Rule(level string) LevelRule {
	if rule, ok := levelRules[level]; ok {
		return rule
	}
	return levelRules[LevelProbation]
}

// Levels lists every level in order, for the level page.
func Levels() []LevelRule {
	rules := make([]LevelRule, 0, len(levelOrder))
	for _, id := range levelOrder {
		rules = append(rules, levelRules[id])
	}
	return rules
}

// Promotion returns the promotion thresholds.
func Promotion() PromotionRule { return promotion }

// ValidLevel reports whether a level id exists.
func ValidLevel(level string) bool {
	_, ok := levelRules[level]
	return ok
}

// Metrics are the quality numbers that drive a scout's level.
type Metrics struct {
	Submitted              int     `json:"submitted"`
	Pending                int     `json:"pending"`
	Approved               int     `json:"approved"`
	Rejected               int     `json:"rejected"`
	Duplicate              int     `json:"duplicate"`
	Expired                int     `json:"expired"`
	Live                   int     `json:"live"`
	WithInterview          int     `json:"with_interview"`
	ApprovalRate           float64 `json:"approval_rate"`
	DuplicateExpiredRate   float64 `json:"duplicate_expired_rate"`
	InterviewProducingRate float64 `json:"interview_producing_rate"`
	SubmittedToday         int     `json:"submitted_today"`
	DailyLimit             int     `json:"daily_limit"`
	RemainingToday         int     `json:"remaining_today"`
	ResetsAt               string  `json:"resets_at"`
}

// metricRow is the slice of a submission that level math needs.
type metricRow struct {
	Status      string
	Expired     bool
	Interviews  int
	SubmittedAt time.Time
	JobID       string
}

// ComputeMetrics summarizes a scout's submissions for a given level and moment.
func ComputeMetrics(level string, rows []metricRow, now time.Time) Metrics {
	var m Metrics
	dayStart := startOfDay(now)
	for _, row := range rows {
		m.Submitted++
		if !row.SubmittedAt.Before(dayStart) {
			m.SubmittedToday++
		}
		switch row.Status {
		case StatusApproved:
			m.Approved++
			if row.Interviews > 0 {
				m.WithInterview++
			}
			if row.Expired {
				m.Expired++
			} else {
				m.Live++
			}
		case StatusRejected:
			m.Rejected++
		case StatusDuplicate:
			m.Duplicate++
		default:
			m.Pending++
		}
	}
	m.ApprovalRate = ratio(m.Approved, m.Approved+m.Rejected)
	m.DuplicateExpiredRate = ratio(m.Duplicate+m.Expired, m.Submitted)
	m.InterviewProducingRate = ratio(m.WithInterview, m.Approved)
	m.DailyLimit = Rule(level).DailyLimit
	m.RemainingToday = max(0, m.DailyLimit-m.SubmittedToday)
	m.ResetsAt = dayStart.Add(24 * time.Hour).Format(time.RFC3339)
	return m
}

// MeetsPromotion reports whether metrics clear every promotion threshold.
func MeetsPromotion(m Metrics) bool {
	return m.Approved >= promotion.MinApproved &&
		m.ApprovalRate >= promotion.MinApprovalRate &&
		m.DuplicateExpiredRate <= promotion.MaxDuplicateExpiredRate &&
		m.InterviewProducingRate >= promotion.MinInterviewProducingRate
}

// NextLevel is the level above, or "" at the top.
func NextLevel(level string) string {
	for i, id := range levelOrder {
		if id == level && i+1 < len(levelOrder) {
			return levelOrder[i+1]
		}
	}
	return ""
}

// RecomputeLevel moves a scout at most one step per recompute: up when every
// promotion threshold holds, down when quality falls below them.
func RecomputeLevel(level string, m Metrics) string {
	decided := m.Approved + m.Rejected
	failing := decided >= promotion.DemoteMinDecidedSubmission && m.ApprovalRate < promotion.DemoteBelowApprovalRate
	switch level {
	case LevelExpert:
		if failing || !MeetsPromotion(m) {
			return LevelTrusted
		}
	case LevelTrusted:
		if failing {
			return LevelProbation
		}
		if MeetsPromotion(m) {
			return LevelExpert
		}
	default:
		if MeetsPromotion(m) {
			return LevelTrusted
		}
		return LevelProbation
	}
	return level
}

func ratio(part, whole int) float64 {
	if whole <= 0 {
		return 0
	}
	return float64(part) / float64(whole)
}

// startOfDay is midnight UTC; daily limits reset for every scout at once.
func startOfDay(now time.Time) time.Time {
	utc := now.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}
