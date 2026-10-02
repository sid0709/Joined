package candidate

import (
	"context"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

const (
	StageSaved     = "saved"
	StageApplied   = "applied"
	StageScreening = "screening"
	StageInterview = "interview"
	StageOffer     = "offer"
	StageClosed    = "closed"

	SourceDirect   = "direct"
	SourceScouted  = "scouted"
	SourceManual   = "manual"
	SourceCalendar = "calendar"

	StatusScheduled   = "scheduled"
	StatusUnconfirmed = "unconfirmed"
	StatusCompleted   = "completed"
	StatusCancelled   = "cancelled"

	// CompanyStatusAwaiting is a company-board status. The candidate list
	// hides these rounds until a slot is locked.
	CompanyStatusAwaiting = "awaiting"

	// MaxWhereLen matches joined-frontend hydrateOptionalUrl (500 runes).
	MaxWhereLen = 500

	OutcomeAdvanced = "advanced"
	OutcomeRejected = "rejected"
	OutcomeWaiting  = "waiting"

	AuthorCandidate = "candidate"
	AuthorCompany   = "company"
	AuthorEvent     = "event"

	DefaultResume    = "General"
	DefaultCurrency  = "USD"
	DefaultWorkplace = "hybrid"
)

type HomeAddress struct {
	Line       string `json:"line" bson:"line"`
	City       string `json:"city" bson:"city"`
	Region     string `json:"region" bson:"region"`
	PostalCode string `json:"postalCode" bson:"postalCode"`
	Country    string `json:"country" bson:"country"`
}

// DateRange is when a role or a school ran. Zero months and years are unset;
// Current means it has not ended, so the end is ignored.
type DateRange struct {
	StartMonth int  `json:"startMonth" bson:"startMonth"`
	StartYear  int  `json:"startYear" bson:"startYear"`
	EndMonth   int  `json:"endMonth" bson:"endMonth"`
	EndYear    int  `json:"endYear" bson:"endYear"`
	Current    bool `json:"current,omitempty" bson:"current,omitempty"`
}

// ExperienceItem is one role. Period is derived from the dates when they are set;
// older entries carry only the free-text Period.
type ExperienceItem struct {
	ID        string `json:"id" bson:"id"`
	Role      string `json:"role" bson:"role"`
	Company   string `json:"company" bson:"company"`
	Period    string `json:"period" bson:"period"`
	Summary   string `json:"summary" bson:"summary"`
	DateRange `bson:",inline"`
}

// EducationItem is one school, degree, or program.
type EducationItem struct {
	ID        string `json:"id" bson:"id"`
	School    string `json:"school" bson:"school"`
	Degree    string `json:"degree" bson:"degree"`
	Field     string `json:"field" bson:"field"`
	Period    string `json:"period" bson:"period"`
	Summary   string `json:"summary" bson:"summary"`
	DateRange `bson:",inline"`
}

// Personal is who the job hunter is, for application forms. Only the job hunter
// and Acorn read it; companies never see it.
type Personal struct {
	FirstName   string `json:"firstName" bson:"firstName"`
	LastName    string `json:"lastName" bson:"lastName"`
	Age         int    `json:"age" bson:"age"`
	Gender      string `json:"gender" bson:"gender"`
	Pronouns    string `json:"pronouns" bson:"pronouns"`
	Orientation string `json:"orientation" bson:"orientation"`
	Citizenship string `json:"citizenship" bson:"citizenship"`
}

// Links are the job hunter's public profiles.
type Links struct {
	LinkedIn  string `json:"linkedin" bson:"linkedin"`
	GitHub    string `json:"github" bson:"github"`
	Portfolio string `json:"portfolio" bson:"portfolio"`
}

// Disclosures are voluntary self-identification (EEO) and sponsorship answers.
// Acorn uses them to answer those questions; companies never see them.
type Disclosures struct {
	HispanicLatino string `json:"hispanicLatino" bson:"hispanicLatino"`
	Race           string `json:"race" bson:"race"`
	Sponsorship    string `json:"sponsorship" bson:"sponsorship"`
	Disability     string `json:"disability" bson:"disability"`
	Veteran        string `json:"veteran" bson:"veteran"`
}

type Visibility struct {
	OpenToWork       bool `json:"openToWork" bson:"openToWork"`
	RecruiterSearch  bool `json:"recruiterSearch" bson:"recruiterSearch"`
	HideFromEmployer bool `json:"hideFromEmployer" bson:"hideFromEmployer"`
}

type Status struct {
	Label   string `json:"label" bson:"label"`
	Variant string `json:"variant" bson:"variant"`
}

type Profile struct {
	Name          string           `json:"name"`
	Email         string           `json:"email"`
	Phone         string           `json:"phone" bson:"phone"`
	Headline      string           `json:"headline" bson:"headline"`
	Location      string           `json:"location" bson:"location"`
	HomeAddress   HomeAddress      `json:"homeAddress" bson:"homeAddress"`
	About         string           `json:"about" bson:"about"`
	MemberSince   string           `json:"memberSince" bson:"-"`
	Status        Status           `json:"status" bson:"status"`
	TargetRoles   []string         `json:"targetRoles" bson:"targetRoles"`
	Locations     []string         `json:"locations" bson:"locations"`
	Workplace     string           `json:"workplace" bson:"workplace"`
	SalaryFloor   int              `json:"salaryFloor" bson:"salaryFloor"`
	Currency      string           `json:"currency" bson:"currency"`
	Authorization string           `json:"authorization" bson:"authorization"`
	NoticePeriod  string           `json:"noticePeriod" bson:"noticePeriod"`
	Skills        []string         `json:"skills" bson:"skills"`
	Experience    []ExperienceItem `json:"experience" bson:"experience"`
	Education     []EducationItem  `json:"education" bson:"education"`
	Personal      Personal         `json:"personal" bson:"personal"`
	Links         Links            `json:"links" bson:"links"`
	Disclosures   Disclosures      `json:"disclosures" bson:"disclosures"`
	Visibility    Visibility       `json:"visibility" bson:"visibility"`
}

type storedProfile struct {
	UserID        string           `bson:"userId"`
	Phone         string           `bson:"phone"`
	Headline      string           `bson:"headline"`
	Location      string           `bson:"location"`
	HomeAddress   HomeAddress      `bson:"homeAddress"`
	About         string           `bson:"about"`
	Status        Status           `bson:"status"`
	TargetRoles   []string         `bson:"targetRoles"`
	Locations     []string         `bson:"locations"`
	Workplace     string           `bson:"workplace"`
	SalaryFloor   int              `bson:"salaryFloor"`
	Currency      string           `bson:"currency"`
	Authorization string           `bson:"authorization"`
	NoticePeriod  string           `bson:"noticePeriod"`
	Skills        []string         `bson:"skills"`
	Experience    []ExperienceItem `bson:"experience"`
	Education     []EducationItem  `bson:"education"`
	Personal      Personal         `bson:"personal"`
	Links         Links            `bson:"links"`
	Disclosures   Disclosures      `bson:"disclosures"`
	Visibility    Visibility       `bson:"visibility"`
	UpdatedAt     time.Time        `bson:"updatedAt"`
}

type ApplicationEvent struct {
	ID    string    `json:"id" bson:"id"`
	Label string    `json:"label" bson:"label"`
	Date  time.Time `json:"date" bson:"date"`
}

type Application struct {
	ID               string             `json:"id" bson:"id"`
	ColumnID         string             `json:"columnId" bson:"columnId"`
	UserID           string             `json:"-" bson:"userId"`
	JobID            string             `json:"jobId" bson:"jobId"`
	CompanyID        string             `json:"companyId,omitempty" bson:"companyId,omitempty"`
	Title            string             `json:"title" bson:"title"`
	Company          string             `json:"company" bson:"company"`
	Location         string             `json:"location" bson:"location"`
	Salary           string             `json:"salary" bson:"salary"`
	Source           string             `json:"source" bson:"source"`
	Resume           string             `json:"resume" bson:"resume"`
	Match            int                `json:"match" bson:"match"`
	Updated          time.Time          `json:"updated" bson:"updated"`
	NextStep         string             `json:"nextStep,omitempty" bson:"nextStep,omitempty"`
	ClosedReason     string             `json:"closedReason,omitempty" bson:"closedReason,omitempty"`
	Activity         []ApplicationEvent `json:"activity" bson:"activity"`
	ScreeningAnswers []ScreeningAnswer  `json:"screeningAnswers" bson:"screeningAnswers,omitempty"`
	ReferralSource   string             `json:"referralSource,omitempty" bson:"referralSource,omitempty"`
	ConsentAt        time.Time          `json:"consentAt,omitempty" bson:"consentAt,omitempty"`
	ConsentVersion   string             `json:"consentVersion,omitempty" bson:"consentVersion,omitempty"`
	CompanyStage     string             `json:"-" bson:"companyStage,omitempty"`
	Rating           int                `json:"-" bson:"rating,omitempty"`
	CompanyNotes     string             `json:"-" bson:"companyNotes,omitempty"`
	Tags             []string           `json:"-" bson:"tags,omitempty"`
	InterviewerIDs   []string           `json:"-" bson:"interviewerIds,omitempty"`
	// Offer is employer-only. Candidate payloads keep json:"-".
	Offer *OfferRecord `json:"-" bson:"offer,omitempty"`
	// StageEnteredAt is when the company column last changed.
	// StageHistory is each company column and when it was entered.
	// Candidate JSON hides both; the hiring board returns them.
	StageEnteredAt time.Time    `json:"-" bson:"stageEnteredAt,omitempty"`
	StageHistory   []StageVisit `json:"-" bson:"stageHistory,omitempty"`
}

// StageVisit is one company-board column and the time it was entered.
type StageVisit struct {
	Stage     string    `json:"stage" bson:"stage"`
	EnteredAt time.Time `json:"enteredAt" bson:"enteredAt"`
}

// ScreeningAnswer is one reply on an application.
// JSON matches intake.ts: questionId, prompt, value, knockedOut?.
type ScreeningAnswer struct {
	QuestionID string `json:"questionId" bson:"questionId"`
	Prompt     string `json:"prompt" bson:"prompt"`
	Value      string `json:"value" bson:"value"`
	KnockedOut bool   `json:"knockedOut,omitempty" bson:"knockedOut,omitempty"`
}

type SavedJob struct {
	ID        string    `json:"id" bson:"id"`
	UserID    string    `json:"-" bson:"userId"`
	JobID     string    `json:"jobId" bson:"jobId"`
	Title     string    `json:"title" bson:"title"`
	Company   string    `json:"company" bson:"company"`
	CompanyID string    `json:"companyId,omitempty" bson:"companyId,omitempty"`
	Location  string    `json:"location" bson:"location"`
	Salary    string    `json:"salary" bson:"salary"`
	Source    string    `json:"source" bson:"source"`
	SavedAt   time.Time `json:"savedAt" bson:"savedAt"`
}

type Interviewer struct {
	Name  string `json:"name" bson:"name"`
	Title string `json:"title" bson:"title"`
}

// ProposedSlot is one offered time while a company round is awaiting a pick.
type ProposedSlot struct {
	Date  string `json:"date" bson:"date"`
	Start string `json:"start" bson:"start"`
	End   string `json:"end" bson:"end"`
}

type PrepTask struct {
	ID    string `json:"id" bson:"id"`
	Label string `json:"label" bson:"label"`
	Done  bool   `json:"done" bson:"done"`
}

type Interview struct {
	ID            string        `json:"id" bson:"id"`
	UserID        string        `json:"-" bson:"userId"`
	ApplicationID string        `json:"applicationId" bson:"applicationId"`
	Company       string        `json:"company" bson:"company"`
	Role          string        `json:"role" bson:"role"`
	Round         string        `json:"round" bson:"round"`
	Date          string        `json:"date" bson:"date"`
	Start         string        `json:"start" bson:"start"`
	End           string        `json:"end" bson:"end"`
	Format        string        `json:"format" bson:"format"`
	Where         string        `json:"where" bson:"where"`
	Interviewers  []Interviewer `json:"interviewers" bson:"interviewers"`
	Status        string        `json:"status" bson:"status"`
	Source        string        `json:"source" bson:"source"`
	Prep          []PrepTask    `json:"prep" bson:"prep"`
	Outcome       string        `json:"outcome,omitempty" bson:"outcome,omitempty"`
	SelfRating    int           `json:"selfRating,omitempty" bson:"selfRating,omitempty"`
	Notes         string        `json:"notes,omitempty" bson:"notes,omitempty"`
	GoogleEventID string        `json:"googleEventId,omitempty" bson:"googleEventId,omitempty"`
	CompanyID     string        `json:"-" bson:"companyId,omitempty"`
	JobID         string        `json:"-" bson:"jobId,omitempty"`
	CompanyStatus string        `json:"-" bson:"companyStatus,omitempty"`
	ChargedCents  int           `json:"-" bson:"chargedCents,omitempty"`
	CandidateName string        `json:"-" bson:"candidateName,omitempty"`
	// Company schedule/join fields. Hidden from the candidate payload; the
	// company API maps them onto CompanyInterview.
	MeetingURL      string         `json:"-" bson:"meetingUrl,omitempty"`
	ScheduleMode    string         `json:"-" bson:"mode,omitempty"`
	ProposedSlots   []ProposedSlot `json:"-" bson:"proposedSlots,omitempty"`
	SelfSchedule    bool           `json:"-" bson:"selfSchedule,omitempty"`
	SelfScheduleURL string         `json:"-" bson:"selfScheduleUrl,omitempty"`
	// SelfScheduleToken is the unguessable public /schedule/{token} key.
	// Interview id URLs keep resolving for links already shared.
	SelfScheduleToken string `json:"-" bson:"selfScheduleToken,omitempty"`
	// SelfScheduleExpiresAt is when an awaiting link stops accepting a slot.
	// The zero value means the link does not expire.
	SelfScheduleExpiresAt time.Time `json:"-" bson:"selfScheduleExpiresAt,omitempty"`
}

// PublicSchedule is the candidate self-schedule page. It omits candidate identity.
type PublicSchedule struct {
	Company       string         `json:"company"`
	Role          string         `json:"role"`
	Round         string         `json:"round"`
	Format        string         `json:"format"`
	Where         string         `json:"where,omitempty"`
	MeetingURL    string         `json:"meetingUrl,omitempty"`
	Status        string         `json:"status"`
	Mode          string         `json:"mode,omitempty"`
	ProposedSlots []ProposedSlot `json:"proposedSlots,omitempty"`
	Date          string         `json:"date,omitempty"`
	Start         string         `json:"start,omitempty"`
	End           string         `json:"end,omitempty"`
	ExpiresAt     *time.Time     `json:"expiresAt,omitempty"`
}

type CalendarConnection struct {
	Connected bool   `json:"connected"`
	Email     string `json:"email,omitempty"`
}

type CalEvent struct {
	ID          string
	Title       string
	Description string
	// Date is the start day; EndDate is the last day an all-day event covers.
	Date    string
	EndDate string
	Start   string
	End     string
	Where   string
	AllDay  bool
	// Link opens the event in Google Calendar.
	Link string
	// TimeZone is the IANA zone Date, Start, and End are in when creating an event.
	TimeZone string
}

type Thread struct {
	ID              string         `json:"id" bson:"id"`
	ApplicationID   string         `json:"applicationId" bson:"applicationId"`
	CandidateUserID string         `json:"-" bson:"candidateUserId"`
	CompanyID       string         `json:"-" bson:"companyId"`
	CandidateName   string         `json:"-" bson:"candidateName"`
	CompanyName     string         `json:"-" bson:"companyName"`
	JobTitle        string         `json:"-" bson:"jobTitle"`
	JobID           string         `json:"-" bson:"jobId"`
	Location        string         `json:"-" bson:"location"`
	Kind            string         `json:"kind" bson:"-"`
	Title           string         `json:"title" bson:"-"`
	Subtitle        string         `json:"subtitle" bson:"-"`
	Stage           string         `json:"stage,omitempty" bson:"-"`
	Unread          int            `json:"unread" bson:"-"`
	Details         []ThreadDetail `json:"details" bson:"-"`
	Links           []ThreadLink   `json:"links" bson:"-"`
	Messages        []Message      `json:"messages" bson:"-"`
}

type ThreadDetail struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type ThreadLink struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

type storedThread struct {
	ID              string    `bson:"id"`
	ApplicationID   string    `bson:"applicationId"`
	CandidateUserID string    `bson:"candidateUserId"`
	CompanyID       string    `bson:"companyId"`
	CandidateName   string    `bson:"candidateName"`
	CompanyName     string    `bson:"companyName"`
	JobTitle        string    `bson:"jobTitle"`
	JobID           string    `bson:"jobId"`
	Location        string    `bson:"location"`
	CreatedAt       time.Time `bson:"createdAt"`
}

type Message struct {
	ID       string `json:"id" bson:"id"`
	ThreadID string `json:"-" bson:"threadId"`
	From     string `json:"from" bson:"from"`
	AuthorID string `json:"-" bson:"authorId"`
	Text     string `json:"text" bson:"text"`
	// Notice marks a system line that should badge the candidate inbox.
	// Hiring-team unread ignores it, the same as other events.
	Notice    bool      `json:"-" bson:"notice,omitempty"`
	Day       string    `json:"day" bson:"-"`
	Time      string    `json:"time" bson:"-"`
	Status    string    `json:"status,omitempty" bson:"-"`
	CreatedAt time.Time `json:"-" bson:"createdAt"`
}

type storedRead struct {
	ThreadID string    `bson:"threadId"`
	UserID   string    `bson:"userId"`
	ReadAt   time.Time `bson:"readAt"`
}

type Listing struct {
	ID                 string
	Title              string
	Company            string
	CompanyID          string
	Location           string
	Salary             string
	Source             string
	ScreeningQuestions []jobs.ScreeningQuestion
}

type Catalog interface {
	Lookup(ctx context.Context, jobID string) (Listing, error)
}
