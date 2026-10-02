package jobs

// Progress hears how a bulk run goes. Calls come from many goroutines at once.
type Progress interface {
	// Total is how many items the run will work through.
	Total(n int64)
	// Done counts items finished.
	Done(n int64)
	// Skip counts items left alone because they cannot be worked on, such as a job with
	// no description.
	Skip(n int64)
	// Fail records one item that went wrong. The run carries on.
	Fail(id string, err error)
}

type noProgress struct{}

func (noProgress) Total(int64)        {}
func (noProgress) Done(int64)         {}
func (noProgress) Skip(int64)         {}
func (noProgress) Fail(string, error) {}

func orNoProgress(progress Progress) Progress {
	if progress == nil {
		return noProgress{}
	}
	return progress
}
