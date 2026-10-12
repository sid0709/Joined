package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/sid0709/Joined/backend-core/jobschema"
)

const (
	// approachDecisions matches the migration approach of the same name.
	approachDecisions = "decisions"
	// decisionYes is the probability at which a noul answer counts as yes.
	decisionYes = 0.5
)

// Decider is a decision model. It returns typed answers, not a written profile.
type Decider interface {
	Decide(ctx context.Context, state string, questions json.RawMessage) (json.RawMessage, error)
}

type decisionAnswer struct {
	Type       string   `json:"type"`
	Noul       float64  `json:"noul"`
	Choice     string   `json:"choice"`
	Confidence *float64 `json:"confidence"`
}

func (a decisionAnswer) sure() bool {
	return a.Confidence == nil || *a.Confidence >= decisionYes
}

func (a decisionAnswer) yes() bool {
	return a.Type == "noul" && a.Noul >= decisionYes && a.sure()
}

func (a decisionAnswer) pick() string {
	if !a.sure() {
		return ""
	}
	return strings.TrimSpace(a.Choice)
}

func decideJob(ctx context.Context, decider Decider, listing tempListing) ([]byte, error) {
	questions, err := json.Marshal(map[string]any{
		"workplace":  choiceQuestion("Where does the posting say the work is done? If it does not say, choose onsite.", []string{"remote", "hybrid", "onsite"}),
		"seniority":  choiceQuestion("What seniority is this role? Staff and Principal are Leader. Manager, Director, and Head of are Manager.", []string{"Junior", "Middle", "Senior", "Leader", "Manager"}),
		"employment": choiceQuestion("What employment type does the posting state? If it does not say, choose full-time.", []string{"full-time", "contract", "part-time"}),
		"visa":       map[string]string{"type": "noul", "instructions": "Does the posting explicitly offer visa sponsorship?"},
	})
	if err != nil {
		return nil, err
	}
	raw, err := decider.Decide(ctx, listingPrompt(listing), questions)
	if err != nil {
		return nil, err
	}
	answers, err := decodeAnswers(raw)
	if err != nil {
		return nil, err
	}
	extracted := Extraction{
		Workplace:  answers["workplace"].pick(),
		Seniority:  answers["seniority"].pick(),
		Employment: answers["employment"].pick(),
		Visa:       answers["visa"].yes(),
	}
	return json.Marshal(extracted)
}

func decideCompany(ctx context.Context, decider Decider, name, website string) (CompanyResearch, error) {
	questions, err := json.Marshal(map[string]any{
		"found": map[string]string{
			"type":         "noul",
			"instructions": "Is this one real company you can identify from the name and website?",
		},
		"industry":    choiceQuestion("Which industry is this company in? Choose Other when none of the listed industries fit.", jobschema.Industries()),
		"companyType": choiceQuestion("What type of company is it? Choose Other when none of the listed types fit.", jobschema.CompanyTypes()),
		"size":        choiceQuestion("Which headcount band fits this company? Choose Other when you cannot tell.", jobschema.CompanySizes()),
	})
	if err != nil {
		return CompanyResearch{}, err
	}
	raw, err := decider.Decide(ctx, companyResearchUser(name, website), questions)
	if err != nil {
		return CompanyResearch{}, err
	}
	answers, err := decodeAnswers(raw)
	if err != nil {
		return CompanyResearch{}, err
	}
	if !answers["found"].yes() {
		return CompanyResearch{}, nil
	}
	payload, err := json.Marshal(researchedCompany{
		Name:        name,
		Website:     website,
		Industry:    answers["industry"].pick(),
		CompanyType: answers["companyType"].pick(),
		Size:        answers["size"].pick(),
	})
	if err != nil {
		return CompanyResearch{}, err
	}
	draft, err := companyFromResearch(payload)
	if err != nil {
		return CompanyResearch{}, err
	}
	return CompanyResearch{Company: draft}, nil
}

func choiceQuestion(instructions string, options []string) map[string]any {
	criteria := make(map[string]string, len(options))
	for _, option := range options {
		if option != "" {
			criteria[option] = option
		}
	}
	return map[string]any{"type": "choice", "instructions": instructions, "criteria": criteria}
}

func decodeAnswers(raw json.RawMessage) (map[string]decisionAnswer, error) {
	var answers map[string]decisionAnswer
	if err := json.Unmarshal(raw, &answers); err != nil {
		return nil, fmt.Errorf("read decisions: %w", err)
	}
	return answers, nil
}

func decisionReason(job SearchJob) string {
	var bits []string
	if job.Workplace != "" {
		bits = append(bits, job.Workplace)
	}
	if job.Seniority != "" {
		bits = append(bits, job.Seniority)
	}
	if job.Employment != "" {
		bits = append(bits, job.Employment)
	}
	classified := "the posting"
	if len(bits) > 0 {
		classified = strings.Join(bits, ", ")
	}
	return "A decision model classified this posting (" + classified + ") and does not write the summary, duties, or skills, so it was not published."
}
