package jobs

import (
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestNormalizeBSONTypes(t *testing.T) {
	id := bson.NewObjectID()
	posted := time.Date(2026, 7, 29, 17, 29, 47, 616000000, time.UTC)
	got, ok := normalize(bson.M{
		"_id":      id,
		"postedAt": bson.NewDateTimeFromTime(posted),
		"metadata": bson.D{{Key: "details", Value: bson.D{{Key: "location", Value: "United States"}}}},
		"aiSkills": bson.A{bson.D{{Key: "name", Value: "AWS"}}},
	}).(map[string]any)
	if !ok {
		t.Fatal("expected a map")
	}
	if got["_id"] != id.Hex() {
		t.Fatalf("id = %#v", got["_id"])
	}
	if got["postedAt"] != "2026-07-29T17:29:47.616Z" {
		t.Fatalf("postedAt = %#v", got["postedAt"])
	}
	metadata, ok := got["metadata"].(map[string]any)
	if !ok {
		t.Fatalf("metadata = %#v", got["metadata"])
	}
	details, ok := metadata["details"].(map[string]any)
	if !ok || details["location"] != "United States" {
		t.Fatalf("details = %#v", metadata["details"])
	}
	skills, ok := got["aiSkills"].([]any)
	if !ok || len(skills) != 1 {
		t.Fatalf("skills = %#v", got["aiSkills"])
	}
}
