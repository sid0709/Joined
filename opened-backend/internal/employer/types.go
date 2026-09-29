package employer

import (
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/candidate"
	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
)

type Pipeline struct {
	New       int `json:"new"`
	Screening int `json:"screening"`
	Interview int `json:"interview"`
	Offer     int `json:"offer"`
}

type Job struct {
	ID                 string                   `json:"id"`
	JobID              string                   `json:"jobId,omitempty"`
	Title              string                   `json:"title"`
	Team               string                   `json:"team"`
	Location           string                   `json:"location"`
	Workplace          string                   `json:"workplace"`
	Seniority          string                   `json:"seniority"`
	Status             string                   `json:"status"`
	PostedOn           time.Time                `json:"postedOn"`
	Views              int                      `json:"views"`
	Pipeline           Pipeline                 `json:"pipeline"`
	Policy             string                   `json:"policy"`
	DailyCap           int                      `json:"dailyCap,omitempty"`
	PayMin             int                      `json:"payMin"`
	PayMax             int                      `json:"payMax"`
	Currency           string                   `json:"currency"`
	Visa               bool                     `json:"visa"`
	Summary            string                   `json:"summary"`
	Skills             []string                 `json:"skills"`
	Responsibilities   []string                 `json:"responsibilities"`
	Requirements       []string                 `json:"requirements"`
	Description        string                   `json:"description"`
	ScreeningQuestions []jobs.ScreeningQuestion `json:"screeningQuestions"`
	CustomStages       []PipelineStageDef       `json:"customStages,omitempty"`
	FeedbackGate       *FeedbackGateConfig      `json:"feedbackGate,omitempty"`
	ScorecardTemplate  *ScorecardTemplate       `json:"scorecardTemplate,omitempty"`
	InterviewGuide     *InterviewGuide          `json:"interviewGuide,omitempty"`
}

type Applicant struct {
	ID               string                      `json:"id"`
	ColumnID         string                      `json:"columnId"`
	Name             string                      `json:"name"`
	Headline         string                      `json:"headline"`
	Location         string                      `json:"location"`
	JobID            string                      `json:"jobId"`
	JobTitle         string                      `json:"jobTitle"`
	Fit              int                         `json:"fit"`
	Verified         bool                        `json:"verified"`
	Assisted         string                      `json:"assisted"`
	Resume           string                      `json:"resume"`
	AppliedOn        time.Time                   `json:"appliedOn"`
	ExperienceYears  int                         `json:"experienceYears"`
	LastCompany      string                      `json:"lastCompany"`
	Skills           []string                    `json:"skills"`
	Rating           int                         `json:"rating,omitempty"`
	Notes            string                      `json:"notes,omitempty"`
	Tags             []string                    `json:"tags"`
	InterviewerIDs   []string                    `json:"interviewerIds,omitempty"`
	UserID           string                      `json:"userId,omitempty"`
	ScreeningAnswers []candidate.ScreeningAnswer `json:"screeningAnswers"`
	ReferralSource   string                      `json:"referralSource,omitempty"`
	ConsentAt        time.Time                   `json:"consentAt,omitempty"`
	ConsentVersion   string                      `json:"consentVersion,omitempty"`
}

type Interview struct {
	ID              string                   `json:"id"`
	ApplicantID     string                   `json:"applicantId"`
	Candidate       string                   `json:"candidate"`
	JobID           string                   `json:"jobId"`
	JobTitle        string                   `json:"jobTitle"`
	Round           string                   `json:"round"`
	Date            string                   `json:"date"`
	Start           string                   `json:"start"`
	End             string                   `json:"end"`
	Format          string                   `json:"format"`
	Interviewers    []string                 `json:"interviewers"`
	Status          string                   `json:"status"`
	FaceCheck       string                   `json:"faceCheck"`
	ChargedCents    int                      `json:"chargedCents"`
	Where           string                   `json:"where,omitempty"`
	MeetingURL      string                   `json:"meetingUrl,omitempty"`
	Mode            string                   `json:"mode,omitempty"`
	SelfScheduleURL string                   `json:"selfScheduleUrl,omitempty"`
	ProposedSlots   []candidate.ProposedSlot `json:"proposedSlots,omitempty"`
}

type Activity struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Tone        string    `json:"tone"`
	CreatedAt   time.Time `json:"createdAt"`
}

type BillingEvent struct {
	ID          string    `json:"id"`
	Date        time.Time `json:"date"`
	Candidate   string    `json:"candidate"`
	JobID       string    `json:"jobId"`
	JobTitle    string    `json:"jobTitle"`
	AmountCents int       `json:"amountCents"`
	Status      string    `json:"status"`
	Note        string    `json:"note"`
}

type Purchase struct {
	ID          string    `json:"id"`
	Date        time.Time `json:"date"`
	AmountCents int       `json:"amountCents"`
}

type Billing struct {
	Plan                   string         `json:"plan"`
	PricePerInterviewCents int            `json:"pricePerInterviewCents"`
	BalanceCents           int            `json:"balanceCents"`
	PurchasedCents         int            `json:"purchasedCents"`
	SpentCents             int            `json:"spentCents"`
	Currency               string         `json:"currency"`
	Events                 []BillingEvent `json:"events"`
	Purchases              []Purchase     `json:"purchases"`
}

type Counts struct {
	OpenJobs      int `json:"openJobs"`
	NewApplicants int `json:"newApplicants"`
}

type Overview struct {
	Jobs       []Job       `json:"jobs"`
	Applicants []Applicant `json:"applicants"`
	Interviews []Interview `json:"interviews"`
	Activity   []Activity  `json:"activity"`
	Billing    Billing     `json:"billing"`
	Counts     Counts      `json:"counts"`
}

type Member struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Role       string `json:"role"`
	LastActive string `json:"lastActive"`
	IsYou      bool   `json:"isYou,omitempty"`
	IsPending  bool   `json:"isPending,omitempty"`
}

type Team struct {
	Members     []Member `json:"members"`
	EmailDomain string   `json:"emailDomain"`
}

type JobTeams struct {
	Teams []string `json:"teams"`
}

type JobTeamsWrite struct {
	Teams  []string    `json:"teams"`
	Rename *TeamRename `json:"rename"`
}

type TeamRename struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type JobInput struct {
	Title              string                   `json:"title"`
	Team               string                   `json:"team"`
	Seniority          string                   `json:"seniority"`
	Location           string                   `json:"location"`
	Workplace          string                   `json:"workplace"`
	PayMin             int                      `json:"payMin"`
	PayMax             int                      `json:"payMax"`
	Currency           string                   `json:"currency"`
	Visa               bool                     `json:"visa"`
	Summary            string                   `json:"summary"`
	Skills             []string                 `json:"skills"`
	Responsibilities   []string                 `json:"responsibilities"`
	Requirements       []string                 `json:"requirements"`
	Description        string                   `json:"description"`
	ScreeningQuestions []jobs.ScreeningQuestion `json:"screeningQuestions"`
	Policy             string                   `json:"policy"`
	DailyCap           int                      `json:"dailyCap"`
	Status             string                   `json:"status"`
}

type StageInput struct {
	ColumnID       string    `json:"columnId"`
	Notes          string    `json:"notes"`
	Rating         *int      `json:"rating"`
	Tags           *[]string `json:"tags"`
	InterviewerIDs *[]string `json:"interviewerIds"`
}

type ScheduleInput struct {
	ApplicationID string                   `json:"applicationId"`
	Round         string                   `json:"round"`
	Date          string                   `json:"date"`
	Start         string                   `json:"start"`
	End           string                   `json:"end"`
	Format        string                   `json:"format"`
	Interviewers  []string                 `json:"interviewers"`
	Where         string                   `json:"where"`
	MeetingURL    string                   `json:"meetingUrl"`
	Mode          string                   `json:"mode"`
	ProposedSlots []candidate.ProposedSlot `json:"proposedSlots"`
	SelfSchedule  bool                     `json:"selfSchedule"`
}

// InterviewUpdate is PATCH /v1/company/interviews/:id.
// Status remains attended | no-show. The other fields update join info,
// re-offer times, or lock an awaiting round.
type InterviewUpdate struct {
	Status        *string                   `json:"status"`
	Where         *string                   `json:"where"`
	MeetingURL    *string                   `json:"meetingUrl"`
	ProposedSlots *[]candidate.ProposedSlot `json:"proposedSlots"`
	Date          *string                   `json:"date"`
	Start         *string                   `json:"start"`
	End           *string                   `json:"end"`
}

type PurchaseInput struct {
	AmountCents int `json:"amountCents"`
}

type InviteInput struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type RoleInput struct {
	Role string `json:"role"`
}

type TransferInput struct {
	UserID string `json:"userId"`
}
