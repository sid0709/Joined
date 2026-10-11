package ranking

import (
	"container/heap"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/RoaringBitmap/roaring/v2"

	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

// Index resolution: filters compare pay in whole thousands of USD and dates in
// whole days, the same resolution the per-job predicate and Qdrant use.
const (
	payUnitUSD  = 1000
	secondsADay = 86400
	// payBucketUSD groups jobs into pay buckets: a pay range is the union of the
	// buckets wholly inside it plus an exact check of the one bucket it cuts.
	payBucketUSD = 10_000
	payBuckets   = maxPlausibleAnnualUSD/payBucketUSD + 1
	// maxTermExpansion caps how many index terms one typed prefix can stand for.
	maxTermExpansion = 64
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
	// payMaxBucket[k] / payMinBucket[k] hold jobs whose top / bottom pay falls in bucket k.
	payMaxBucket []*roaring.Bitmap
	payMinBucket []*roaring.Bitmap
	// postedOn holds jobs by posting day (days since the epoch).
	postedOn map[int32]*roaring.Bitmap
	// payMaxFrom[k] = jobs with top pay in bucket k or above; payMinTo[k] = bottom
	// pay in a bucket below k. Rebuilt lazily when version moves.
	payMaxFrom  []*roaring.Bitmap
	payMinTo    []*roaring.Bitmap
	rangesBuilt uint64
	// postedUnix is the posting time per slot, for exact recency ordering.
	postedUnix []int64
	// version changes on every update, so derived caches (facets) know they are stale.
	version uint64
	// byRecency is every active slot, newest first, rebuilt lazily when version moves.
	byRecency    []uint32
	recencyBuilt uint64
}

// NewIndex returns an empty index.
func NewIndex() *Index {
	return NewIndexWithCapacity(0)
}

// NewIndexWithCapacity returns an empty index sized for about n jobs, so a full
// reconcile does not grow (and copy) its columns a million jobs at a time.
func NewIndexWithCapacity(n int) *Index {
	return &Index{
		jobs:         make([]JobFeatures, 0, n),
		postedUnix:   make([]int64, 0, n),
		slot:         make(map[string]uint32, n),
		active:       roaring.New(),
		workplace:    newBitmaps(int(WorkplaceOnsite) + 1),
		region:       newBitmaps(len(regionNames)),
		seniority:    newBitmaps(len(jobschema.Seniorities()) + 1),
		employment:   newBitmaps(len(jobschema.Employments()) + 1),
		hidden:       roaring.New(),
		visa:         roaring.New(),
		payKnown:     roaring.New(),
		source:       map[string]*roaring.Bitmap{},
		location:     map[string]*roaring.Bitmap{},
		company:      map[string]*roaring.Bitmap{},
		occupation:   map[string]*roaring.Bitmap{},
		payMaxBucket: newBitmaps(payBuckets),
		payMinBucket: newBitmaps(payBuckets),
		postedOn:     map[int32]*roaring.Bitmap{},
	}
}

func newBitmaps(n int) []*roaring.Bitmap {
	out := make([]*roaring.Bitmap, n)
	for i := range out {
		out[i] = roaring.New()
	}
	return out
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
	x.postedUnix[slot] = unixOf(job.PostedAt)
	x.setSlot(slot, &job)
	x.version++
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
	x.postedUnix[slot] = 0
	x.free = append(x.free, slot)
	x.version++
	return true
}

// Version changes whenever the index does.
func (x *Index) Version() uint64 {
	x.mu.RLock()
	defer x.mu.RUnlock()
	return x.version
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
	x.postedUnix = append(x.postedUnix, 0)
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
		x.payMaxBucket[payBucket(job.PayMaxUSD)].Add(slot)
		x.payMinBucket[payBucket(job.PayMinUSD)].Add(slot)
	}
	bitmapForDay(x.postedOn, dayOf(job.PostedAt)).Add(slot)
}

func payBucket(usd int32) int {
	return min(max(int(usd)/payBucketUSD, 0), payBuckets-1)
}

func bitmapForDay(m map[int32]*roaring.Bitmap, day int32) *roaring.Bitmap {
	b, ok := m[day]
	if !ok {
		b = roaring.New()
		m[day] = b
	}
	return b
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
	if job.PayKnown {
		x.payKnown.Remove(slot)
		x.payMaxBucket[payBucket(job.PayMaxUSD)].Remove(slot)
		x.payMinBucket[payBucket(job.PayMinUSD)].Remove(slot)
	}
	day := dayOf(job.PostedAt)
	if b, ok := x.postedOn[day]; ok {
		b.Remove(slot)
		if b.IsEmpty() {
			delete(x.postedOn, day)
		}
	}
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

func unixOf(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.Unix()
}

func dayOf(t time.Time) int32 {
	if t.IsZero() {
		return 0
	}
	return int32(t.Unix() / secondsADay)
}

// Match returns the slots that pass f. The caller owns the bitmap.
func (x *Index) Match(f Filter) *roaring.Bitmap {
	x.ensureRanges()
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
		and(x.payAtMost(f.PayMaxUSD))
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

// ensureRanges rebuilds the cumulative pay unions if the index changed since.
// It needs the write lock; callers hold neither lock.
func (x *Index) ensureRanges() {
	x.mu.RLock()
	fresh := x.rangesBuilt == x.version && x.payMaxFrom != nil
	x.mu.RUnlock()
	if fresh {
		return
	}
	x.mu.Lock()
	defer x.mu.Unlock()
	if x.rangesBuilt == x.version && x.payMaxFrom != nil {
		return
	}
	from := make([]*roaring.Bitmap, payBuckets+1)
	from[payBuckets] = roaring.New()
	for k := payBuckets - 1; k >= 0; k-- {
		from[k] = roaring.Or(from[k+1], x.payMaxBucket[k])
	}
	to := make([]*roaring.Bitmap, payBuckets+1)
	to[0] = roaring.New()
	for k := 1; k <= payBuckets; k++ {
		to[k] = roaring.Or(to[k-1], x.payMinBucket[k-1])
	}
	x.payMaxFrom, x.payMinTo, x.rangesBuilt = from, to, x.version
}

// payAtLeast is every job whose top pay, in whole thousands, reaches floor
// rounded up to the thousand — the rule the predicate and Qdrant use.
// Callers hold the read lock and have called ensureRanges.
func (x *Index) payAtLeast(floor int32) *roaring.Bitmap {
	units := (int64(floor) + payUnitUSD - 1) / payUnitUSD
	cut := payBucket(int32(units * payUnitUSD))
	result := x.payMaxFrom[cut+1].Clone()
	it := x.payMaxBucket[cut].Iterator()
	for it.HasNext() {
		slot := it.Next()
		if int64(x.jobs[slot].PayMaxUSD/payUnitUSD) >= units {
			result.Add(slot)
		}
	}
	return result
}

// payAtMost is every job whose bottom pay, in whole thousands, is at most ceiling's.
func (x *Index) payAtMost(ceiling int32) *roaring.Bitmap {
	units := int64(ceiling / payUnitUSD)
	cut := payBucket(int32(units * payUnitUSD))
	result := x.payMinTo[cut].Clone()
	it := x.payMinBucket[cut].Iterator()
	for it.HasNext() {
		slot := it.Next()
		if int64(x.jobs[slot].PayMinUSD/payUnitUSD) <= units {
			result.Add(slot)
		}
	}
	return result
}

// postedSince is every job posted on or after after's day.
func (x *Index) postedSince(after time.Time) *roaring.Bitmap {
	cutoff := dayOf(after)
	days := make([]*roaring.Bitmap, 0, len(x.postedOn))
	for day, b := range x.postedOn {
		if day >= cutoff {
			days = append(days, b)
		}
	}
	return roaring.FastOr(days...)
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
	x.ensureRanges()
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

// OccupationSlots is every job in any of the given families.
func (x *Index) OccupationSlots(families []string) *roaring.Bitmap {
	x.mu.RLock()
	defer x.mu.RUnlock()
	out := roaring.New()
	for _, family := range families {
		if b, ok := x.occupation[family]; ok {
			out.Or(b)
		}
	}
	return out
}

// recentHeapLimit: a filtered set this small is ordered directly; a larger one
// walks the global newest-first order and stops after n hits.
const recentHeapLimit = 4096

// Recent returns the ids of the n most recently posted jobs among slots, newest first.
func (x *Index) Recent(slots *roaring.Bitmap, n int) []string {
	if n <= 0 {
		return nil
	}
	if slots.GetCardinality() > recentHeapLimit {
		x.ensureRecency()
	}
	x.mu.RLock()
	defer x.mu.RUnlock()
	if slots.GetCardinality() > recentHeapLimit && x.recencyBuilt == x.version {
		out := make([]string, 0, n)
		for _, slot := range x.byRecency {
			if slots.Contains(slot) {
				out = append(out, x.jobs[slot].JobID)
				if len(out) == n {
					break
				}
			}
		}
		return out
	}
	h := &timeHeap{}
	it := slots.Iterator()
	for it.HasNext() {
		slot := it.Next()
		if int(slot) >= len(x.postedUnix) {
			continue
		}
		entry := timeSlot{at: x.postedUnix[slot], slot: slot}
		if h.Len() < n {
			heap.Push(h, entry)
		} else if entry.at > (*h)[0].at || (entry.at == (*h)[0].at && entry.slot < (*h)[0].slot) {
			(*h)[0] = entry
			heap.Fix(h, 0)
		}
	}
	out := make([]string, h.Len())
	for i := len(out) - 1; i >= 0; i-- {
		out[i] = x.jobs[heap.Pop(h).(timeSlot).slot].JobID
	}
	return out
}

// ensureRecency rebuilds the newest-first order if the index changed since.
func (x *Index) ensureRecency() {
	x.mu.RLock()
	fresh := x.recencyBuilt == x.version && x.byRecency != nil
	x.mu.RUnlock()
	if fresh {
		return
	}
	x.mu.Lock()
	defer x.mu.Unlock()
	if x.recencyBuilt == x.version && x.byRecency != nil {
		return
	}
	order := x.active.ToArray()
	sort.Slice(order, func(i, j int) bool {
		a, b := x.postedUnix[order[i]], x.postedUnix[order[j]]
		if a != b {
			return a > b
		}
		return order[i] < order[j]
	})
	x.byRecency, x.recencyBuilt = order, x.version
}

// ObjectIDs maps job ids to Mongo _ids, keeping order; unknown ids map to "".
func (x *Index) ObjectIDs(ids []string) []string {
	x.mu.RLock()
	defer x.mu.RUnlock()
	out := make([]string, len(ids))
	for i, id := range ids {
		if slot, ok := x.slot[id]; ok {
			out[i] = x.jobs[slot].ObjectID
		}
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

type timeSlot struct {
	at   int64
	slot uint32
}

// timeHeap is a min-heap on posting time (ties: higher slot first out), so the
// root is the weakest of the kept jobs.
type timeHeap []timeSlot

func (h timeHeap) Len() int { return len(h) }
func (h timeHeap) Less(i, j int) bool {
	if h[i].at != h[j].at {
		return h[i].at < h[j].at
	}
	return h[i].slot > h[j].slot
}
func (h timeHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *timeHeap) Push(v any)   { *h = append(*h, v.(timeSlot)) }
func (h *timeHeap) Pop() any {
	old := *h
	n := len(old)
	v := old[n-1]
	*h = old[:n-1]
	return v
}
