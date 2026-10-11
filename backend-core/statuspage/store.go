package statuspage

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	incidentsCollection = "status_incidents"
	uptimeCollection    = "status_uptime_daily"
	// maxIncidents caps one listing: 90 days of incidents is never near this.
	maxIncidents = 500
)

// Store keeps incidents and daily uptime.
type Store interface {
	CreateIncident(ctx context.Context, in NewIncident, by string, now time.Time) (Incident, error)
	UpdateIncident(ctx context.Context, id string, in NewUpdate, by string, now time.Time) (Incident, error)
	// Incidents is every incident created since, plus any still unresolved, newest first.
	Incidents(ctx context.Context, since time.Time) ([]Incident, error)
	// RecordUptime saves one day's uptime (0–1) per component.
	RecordUptime(ctx context.Context, day string, uptime map[string]float64, now time.Time) error
	// Uptime is daily uptime per component, then per day, from fromDay on.
	Uptime(ctx context.Context, fromDay string) (map[string]map[string]float64, error)
}

var (
	_ Store = (*MongoStore)(nil)
	_ Store = (*Memory)(nil)
)

// MongoStore keeps the status page in status_incidents and status_uptime_daily.
type MongoStore struct {
	incidents *mongo.Collection
	uptime    *mongo.Collection
}

// NewMongoStore uses the status collections in db.
func NewMongoStore(client *mongo.Client, db string) *MongoStore {
	database := client.Database(db)
	return &MongoStore{incidents: database.Collection(incidentsCollection), uptime: database.Collection(uptimeCollection)}
}

// EnsureIndexes creates the indexes the page's reads use.
func (s *MongoStore) EnsureIndexes(ctx context.Context) error {
	if _, err := s.incidents.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "createdAt", Value: -1}}},
		{Keys: bson.D{{Key: "status", Value: 1}}},
	}); err != nil {
		return fmt.Errorf("status incident indexes: %w", err)
	}
	if _, err := s.uptime.Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "day", Value: 1}}}); err != nil {
		return fmt.Errorf("status uptime indexes: %w", err)
	}
	return nil
}

func (s *MongoStore) CreateIncident(ctx context.Context, in NewIncident, by string, now time.Time) (Incident, error) {
	incident, err := in.incident(bson.NewObjectID().Hex(), by, now)
	if err != nil {
		return Incident{}, err
	}
	if _, err := s.incidents.InsertOne(ctx, incident); err != nil {
		return Incident{}, fmt.Errorf("insert incident: %w", err)
	}
	return incident, nil
}

func (s *MongoStore) UpdateIncident(ctx context.Context, id string, in NewUpdate, by string, now time.Time) (Incident, error) {
	update, err := in.update(by, now)
	if err != nil {
		return Incident{}, err
	}
	set := bson.D{{Key: "status", Value: update.Phase}, {Key: "updatedAt", Value: update.At}}
	if in.Impact != nil {
		set = append(set, bson.E{Key: "impact", Value: *in.Impact})
	}
	change := bson.D{{Key: "$push", Value: bson.D{{Key: "updates", Value: bson.D{
		{Key: "$each", Value: bson.A{update}},
		{Key: "$position", Value: 0},
	}}}}}
	if update.Phase == Resolved {
		set = append(set, bson.E{Key: "resolvedAt", Value: update.At})
	} else {
		change = append(change, bson.E{Key: "$unset", Value: bson.D{{Key: "resolvedAt", Value: ""}}})
	}
	change = append(change, bson.E{Key: "$set", Value: set})

	var incident Incident
	err = s.incidents.FindOneAndUpdate(ctx, bson.D{{Key: "_id", Value: id}}, change,
		options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&incident)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Incident{}, ErrNotFound
	}
	if err != nil {
		return Incident{}, fmt.Errorf("update incident: %w", err)
	}
	return incident, nil
}

func (s *MongoStore) Incidents(ctx context.Context, since time.Time) ([]Incident, error) {
	filter := bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "createdAt", Value: bson.D{{Key: "$gte", Value: since.UTC()}}}},
		bson.D{{Key: "status", Value: bson.D{{Key: "$ne", Value: Resolved}}}},
	}}}
	cursor, err := s.incidents.Find(ctx, filter,
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(maxIncidents))
	if err != nil {
		return nil, fmt.Errorf("list incidents: %w", err)
	}
	var out []Incident
	if err := cursor.All(ctx, &out); err != nil {
		return nil, fmt.Errorf("decode incidents: %w", err)
	}
	return out, nil
}

type uptimeDocument struct {
	ID        string    `bson:"_id"`
	Component string    `bson:"component"`
	Day       string    `bson:"day"`
	Uptime    float64   `bson:"uptime"`
	UpdatedAt time.Time `bson:"updatedAt"`
}

func (s *MongoStore) RecordUptime(ctx context.Context, day string, uptime map[string]float64, now time.Time) error {
	if len(uptime) == 0 {
		return nil
	}
	models := make([]mongo.WriteModel, 0, len(uptime))
	for component, value := range uptime {
		doc := uptimeDocument{ID: component + ":" + day, Component: component, Day: day, Uptime: value, UpdatedAt: now.UTC()}
		models = append(models, mongo.NewReplaceOneModel().SetFilter(bson.D{{Key: "_id", Value: doc.ID}}).SetReplacement(doc).SetUpsert(true))
	}
	if _, err := s.uptime.BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false)); err != nil {
		return fmt.Errorf("record uptime: %w", err)
	}
	return nil
}

func (s *MongoStore) Uptime(ctx context.Context, fromDay string) (map[string]map[string]float64, error) {
	cursor, err := s.uptime.Find(ctx, bson.D{{Key: "day", Value: bson.D{{Key: "$gte", Value: fromDay}}}})
	if err != nil {
		return nil, fmt.Errorf("read uptime: %w", err)
	}
	var docs []uptimeDocument
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decode uptime: %w", err)
	}
	out := make(map[string]map[string]float64)
	for _, doc := range docs {
		if out[doc.Component] == nil {
			out[doc.Component] = make(map[string]float64)
		}
		out[doc.Component][doc.Day] = doc.Uptime
	}
	return out, nil
}

// Memory is a Store for tests and local runs without Mongo.
type Memory struct {
	mu        sync.Mutex
	incidents []Incident
	uptime    map[string]map[string]float64
	nextID    int
}

func (m *Memory) CreateIncident(_ context.Context, in NewIncident, by string, now time.Time) (Incident, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.nextID++
	incident, err := in.incident(fmt.Sprintf("incident-%d", m.nextID), by, now)
	if err != nil {
		return Incident{}, err
	}
	m.incidents = append(m.incidents, incident)
	return incident, nil
}

func (m *Memory) UpdateIncident(_ context.Context, id string, in NewUpdate, by string, now time.Time) (Incident, error) {
	update, err := in.update(by, now)
	if err != nil {
		return Incident{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.incidents {
		if m.incidents[i].ID == id {
			m.incidents[i].apply(update, in.Impact)
			return m.incidents[i], nil
		}
	}
	return Incident{}, ErrNotFound
}

func (m *Memory) Incidents(_ context.Context, since time.Time) ([]Incident, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Incident
	for _, incident := range m.incidents {
		if incident.active() || !incident.CreatedAt.Before(since) {
			out = append(out, incident)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (m *Memory) RecordUptime(_ context.Context, day string, uptime map[string]float64, _ time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.uptime == nil {
		m.uptime = make(map[string]map[string]float64)
	}
	for component, value := range uptime {
		if m.uptime[component] == nil {
			m.uptime[component] = make(map[string]float64)
		}
		m.uptime[component][day] = value
	}
	return nil
}

func (m *Memory) Uptime(_ context.Context, fromDay string) (map[string]map[string]float64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make(map[string]map[string]float64)
	for component, days := range m.uptime {
		for day, value := range days {
			if day < fromDay {
				continue
			}
			if out[component] == nil {
				out[component] = make(map[string]float64)
			}
			out[component][day] = value
		}
	}
	return out, nil
}
