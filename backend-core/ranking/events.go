package ranking

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/sid0709/Joined/backend-core/metrics"
)

// Event types.
const (
	EventImpression = "impression"
	EventClick      = "click"
	EventSave       = "save"
	EventApply      = "apply"
	EventDismiss    = "dismiss"
)

// Training labels: the strongest interaction with a shown job wins.
var interactionLabel = map[string]int{EventClick: 1, EventSave: 2, EventApply: 3}

const (
	// eventBuffer is how many events can wait for the writer before new ones are dropped.
	eventBuffer = 4096
	// eventBatch is how many events one insert carries.
	eventBatch = 256
	// eventFlushEvery bounds how long an event waits in the buffer.
	eventFlushEvery = 2 * time.Second
	// FeatureLogLimit is how many top results keep their feature vectors in a
	// cached list, and so how deep impressions can be logged with features.
	FeatureLogLimit = 100
)

// ImpressionItem is one shown job.
type ImpressionItem struct {
	JobID    string    `bson:"jobId" json:"jobId"`
	Position int       `bson:"position" json:"position"`
	Score    float32   `bson:"score" json:"score"`
	Features []float32 `bson:"features,omitempty" json:"features,omitempty"`
}

// Event is one impression or interaction. Impressions carry the page they showed;
// interactions carry one job.
type Event struct {
	Type           string           `bson:"type" json:"type"`
	RankingID      string           `bson:"rankingId" json:"rankingId"`
	UserID         string           `bson:"userId" json:"userId"`
	At             time.Time        `bson:"at" json:"at"`
	Query          string           `bson:"query,omitempty" json:"query,omitempty"`
	FilterKey      string           `bson:"filterKey,omitempty" json:"filterKey,omitempty"`
	Sort           string           `bson:"sort,omitempty" json:"sort,omitempty"`
	List           string           `bson:"list,omitempty" json:"list,omitempty"`
	Mode           string           `bson:"mode,omitempty" json:"mode,omitempty"`
	Model          string           `bson:"model,omitempty" json:"model,omitempty"`
	Arm            string           `bson:"arm,omitempty" json:"arm,omitempty"`
	FeatureVersion string           `bson:"featureVersion,omitempty" json:"featureVersion,omitempty"`
	Page           int              `bson:"page,omitempty" json:"page,omitempty"`
	Items          []ImpressionItem `bson:"items,omitempty" json:"items,omitempty"`
	JobID          string           `bson:"jobId,omitempty" json:"jobId,omitempty"`
	Position       int              `bson:"position,omitempty" json:"position,omitempty"`
}

// EventLog records events. Logging never blocks a search.
type EventLog interface {
	Log(event Event)
}

// NewRankingID returns a random id that ties a page's impression to later interactions.
func NewRankingID() string {
	var b [12]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// MongoEventLog buffers events and inserts them in batches from one goroutine.
type MongoEventLog struct {
	coll    *mongo.Collection
	log     *slog.Logger
	queue   chan Event
	done    chan struct{}
	once    sync.Once
	dropped int64
	mu      sync.Mutex
}

// NewMongoEventLog starts the writer. Call Close to flush on shutdown.
func NewMongoEventLog(client *mongo.Client, db, collection string, log *slog.Logger) *MongoEventLog {
	l := &MongoEventLog{
		coll:  client.Database(db).Collection(collection),
		log:   log,
		queue: make(chan Event, eventBuffer),
		done:  make(chan struct{}),
	}
	go l.run()
	return l
}

// EnsureIndexes creates the indexes training export reads through.
func (l *MongoEventLog) EnsureIndexes(ctx context.Context) error {
	_, err := l.coll.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "type", Value: 1}, {Key: "at", Value: 1}}, Options: options.Index().SetName("type_at")},
		{Keys: bson.D{{Key: "rankingId", Value: 1}}, Options: options.Index().SetName("ranking_id")},
	})
	if err != nil {
		return fmt.Errorf("ranking event indexes: %w", err)
	}
	return nil
}

// Log queues an event, dropping it (and counting the drop) when the buffer is full.
func (l *MongoEventLog) Log(event Event) {
	if event.At.IsZero() {
		event.At = time.Now()
	}
	select {
	case l.queue <- event:
	default:
		metrics.RankingEventDropped()
		l.mu.Lock()
		l.dropped++
		dropped := l.dropped
		l.mu.Unlock()
		if dropped%eventBatch == 1 {
			l.log.Warn("ranking event buffer full", "dropped", dropped)
		}
	}
}

// Close flushes queued events and stops the writer.
func (l *MongoEventLog) Close() {
	l.once.Do(func() {
		close(l.queue)
		<-l.done
	})
}

func (l *MongoEventLog) run() {
	defer close(l.done)
	ticker := time.NewTicker(eventFlushEvery)
	defer ticker.Stop()
	batch := make([]any, 0, eventBatch)
	flush := func() {
		if len(batch) == 0 {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		if _, err := l.coll.InsertMany(ctx, batch, options.InsertMany().SetOrdered(false)); err != nil {
			l.log.Warn("ranking events insert", "error", err, "events", len(batch))
		}
		cancel()
		batch = batch[:0]
	}
	for {
		select {
		case event, ok := <-l.queue:
			if !ok {
				flush()
				return
			}
			batch = append(batch, event)
			if len(batch) == eventBatch {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

// TrainingRow is one shown job with its label, grouped by the page it was on.
type TrainingRow struct {
	Group    string
	Label    int
	Arm      string
	Features []float32
}

// ExportTraining joins impressions since a time with the interactions that
// followed, and calls fn for every shown job that kept its features. Pages
// where nothing was touched carry no preference signal and are skipped.
func ExportTraining(ctx context.Context, coll *mongo.Collection, since time.Time, fn func(TrainingRow) error) (groups int, err error) {
	labels := map[string]int{}
	cur, err := coll.Find(ctx, bson.D{
		{Key: "type", Value: bson.D{{Key: "$in", Value: bson.A{EventClick, EventSave, EventApply}}}},
		{Key: "at", Value: bson.D{{Key: "$gte", Value: since}}},
	})
	if err != nil {
		return 0, fmt.Errorf("read interactions: %w", err)
	}
	for cur.Next(ctx) {
		var e Event
		if err := cur.Decode(&e); err != nil {
			cur.Close(ctx)
			return 0, fmt.Errorf("decode interaction: %w", err)
		}
		key := e.RankingID + "\x00" + e.JobID
		if label := interactionLabel[e.Type]; label > labels[key] {
			labels[key] = label
		}
	}
	if err := cur.Err(); err != nil {
		cur.Close(ctx)
		return 0, err
	}
	cur.Close(ctx)

	cur, err = coll.Find(ctx, bson.D{
		{Key: "type", Value: EventImpression},
		{Key: "at", Value: bson.D{{Key: "$gte", Value: since}}},
		{Key: "featureVersion", Value: FeatureVersion},
	})
	if err != nil {
		return 0, fmt.Errorf("read impressions: %w", err)
	}
	defer cur.Close(ctx)
	for cur.Next(ctx) {
		var e Event
		if err := cur.Decode(&e); err != nil {
			return groups, fmt.Errorf("decode impression: %w", err)
		}
		rows := make([]TrainingRow, 0, len(e.Items))
		touched := false
		group := fmt.Sprintf("%s:%d", e.RankingID, e.Page)
		for _, item := range e.Items {
			if len(item.Features) != FeatureCount {
				continue
			}
			label := labels[e.RankingID+"\x00"+item.JobID]
			touched = touched || label > 0
			rows = append(rows, TrainingRow{Group: group, Label: label, Arm: e.Arm, Features: item.Features})
		}
		if !touched {
			continue
		}
		groups++
		for _, row := range rows {
			if err := fn(row); err != nil {
				return groups, err
			}
		}
	}
	return groups, cur.Err()
}
