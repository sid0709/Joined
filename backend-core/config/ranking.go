package config

import (
	"strings"
	"time"
)

// Ranking defaults. Every value can be overridden by the RANKING_* variable named in LoadRanking.
const (
	defaultRankingJobsCollection    = "jobs"
	defaultRankingUsersCollection   = "users"
	defaultRankingCollectionVersion = "v1"
	defaultRankingEventsCollection  = "ranking_events"
	defaultEmbedderAPI              = EmbedderTEI
	defaultEmbedderModel            = "BAAI/bge-small-en-v1.5"
	defaultEmbedderDimensions       = 384
	defaultRankingSyncInterval      = 30 * time.Second
	defaultRankingReconcileInterval = 15 * time.Minute
	defaultRankingCacheTTL          = 10 * time.Minute
	defaultRankingQueryVectorTTL    = 24 * time.Hour
	defaultRankingFeedSize          = 500
	defaultRankingCandidateLimit    = 1000
	defaultRankingChannelLimit      = 500
	defaultRankingScanLimit         = 50_000
	defaultRankingRequestTimeout    = 400 * time.Millisecond
	defaultRankingExperiment        = "ltr-v1"
)

// Embedder protocols the ranking service can talk to.
const (
	// EmbedderTEI is HuggingFace text-embeddings-inference: POST /embed.
	EmbedderTEI = "tei"
	// EmbedderOpenAI is any OpenAI-compatible POST /v1/embeddings (OpenAI, Ollama, vLLM).
	EmbedderOpenAI = "openai"
)

// Ranking configures personalized job ranking: the vector index, the cache, the
// embedding model, and the learned-ranking experiment. A blank QdrantURL or
// EmbedderURL turns the matching retrieval channel off; search then falls back to
// in-process candidates and, for typed queries, to the Mongo text search.
type Ranking struct {
	QdrantURL    string
	QdrantAPIKey string
	// RedisURL is a redis:// URL. Blank keeps caches and feeds in process memory.
	RedisURL string

	EmbedderURL        string
	EmbedderAPI        string
	EmbedderModel      string
	EmbedderAPIKey     string
	EmbedderDimensions int

	// Collections are aliases over versioned collections ("jobs" → "jobs_v1").
	JobsCollection    string
	UsersCollection   string
	CollectionVersion string
	// EventsCollection is the Mongo collection for impressions and interactions.
	EventsCollection string

	// Indexer runs the Mongo → Qdrant sync in this process. Turn it on in one instance only.
	Indexer           bool
	SyncInterval      time.Duration
	ReconcileInterval time.Duration

	CacheTTL       time.Duration
	QueryVectorTTL time.Duration
	FeedSize       int
	CandidateLimit int
	ChannelLimit   int
	// ScanLimit is the most filtered jobs scored directly when no vector channel runs.
	ScanLimit int
	// RequestTimeout bounds one ranked search before it falls back.
	RequestTimeout time.Duration

	// ModelPath is a LightGBM text model. Blank serves the hand-tuned weights only.
	ModelPath string
	// LTRPercent of signed-in users (by stable hash) get the learned model.
	LTRPercent int
	Experiment string
}

// LoadRanking reads RANKING_*, QDRANT_*, REDIS_URL, and EMBEDDER_* from the environment.
func LoadRanking() Ranking {
	return Ranking{
		QdrantURL:    strings.TrimRight(Env("QDRANT_URL", ""), "/"),
		QdrantAPIKey: Env("QDRANT_API_KEY", ""),
		RedisURL:     Env("REDIS_URL", ""),

		EmbedderURL:        strings.TrimRight(Env("EMBEDDER_URL", ""), "/"),
		EmbedderAPI:        strings.ToLower(Env("EMBEDDER_API", defaultEmbedderAPI)),
		EmbedderModel:      Env("EMBEDDER_MODEL", defaultEmbedderModel),
		EmbedderAPIKey:     Env("EMBEDDER_API_KEY", ""),
		EmbedderDimensions: EnvInt("EMBEDDER_DIMENSIONS", defaultEmbedderDimensions),

		JobsCollection:    Env("RANKING_JOBS_COLLECTION", defaultRankingJobsCollection),
		UsersCollection:   Env("RANKING_USERS_COLLECTION", defaultRankingUsersCollection),
		CollectionVersion: Env("RANKING_COLLECTION_VERSION", defaultRankingCollectionVersion),
		EventsCollection:  Env("RANKING_EVENTS_COLLECTION", defaultRankingEventsCollection),

		Indexer:           envFlag("RANKING_INDEXER"),
		SyncInterval:      EnvDuration("RANKING_SYNC_INTERVAL", defaultRankingSyncInterval),
		ReconcileInterval: EnvDuration("RANKING_RECONCILE_INTERVAL", defaultRankingReconcileInterval),

		CacheTTL:       EnvDuration("RANKING_CACHE_TTL", defaultRankingCacheTTL),
		QueryVectorTTL: EnvDuration("RANKING_QUERY_VECTOR_TTL", defaultRankingQueryVectorTTL),
		FeedSize:       EnvInt("RANKING_FEED_SIZE", defaultRankingFeedSize),
		CandidateLimit: EnvInt("RANKING_CANDIDATE_LIMIT", defaultRankingCandidateLimit),
		ChannelLimit:   EnvInt("RANKING_CHANNEL_LIMIT", defaultRankingChannelLimit),
		ScanLimit:      EnvInt("RANKING_SCAN_LIMIT", defaultRankingScanLimit),
		RequestTimeout: EnvDuration("RANKING_REQUEST_TIMEOUT", defaultRankingRequestTimeout),

		ModelPath:  Env("RANKING_MODEL_PATH", ""),
		LTRPercent: envPercent("RANKING_LTR_PERCENT"),
		Experiment: Env("RANKING_EXPERIMENT", defaultRankingExperiment),
	}
}

// envPercent reads a whole number from 0 to 100; anything else is 0.
func envPercent(key string) int {
	value := EnvInt(key, 0)
	if value > 100 {
		return 100
	}
	return value
}
