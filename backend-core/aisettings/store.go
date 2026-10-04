// Package aisettings keeps the model settings staff change from the admin console.
// Each provider is its own document: the API key, stored encrypted, and the model.
// A database dump alone does not reveal a key, and a key is never sent back to the console.
package aisettings

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	collectionName = "app_settings"
	// DocumentAcorn is the document holding Acorn's OpenAI settings.
	DocumentAcorn = "acorn-ai"
	// DocumentDeepSeek is the document holding the DeepSeek settings job analysis,
	// company research, and company autofill use.
	DocumentDeepSeek = "deepseek"

	maxKeyLength   = 400
	maxModelLength = 80
	// hintTail is how many trailing characters of the key the console may show.
	hintTail = 4
)

// ErrInvalid is a key or model the console should correct.
var ErrInvalid = errors.New("invalid AI settings")

type Store struct {
	collection *mongo.Collection
	box        *Box
	id         string
}

// NewStore reads and writes Acorn's settings in db. box seals the API key; without one,
// settings can still be read but a key can be neither saved nor opened.
func NewStore(client *mongo.Client, db string, box *Box) *Store {
	return NewStoreFor(client, db, box, DocumentAcorn)
}

// NewStoreFor reads and writes the document id in the shared settings collection.
func NewStoreFor(client *mongo.Client, db string, box *Box, id string) *Store {
	return &Store{collection: client.Database(db).Collection(collectionName), box: box, id: id}
}

type document struct {
	ID        string    `bson:"_id"`
	APIKey    string    `bson:"apiKey,omitempty"`
	Model     string    `bson:"model,omitempty"`
	UpdatedAt time.Time `bson:"updatedAt"`
	UpdatedBy string    `bson:"updatedBy,omitempty"`
}

// Settings are one provider's model settings with the API key opened.
type Settings struct {
	APIKey string
	Model  string
}

// View is what the console may see: whether a key is saved and its last characters.
type View struct {
	Configured bool      `json:"configured"`
	KeyHint    string    `json:"keyHint"`
	Model      string    `json:"model"`
	UpdatedAt  time.Time `json:"updatedAt"`
	UpdatedBy  string    `json:"updatedBy"`
	// Encryptable is false when SETTINGS_ENCRYPTION_KEY is not set, so a key cannot be saved.
	Encryptable bool `json:"encryptable"`
}

// Update changes the settings; a nil field is left as it is.
type Update struct {
	APIKey *string
	Model  *string
}

func (s *Store) load(ctx context.Context) (document, error) {
	var doc document
	err := s.collection.FindOne(ctx, bson.D{{Key: "_id", Value: s.id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return document{}, nil
	}
	return doc, err
}

// Get returns the saved settings with the key opened. A key that cannot be opened is an error.
func (s *Store) Get(ctx context.Context) (Settings, error) {
	doc, err := s.load(ctx)
	if err != nil {
		return Settings{}, err
	}
	settings := Settings{Model: doc.Model}
	if doc.APIKey != "" {
		if settings.APIKey, err = s.box.Open(doc.APIKey); err != nil {
			return Settings{}, err
		}
	}
	return settings, nil
}

// View describes the saved settings without revealing the key.
func (s *Store) View(ctx context.Context) (View, error) {
	doc, err := s.load(ctx)
	if err != nil {
		return View{}, err
	}
	view := View{Model: doc.Model, UpdatedAt: doc.UpdatedAt, UpdatedBy: doc.UpdatedBy, Encryptable: s.box != nil}
	if doc.APIKey != "" {
		view.Configured = true
		if key, err := s.box.Open(doc.APIKey); err == nil {
			view.KeyHint = hint(key)
		}
	}
	return view, nil
}

// Save applies the update. A blank key removes the saved key; a blank model returns to the default.
func (s *Store) Save(ctx context.Context, update Update, actor string, now time.Time) error {
	set := bson.D{{Key: "updatedAt", Value: now.UTC()}, {Key: "updatedBy", Value: actor}}
	unset := bson.D{}
	if update.APIKey != nil {
		key := strings.TrimSpace(*update.APIKey)
		switch {
		case key == "":
			unset = append(unset, bson.E{Key: "apiKey", Value: ""})
		case len(key) > maxKeyLength || strings.ContainsAny(key, " \t\r\n"):
			return ErrInvalid
		default:
			sealed, err := s.box.Seal(key)
			if err != nil {
				return err
			}
			set = append(set, bson.E{Key: "apiKey", Value: sealed})
		}
	}
	if update.Model != nil {
		model := strings.TrimSpace(*update.Model)
		switch {
		case model == "":
			unset = append(unset, bson.E{Key: "model", Value: ""})
		case len(model) > maxModelLength || strings.ContainsAny(model, " \t\r\n"):
			return ErrInvalid
		default:
			set = append(set, bson.E{Key: "model", Value: model})
		}
	}
	change := bson.D{{Key: "$set", Value: set}}
	if len(unset) > 0 {
		change = append(change, bson.E{Key: "$unset", Value: unset})
	}
	_, err := s.collection.UpdateOne(ctx, bson.D{{Key: "_id", Value: s.id}}, change, options.UpdateOne().SetUpsert(true))
	return err
}

// hint shows the end of a key, enough to tell which one is saved.
func hint(key string) string {
	runes := []rune(key)
	if len(runes) <= hintTail*2 {
		return "…"
	}
	return "…" + string(runes[len(runes)-hintTail:])
}
