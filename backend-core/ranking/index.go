package ranking

import (
	"container/heap"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/RoaringBitmap/roaring/v2"
	bsi "github.com/RoaringBitmap/roaring/v2/BitSliceIndexing"

	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

// Index storage units: pay in thousands of USD and dates in whole days keep the
// bit-sliced indexes narrow. Filters round the same way, so they stay exact at
// the resolution the UI offers ($10k steps, whole days).
const (
	payUnitUSD  = 1000
	secondsADay = 86400
	// maxTermExpansion caps how many index terms one typed prefix can stand for.
	maxTermExpansion = 64
	// bsiParallelism lets a range compare use every core.
	bsiParallelism = 0
)

// FacetPostedDays and FacetPayFloors are the quick-filter values the UI shows counts for.
var (
	FacetPostedDays = []int{1, 3, 7, 14}
	FacetPayFloors  = []int32{50_000, 100_000, 150_000, 200_000}
)

// Index is the in-memory feature store: one slot per public job, the features the
// ranker reads, and a bitmap for every filterable value. It is safe for concurrent
// use; reads take a shared lock, updates an exclusive one.
type Index struct {
	mu   sync.RWMutex
	slot map[string]uint32
	jobs []JobFeatures
	free []uint32

	active     *roaring.Bitmap
	workplace  []*roaring.Bitmap
	region     []*roaring.Bitmap
	seniority  []*roaring.Bitmap
	employment []*roaring.Bitmap
	hidden     *roaring.Bitmap
	visa       *roaring.Bitmap
	payKnown   *roaring.Bitmap
	source     map[string]*roaring.Bitmap
	location   map[string]*roaring.Bitmap
	company    map[string]*roaring.Bitmap
	occupation map[string]*roaring.Bitmap
	payMin     *bsi.BSI
	payMax     *bsi.BSI
	posted     *bsi.BSI
	// postedDay is a column copy of posted, for recency ordering without the BSI.
	postedDay []int32
}

// NewIndex returns an empty index.
func NewIndex() *Index {
	newBitmaps := func(n int) []*roaring.Bitmap {
		out := make([]*roaring.Bitmap, n)
		for i := range out {
			out[i] = roaring.New()
		}
		return out
	}
	return &Index{
		slot:       map[string]uint32{},
		active:     roaring.New(),
		workplace:  newBitmaps(int(WorkplaceOnsite) + 1),
		region:     newBitmaps(len(regionNames)),
		seniority:  newBitmaps(len(jobschema.Seniorities()) + 1),
		employment: newBitmaps(len(jobschema.Employments()) + 1),
		hidden:     roaring.New(),
		visa:       roaring.New(),
		payKnown:   roaring.New(),
		source:     map[string]*roaring.Bitmap{},
		location:   map[string]*roaring.Bitmap{},
		company:    map[string]*roaring.Bitmap{},
		occupation: map[string]*roaring.Bitmap{},
		payMin:     bsi.NewDefaultBSI(),
		payMax:     bsi.NewDefaultBSI(),
		posted:     bsi.NewDefaultBSI(),
	}
}

// Len is how many jobs the index holds.
func (x *Index) Len() int {
	x.mu.RLock()
	defer x.mu.RUnlock()
	return int(x.active.GetCardinality())
}

// Upsert adds a job or replaces the stored copy.
func (x *Index) Upsert(job JobFeatures) {
	if job.JobID == "" {
		return
	}
	// The index never shows them; keeping them would cost memory per job.
	job.Summary, job.Team = "", ""
	x.mu.Lock()
	defer x.mu.Unlock()
	slot, exists := x.slot[job.JobID]
	if exists {
		x.clearSlot(slot)
	} else {
		slot = x.allocate()
		x.slot[job.JobID] = slot
	}
	x.jobs[slot] = job
	x.postedDay[slot] = dayOf(job.PostedAt)
	x.setSlot(slot, &job)
}

// Remove drops a job. It reports whether the job was there.
func (x *Index) Remove(jobID string) bool {
	x.mu.Lock()
	defer x.mu.Unlock()
	slot, ok := x.slot[jobID]
	if !ok {
		return false
	}
	x.clearSlot(slot)
	delete(x.slot, jobID)
	x.jobs[slot] = JobFeatures{}
	x.postedDay[slot] = 0
	x.free = append(x.free, slot)
	return true
}

// JobIDs lists every job in the index.
func (x *Index) JobIDs() []string {
	x.mu.RLock()
	defer x.mu.RUnlock()
	out := make([]string, 0, len(x.slot))
	for id := range x.slot {
		out = append(out, id)
	}
	return out
}

// Get returns a copy of one job's features.
func (x *Index) Get(jobID string) (JobFeatures, bool) {
	x.mu.RLock()
	defer x.mu.RUnlock()
	slot, ok := x.slot[jobID]
	if !ok {
		return JobFeatures{}, false
	}
	return x.jobs[slot], true
}

// Lookup returns copies of the features for each id the index holds, keyed by id.
func (x *Index) Lookup(ids []string) map[string]*JobFeatures {
	x.mu.RLock()
	defer x.mu.RUnlock()
	out := make(map[string]*JobFeatures, len(ids))
	for _, id := range ids {
		if slot, ok := x.slot[id]; ok {
			job := x.jobs[slot]
			out[id] = &job
		}
	}
	return out
}

func (x *Index) allocate() uint32 {
	if n := len(x.free); n > 0 {
		slot := x.free[n-1]
		x.free = x.free[:n-1]
		return slot
	}
	x.jobs = append(x.jobs, JobFeatures{})
	x.postedDay = append(x.postedDay, 0)
	return uint32(len(x.jobs) - 1)
}

func (x *Index) setSlot(slot uint32, job *JobFeatures) {
	x.active.Add(slot)
	x.workplace[job.Workplace].Add(slot)
	x.region[job.Region].Add(slot)
	if int(job.Seniority) < len(x.seniority) {
		x.seniority[job.Seniority].Add(slot)
	}
	if int(job.Employment) < len(x.employment) {
		x.employment[job.Employment].Add(slot)
	}
	if job.Hidden {
		x.hidden.Add(slot)
	}
	if job.Visa == VisaYes {
		x.visa.Add(slot)
	}
	if job.Source != "" {
		bitmapFor(x.source, job.Source).Add(slot)
	}
	for _, term := range uniqueTerms(job.Location) {
		bitmapFor(x.location, term).Add(slot)
	}
	for _, term := range uniqueTerms(job.Company) {
		bitmapFor(x.company, term).Add(slot)
	}
	for _, family := range job.Occupations {
		bitmapFor(x.occupation, family).Add(slot)
	}
	if job.PayKnown {
		x.payKnown.Add(slot)
		x.payMin.SetValue(uint64(slot), int64(job.PayMinUSD/payUnitUSD))
		x.payMax.SetValue(uint64(slot), int64(job.PayMaxUSD/payUnitUSD))
	}
	x.posted.SetValue(uint64(slot), int64(x.postedDay[slot]))
}

func (x *Index) clearSlot(slot uint32) {
	job := &x.jobs[slot]
	x.active.Remove(slot)
	x.workplace[job.Workplace].Remove(slot)
	x.region[job.Region].Remove(slot)
	if int(job.Seniority) < len(x.seniority) {
		x.seniority[job.Seniority].Remove(slot)
	}
	if int(job.Employment) < len(x.employment) {
		x.employment[job.Employment].Remove(slot)
	}
	x.hidden.Remove(slot)
	x.visa.Remove(slot)
	removeFrom(x.source, job.Source, slot)
	for _, term := range uniqueTerms(job.Location) {
		removeFrom(x.location, term, slot)
	}
	for _, term := range uniqueTerms(job.Company) {
		removeFrom(x.company, term, slot)
	}
	for _, family := range job.Occupations {
		removeFrom(x.occupation, family, slot)
	}
	one := roaring.BitmapOf(slot)
	if x.payKnown.Contains(slot) {
		x.payKnown.Remove(slot)
		x.payMin.ClearValues(one)
		x.payMax.ClearValues(one)
	}
	x.posted.ClearValues(one)
}

func bitmapFor(m map[string]*roaring.Bitmap, key string) *roaring.Bitmap {
	b, ok := m[key]
	if !ok {
		b = roaring.New()
		m[key] = b
	}
	return b
}

func removeFrom(m map[string]*roaring.Bitmap, key string, slot uint32) {
	if b, ok := m[key]; ok {
		b.Remove(slot)
		if b.IsEmpty() {
			delete(m, key)
		}
	}
}

func uniqueTerms(text string) []string {
	terms := LocationTerms(text)
	seen := make(map[string]struct{}, len(terms))
	out := terms[:0]
	for _, term := range terms {
		if _, dup := seen[term]; !dup {
			seen[term] = struct{}{}
			out = append(out, term)
		}
	}
	return out
}

func dayOf(t time.Time) int32 {
	if t.IsZero() {
		return 0
	}
	return int32(t.Unix() / secondsADay)
}

// Match returns the slots that pass f. The caller owns the bitmap.
func (x *Index) Match(f Filter) *roaring.Bitmap {
	x.mu.RLock()
	defer x.mu.RUnlock()
	return x.match(f, "")
}

// Count is how many jobs pass f.
func (x *Index) Count(f Filter) uint64 {
	return x.Match(f).GetCardinality()
}

// match evaluates f, skipping the dimension named skip (for facet counts).
func (x *Index) match(f Filter, skip string) *roaring.Bitmap {
	result := x.active.Clone()
	and := func(b *roaring.Bitmap) {
		if b == nil {
			result.Clear()
			return
		}
		result.And(b)
	}
	if len(f.Workplaces) > 0 && skip != facetWorkplace {
		and(unionOf(x.workplace, f.Workplaces))
	}
	if len(f.Seniorities) > 0 && skip != facetSeniority {
		and(unionOf(x.seniority, f.Seniorities))
	}
	if len(f.Employments) > 0 && skip != facetEmployment {
		and(unionOf(x.employment, f.Employments))
	}
	if len(f.Regions) > 0 {
		and(unionOf(x.region, f.Regions))
	}
	if len(f.Sources) > 0 {
		union := roaring.New()
		for _, source := range f.Sources {
			if b, ok := x.source[source]; ok {
				union.Or(b)
			}
		}
		and(union)
	}
	if f.HiddenOnly && skip != facetHidden {
		and(x.hidden)
	}
	if f.VisaOnly && skip != facetVisa {
		and(x.visa)
	}
	if f.PayMinUSD > 0 && skip != facetPay {
		and(x.payAtLeast(f.PayMinUSD))
	}
	if f.PayMaxUSD > 0 {
		floor := x.payMin.CompareValue(bsiParallelism, bsi.LE, int64(f.PayMaxUSD/payUnitUSD), 0, x.payKnown)
		and(floor)
	}
	if !f.PostedAfter.IsZero() && skip != facetPosted {
		and(x.postedSince(f.PostedAfter))
	}
	if len(f.LocationTerms) > 0 {
		and(termsBitmap(x.location, f.LocationTerms))
	}
	if len(f.CompanyTerms) > 0 {
		and(termsBitmap(x.company, f.CompanyTerms))
	}
	for _, id := range f.Exclude {
		if slot, ok := x.slot[id]; ok {
			result.Remove(slot)
		}
	}
	return result
}

func (x *Index) payAtLeast(floor int32) *roaring.Bitmap {
	// Pay is stored in whole thousands rounded down; a floor in thousands rounded up
	// keeps "≥ floor" exact for floors on the $1k grid the filters use.
	units := (int64(floor) + payUnitUSD - 1) / payUnitUSD
	return x.payMax.CompareValue(bsiParallelism, bsi.GE, units, 0, x.payKnown)
}

func (x *Index) postedSince(after time.Time) *roaring.Bitmap {
	return x.posted.CompareValue(bsiParallelism, bsi.GE, int64(dayOf(after)), 0, nil)
}

func unionOf[T ~uint8](bitmaps []*roaring.Bitmap, values []T) *roaring.Bitmap {
	union := roaring.New()
	for _, v := range values {
		if int(v) < len(bitmaps) {
			union.Or(bitmaps[v])
		}
	}
	return union
}

// termsBitmap intersects every exact term and the union of the last term's prefix matches.
func termsBitmap(index map[string]*roaring.Bitmap, terms []string) *roaring.Bitmap {
	var result *roaring.Bitmap
	for i, term := range terms {
		var b *roaring.Bitmap
		if i == len(terms)-1 {
			b = roaring.New()
			for _, full := range expand(index, term) {
				b.Or(index[full])
			}
		} else if exact, ok := index[term]; ok {
			b = exact.Clone()
		} else {
			return roaring.New()
		}
		if result == nil {
			result = b
		} else {
			result.And(b)
		}
	}
	if result == nil {
		return roaring.New()
	}
	return result
}

// expand lists the index terms that start with prefix, the exact term first.
func expand(index map[string]*roaring.Bitmap, prefix string) []string {
	out := []string{}
	if _, ok := index[prefix]; ok {
		out = append(out, prefix)
	}
	for term := range index {
		if term != prefix && strings.HasPrefix(term, prefix) {
			out = append(out, term)
		}
	}
	if len(out) > 1 {
		rest := out[1:]
		if _, exact := index[prefix]; !exact {
			rest = out
		}
		sort.Strings(rest)
	}
	if len(out) > maxTermExpansion {
		out = out[:maxTermExpansion]
	}
	return out
}

// Expansions returns the full location and company terms the filter's last terms stand for,
// for building the matching Qdrant filter.
func (x *Index) Expansions(f Filter) (location, company []string) {
	x.mu.RLock()
	defer x.mu.RUnlock()
	if n := len(f.LocationTerms); n > 0 {
		location = expand(x.location, f.LocationTerms[n-1])
	}
	if n := len(f.CompanyTerms); n > 0 {
		company = expand(x.company, f.CompanyTerms[n-1])
	}
	return location, company
}

// Facet dimension names.
const (
	facetWorkplace  = "workplace"
	facetSeniority  = "seniority"
	facetEmployment = "employment"
	facetHidden     = "hidden"
	facetVisa       = "visa"
	facetPosted     = "posted"
	facetPay        = "pay"
)

// Facets are exact counts for each quick-filter value, given the rest of the
// filter: the "Remote" count assumes every other active filter but not the
// workplace one, so it says how many jobs that chip would show.
type Facets struct {
	Total      uint64            `json:"total"`
	Workplace  map[string]uint64 `json:"workplace"`
	Seniority  map[string]uint64 `json:"seniority"`
	Employment map[string]uint64 `json:"employment"`
	Hidden     uint64            `json:"hidden"`
	Visa       uint64            `json:"visa"`
	PostedDays map[string]uint64 `json:"postedDays"`
	PayAtLeast map[string]uint64 `json:"payAtLeast"`
}

// Facets counts every quick filter against f.
func (x *Index) Facets(f Filter, now time.Time) Facets {
	x.mu.RLock()
	defer x.mu.RUnlock()
	out := Facets{
		Total:      x.match(f, "").GetCardinality(),
		Workplace:  map[string]uint64{},
		Seniority:  map[string]uint64{},
		Employment: map[string]uint64{},
		PostedDays: map[string]uint64{},
		PayAtLeast: map[string]uint64{},
	}
	base := x.match(f, facetWorkplace)
	for _, name := range jobschema.Workplaces() {
		w := parseWorkplace(name)
		out.Workplace[name] = base.AndCardinality(x.workplace[w])
	}
	base = x.match(f, facetSeniority)
	for i, name := range jobschema.Seniorities() {
		out.Seniority[name] = base.AndCardinality(x.seniority[i+1])
	}
	base = x.match(f, facetEmployment)
	for i, name := range jobschema.Employments() {
		out.Employment[name] = base.AndCardinality(x.employment[i+1])
	}
	out.Hidden = x.match(f, facetHidden).AndCardinality(x.hidden)
	out.Visa = x.match(f, facetVisa).AndCardinality(x.visa)
	base = x.match(f, facetPosted)
	for _, days := range FacetPostedDays {
		since := x.postedSince(now.Add(-time.Duration(days) * 24 * time.Hour))
		out.PostedDays[strconv.Itoa(days)] = base.AndCardinality(since)
	}
	base = x.match(f, facetPay)
	for _, floor := range FacetPayFloors {
		out.PayAtLeast[strconv.Itoa(int(floor))] = base.AndCardinality(x.payAtLeast(floor))
	}
	return out
}

// ForEach calls fn with each matching job's features, under the read lock. fn must
// not keep the pointer or call back into the index. Return false to stop.
func (x *Index) ForEach(slots *roaring.Bitmap, fn func(*JobFeatures) bool) {
	x.mu.RLock()
	defer x.mu.RUnlock()
	it := slots.Iterator()
	for it.HasNext() {
		slot := it.Next()
		if int(slot) >= len(x.jobs) || x.jobs[slot].JobID == "" {
			continue
		}
		if !fn(&x.jobs[slot]) {
			return
		}
	}
}

// Recent returns the ids of the n most recently posted jobs among slots, newest first.
func (x *Index) Recent(slots *roaring.Bitmap, n int) []string {
	if n <= 0 {
		return nil
	}
	x.mu.RLock()
	defer x.mu.RUnlock()
	h := &dayHeap{}
	it := slots.Iterator()
	for it.HasNext() {
		slot := it.Next()
		if int(slot) >= len(x.postedDay) {
			continue
		}
		entry := daySlot{day: x.postedDay[slot], slot: slot}
		if h.Len() < n {
			heap.Push(h, entry)
		} else if entry.day > (*h)[0].day {
			(*h)[0] = entry
			heap.Fix(h, 0)
		}
	}
	out := make([]string, h.Len())
	for i := len(out) - 1; i >= 0; i-- {
		out[i] = x.jobs[heap.Pop(h).(daySlot).slot].JobID
	}
	return out
}

// IDs lists the job ids for slots.
func (x *Index) IDs(slots *roaring.Bitmap) []string {
	x.mu.RLock()
	defer x.mu.RUnlock()
	out := make([]string, 0, slots.GetCardinality())
	it := slots.Iterator()
	for it.HasNext() {
		slot := it.Next()
		if int(slot) < len(x.jobs) && x.jobs[slot].JobID != "" {
			out = append(out, x.jobs[slot].JobID)
		}
	}
	return out
}

// Contains reports whether jobID passes f — for filtering a precomputed feed.
func (x *Index) Contains(slots *roaring.Bitmap, jobID string) bool {
	x.mu.RLock()
	defer x.mu.RUnlock()
	slot, ok := x.slot[jobID]
	return ok && slots.Contains(slot)
}

// FilterIDs keeps the ids (in order) that pass slots.
func (x *Index) FilterIDs(slots *roaring.Bitmap, ids []string) []string {
	x.mu.RLock()
	defer x.mu.RUnlock()
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if slot, ok := x.slot[id]; ok && slots.Contains(slot) {
			out = append(out, id)
		}
	}
	return out
}

type daySlot struct {
	day  int32
	slot uint32
}

// dayHeap is a min-heap on day, so the root is the oldest of the kept jobs.
type dayHeap []daySlot

func (h dayHeap) Len() int           { return len(h) }
func (h dayHeap) Less(i, j int) bool { return h[i].day < h[j].day }
func (h dayHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *dayHeap) Push(v any)        { *h = append(*h, v.(daySlot)) }
func (h *dayHeap) Pop() any {
	old := *h
	n := len(old)
	v := old[n-1]
	*h = old[:n-1]
	return v
}
