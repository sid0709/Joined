package killswitch

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// State is one switch as staff and services see it.
type State struct {
	Name      Name      `json:"name"`
	Enabled   bool      `json:"enabled"`
	Source    string    `json:"source"`
	UpdatedAt time.Time `json:"updatedAt,omitempty"`
	UpdatedBy string    `json:"updatedBy,omitempty"`
	Note      string    `json:"note,omitempty"`
}

// Result is a staff flip: the new state and the admin_audit row id.
type Result struct {
	State   State  `json:"switch"`
	AuditID string `json:"auditId"`
}

type document struct {
	ID        string    `bson:"_id"`
	Enabled   bool      `bson:"enabled"`
	UpdatedAt time.Time `bson:"updatedAt"`
	UpdatedBy string    `bson:"updatedBy,omitempty"`
	Note      string    `bson:"note,omitempty"`
}

type storedAudit struct {
	ID          bson.ObjectID `bson:"_id,omitempty"`
	Action      string        `bson:"action"`
	SubjectType string        `bson:"subjectType"`
	SubjectID   string        `bson:"subjectId"`
	Actor       string        `bson:"actor"`
	Note        string        `bson:"note,omitempty"`
	At          time.Time     `bson:"at"`
}

// Store reads env defaults and optional Mongo overrides with a short cache.
type Store struct {
	defaults Defaults
	coll     *mongo.Collection
	audit    *mongo.Collection
	cacheTTL time.Duration
	now      func() time.Time
	fetch    func(context.Context) (map[Name]document, error)

	mu    sync.Mutex
	cache map[Name]document
	until time.Time
}

var (
	_ Switches = (*Store)(nil)
	_ Switches = (*Memory)(nil)
)

// NewStore reads and writes kill_switches in db. overrides live in Mongo;
// missing documents fall back to defaults.
func NewStore(client *mongo.Client, db string, defaults Defaults) *Store {
	s := &Store{
		defaults: complete(defaults),
		coll:     client.Database(db).Collection(collectionName),
		audit:    client.Database(db).Collection(auditCollection),
		cacheTTL: cacheTTL(),
	}
	s.fetch = s.loadMongo
	return s
}

func (s *Store) clock() time.Time {
	if s.now != nil {
		return s.now()
	}
	return time.Now()
}

func (s *Store) invalidate() {
	s.mu.Lock()
	s.cache = nil
	s.until = time.Time{}
	s.mu.Unlock()
}

func (s *Store) overrides(ctx context.Context) map[Name]document {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.clock()
	if s.cache != nil && now.Before(s.until) {
		return s.cache
	}
	if s.fetch == nil {
		return s.cache
	}
	docs, err := s.fetch(ctx)
	if err != nil {
		slog.Error("killswitch fetch", "error", err)
		if s.cache != nil {
			return s.cache
		}
		return map[Name]document{}
	}
	if docs == nil {
		docs = map[Name]document{}
	}
	s.cache = docs
	s.until = now.Add(s.cacheTTL)
	return docs
}

func (s *Store) loadMongo(ctx context.Context) (map[Name]document, error) {
	cursor, err := s.coll.Find(ctx, bson.D{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []document
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := map[Name]document{}
	for _, doc := range docs {
		name := Name(doc.ID)
		if !Known(name) {
			continue
		}
		out[name] = doc
	}
	return out, nil
}

// Enabled reports whether name may run. Unknown names stay on. A Mongo
// read failure keeps the last cache, or env, so a database blip does not
// take features down.
func (s *Store) Enabled(ctx context.Context, name Name) bool {
	state := s.state(name, s.overrides(ctx))
	return state.Enabled
}

// List is every known switch with its current source.
func (s *Store) List(ctx context.Context) ([]State, error) {
	overrides := s.overrides(ctx)
	out := make([]State, 0, len(Names))
	for _, name := range Names {
		out = append(out, s.state(name, overrides))
	}
	return out, nil
}

func (s *Store) state(name Name, overrides map[Name]document) State {
	if doc, ok := overrides[name]; ok {
		return State{
			Name:      name,
			Enabled:   doc.Enabled,
			Source:    sourceOverride,
			UpdatedAt: doc.UpdatedAt,
			UpdatedBy: doc.UpdatedBy,
			Note:      doc.Note,
		}
	}
	enabled := true
	if s.defaults != nil {
		if v, ok := s.defaults[name]; ok {
			enabled = v
		}
	}
	return State{Name: name, Enabled: enabled, Source: sourceEnv}
}

// Set writes a Mongo override, records admin_audit, and drops the cache.
func (s *Store) Set(ctx context.Context, name Name, enabled bool, actor, note string, now time.Time) (Result, error) {
	if !Known(name) {
		return Result{}, ErrUnknown
	}
	if s.coll == nil {
		return Result{}, ErrNoStore
	}
	actor = cleanActor(actor)
	note = cleanNote(note)
	if now.IsZero() {
		now = s.clock()
	}
	now = now.UTC()
	doc := document{
		ID:        string(name),
		Enabled:   enabled,
		UpdatedAt: now,
		UpdatedBy: actor,
		Note:      note,
	}
	_, err := s.coll.UpdateOne(ctx, bson.D{{Key: "_id", Value: doc.ID}}, bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "enabled", Value: doc.Enabled},
			{Key: "updatedAt", Value: doc.UpdatedAt},
			{Key: "updatedBy", Value: doc.UpdatedBy},
			{Key: "note", Value: doc.Note},
		}},
	}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return Result{}, err
	}
	auditID, err := s.writeAudit(ctx, name, enabled, actor, note, now)
	if err != nil {
		return Result{}, err
	}
	s.invalidate()
	return Result{State: s.state(name, map[Name]document{name: doc}), AuditID: auditID}, nil
}

func (s *Store) writeAudit(ctx context.Context, name Name, enabled bool, actor, note string, now time.Time) (string, error) {
	if s.audit == nil {
		return "", ErrNoStore
	}
	action := auditActionDisable
	if enabled {
		action = auditActionEnable
	}
	doc := storedAudit{
		ID:          bson.NewObjectID(),
		Action:      action,
		SubjectType: auditSubject,
		SubjectID:   string(name),
		Actor:       actor,
		Note:        note,
		At:          now,
	}
	if _, err := s.audit.InsertOne(ctx, doc); err != nil {
		return "", err
	}
	return doc.ID.Hex(), nil
}

func cleanActor(actor string) string {
	actor = strings.TrimSpace(actor)
	actor = strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}
		return -1
	}, actor)
	if actor == "" {
		return "admin"
	}
	if utf8.RuneCountInString(actor) > 80 {
		return string([]rune(actor)[:80])
	}
	return actor
}

func cleanNote(note string) string {
	note = strings.TrimSpace(note)
	if utf8.RuneCountInString(note) > maxNoteLength {
		return string([]rune(note)[:maxNoteLength])
	}
	return note
}
