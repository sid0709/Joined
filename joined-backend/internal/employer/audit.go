package employer

import (
	"context"
	"encoding/base64"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	auditCollection   = "company_audit"
	auditDefaultLimit = 50
	auditMaxLimit     = 100

	AuditRoleChanged      = "role.changed"
	AuditMemberInvited    = "member.invited"
	AuditMemberRemoved    = "member.removed"
	AuditStageMoved       = "stage.moved"
	AuditOfferUpdated     = "offer.updated"
	AuditOfferSent        = "offer.sent"
	AuditOfferApproved    = "offer.approved"
	AuditHireMarked       = "hire.marked"
	AuditBillingPurchased = "billing.purchased"
	AuditJobAccessUpdated = "job_access.updated"

	subjectMember    = "member"
	subjectApplicant = "applicant"
	subjectOffer     = "offer"
	subjectJob       = "job"
	subjectBilling   = "billing"
)

// AuditEvent is one append-only row from GET /v1/company/team/audit.
type AuditEvent struct {
	ID           string         `json:"id" bson:"id"`
	CompanyID    string         `json:"-" bson:"companyId"`
	At           time.Time      `json:"at" bson:"at"`
	ActorID      string         `json:"actorId" bson:"actorId"`
	ActorName    string         `json:"actorName,omitempty" bson:"actorName,omitempty"`
	Action       string         `json:"action" bson:"action"`
	SubjectType  string         `json:"subjectType" bson:"subjectType"`
	SubjectID    string         `json:"subjectId" bson:"subjectId"`
	SubjectLabel string         `json:"subjectLabel,omitempty" bson:"subjectLabel,omitempty"`
	Summary      string         `json:"summary" bson:"summary"`
	Before       map[string]any `json:"before,omitempty" bson:"before,omitempty"`
	After        map[string]any `json:"after,omitempty" bson:"after,omitempty"`
}

// AuditPage is the audit list response.
type AuditPage struct {
	Events     []AuditEvent `json:"events"`
	NextCursor string       `json:"nextCursor,omitempty"`
}

func (s *Store) writeAudit(ctx context.Context, companyID string, actor Actor, event AuditEvent, now time.Time) error {
	if companyID == "" || event.Action == "" {
		return nil
	}
	id, err := newID()
	if err != nil {
		return err
	}
	event.ID = id
	event.CompanyID = companyID
	event.At = now.UTC()
	event.ActorID = actor.ID
	event.ActorName = strings.TrimSpace(actor.Name)
	event.Summary = clip(event.Summary, 240)
	_, err = s.collection(auditCollection).InsertOne(ctx, event)
	return err
}

// ParseAuditLimit reads ?limit= for the audit list. An empty value uses the default.
func ParseAuditLimit(raw string) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return auditDefaultLimit, nil
	}
	if len(raw) > 4 {
		return 0, Invalid("audit limit is invalid")
	}
	n := 0
	for _, r := range raw {
		if r < '0' || r > '9' {
			return 0, Invalid("audit limit is invalid")
		}
		n = n*10 + int(r-'0')
	}
	if n < 1 {
		return 0, Invalid("audit limit is invalid")
	}
	if n > auditMaxLimit {
		return auditMaxLimit, nil
	}
	return n, nil
}

// ListAudit returns newest events first. cursor is opaque.
func (s *Store) ListAudit(ctx context.Context, companyID, cursor string, limit int) (AuditPage, error) {
	if limit < 1 || limit > auditMaxLimit {
		limit = auditDefaultLimit
	}
	filter := bson.D{{Key: "companyId", Value: companyID}}
	if strings.TrimSpace(cursor) != "" {
		at, id, err := decodeAuditCursor(cursor)
		if err != nil {
			return AuditPage{}, err
		}
		filter = append(filter, bson.E{Key: "$or", Value: bson.A{
			bson.D{{Key: "at", Value: bson.D{{Key: "$lt", Value: at}}}},
			bson.D{{Key: "at", Value: at}, {Key: "id", Value: bson.D{{Key: "$lt", Value: id}}}},
		}})
	}
	cur, err := s.collection(auditCollection).Find(ctx, filter, options.Find().
		SetSort(bson.D{{Key: "at", Value: -1}, {Key: "id", Value: -1}}).
		SetLimit(int64(limit)))
	if err != nil {
		return AuditPage{}, err
	}
	defer cur.Close(ctx)
	events := []AuditEvent{}
	if err := cur.All(ctx, &events); err != nil {
		return AuditPage{}, err
	}
	page := AuditPage{Events: events}
	if len(events) == limit {
		last := events[len(events)-1]
		page.NextCursor = encodeAuditCursor(last.At, last.ID)
	}
	return page, nil
}

func encodeAuditCursor(at time.Time, id string) string {
	payload := at.UTC().Format(time.RFC3339Nano) + "|" + id
	return base64.RawURLEncoding.EncodeToString([]byte(payload))
}

func decodeAuditCursor(raw string) (time.Time, string, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(raw))
	if err != nil {
		return time.Time{}, "", Invalid("audit cursor is invalid")
	}
	payload := string(decoded)
	atRaw, id, ok := strings.Cut(payload, "|")
	if !ok || id == "" {
		return time.Time{}, "", Invalid("audit cursor is invalid")
	}
	at, err := time.Parse(time.RFC3339Nano, atRaw)
	if err != nil {
		return time.Time{}, "", Invalid("audit cursor is invalid")
	}
	return at, id, nil
}
