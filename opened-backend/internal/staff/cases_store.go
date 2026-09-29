package staff

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func (s *Store) ensureTrustIndexes(ctx context.Context) error {
	if _, err := s.casesColl().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "queue", Value: 1}, {Key: "status", Value: 1}, {Key: "createdAt", Value: 1}}},
		{Keys: bson.D{{Key: "id", Value: 1}}, Options: options.Index().SetUnique(true)},
	}); err != nil {
		return err
	}
	if _, err := s.reportsColl().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "createdAt", Value: 1}}},
		{Keys: bson.D{{Key: "id", Value: 1}}, Options: options.Index().SetUnique(true)},
	}); err != nil {
		return err
	}
	_, err := s.reportClaims().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "actor", Value: 1}, {Key: "key", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "createdAt", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(int32(reportIdempotencyTTL / time.Second)),
		},
	})
	return err
}

func (s *Store) casesColl() *mongo.Collection {
	return s.client.Database(s.db).Collection(casesCollection)
}

func (s *Store) reportsColl() *mongo.Collection {
	return s.client.Database(s.db).Collection(reportsCollection)
}

func (s *Store) reportClaims() *mongo.Collection {
	return s.client.Database(s.db).Collection(reportClaimsCollection)
}

// ListCases returns the moderation queue. Empty queue or status means every value.
func (s *Store) ListCases(ctx context.Context, query CaseQuery) (CaseList, error) {
	return listCases(ctx, s.casesColl(), query)
}

// OpenCase records a staff-opened dispute, report, or fraud-flag case.
func (s *Store) OpenCase(ctx context.Context, actor string, input CaseOpening, now time.Time) (CaseResult, error) {
	oid, id := newID()
	cas := newStaffCase(id, input.Queue, input.ReasonCode, input.SubjectType, input.SubjectID, input.Details, "", input.EvidenceKeys, now)
	cas.OID = oid
	if _, err := s.casesColl().InsertOne(ctx, cas); err != nil {
		return CaseResult{}, err
	}
	auditID, err := s.audit(ctx, "case.open", subjectCase, cas.ID, actor, input.Details, now)
	if err != nil {
		_, _ = s.casesColl().DeleteOne(ctx, bson.D{{Key: "id", Value: cas.ID}})
		return CaseResult{}, err
	}
	return CaseResult{Case: cas.view(), AuditID: auditID}, nil
}

// DecideCase upholds or dismisses an open or pending case and audits the actor.
func (s *Store) DecideCase(ctx context.Context, id, actor string, input CaseDecision, now time.Time) (CaseResult, error) {
	cas, err := s.loadCase(ctx, id)
	if err != nil {
		return CaseResult{}, err
	}
	original := cas
	if err := decideRecord(&cas, input, actor, now); err != nil {
		return CaseResult{}, err
	}
	if err := s.saveCase(ctx, cas); err != nil {
		return CaseResult{}, err
	}
	if cas.ReportID != "" {
		if err := s.resolveLinkedReport(ctx, cas.ReportID, input.Decision); err != nil {
			_ = s.saveCase(ctx, original)
			return CaseResult{}, err
		}
	}
	auditID, err := s.audit(ctx, "case.decision."+input.Decision, subjectCase, cas.ID, actor, input.Reason, now)
	if err != nil {
		return CaseResult{}, err
	}
	return CaseResult{Case: cas.view(), AuditID: auditID}, nil
}

// FileReport stores a report, opens its reports-queue case, and audits the actor.
// The same actor, key, and body replays the first response for 24 hours.
func (s *Store) FileReport(ctx context.Context, actor, idempotencyKey, bodyHash string, input ReportFiling, now time.Time) (ReportResult, bool, error) {
	claim := reportClaim{Actor: actor, Key: idempotencyKey, BodyHash: bodyHash, CreatedAt: now.UTC()}
	if _, err := s.reportClaims().InsertOne(ctx, claim); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return s.replayReport(ctx, actor, idempotencyKey, bodyHash)
		}
		return ReportResult{}, false, err
	}
	reportOID, reportID := newID()
	caseOID, caseID := newID()
	rep, cas := newReportPair(reportID, caseID, input, now)
	rep.OID = reportOID
	cas.OID = caseOID
	if _, err := s.casesColl().InsertOne(ctx, cas); err != nil {
		s.abandonReport(ctx, actor, idempotencyKey, "", "")
		return ReportResult{}, false, err
	}
	if _, err := s.reportsColl().InsertOne(ctx, rep); err != nil {
		s.abandonReport(ctx, actor, idempotencyKey, "", cas.ID)
		return ReportResult{}, false, err
	}
	auditID, err := s.audit(ctx, "report.file", subjectReport, rep.ID, actor, input.Details, now)
	if err != nil {
		s.abandonReport(ctx, actor, idempotencyKey, rep.ID, cas.ID)
		return ReportResult{}, false, err
	}
	_, err = s.reportClaims().UpdateOne(ctx,
		bson.D{{Key: "actor", Value: actor}, {Key: "key", Value: idempotencyKey}},
		bson.D{{Key: "$set", Value: bson.D{{Key: "reportId", Value: rep.ID}, {Key: "auditId", Value: auditID}}}},
	)
	if err != nil {
		return ReportResult{}, false, err
	}
	return ReportResult{Report: rep.view(), AuditID: auditID}, false, nil
}

// ListReports returns filed reports. Empty status means every status.
func (s *Store) ListReports(ctx context.Context, query ReportQuery) (ReportList, error) {
	page, size := pageBounds(query.Page, query.PageSize)
	filter := bson.D{}
	if status := strings.TrimSpace(query.Status); status != "" {
		filter = append(filter, bson.E{Key: "status", Value: status})
	}
	total, err := s.reportsColl().CountDocuments(ctx, filter)
	if err != nil {
		return ReportList{}, err
	}
	opts := options.Find().
		SetSort(bson.D{{Key: "createdAt", Value: 1}, {Key: "id", Value: 1}}).
		SetSkip((page - 1) * size).
		SetLimit(size)
	cursor, err := s.reportsColl().Find(ctx, filter, opts)
	if err != nil {
		return ReportList{}, err
	}
	defer cursor.Close(ctx)
	docs := []storedReport{}
	if err := cursor.All(ctx, &docs); err != nil {
		return ReportList{}, err
	}
	rows := make([]Report, len(docs))
	for i, doc := range docs {
		rows[i] = doc.view()
	}
	return ReportList{Reports: rows, Total: total, Next: nextPage(page, size, total)}, nil
}

// AppealReport records the subject's statement inside the 7-day window.
func (s *Store) AppealReport(ctx context.Context, id, actor string, input ReportAppeal, now time.Time) (ReportResult, error) {
	rep, err := s.loadReport(ctx, id)
	if err != nil {
		return ReportResult{}, err
	}
	cas, err := s.loadCase(ctx, rep.CaseID)
	if err != nil {
		return ReportResult{}, err
	}
	originalReport := rep
	originalCase := cas
	if err := appealRecord(&rep, &cas, input, now); err != nil {
		return ReportResult{}, err
	}
	if err := s.saveReport(ctx, rep); err != nil {
		return ReportResult{}, err
	}
	if err := s.saveCase(ctx, cas); err != nil {
		_ = s.saveReport(ctx, originalReport)
		return ReportResult{}, err
	}
	auditID, err := s.audit(ctx, "report.appeal", subjectReport, rep.ID, actor, input.Statement, now)
	if err != nil {
		_ = s.saveReport(ctx, originalReport)
		_ = s.saveCase(ctx, originalCase)
		return ReportResult{}, err
	}
	return ReportResult{Report: rep.view(), AuditID: auditID}, nil
}

func listCases(ctx context.Context, coll *mongo.Collection, query CaseQuery) (CaseList, error) {
	page, size := pageBounds(query.Page, query.PageSize)
	filter := bson.D{}
	if queue := strings.TrimSpace(query.Queue); queue != "" {
		filter = append(filter, bson.E{Key: "queue", Value: queue})
	}
	if status := strings.TrimSpace(query.Status); status != "" {
		filter = append(filter, bson.E{Key: "status", Value: status})
	}
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return CaseList{}, err
	}
	opts := options.Find().
		SetSort(bson.D{{Key: "createdAt", Value: 1}, {Key: "id", Value: 1}}).
		SetSkip((page - 1) * size).
		SetLimit(size)
	cursor, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return CaseList{}, err
	}
	defer cursor.Close(ctx)
	docs := []storedCase{}
	if err := cursor.All(ctx, &docs); err != nil {
		return CaseList{}, err
	}
	rows := make([]ModerationCase, len(docs))
	for i, doc := range docs {
		rows[i] = doc.view()
	}
	return CaseList{Cases: rows, Total: total, Next: nextPage(page, size, total)}, nil
}

func (s *Store) loadCase(ctx context.Context, id string) (storedCase, error) {
	return loadCase(ctx, s.casesColl(), id)
}

func (s *Store) loadReport(ctx context.Context, id string) (storedReport, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return storedReport{}, ErrNotFound
	}
	var rep storedReport
	err := s.reportsColl().FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&rep)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return storedReport{}, ErrNotFound
	}
	if err != nil {
		return storedReport{}, err
	}
	return rep, nil
}

func loadCase(ctx context.Context, coll *mongo.Collection, id string) (storedCase, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return storedCase{}, ErrNotFound
	}
	var cas storedCase
	err := coll.FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&cas)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return storedCase{}, ErrNotFound
	}
	if err != nil {
		return storedCase{}, err
	}
	return cas, nil
}

func (s *Store) saveCase(ctx context.Context, cas storedCase) error {
	_, err := s.casesColl().ReplaceOne(ctx, bson.D{{Key: "id", Value: cas.ID}}, cas)
	return err
}

func (s *Store) saveReport(ctx context.Context, rep storedReport) error {
	_, err := s.reportsColl().ReplaceOne(ctx, bson.D{{Key: "id", Value: rep.ID}}, rep)
	return err
}

func (s *Store) resolveLinkedReport(ctx context.Context, id, decision string) error {
	rep, err := s.loadReport(ctx, id)
	if err != nil {
		return err
	}
	resolveReport(&rep, decision)
	return s.saveReport(ctx, rep)
}

func (s *Store) replayReport(ctx context.Context, actor, key, hash string) (ReportResult, bool, error) {
	var claim reportClaim
	err := s.reportClaims().FindOne(ctx, bson.D{{Key: "actor", Value: actor}, {Key: "key", Value: key}}).Decode(&claim)
	if err != nil {
		return ReportResult{}, false, err
	}
	if claim.BodyHash != hash {
		return ReportResult{}, false, ErrIdempotency
	}
	if claim.ReportID == "" {
		return ReportResult{}, false, ErrIdempotencyInFlight
	}
	rep, err := s.loadReport(ctx, claim.ReportID)
	if err != nil {
		return ReportResult{}, false, err
	}
	return ReportResult{Report: rep.view(), AuditID: claim.AuditID}, true, nil
}

func (s *Store) abandonReport(ctx context.Context, actor, key, reportID, caseID string) {
	if reportID != "" {
		_, _ = s.reportsColl().DeleteOne(ctx, bson.D{{Key: "id", Value: reportID}})
	}
	if caseID != "" {
		_, _ = s.casesColl().DeleteOne(ctx, bson.D{{Key: "id", Value: caseID}})
	}
	_, _ = s.reportClaims().DeleteOne(ctx, bson.D{{Key: "actor", Value: actor}, {Key: "key", Value: key}})
}
