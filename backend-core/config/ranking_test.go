package config

import (
	"testing"
	"time"
)

func TestLoadRankingDefaults(t *testing.T) {
	for _, key := range []string{
		"QDRANT_URL", "REDIS_URL", "EMBEDDER_URL", "EMBEDDER_API", "RANKING_INDEXER",
		"RANKING_LTR_PERCENT", "RANKING_CACHE_TTL", "RANKING_FEED_SIZE", "RANKING_EVENTS",
	} {
		t.Setenv(key, "")
	}
	cfg := LoadRanking()
	if cfg.QdrantURL != "" || cfg.RedisURL != "" || cfg.EmbedderURL != "" {
		t.Fatalf("external services should default off, got %+v", cfg)
	}
	if cfg.EmbedderAPI != EmbedderTEI || cfg.EmbedderDimensions != defaultEmbedderDimensions {
		t.Fatalf("embedder defaults = %q/%d", cfg.EmbedderAPI, cfg.EmbedderDimensions)
	}
	if !cfg.Events {
		t.Fatal("event logging should default on")
	}
	if cfg.Indexer || cfg.LTRPercent != 0 {
		t.Fatalf("indexer and LTR should default off, got %v/%d", cfg.Indexer, cfg.LTRPercent)
	}
	if cfg.CacheTTL != defaultRankingCacheTTL || cfg.FeedSize != defaultRankingFeedSize {
		t.Fatalf("cache defaults = %v/%d", cfg.CacheTTL, cfg.FeedSize)
	}
}

func TestLoadRankingOverrides(t *testing.T) {
	t.Setenv("QDRANT_URL", "http://qdrant:6333/")
	t.Setenv("EMBEDDER_API", "OpenAI")
	t.Setenv("RANKING_INDEXER", "true")
	t.Setenv("RANKING_LTR_PERCENT", "250")
	t.Setenv("RANKING_CACHE_TTL", "2m")
	cfg := LoadRanking()
	if cfg.QdrantURL != "http://qdrant:6333" {
		t.Fatalf("QdrantURL = %q, want trailing slash trimmed", cfg.QdrantURL)
	}
	if cfg.EmbedderAPI != EmbedderOpenAI {
		t.Fatalf("EmbedderAPI = %q", cfg.EmbedderAPI)
	}
	if !cfg.Indexer || cfg.LTRPercent != 100 || cfg.CacheTTL != 2*time.Minute {
		t.Fatalf("overrides not applied: %+v", cfg)
	}
}
