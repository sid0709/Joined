package metrics

import (
	"context"
	"errors"
	"net"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metric names. PromQL in backend-core/monitoring uses these.
const (
	ModelCalls         = "joined_model_calls_total"
	ModelLatency       = "joined_model_latency_seconds"
	ModelTokens        = "joined_model_tokens_total"
	WorkerLastSuccess  = "joined_worker_last_success_unixtime"
	WorkerLastDuration = "joined_worker_last_duration_seconds"
	WorkerLastError    = "joined_worker_last_error"
	WorkerItems        = "joined_worker_items_total"
)

// Outcomes on ModelCalls. Retries and a missing key are not successful calls.
const (
	OutcomeOK         = "ok"
	OutcomeError      = "error"
	OutcomeMissingKey = "missing_key"
	OutcomeTimeout    = "timeout"
	OutcomeEmpty      = "empty"
	OutcomeRetry      = "retry"
)

// Features label a model call. Never a user id or a prompt.
const (
	FeatureJobParse        = "job-parse"
	FeatureJobAnalyze      = "job-analyze"
	FeatureCompanyResearch = "company-research"
	FeatureCompanyAutofill = "company-autofill"
	FeatureDuplicate       = "duplicate-check"
	FeatureResume          = "resume-read"
	FeatureMigration       = "migration-assist"
	FeatureUnspecified     = "unspecified"
)

// Workers the product page lists.
const (
	WorkerImport  = "job-import"
	WorkerExpiry  = "job-expiry"
	WorkerRanking = "ranking-sync"
	WorkerStatus  = "status-recorder"
)

type featureKey struct{}

// WithFeature marks ctx so the model client can label the call.
func WithFeature(ctx context.Context, feature string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, featureKey{}, feature)
}

// EnsureFeature sets feature when ctx does not already carry one.
func EnsureFeature(ctx context.Context, feature string) context.Context {
	if Feature(ctx) != FeatureUnspecified {
		return ctx
	}
	return WithFeature(ctx, feature)
}

// Feature reads the label WithFeature stored, or FeatureUnspecified.
func Feature(ctx context.Context) string {
	if ctx == nil {
		return FeatureUnspecified
	}
	feature, _ := ctx.Value(featureKey{}).(string)
	if feature == "" {
		return FeatureUnspecified
	}
	return feature
}

var (
	modelCalls = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: ModelCalls,
		Help: "Model calls by feature, model, and outcome.",
	}, []string{"feature", "model", "outcome"})

	modelLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    ModelLatency,
		Help:    "Time a model call took, by feature and model.",
		Buckets: requestBuckets,
	}, []string{"feature", "model"})

	modelTokens = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: ModelTokens,
		Help: "Tokens a model call reported, by feature, model, and kind (prompt or completion).",
	}, []string{"feature", "model", "kind"})

	workerLastSuccess = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: WorkerLastSuccess,
		Help: "Unix time of a worker's last successful run.",
	}, []string{"worker"})

	workerLastDuration = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: WorkerLastDuration,
		Help: "Seconds a worker's last run took.",
	}, []string{"worker"})

	workerLastError = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: WorkerLastError,
		Help: "1 when a worker's last run failed, otherwise 0.",
	}, []string{"worker"})

	workerItems = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: WorkerItems,
		Help: "Items a worker handled.",
	}, []string{"worker"})
)

// RecordModel counts one model call. retries is how many attempts were not the last.
func RecordModel(ctx context.Context, model, outcome string, took time.Duration, prompt, completion, retries int) {
	feature := Feature(ctx)
	if model == "" {
		model = "unknown"
	}
	if outcome == "" {
		outcome = OutcomeError
	}
	for range retries {
		modelCalls.WithLabelValues(feature, model, OutcomeRetry).Inc()
	}
	modelCalls.WithLabelValues(feature, model, outcome).Inc()
	if outcome != OutcomeRetry && outcome != OutcomeMissingKey {
		modelLatency.WithLabelValues(feature, model).Observe(took.Seconds())
	}
	if prompt > 0 {
		modelTokens.WithLabelValues(feature, model, "prompt").Add(float64(prompt))
	}
	if completion > 0 {
		modelTokens.WithLabelValues(feature, model, "completion").Add(float64(completion))
	}
}

// ObserveWorker records the end of one worker run.
func ObserveWorker(name string, took time.Duration, failed bool, items int) {
	if name == "" {
		return
	}
	workerLastDuration.WithLabelValues(name).Set(took.Seconds())
	if failed {
		workerLastError.WithLabelValues(name).Set(1)
	} else {
		workerLastError.WithLabelValues(name).Set(0)
		workerLastSuccess.WithLabelValues(name).Set(float64(time.Now().Unix()))
	}
	if items > 0 {
		workerItems.WithLabelValues(name).Add(float64(items))
	}
}

// ModelOutcome classifies a model error. empty is a successful HTTP call with no text.
func ModelOutcome(err error, empty bool) string {
	if err == nil {
		if empty {
			return OutcomeEmpty
		}
		return OutcomeOK
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return OutcomeTimeout
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return OutcomeTimeout
	}
	return OutcomeError
}
