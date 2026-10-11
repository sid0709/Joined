package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

// loadQueries is the request mix: blank and filtered browsing, typed queries, and
// typed queries with filters, roughly as people search.
var loadQueries = []string{
	"sort=relevance",
	"sort=recommended",
	"sort=recommended&remote=true",
	"sort=relevance&salaryMin=150000",
	"sort=newest&postedDays=7",
	"sort=pay&workplace=hybrid,onsite",
	"q=machine+learning+engineer",
	"q=ai+engineer&remote=true",
	"q=data+scientist",
	"q=senior+backend+engineer+golang",
	"q=product+manager",
	"q=marketing+manager&postedDays=14",
	"q=react+frontend+developer&salaryMin=120000",
	"q=registered+nurse",
	"q=account+executive",
	"q=site+reliability+engineer&seniority=Senior",
}

// loadTimeout bounds one request; a slower answer counts as an error.
const loadTimeout = 5 * time.Second

func runLoadTest(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("loadtest", flag.ExitOnError)
	base := flags.String("url", "http://127.0.0.1:8080", "joined-backend base URL")
	rps := flags.Int("rps", 100, "requests per second")
	duration := flags.Duration("duration", 30*time.Second, "how long to run")
	token := flags.String("token", "", "a session token, to load-test personalized search")
	pages := flags.Int("pages", 3, "spread requests over this many result pages")
	budget := flags.Duration("p95", 0, "fail when client p95 latency exceeds this (0 = report only)")
	_ = flags.Parse(args)
	if *rps < 1 || *pages < 1 {
		return errors.New("-rps and -pages must be positive")
	}

	client := &http.Client{Timeout: loadTimeout}
	var mu sync.Mutex
	latencies, server := []time.Duration{}, []float64{}
	errorsSeen := map[string]int{}
	var wg sync.WaitGroup
	ticker := time.NewTicker(time.Second / time.Duration(*rps))
	defer ticker.Stop()
	deadline := time.After(*duration)
	sent := 0
loop:
	for {
		select {
		case <-ctx.Done():
			break loop
		case <-deadline:
			break loop
		case <-ticker.C:
			query := loadQueries[sent%len(loadQueries)]
			page := sent/len(loadQueries)%*pages + 1
			sent++
			wg.Add(1)
			go func() {
				defer wg.Done()
				took, serverMS, err := searchOnce(ctx, client, *base, query, page, *token)
				mu.Lock()
				defer mu.Unlock()
				if err != nil {
					errorsSeen[err.Error()]++
					return
				}
				latencies = append(latencies, took)
				if serverMS > 0 {
					server = append(server, serverMS)
				}
			}()
		}
	}
	wg.Wait()

	sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })
	sort.Float64s(server)
	failed := 0
	for _, n := range errorsSeen {
		failed += n
	}
	fmt.Printf("sent %d  ok %d  errors %d  (%.0f rps for %s)\n", sent, len(latencies), failed, float64(*rps), *duration)
	if len(latencies) > 0 {
		fmt.Printf("client   p50 %6.1fms  p90 %6.1fms  p95 %6.1fms  p99 %6.1fms  max %6.1fms\n",
			ms(pct(latencies, 50)), ms(pct(latencies, 90)), ms(pct(latencies, 95)), ms(pct(latencies, 99)), ms(latencies[len(latencies)-1]))
	}
	if len(server) > 0 {
		fmt.Printf("ranking  p50 %6.1fms  p90 %6.1fms  p95 %6.1fms  p99 %6.1fms  (server-side, ranked requests)\n",
			pctF(server, 50), pctF(server, 90), pctF(server, 95), pctF(server, 99))
	}
	for msg, n := range errorsSeen {
		fmt.Printf("  %d× %s\n", n, msg)
	}
	if *budget > 0 && len(latencies) > 0 && pct(latencies, 95) > *budget {
		return fmt.Errorf("client p95 %.1fms is over the %s budget", ms(pct(latencies, 95)), *budget)
	}
	if failed > 0 {
		return fmt.Errorf("%d requests failed", failed)
	}
	return nil
}

func searchOnce(ctx context.Context, client *http.Client, base, query string, page int, token string) (time.Duration, float64, error) {
	target := strings.TrimRight(base, "/") + "/v1/search/jobs?limit=25&page=" + url.QueryEscape(fmt.Sprint(page)) + "&" + query
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return 0, 0, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return 0, 0, fmt.Errorf("transport: %v", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	took := time.Since(start)
	if err != nil {
		return 0, 0, err
	}
	if resp.StatusCode != http.StatusOK {
		return 0, 0, fmt.Errorf("status %d", resp.StatusCode)
	}
	var parsed struct {
		Timing map[string]float64 `json:"timing"`
	}
	_ = json.Unmarshal(body, &parsed)
	return took, parsed.Timing["total"], nil
}

func pct(sorted []time.Duration, p int) time.Duration {
	return sorted[min(len(sorted)-1, len(sorted)*p/100)]
}

func pctF(sorted []float64, p int) float64 {
	return sorted[min(len(sorted)-1, len(sorted)*p/100)]
}

func ms(d time.Duration) float64 {
	return float64(d.Microseconds()) / 1000
}
