package employer

import "time"

type storedJob struct {
	ID        string    `bson:"id"`
	CompanyID string    `bson:"companyId"`
	CreatedBy string    `bson:"createdBy"`
	Title     string    `bson:"title"`
	Team      string    `bson:"team"`
	Seniority string    `bson:"seniority"`
	Location  string    `bson:"location"`
	Workplace string    `bson:"workplace"`
	PayMin    int       `bson:"payMin"`
	PayMax    int       `bson:"payMax"`
	Visa      bool      `bson:"visa"`
	Summary   string    `bson:"summary"`
	Skills    []string  `bson:"skills"`
	Policy    string    `bson:"policy"`
	DailyCap  int       `bson:"dailyCap,omitempty"`
	Status    string    `bson:"status"`
	Views     int       `bson:"views"`
	CreatedAt time.Time `bson:"createdAt"`
	UpdatedAt time.Time `bson:"updatedAt"`
	PostedAt  time.Time `bson:"postedAt,omitempty"`
}

type storedWallet struct {
	CompanyID      string    `bson:"companyId"`
	BalanceCents   int       `bson:"balanceCents"`
	PurchasedCents int       `bson:"purchasedCents"`
	SpentCents     int       `bson:"spentCents"`
	Currency       string    `bson:"currency"`
	UpdatedAt      time.Time `bson:"updatedAt"`
}

type storedLedger struct {
	ID           string    `bson:"id"`
	CompanyID    string    `bson:"companyId"`
	Kind         string    `bson:"kind"`
	AmountCents  int       `bson:"amountCents"`
	BalanceAfter int       `bson:"balanceAfter"`
	Candidate    string    `bson:"candidate,omitempty"`
	JobID        string    `bson:"jobId,omitempty"`
	JobTitle     string    `bson:"jobTitle,omitempty"`
	InterviewID  string    `bson:"interviewId,omitempty"`
	Note         string    `bson:"note,omitempty"`
	CreatedAt    time.Time `bson:"createdAt"`
}

type storedActivity struct {
	ID          string    `bson:"id"`
	CompanyID   string    `bson:"companyId"`
	Title       string    `bson:"title"`
	Description string    `bson:"description"`
	Tone        string    `bson:"tone"`
	CreatedAt   time.Time `bson:"createdAt"`
}

type storedInvite struct {
	ID        string    `bson:"id"`
	CompanyID string    `bson:"companyId"`
	Email     string    `bson:"email"`
	Role      string    `bson:"role"`
	CreatedAt time.Time `bson:"createdAt"`
}
