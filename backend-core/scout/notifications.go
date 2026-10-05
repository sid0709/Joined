package scout

import (
	"context"
	"log/slog"
	"strconv"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Notification kinds and tones. Tones map onto design-system badge variants.
const (
	kindDecision     = "decision"
	kindReward       = "reward"
	kindLevel        = "level"
	kindPayout       = "payout"
	kindVerification = "verification"

	toneAccent  = "accent"
	toneSuccess = "success"
	toneWarning = "warning"
	toneDanger  = "danger"
	toneNeutral = "neutral"
)

// notify stores an in-app notification. Failures are logged, never returned:
// a missed notification must not undo the decision that caused it.
func (s *Store) notify(ctx context.Context, userID, kind, tone, title, body, subjectID string) {
	if kind == kindDecision || kind == kindReward {
		profile, err := s.storedProfile(ctx, userID)
		if err == nil && ((kind == kindDecision && !profile.NotifyDecisions) || (kind == kindReward && !profile.NotifyRewards)) {
			return
		}
	}
	_, err := s.collection(notificationsCollection).InsertOne(ctx, Notification{
		ObjectID:    bson.NewObjectID(),
		ScoutUserID: userID,
		Kind:        kind,
		Tone:        tone,
		Title:       title,
		Body:        body,
		SubjectID:   subjectID,
		CreatedAt:   s.now().UTC(),
	})
	if err != nil {
		slog.Error("scout notify", "user", userID, "kind", kind, "error", err)
	}
}

func (s *Store) notifyDecision(ctx context.Context, sub Submission, status, reason string) {
	job := sub.Title + " at " + sub.CompanyName
	switch status {
	case StatusApproved:
		s.notify(ctx, sub.ScoutUserID, kindDecision, toneSuccess, "Job approved", job+" is live in the job pool.", sub.ID)
	case StatusRejected:
		s.notify(ctx, sub.ScoutUserID, kindDecision, toneDanger, "Submission rejected", job+": "+reason+".", sub.ID)
	case StatusDuplicate:
		s.notify(ctx, sub.ScoutUserID, kindDecision, toneNeutral, "Marked duplicate", job+" was already in the pool.", sub.ID)
	case StatusNeedsReview:
		s.notify(ctx, sub.ScoutUserID, kindDecision, toneWarning, "Waiting on a moderator", job+" passed the automatic checks and is in the review queue.", sub.ID)
	}
}

func (s *Store) notifyRewardImpl(ctx context.Context, userID string, earning Earning) {
	body := formatMoney(earning.Amount) + " for " + earning.JobTitle
	if earning.Status == EarningHeld {
		body += ", held until " + earning.HoldUntil.Format("Jan 2")
	}
	s.notify(ctx, userID, kindReward, toneSuccess, rewardTitle(earning.Type), body+".", earning.SubmissionID)
}

func rewardTitle(kind string) string {
	switch kind {
	case RewardApproval:
		return "Approval reward"
	case RewardApply:
		return "Apply reward"
	case RewardInterview:
		return "Interview reward"
	case RewardHire:
		return "Hire reward"
	default:
		return "Reward"
	}
}

func (s *Store) notifyLevel(ctx context.Context, userID, from, to string) {
	tone := toneSuccess
	title := "Promoted to " + Rule(to).Label
	if levelIndex(to) < levelIndex(from) {
		tone = toneWarning
		title = "Moved to " + Rule(to).Label
	}
	s.notify(ctx, userID, kindLevel, tone, title, "Your daily limit is now "+strconv.Itoa(Rule(to).DailyLimit)+" submissions.", "")
}

func levelIndex(level string) int {
	for i, id := range levelOrder {
		if id == level {
			return i
		}
	}
	return 0
}

// ListNotifications pages a scout's notifications newest first.
func (s *Store) ListNotifications(ctx context.Context, userID, cursorValue string, limit int) (List[Notification], error) {
	filter, err := cursorFilter(bson.D{{Key: "scoutUserId", Value: userID}}, cursorValue)
	if err != nil {
		return List[Notification]{}, err
	}
	limit = listLimit(limit)
	cursor, err := s.collection(notificationsCollection).Find(ctx, filter,
		options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(int64(limit+1)))
	if err != nil {
		return List[Notification]{}, err
	}
	items := []Notification{}
	if err := cursor.All(ctx, &items); err != nil {
		return List[Notification]{}, err
	}
	next := ""
	if len(items) > limit {
		items = items[:limit]
		next = items[len(items)-1].ObjectID.Hex()
	}
	for i := range items {
		items[i].fill()
	}
	return List[Notification]{Data: items, NextCursor: next}, nil
}

// UnreadCount is how many notifications the scout has not read.
func (s *Store) UnreadCount(ctx context.Context, userID string) (int64, error) {
	return s.collection(notificationsCollection).CountDocuments(ctx, bson.D{{Key: "scoutUserId", Value: userID}, {Key: "read", Value: false}})
}

// MarkRead marks some notifications read, or every one when ids is empty.
func (s *Store) MarkRead(ctx context.Context, userID string, ids []string) error {
	filter := bson.D{{Key: "scoutUserId", Value: userID}, {Key: "read", Value: false}}
	if len(ids) > 0 {
		oids := make([]bson.ObjectID, 0, len(ids))
		for _, id := range ids {
			if oid, err := bson.ObjectIDFromHex(id); err == nil {
				oids = append(oids, oid)
			}
		}
		filter = append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$in", Value: oids}}})
	}
	_, err := s.collection(notificationsCollection).UpdateMany(ctx, filter, bson.D{{Key: "$set", Value: bson.D{{Key: "read", Value: true}}}})
	return err
}
