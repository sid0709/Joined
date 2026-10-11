package ranking

import (
	"container/list"
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Key prefixes. Everything ranking writes to Redis lives under "rank:", "feed:",
// "qvec:", or "rankkeys:".
const (
	prefixRanked     = "rank:"
	prefixFeed       = "feed:"
	prefixVector     = "qvec:"
	prefixUserRanked = "rankkeys:"
	anonymousUser    = "anon"
	// memoryCacheEntries bounds the in-process fallback cache.
	memoryCacheEntries = 20_000
	// feedTTL keeps an idle user's feed around for a week before it is rebuilt.
	feedTTL = 7 * 24 * time.Hour
)

// RankedList is one search's full ordered result, cached so every page after the
// first is a slice of it.
type RankedList struct {
	IDs    []string  `json:"ids"`
	Scores []float32 `json:"scores"`
	// Total is the result count to show; Exact says whether it is a filter count
	// (exact) or a relevance cut (approximate).
	Total int  `json:"total"`
	Exact bool `json:"exact"`
	// Model and Arm record what ranked it, for impression logs.
	Model string    `json:"model"`
	Arm   string    `json:"arm"`
	Built time.Time `json:"built"`
	// Suggestions are filter chips the query implies.
	Suggestions []Suggestion `json:"suggestions,omitempty"`
	// Features are the top results' feature vectors (up to FeatureLogLimit), so a
	// cached page can still log what it was ranked on.
	Features [][]float32 `json:"features,omitempty"`
	// FromFeed marks a list served from the precomputed feed.
	FromFeed bool `json:"fromFeed,omitempty"`
	// Degraded marks a list built without some vector channel (embedder or
	// Qdrant unavailable); it is cached briefly and never stored as a feed.
	Degraded bool `json:"degraded,omitempty"`
}

// Scored is one id with its score.
type Scored struct {
	ID    string
	Score float64
}

// Cache stores derived ranking state. Every method is best effort: a cache
// failure costs latency, never correctness.
type Cache interface {
	GetRanked(ctx context.Context, key string) (RankedList, bool, error)
	// SetRanked stores a list; userID groups keys so a profile change can drop them.
	SetRanked(ctx context.Context, userID, key string, list RankedList, ttl time.Duration) error
	// DropUser forgets every ranked list cached for a user.
	DropUser(ctx context.Context, userID string) error
	GetVector(ctx context.Context, key string) ([]float32, bool, error)
	SetVector(ctx context.Context, key string, vector []float32, ttl time.Duration) error
	// ReplaceFeed swaps a user's whole feed.
	ReplaceFeed(ctx context.Context, userID string, items []Scored) error
	// AddToFeed inserts jobs into a feed that exists, keeping the best size entries.
	AddToFeed(ctx context.Context, userID string, items []Scored, size int) error
	// Feed returns up to n job ids, best first, and whether a feed exists.
	Feed(ctx context.Context, userID string, n int) ([]Scored, bool, error)
}

// RankedKey is the cache key for one search.
func RankedKey(userID, mode, query, filterKey, sort string, profileHash string) string {
	if userID == "" {
		userID = anonymousUser
	}
	return prefixRanked + userID + ":" + mode + ":" + sort + ":" + filterKey + ":" + profileHash + ":" + Phrase(query)
}

// VectorKey is the cache key for a query embedding.
func VectorKey(query string) string {
	return prefixVector + Phrase(query)
}

// NewCache returns a Redis cache for url, or an in-process cache when url is blank.
// With Redis, ranked lists and vectors also sit in a small in-process cache in
// front of it, so paging through one search does not decode the list again.
func NewCache(url string) (Cache, error) {
	if url == "" {
		return NewMemoryCache(memoryCacheEntries), nil
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parse REDIS_URL: %w", err)
	}
	return &layeredCache{redisCache: &redisCache{client: redis.NewClient(opts)}, local: NewMemoryCache(localCacheEntries)}, nil
}

// localCacheEntries bounds the in-process layer in front of Redis.
const (
	localCacheEntries = 2_000
	// localCacheTTL keeps the local layer short-lived: other instances may drop a
	// user's lists in Redis, and this layer must not outlive that by much.
	localCacheTTL = 30 * time.Second
)

// layeredCache reads ranked lists and vectors from process memory first, then Redis.
type layeredCache struct {
	*redisCache
	local Cache
}

func (c *layeredCache) GetRanked(ctx context.Context, key string) (RankedList, bool, error) {
	if list, ok, _ := c.local.GetRanked(ctx, key); ok {
		return list, true, nil
	}
	list, ok, err := c.redisCache.GetRanked(ctx, key)
	if ok {
		_ = c.local.SetRanked(ctx, "", key, list, localCacheTTL)
	}
	return list, ok, err
}

func (c *layeredCache) SetRanked(ctx context.Context, userID, key string, list RankedList, ttl time.Duration) error {
	_ = c.local.SetRanked(ctx, userID, key, list, min(ttl, localCacheTTL))
	return c.redisCache.SetRanked(ctx, userID, key, list, ttl)
}

func (c *layeredCache) DropUser(ctx context.Context, userID string) error {
	_ = c.local.DropUser(ctx, userID)
	return c.redisCache.DropUser(ctx, userID)
}

func (c *layeredCache) GetVector(ctx context.Context, key string) ([]float32, bool, error) {
	if v, ok, _ := c.local.GetVector(ctx, key); ok {
		return v, true, nil
	}
	v, ok, err := c.redisCache.GetVector(ctx, key)
	if ok {
		_ = c.local.SetVector(ctx, key, v, localCacheTTL)
	}
	return v, ok, err
}

func (c *layeredCache) SetVector(ctx context.Context, key string, vector []float32, ttl time.Duration) error {
	_ = c.local.SetVector(ctx, key, vector, min(ttl, localCacheTTL))
	return c.redisCache.SetVector(ctx, key, vector, ttl)
}

type redisCache struct {
	client *redis.Client
}

func (c *redisCache) GetRanked(ctx context.Context, key string) (RankedList, bool, error) {
	raw, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return RankedList{}, false, nil
	}
	if err != nil {
		return RankedList{}, false, err
	}
	var list RankedList
	if err := json.Unmarshal(raw, &list); err != nil {
		return RankedList{}, false, err
	}
	return list, true, nil
}

func (c *redisCache) SetRanked(ctx context.Context, userID, key string, list RankedList, ttl time.Duration) error {
	raw, err := json.Marshal(list)
	if err != nil {
		return err
	}
	pipe := c.client.TxPipeline()
	pipe.Set(ctx, key, raw, ttl)
	if userID != "" {
		group := prefixUserRanked + userID
		pipe.SAdd(ctx, group, key)
		pipe.Expire(ctx, group, ttl)
	}
	_, err = pipe.Exec(ctx)
	return err
}

func (c *redisCache) DropUser(ctx context.Context, userID string) error {
	group := prefixUserRanked + userID
	keys, err := c.client.SMembers(ctx, group).Result()
	if err != nil {
		return err
	}
	keys = append(keys, group)
	return c.client.Del(ctx, keys...).Err()
}

func (c *redisCache) GetVector(ctx context.Context, key string) ([]float32, bool, error) {
	raw, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	var v []float32
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, false, err
	}
	return v, true, nil
}

func (c *redisCache) SetVector(ctx context.Context, key string, vector []float32, ttl time.Duration) error {
	raw, err := json.Marshal(vector)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, key, raw, ttl).Err()
}

func (c *redisCache) ReplaceFeed(ctx context.Context, userID string, items []Scored) error {
	key := prefixFeed + userID
	pipe := c.client.TxPipeline()
	pipe.Del(ctx, key)
	if len(items) > 0 {
		members := make([]redis.Z, len(items))
		for i, item := range items {
			members[i] = redis.Z{Score: item.Score, Member: item.ID}
		}
		pipe.ZAdd(ctx, key, members...)
		pipe.Expire(ctx, key, feedTTL)
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (c *redisCache) AddToFeed(ctx context.Context, userID string, items []Scored, size int) error {
	key := prefixFeed + userID
	exists, err := c.client.Exists(ctx, key).Result()
	if err != nil || exists == 0 || len(items) == 0 {
		return err
	}
	members := make([]redis.Z, len(items))
	for i, item := range items {
		members[i] = redis.Z{Score: item.Score, Member: item.ID}
	}
	pipe := c.client.TxPipeline()
	pipe.ZAdd(ctx, key, members...)
	// Keep the best size members: drop ranks 0..len-size-1 counted from the lowest.
	pipe.ZRemRangeByRank(ctx, key, 0, int64(-size-1))
	_, err = pipe.Exec(ctx)
	return err
}

func (c *redisCache) Feed(ctx context.Context, userID string, n int) ([]Scored, bool, error) {
	key := prefixFeed + userID
	members, err := c.client.ZRevRangeWithScores(ctx, key, 0, int64(n-1)).Result()
	if err != nil {
		return nil, false, err
	}
	if len(members) == 0 {
		exists, err := c.client.Exists(ctx, key).Result()
		return nil, exists > 0, err
	}
	out := make([]Scored, len(members))
	for i, m := range members {
		out[i] = Scored{ID: fmt.Sprint(m.Member), Score: m.Score}
	}
	return out, true, nil
}

// memoryCache is the in-process fallback: an LRU with per-entry expiry.
type memoryCache struct {
	mu      sync.Mutex
	limit   int
	order   *list.List
	entries map[string]*list.Element
}

type memoryEntry struct {
	key     string
	value   any
	expires time.Time
}

// NewMemoryCache returns an in-process cache holding at most limit entries.
func NewMemoryCache(limit int) Cache {
	return &memoryCache{limit: limit, order: list.New(), entries: map[string]*list.Element{}}
}

func (c *memoryCache) get(key string) (any, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	el, ok := c.entries[key]
	if !ok {
		return nil, false
	}
	entry := el.Value.(*memoryEntry)
	if !entry.expires.IsZero() && time.Now().After(entry.expires) {
		c.order.Remove(el)
		delete(c.entries, key)
		return nil, false
	}
	c.order.MoveToFront(el)
	return entry.value, true
}

func (c *memoryCache) set(key string, value any, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	expires := time.Time{}
	if ttl > 0 {
		expires = time.Now().Add(ttl)
	}
	if el, ok := c.entries[key]; ok {
		el.Value = &memoryEntry{key: key, value: value, expires: expires}
		c.order.MoveToFront(el)
		return
	}
	c.entries[key] = c.order.PushFront(&memoryEntry{key: key, value: value, expires: expires})
	for c.order.Len() > c.limit {
		oldest := c.order.Back()
		c.order.Remove(oldest)
		delete(c.entries, oldest.Value.(*memoryEntry).key)
	}
}

func (c *memoryCache) delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.entries[key]; ok {
		c.order.Remove(el)
		delete(c.entries, key)
	}
}

func (c *memoryCache) GetRanked(_ context.Context, key string) (RankedList, bool, error) {
	v, ok := c.get(key)
	if !ok {
		return RankedList{}, false, nil
	}
	return v.(RankedList), true, nil
}

func (c *memoryCache) SetRanked(_ context.Context, _ string, key string, list RankedList, ttl time.Duration) error {
	c.set(key, list, ttl)
	return nil
}

func (c *memoryCache) DropUser(_ context.Context, userID string) error {
	prefix := prefixRanked + userID + ":"
	c.mu.Lock()
	keys := []string{}
	for key := range c.entries {
		if strings.HasPrefix(key, prefix) {
			keys = append(keys, key)
		}
	}
	c.mu.Unlock()
	for _, key := range keys {
		c.delete(key)
	}
	return nil
}

func (c *memoryCache) GetVector(_ context.Context, key string) ([]float32, bool, error) {
	v, ok := c.get(key)
	if !ok {
		return nil, false, nil
	}
	return v.([]float32), true, nil
}

func (c *memoryCache) SetVector(_ context.Context, key string, vector []float32, ttl time.Duration) error {
	c.set(key, vector, ttl)
	return nil
}

func (c *memoryCache) ReplaceFeed(_ context.Context, userID string, items []Scored) error {
	sorted := append([]Scored{}, items...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].Score > sorted[j].Score })
	c.set(prefixFeed+userID, sorted, feedTTL)
	return nil
}

func (c *memoryCache) AddToFeed(_ context.Context, userID string, items []Scored, size int) error {
	v, ok := c.get(prefixFeed + userID)
	if !ok {
		return nil
	}
	merged := map[string]float64{}
	for _, item := range v.([]Scored) {
		merged[item.ID] = item.Score
	}
	for _, item := range items {
		merged[item.ID] = item.Score
	}
	out := make([]Scored, 0, len(merged))
	for id, score := range merged {
		out = append(out, Scored{ID: id, Score: score})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].ID < out[j].ID
	})
	if len(out) > size {
		out = out[:size]
	}
	c.set(prefixFeed+userID, out, feedTTL)
	return nil
}

func (c *memoryCache) Feed(_ context.Context, userID string, n int) ([]Scored, bool, error) {
	v, ok := c.get(prefixFeed + userID)
	if !ok {
		return nil, false, nil
	}
	items := v.([]Scored)
	if len(items) > n {
		items = items[:n]
	}
	return append([]Scored{}, items...), true, nil
}
