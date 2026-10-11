package ranking

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/fitscore"
)

// userCacheEntries bounds the in-process cache of user vectors.
const userCacheEntries = 10_000

// ProfileSource loads a job hunter's profile.
type ProfileSource interface {
	GetProfile(ctx context.Context, userID string, now time.Time) (candidate.Profile, error)
}

// userVectors are a profile's embeddings, tagged with the profile hash they came from.
type userVectors struct {
	Hash    string
	Profile []float32
	Roles   [][]float32
}

// User is everything a personalized search needs about the person searching.
type User struct {
	ID       string
	Features ProfileFeatures
	Fit      fitscore.Profile
	Vectors  *userVectors
}

// users loads profiles, features, and vectors, reusing vectors while the profile
// hash is unchanged: first from process memory, then from Qdrant, and only then
// by embedding again.
type users struct {
	source     ProfileSource
	tax        *Taxonomy
	qdrant     *Qdrant
	collection string
	embedder   Embedder
	log        *slog.Logger

	mu    sync.Mutex
	cache map[string]userVectors
	order []string
}

// load returns the user, or nil when there is no profile to personalize with.
func (u *users) load(ctx context.Context, userID string, now time.Time) (*User, error) {
	if userID == "" || u.source == nil {
		return nil, nil
	}
	profile, err := u.source.GetProfile(ctx, userID, now)
	if err != nil {
		return nil, fmt.Errorf("load profile: %w", err)
	}
	features := NormalizeProfile(userID, profile, now, u.tax)
	user := &User{ID: userID, Features: features, Fit: FitProfile(profile, u.tax)}
	if features.Empty() {
		return user, nil
	}
	vectors, err := u.vectors(ctx, features, false)
	if err != nil {
		// Personalization still works from features; only the vector channels go quiet.
		u.log.Warn("ranking user vectors", "error", err, "user", userID)
		return user, nil
	}
	user.Vectors = vectors
	return user, nil
}

// vectors returns the profile's embeddings. refresh skips every cache.
func (u *users) vectors(ctx context.Context, p ProfileFeatures, refresh bool) (*userVectors, error) {
	if u.embedder == nil {
		return nil, nil
	}
	if !refresh {
		if v, ok := u.cached(p.UserID, p.Hash); ok {
			return &v, nil
		}
		if v, ok := u.stored(ctx, p); ok {
			u.remember(p.UserID, v)
			return &v, nil
		}
	}
	texts := append([]string{p.ProfileText()}, p.RoleTexts()...)
	embedded, err := u.embedder.Embed(ctx, texts, true)
	if err != nil {
		return nil, err
	}
	v := userVectors{Hash: p.Hash, Profile: embedded[0], Roles: embedded[1:]}
	u.remember(p.UserID, v)
	if u.qdrant != nil {
		if err := u.store(ctx, p, v); err != nil {
			u.log.Warn("ranking store user vectors", "error", err, "user", p.UserID)
		}
	}
	return &v, nil
}

func (u *users) cached(userID, hash string) (userVectors, bool) {
	u.mu.Lock()
	defer u.mu.Unlock()
	v, ok := u.cache[userID]
	return v, ok && v.Hash == hash
}

func (u *users) remember(userID string, v userVectors) {
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.cache == nil {
		u.cache = map[string]userVectors{}
	}
	if _, exists := u.cache[userID]; !exists {
		u.order = append(u.order, userID)
	}
	u.cache[userID] = v
	for len(u.order) > userCacheEntries {
		delete(u.cache, u.order[0])
		u.order = u.order[1:]
	}
}

func (u *users) forget(userID string) {
	u.mu.Lock()
	defer u.mu.Unlock()
	delete(u.cache, userID)
}

// stored reads vectors back from Qdrant when they match the current profile.
func (u *users) stored(ctx context.Context, p ProfileFeatures) (userVectors, bool) {
	if u.qdrant == nil {
		return userVectors{}, false
	}
	points, err := u.qdrant.Retrieve(ctx, u.collection, []string{PointID("user", p.UserID)})
	if err != nil {
		return userVectors{}, false
	}
	for _, point := range points {
		if hash, _ := point.Payload[payloadProfileHash].(string); hash != p.Hash {
			return userVectors{}, false
		}
		v := userVectors{Hash: p.Hash, Profile: point.Vectors[vectorProfile]}
		for i := 0; i < len(p.RoleTexts()); i++ {
			if role, ok := point.Vectors[roleVector(i)]; ok {
				v.Roles = append(v.Roles, role)
			}
		}
		if len(v.Profile) == 0 {
			return userVectors{}, false
		}
		return v, true
	}
	return userVectors{}, false
}

// store writes a user's vectors and features, so the new-job fan-out can score
// them without loading the profile.
func (u *users) store(ctx context.Context, p ProfileFeatures, v userVectors) error {
	vectors := map[string]any{vectorProfile: v.Profile}
	for i, role := range v.Roles {
		vectors[roleVector(i)] = role
	}
	encoded, err := json.Marshal(p)
	if err != nil {
		return err
	}
	point := Point{
		ID:     PointID("user", p.UserID),
		Vector: vectors,
		Payload: map[string]any{
			payloadUserID:      p.UserID,
			payloadProfileHash: p.Hash,
			"features":         string(encoded),
		},
	}
	return u.qdrant.Upsert(ctx, u.collection, []Point{point}, false)
}

// profileFromPayload reads the features the fan-out needs from a users point.
func profileFromPayload(payload map[string]any) (ProfileFeatures, bool) {
	raw, _ := payload["features"].(string)
	if raw == "" {
		return ProfileFeatures{}, false
	}
	var p ProfileFeatures
	if err := json.Unmarshal([]byte(raw), &p); err != nil || p.UserID == "" {
		return ProfileFeatures{}, false
	}
	return p, true
}
