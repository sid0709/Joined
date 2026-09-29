package staff

import (
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/v2/bson"
)

const (
	QueueReports    = "reports"
	QueueDisputes   = "disputes"
	QueueFraudFlags = "fraud_flags"

	StatusOpen     = "open"
	StatusPending  = "pending"
	StatusResolved = "resolved"

	DecisionUphold  = "uphold"
	DecisionDismiss = "dismiss"

	maxSubjectLen        = 120
	maxDetailsLen        = 4000
	maxEvidenceLen       = 200
	maxEvidenceCount     = 20
	maxActionLen         = 80
	maxActionCount       = 20
	appealWindow         = 7 * 24 * time.Hour
	reportSLA            = 48 * time.Hour
	disputeBusinessDays  = 5
	reportIdempotencyTTL = 24 * time.Hour
)

// objectiveReasons are the only report reasons (docs/32). "not_a_good_fit" is absent on purpose.
var objectiveReasons = map[string]struct{}{
	"no_show":                {},
	"identity_mismatch":      {},
	"proxy_interviewer":      {},
	"fake_credentials":       {},
	"abusive_behavior":       {},
	"scam_job":               {},
	"fake_company":           {},
	"fabricated_application": {},
	"payment_request":        {},
	"other_with_evidence":    {},
}

// CaseQuery is GET /v1/admin/cases.
type CaseQuery struct {
	Queue    string
	Status   string
	Page     int64
	PageSize int64
}

// ReportQuery is GET /v1/reports.
type ReportQuery struct {
	Status   string
	Page     int64
	PageSize int64
}

// CaseOpening is POST /v1/admin/cases.
type CaseOpening struct {
	Queue        string   `json:"queue"`
	ReasonCode   string   `json:"reasonCode"`
	SubjectType  string   `json:"subjectType"`
	SubjectID    string   `json:"subjectId"`
	Details      string   `json:"details"`
	EvidenceKeys []string `json:"evidenceKeys"`
}

// Normalize checks the queue, objective reason, and subject.
func (c *CaseOpening) Normalize() error {
	var fields []FieldError
	c.Queue = checkQueue(&fields, c.Queue)
	c.ReasonCode = checkReason(&fields, c.ReasonCode)
	c.SubjectType = checkText(&fields, "subjectType", c.SubjectType, maxSubjectLen, true)
	c.SubjectID = checkText(&fields, "subjectId", c.SubjectID, maxSubjectLen, true)
	c.Details = checkText(&fields, "details", c.Details, maxDetailsLen, false)
	c.EvidenceKeys = cleanList(&fields, "evidenceKeys", c.EvidenceKeys, maxEvidenceLen, maxEvidenceCount, "a key is too long", "too many keys")
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

// CaseDecision is POST /v1/admin/cases/{id}/decision.
type CaseDecision struct {
	Decision string   `json:"decision"`
	Reason   string   `json:"reason"`
	Actions  []string `json:"actions"`
}

// Normalize requires uphold or dismiss and a reason. Action codes are not locked.
func (d *CaseDecision) Normalize() error {
	var fields []FieldError
	d.Decision = checkDecision(&fields, d.Decision)
	reason, err := NormalizeReason(d.Reason, true)
	if err != nil {
		var invalid *ValidationError
		if errorsAsValidation(err, &invalid) {
			fields = append(fields, invalid.Fields...)
		}
	} else {
		d.Reason = reason
	}
	d.Actions = cleanList(&fields, "actions", d.Actions, maxActionLen, maxActionCount, "an action is too long", "too many actions")
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

// ReportFiling is POST /v1/reports.
type ReportFiling struct {
	SubjectType  string   `json:"subjectType"`
	SubjectID    string   `json:"subjectId"`
	ReasonCode   string   `json:"reasonCode"`
	Details      string   `json:"details"`
	EvidenceKeys []string `json:"evidenceKeys"`
}

// Normalize checks the objective reason and subject. Details may be empty.
func (f *ReportFiling) Normalize() error {
	var fields []FieldError
	f.ReasonCode = checkReason(&fields, f.ReasonCode)
	f.SubjectType = checkText(&fields, "subjectType", f.SubjectType, maxSubjectLen, true)
	f.SubjectID = checkText(&fields, "subjectId", f.SubjectID, maxSubjectLen, true)
	f.Details = checkText(&fields, "details", f.Details, maxDetailsLen, false)
	f.EvidenceKeys = cleanList(&fields, "evidenceKeys", f.EvidenceKeys, maxEvidenceLen, maxEvidenceCount, "a key is too long", "too many keys")
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

// ReportAppeal is POST /v1/reports/{id}/appeal.
type ReportAppeal struct {
	Statement    string   `json:"statement"`
	EvidenceKeys []string `json:"evidenceKeys"`
}

// Normalize requires a statement. Evidence keys are optional.
func (a *ReportAppeal) Normalize() error {
	var fields []FieldError
	a.Statement = checkText(&fields, "statement", a.Statement, maxDetailsLen, true)
	a.EvidenceKeys = cleanList(&fields, "evidenceKeys", a.EvidenceKeys, maxEvidenceLen, maxEvidenceCount, "a key is too long", "too many keys")
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

// ModerationCase is one row of GET /v1/admin/cases and the case on create and decision.
type ModerationCase struct {
	ID                   string     `json:"id"`
	Queue                string     `json:"queue"`
	Status               string     `json:"status"`
	ReasonCode           string     `json:"reasonCode"`
	SubjectType          string     `json:"subjectType"`
	SubjectID            string     `json:"subjectId"`
	Details              string     `json:"details"`
	EvidenceKeys         []string   `json:"evidenceKeys"`
	CreatedAt            time.Time  `json:"createdAt"`
	SLAAt                time.Time  `json:"slaAt"`
	Decision             string     `json:"decision"`
	DecisionReason       string     `json:"decisionReason,omitempty"`
	DecidedBy            string     `json:"decidedBy,omitempty"`
	DecidedAt            *time.Time `json:"decidedAt,omitempty"`
	DecisionEvidenceKeys []string   `json:"decisionEvidenceKeys,omitempty"`
	Actions              []string   `json:"actions,omitempty"`
	ReportID             string     `json:"reportId,omitempty"`
}

// CaseList is GET /v1/admin/cases.
type CaseList struct {
	Cases []ModerationCase `json:"cases"`
	Total int64            `json:"total"`
	Next  *int64           `json:"next,omitempty"`
}

// CaseResult is POST /v1/admin/cases and POST /v1/admin/cases/{id}/decision.
type CaseResult struct {
	Case    ModerationCase `json:"case"`
	AuditID string         `json:"auditId"`
}

// Appeal is the subject's response stored on a report.
type Appeal struct {
	Statement    string    `json:"statement"`
	EvidenceKeys []string  `json:"evidenceKeys"`
	At           time.Time `json:"at"`
}

// Report is one filed report.
type Report struct {
	ID           string    `json:"id"`
	SubjectType  string    `json:"subjectType"`
	SubjectID    string    `json:"subjectId"`
	ReasonCode   string    `json:"reasonCode"`
	Details      string    `json:"details"`
	EvidenceKeys []string  `json:"evidenceKeys"`
	Status       string    `json:"status"`
	Resolution   string    `json:"resolution,omitempty"`
	CaseID       string    `json:"caseId"`
	CreatedAt    time.Time `json:"createdAt"`
	Appeal       *Appeal   `json:"appeal,omitempty"`
}

// ReportList is GET /v1/reports.
type ReportList struct {
	Reports []Report `json:"reports"`
	Total   int64    `json:"total"`
	Next    *int64   `json:"next,omitempty"`
}

// ReportResult is POST /v1/reports and POST /v1/reports/{id}/appeal.
type ReportResult struct {
	Report  Report `json:"report"`
	AuditID string `json:"auditId"`
}

type storedCase struct {
	OID              bson.ObjectID `bson:"_id,omitempty"`
	ID               string        `bson:"id"`
	Queue            string        `bson:"queue"`
	Status           string        `bson:"status"`
	ReasonCode       string        `bson:"reasonCode"`
	SubjectType      string        `bson:"subjectType"`
	SubjectID        string        `bson:"subjectId"`
	Details          string        `bson:"details,omitempty"`
	EvidenceKeys     []string      `bson:"evidenceKeys"`
	CreatedAt        time.Time     `bson:"createdAt"`
	SLAAt            time.Time     `bson:"slaAt"`
	Decision         string        `bson:"decision,omitempty"`
	DecisionReason   string        `bson:"decisionReason,omitempty"`
	DecidedBy        string        `bson:"decidedBy,omitempty"`
	DecidedAt        time.Time     `bson:"decidedAt,omitempty"`
	DecisionEvidence []string      `bson:"decisionEvidenceKeys,omitempty"`
	Actions          []string      `bson:"actions,omitempty"`
	ReportID         string        `bson:"reportId,omitempty"`
}

type storedReport struct {
	OID             bson.ObjectID `bson:"_id,omitempty"`
	ID              string        `bson:"id"`
	SubjectType     string        `bson:"subjectType"`
	SubjectID       string        `bson:"subjectId"`
	ReasonCode      string        `bson:"reasonCode"`
	Details         string        `bson:"details,omitempty"`
	EvidenceKeys    []string      `bson:"evidenceKeys"`
	Status          string        `bson:"status"`
	Resolution      string        `bson:"resolution,omitempty"`
	CaseID          string        `bson:"caseId"`
	CreatedAt       time.Time     `bson:"createdAt"`
	AppealStatement string        `bson:"appealStatement,omitempty"`
	AppealEvidence  []string      `bson:"appealEvidenceKeys,omitempty"`
	AppealAt        time.Time     `bson:"appealAt,omitempty"`
}

type reportClaim struct {
	Actor     string    `bson:"actor"`
	Key       string    `bson:"key"`
	BodyHash  string    `bson:"bodyHash"`
	ReportID  string    `bson:"reportId,omitempty"`
	AuditID   string    `bson:"auditId,omitempty"`
	CreatedAt time.Time `bson:"createdAt"`
}

func (c storedCase) view() ModerationCase {
	out := ModerationCase{
		ID:             c.ID,
		Queue:          c.Queue,
		Status:         c.Status,
		ReasonCode:     c.ReasonCode,
		SubjectType:    c.SubjectType,
		SubjectID:      c.SubjectID,
		Details:        c.Details,
		EvidenceKeys:   cloneKeys(c.EvidenceKeys),
		CreatedAt:      c.CreatedAt.UTC(),
		SLAAt:          c.SLAAt.UTC(),
		Decision:       c.Decision,
		DecisionReason: c.DecisionReason,
		DecidedBy:      c.DecidedBy,
		ReportID:       c.ReportID,
	}
	if !c.DecidedAt.IsZero() {
		out.DecidedAt = timePtr(c.DecidedAt)
		out.DecisionEvidenceKeys = cloneKeys(c.DecisionEvidence)
	}
	if len(c.Actions) > 0 {
		out.Actions = cloneKeys(c.Actions)
	}
	return out
}

func (r storedReport) view() Report {
	out := Report{
		ID:           r.ID,
		SubjectType:  r.SubjectType,
		SubjectID:    r.SubjectID,
		ReasonCode:   r.ReasonCode,
		Details:      r.Details,
		EvidenceKeys: cloneKeys(r.EvidenceKeys),
		Status:       r.Status,
		Resolution:   r.Resolution,
		CaseID:       r.CaseID,
		CreatedAt:    r.CreatedAt.UTC(),
	}
	if !r.AppealAt.IsZero() {
		out.Appeal = &Appeal{
			Statement:    r.AppealStatement,
			EvidenceKeys: cloneKeys(r.AppealEvidence),
			At:           r.AppealAt.UTC(),
		}
	}
	return out
}

func newStaffCase(id, queue, reason, subjectType, subjectID, details, reportID string, keys []string, now time.Time) storedCase {
	now = now.UTC()
	return storedCase{
		ID:           id,
		Queue:        queue,
		Status:       StatusOpen,
		ReasonCode:   reason,
		SubjectType:  subjectType,
		SubjectID:    subjectID,
		Details:      details,
		EvidenceKeys: cloneKeys(keys),
		CreatedAt:    now,
		SLAAt:        caseDue(queue, now),
		ReportID:     reportID,
	}
}

func newReportPair(reportID, caseID string, input ReportFiling, now time.Time) (storedReport, storedCase) {
	now = now.UTC()
	rep := storedReport{
		ID:           reportID,
		SubjectType:  input.SubjectType,
		SubjectID:    input.SubjectID,
		ReasonCode:   input.ReasonCode,
		Details:      input.Details,
		EvidenceKeys: cloneKeys(input.EvidenceKeys),
		Status:       StatusOpen,
		CaseID:       caseID,
		CreatedAt:    now,
	}
	cas := newStaffCase(caseID, QueueReports, input.ReasonCode, input.SubjectType, input.SubjectID, input.Details, reportID, input.EvidenceKeys, now)
	return rep, cas
}

// caseDue is the staff SLA. Disputes are 5 business days; reports and fraud flags are 48 hours.
func caseDue(queue string, opened time.Time) time.Time {
	opened = opened.UTC()
	if queue == QueueDisputes {
		return addBusinessDays(opened, disputeBusinessDays)
	}
	return opened.Add(reportSLA)
}

func addBusinessDays(start time.Time, days int) time.Time {
	cursor := start.UTC()
	left := days
	for left > 0 {
		cursor = cursor.AddDate(0, 0, 1)
		weekday := cursor.Weekday()
		if weekday != time.Saturday && weekday != time.Sunday {
			left--
		}
	}
	return cursor
}

func decideRecord(cas *storedCase, input CaseDecision, actor string, now time.Time) error {
	if cas.Status == StatusResolved {
		return ErrConflict
	}
	now = now.UTC()
	cas.Status = StatusResolved
	cas.Decision = input.Decision
	cas.DecisionReason = input.Reason
	cas.DecidedBy = actor
	cas.DecidedAt = now
	cas.DecisionEvidence = cloneKeys(cas.EvidenceKeys)
	if len(input.Actions) == 0 {
		cas.Actions = nil
	} else {
		cas.Actions = cloneKeys(input.Actions)
	}
	return nil
}

func resolveReport(rep *storedReport, decision string) {
	rep.Status = StatusResolved
	rep.Resolution = decision
}

func appealRecord(rep *storedReport, cas *storedCase, input ReportAppeal, now time.Time) error {
	if rep.Status == StatusResolved {
		return conflict("that report is already resolved")
	}
	if !rep.AppealAt.IsZero() {
		return conflict("that report already has an appeal")
	}
	now = now.UTC()
	if !now.Before(rep.CreatedAt.UTC().Add(appealWindow)) {
		return conflict("the appeal window has closed")
	}
	if cas.Status == StatusResolved {
		return ErrConflict
	}
	rep.Status = StatusPending
	rep.AppealStatement = input.Statement
	rep.AppealEvidence = cloneKeys(input.EvidenceKeys)
	rep.AppealAt = now
	cas.Status = StatusPending
	cas.EvidenceKeys = mergeKeys(cas.EvidenceKeys, input.EvidenceKeys)
	cas.Details = appendAppeal(cas.Details, input.Statement)
	return nil
}

func appendAppeal(details, statement string) string {
	if details == "" {
		return statement
	}
	return details + "\n\nAppeal: " + statement
}

type statusConflict struct{ detail string }

func (e *statusConflict) Error() string { return e.detail }

func (e *statusConflict) Unwrap() error { return ErrConflict }

func conflict(detail string) error { return &statusConflict{detail: detail} }

func errorsAsValidation(err error, target **ValidationError) bool {
	if err == nil {
		return false
	}
	invalid, ok := err.(*ValidationError)
	if !ok {
		return false
	}
	*target = invalid
	return true
}

func checkText(fields *[]FieldError, field, value string, max int, required bool) string {
	value = strings.TrimSpace(value)
	if required && value == "" {
		*fields = append(*fields, FieldError{Field: field, Detail: "is required"})
		return ""
	}
	if utf8.RuneCountInString(value) > max {
		*fields = append(*fields, FieldError{Field: field, Detail: "is too long"})
	}
	return value
}

func checkReason(fields *[]FieldError, code string) string {
	code = strings.TrimSpace(code)
	if _, ok := objectiveReasons[code]; !ok {
		*fields = append(*fields, FieldError{Field: "reasonCode", Detail: "use an objective reason code"})
		return ""
	}
	return code
}

func checkQueue(fields *[]FieldError, queue string) string {
	queue = strings.TrimSpace(queue)
	switch queue {
	case QueueReports, QueueDisputes, QueueFraudFlags:
		return queue
	default:
		*fields = append(*fields, FieldError{Field: "queue", Detail: "use reports, disputes, or fraud_flags"})
		return ""
	}
}

func checkDecision(fields *[]FieldError, decision string) string {
	decision = strings.TrimSpace(decision)
	switch decision {
	case DecisionUphold, DecisionDismiss:
		return decision
	default:
		*fields = append(*fields, FieldError{Field: "decision", Detail: "use uphold or dismiss"})
		return ""
	}
}

func cleanList(fields *[]FieldError, field string, values []string, maxLen, maxCount int, tooLong, tooMany string) []string {
	out := []string{}
	seen := map[string]struct{}{}
	for _, value := range values {
		item := strings.TrimSpace(value)
		if item == "" {
			continue
		}
		if utf8.RuneCountInString(item) > maxLen {
			*fields = append(*fields, FieldError{Field: field, Detail: tooLong})
			return nil
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
		if len(out) > maxCount {
			*fields = append(*fields, FieldError{Field: field, Detail: tooMany})
			return nil
		}
	}
	return out
}

func cloneKeys(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
	return append([]string{}, values...)
}

func mergeKeys(base, extra []string) []string {
	out := cloneKeys(base)
	seen := map[string]struct{}{}
	for _, key := range out {
		seen[key] = struct{}{}
	}
	for _, key := range extra {
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, key)
	}
	return out
}

func newID() (bson.ObjectID, string) {
	oid := bson.NewObjectID()
	return oid, oid.Hex()
}

func pageSlice(page, size, total int64) (int64, int64) {
	start := (page - 1) * size
	if start < 0 || start > total {
		return total, total
	}
	end := start + size
	if end > total || end < start {
		end = total
	}
	return start, end
}
