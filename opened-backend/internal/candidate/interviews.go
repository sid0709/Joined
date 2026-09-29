package candidate

import (
	"context"
	"net/url"
	"regexp"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var (
	timePattern = regexp.MustCompile(`^\d{2}:\d{2}$`)
	datePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

	// selfSchedulePath is the candidate page in opened-frontend schedule-join.ts.
	selfSchedulePath = "/schedule/"
)

var defaultPrepLabels = []string{
	"Research the company and product",
	"Prepare three impact stories",
	"Write questions for them",
	"Test camera, mic, and link",
}

type InterviewInput struct {
	ApplicationID string         `json:"applicationId"`
	Round         string         `json:"round"`
	Date          string         `json:"date"`
	Start         string         `json:"start"`
	End           string         `json:"end"`
	Format        string         `json:"format"`
	Where         string         `json:"where"`
	Interviewers  []Interviewer  `json:"interviewers"`
	Status        string         `json:"status"`
	Source        string         `json:"source"`
	Prep          []PrepTask     `json:"prep"`
	MeetingURL    string         `json:"-"`
	ScheduleMode  string         `json:"-"`
	ProposedSlots []ProposedSlot `json:"-"`
	SelfSchedule  bool           `json:"-"`
	CompanyStatus string         `json:"-"`
	PublicOrigin  string         `json:"-"`
	// OpenSlot allows a round with no locked date (propose / self-schedule).
	OpenSlot bool `json:"-"`
}

type InterviewPatch struct {
	Status       *string        `json:"status"`
	Outcome      *string        `json:"outcome"`
	SelfRating   *int           `json:"selfRating"`
	Notes        *string        `json:"notes"`
	Prep         *[]PrepTask    `json:"prep"`
	Round        *string        `json:"round"`
	Where        *string        `json:"where"`
	Interviewers *[]Interviewer `json:"interviewers"`
}

func (s *Store) ListInterviews(ctx context.Context, userID string) ([]Interview, error) {
	filter := bson.D{
		{Key: "userId", Value: userID},
		{Key: "companyStatus", Value: bson.D{{Key: "$ne", Value: CompanyStatusAwaiting}}},
	}
	cursor, err := s.collection(interviewsCollection).Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "date", Value: 1}, {Key: "start", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	items := []Interview{}
	if err := cursor.All(ctx, &items); err != nil {
		return nil, err
	}
	for i := range items {
		items[i] = normalizeInterview(items[i])
	}
	return items, nil
}

func (s *Store) CreateInterview(ctx context.Context, userID string, input InterviewInput, now time.Time) (Interview, error) {
	app, err := s.applicationByID(ctx, userID, input.ApplicationID)
	if err != nil {
		if err == ErrNotFound {
			return Interview{}, ErrNeedsApplication
		}
		return Interview{}, err
	}
	item, err := buildInterview(userID, app, input, now)
	if err != nil {
		return Interview{}, err
	}
	if s.calendar != nil && s.calendar.Configured() && item.Status == StatusScheduled {
		if conn, err := s.connection(ctx, userID); err == nil && conn.RefreshToken != "" {
			eventID, err := s.calendar.CreateEvent(ctx, conn.RefreshToken, CalEvent{
				Title:       app.Company + " · " + item.Round,
				Description: app.Title,
				Date:        item.Date,
				Start:       item.Start,
				End:         item.End,
				Where:       item.Where,
			})
			if err == nil {
				item.GoogleEventID = eventID
				item.Source = SourceCalendar
			}
		}
	}
	if _, err := s.collection(interviewsCollection).InsertOne(ctx, item); err != nil {
		return Interview{}, err
	}
	if err := s.setApplicationStage(ctx, userID, app.ID, stageOnInterviewScheduled(app.ColumnID), "Interview scheduled", now); err != nil {
		return Interview{}, err
	}
	return normalizeInterview(item), nil
}

func (s *Store) PatchInterview(ctx context.Context, userID, id string, patch InterviewPatch, now time.Time) (Interview, error) {
	item, err := s.interviewByID(ctx, userID, id)
	if err != nil {
		return Interview{}, err
	}
	if patch.Status != nil {
		if !validInterviewStatus(*patch.Status) {
			return Interview{}, ErrInvalidInput
		}
		item.Status = *patch.Status
	}
	if patch.Outcome != nil {
		outcome := strings.TrimSpace(*patch.Outcome)
		if outcome != "" && !validOutcome(outcome) {
			return Interview{}, ErrInvalidInput
		}
		item.Outcome = outcome
		if item.Outcome != "" && item.Status != StatusCancelled {
			item.Status = StatusCompleted
		}
		stage, reason := stageOnOutcome(item.Outcome)
		app, err := s.applicationByID(ctx, userID, item.ApplicationID)
		if err == nil {
			if stage == StageClosed {
				closed := reason
				_, _ = s.PatchApplication(ctx, userID, app.ID, ApplicationPatch{ColumnID: &stage, ClosedReason: closed}, now)
			} else {
				_ = s.setApplicationStage(ctx, userID, app.ID, stage, "Interview outcome updated", now)
			}
		}
	}
	if patch.SelfRating != nil {
		if *patch.SelfRating < 0 || *patch.SelfRating > 5 {
			return Interview{}, ErrInvalidInput
		}
		item.SelfRating = *patch.SelfRating
	}
	if patch.Notes != nil {
		item.Notes = clip(*patch.Notes, 2000)
	}
	if patch.Prep != nil {
		item.Prep = *patch.Prep
	}
	if patch.Round != nil {
		item.Round = clip(*patch.Round, 80)
	}
	if patch.Where != nil {
		item.Where = clip(*patch.Where, MaxWhereLen)
	}
	if patch.Interviewers != nil {
		item.Interviewers = *patch.Interviewers
	}
	item = normalizeInterview(item)
	_, err = s.collection(interviewsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: item.ID}, {Key: "userId", Value: userID}}, item)
	if err != nil {
		return Interview{}, err
	}
	return item, nil
}

func (s *Store) interviewByID(ctx context.Context, userID, id string) (Interview, error) {
	var item Interview
	err := s.collection(interviewsCollection).FindOne(ctx, bson.D{{Key: "id", Value: id}, {Key: "userId", Value: userID}}).Decode(&item)
	if notFound(err) {
		return Interview{}, ErrNotFound
	}
	if err != nil {
		return Interview{}, err
	}
	return normalizeInterview(item), nil
}

func buildInterview(userID string, app Application, input InterviewInput, now time.Time) (Interview, error) {
	round := clip(input.Round, 80)
	if round == "" {
		return Interview{}, ErrInvalidInput
	}
	date, start, end, err := slotTimes(input)
	if err != nil {
		return Interview{}, err
	}
	format := input.Format
	if format == "" {
		format = "video"
	}
	switch format {
	case "video", "phone", "onsite":
	default:
		return Interview{}, ErrInvalidInput
	}
	status := input.Status
	if status == "" {
		status = StatusScheduled
	}
	if !validInterviewStatus(status) {
		return Interview{}, ErrInvalidInput
	}
	source := input.Source
	if source == "" {
		source = SourceManual
	}
	id, err := newPublicID()
	if err != nil {
		return Interview{}, err
	}
	prep := input.Prep
	if len(prep) == 0 {
		prep = defaultPrep(id)
	}
	where := clip(input.Where, MaxWhereLen)
	if where == "" {
		where = format
	}
	interviewers := input.Interviewers
	if interviewers == nil {
		interviewers = []Interviewer{}
	}
	_ = now
	return Interview{
		ID:            id,
		UserID:        userID,
		ApplicationID: app.ID,
		Company:       app.Company,
		Role:          app.Title,
		Round:         round,
		Date:          date,
		Start:         start,
		End:           end,
		Format:        format,
		Where:         where,
		Interviewers:  interviewers,
		Status:        status,
		Source:        source,
		Prep:          prep,
		MeetingURL:    clip(input.MeetingURL, MaxWhereLen),
		ScheduleMode:  input.ScheduleMode,
		ProposedSlots: input.ProposedSlots,
		SelfSchedule:  input.SelfSchedule,
	}, nil
}

func slotTimes(input InterviewInput) (date, start, end string, err error) {
	date = strings.TrimSpace(input.Date)
	start = strings.TrimSpace(input.Start)
	end = strings.TrimSpace(input.End)
	if input.OpenSlot {
		if date != "" && !datePattern.MatchString(date) {
			return "", "", "", ErrInvalidInput
		}
		if start != "" && !timePattern.MatchString(start) {
			return "", "", "", ErrInvalidInput
		}
		if end == "" {
			end = start
		}
		if end != "" && !timePattern.MatchString(end) {
			return "", "", "", ErrInvalidInput
		}
		if date == "" {
			return "", "", "", nil
		}
		return date, start, end, nil
	}
	if !datePattern.MatchString(date) || !timePattern.MatchString(start) {
		return "", "", "", ErrInvalidInput
	}
	if end == "" {
		end = start
	}
	if !timePattern.MatchString(end) {
		return "", "", "", ErrInvalidInput
	}
	return date, start, end, nil
}

// publicScheduleURL is the link employers share while a round is awaiting.
// Origin comes from FRONTEND_ORIGIN; the path matches schedule-join.ts.
func publicScheduleURL(origin, interviewID string) string {
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	if origin == "" || interviewID == "" {
		return ""
	}
	return origin + selfSchedulePath + url.PathEscape(interviewID)
}

func defaultPrep(id string) []PrepTask {
	out := make([]PrepTask, 0, len(defaultPrepLabels))
	for i, label := range defaultPrepLabels {
		out = append(out, PrepTask{ID: id + "-" + itoa(i), Label: label, Done: false})
	}
	return out
}

func itoa(n int) string {
	return []string{"0", "1", "2", "3", "4", "5", "6", "7", "8", "9"}[n]
}

func normalizeInterview(item Interview) Interview {
	if item.Interviewers == nil {
		item.Interviewers = []Interviewer{}
	}
	if item.Prep == nil {
		item.Prep = []PrepTask{}
	}
	return item
}

func validInterviewStatus(value string) bool {
	switch value {
	case StatusScheduled, StatusUnconfirmed, StatusCompleted, StatusCancelled:
		return true
	default:
		return false
	}
}

func validOutcome(value string) bool {
	switch value {
	case OutcomeAdvanced, OutcomeRejected, OutcomeWaiting:
		return true
	default:
		return false
	}
}
