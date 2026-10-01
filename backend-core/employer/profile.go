package employer

import (
	"context"
	"errors"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// DefaultHiringTimeZone is the company calendar when a profile has none.
const DefaultHiringTimeZone = "America/Chicago"

type HiringProfile struct {
	Name                  string   `json:"name"`
	Title                 string   `json:"title"`
	About                 string   `json:"about"`
	MeetingLink           string   `json:"meetingLink"`
	InterviewLength       string   `json:"interviewLength"`
	Buffer                string   `json:"buffer"`
	DayStart              string   `json:"dayStart"`
	DayEnd                string   `json:"dayEnd"`
	InterviewDays         []string `json:"interviewDays"`
	TimeZone              string   `json:"timeZone"`
	Signature             string   `json:"signature"`
	IsVisibleToCandidates bool     `json:"isVisibleToCandidates"`
}

type storedHiringProfile struct {
	UserID                string   `bson:"userId"`
	Title                 string   `bson:"title"`
	About                 string   `bson:"about"`
	MeetingLink           string   `bson:"meetingLink"`
	InterviewLength       string   `bson:"interviewLength"`
	Buffer                string   `bson:"buffer"`
	DayStart              string   `bson:"dayStart"`
	DayEnd                string   `bson:"dayEnd"`
	InterviewDays         []string `bson:"interviewDays"`
	TimeZone              string   `bson:"timeZone"`
	Signature             string   `bson:"signature"`
	IsVisibleToCandidates bool     `bson:"isVisibleToCandidates"`
}

func (s *Store) HiringProfile(ctx context.Context, user auth.User) (HiringProfile, error) {
	var doc storedHiringProfile
	err := s.collection(profilesCollection).FindOne(ctx, bson.D{{Key: "userId", Value: user.ID}}).Decode(&doc)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return HiringProfile{}, err
	}
	profile := profileFrom(doc, user.Name)
	if errors.Is(err, mongo.ErrNoDocuments) {
		profile.IsVisibleToCandidates = true
	}
	return profile, nil
}

func (s *Store) SaveHiringProfile(ctx context.Context, user auth.User, input HiringProfile) (HiringProfile, error) {
	name := clip(input.Name, 80)
	if name == "" {
		return HiringProfile{}, ErrInvalidInput
	}
	if name != user.Name {
		if err := s.accounts.SetName(ctx, user.ID, name); err != nil {
			return HiringProfile{}, err
		}
	}
	doc := storedHiringProfile{
		UserID:                user.ID,
		Title:                 clip(input.Title, 80),
		About:                 clip(input.About, 280),
		MeetingLink:           clip(input.MeetingLink, 200),
		InterviewLength:       one(input.InterviewLength, []string{"30", "45", "60", "90"}, "45"),
		Buffer:                one(input.Buffer, []string{"0", "10", "15", "30"}, "15"),
		DayStart:              clock(input.DayStart, "09:00"),
		DayEnd:                clock(input.DayEnd, "17:00"),
		InterviewDays:         days(input.InterviewDays),
		TimeZone:              clip(input.TimeZone, 80),
		Signature:             clip(input.Signature, 200),
		IsVisibleToCandidates: input.IsVisibleToCandidates,
	}
	if doc.TimeZone == "" {
		doc.TimeZone = DefaultHiringTimeZone
	}
	_, err := s.collection(profilesCollection).UpdateOne(ctx, bson.D{{Key: "userId", Value: user.ID}}, bson.D{
		{Key: "$set", Value: doc},
	}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return HiringProfile{}, err
	}
	return profileFrom(doc, name), nil
}

func profileFrom(doc storedHiringProfile, name string) HiringProfile {
	days := doc.InterviewDays
	if days == nil {
		days = []string{"mon", "tue", "wed", "thu", "fri"}
	}
	length := doc.InterviewLength
	if length == "" {
		length = "45"
	}
	buffer := doc.Buffer
	if buffer == "" {
		buffer = "15"
	}
	start := doc.DayStart
	if start == "" {
		start = "09:00"
	}
	end := doc.DayEnd
	if end == "" {
		end = "17:00"
	}
	zone := doc.TimeZone
	if zone == "" {
		zone = DefaultHiringTimeZone
	}
	return HiringProfile{
		Name: name, Title: doc.Title, About: doc.About, MeetingLink: doc.MeetingLink,
		InterviewLength: length, Buffer: buffer, DayStart: start, DayEnd: end,
		InterviewDays: days, TimeZone: zone, Signature: doc.Signature,
		IsVisibleToCandidates: doc.IsVisibleToCandidates,
	}
}

func one(value string, allowed []string, fallback string) string {
	for _, item := range allowed {
		if item == value {
			return value
		}
	}
	return fallback
}

func clock(value, fallback string) string {
	value = strings.TrimSpace(value)
	if len(value) == 5 && value[2] == ':' {
		return value
	}
	return fallback
}

func days(values []string) []string {
	allowed := map[string]struct{}{"mon": {}, "tue": {}, "wed": {}, "thu": {}, "fri": {}}
	out := []string{}
	for _, value := range values {
		if _, ok := allowed[value]; ok {
			out = append(out, value)
		}
	}
	if len(out) == 0 {
		return []string{"mon", "tue", "wed", "thu", "fri"}
	}
	return out
}
