package jobs

import (
	"bytes"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestExactDocumentPreservesBytes(t *testing.T) {
	original, err := bson.Marshal(bson.D{
		{Key: "_id", Value: bson.NewObjectID()},
		{Key: "title", Value: "Senior DevOps Engineer"},
		{Key: "postedAt", Value: bson.NewDateTimeFromTime(time.Date(2026, 7, 29, 17, 29, 47, 616000000, time.UTC))},
	})
	if err != nil {
		t.Fatal(err)
	}

	encoded, err := bson.Marshal(exactDocument(original))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(original, encoded) {
		t.Fatalf("marshal changed document bytes\noriginal: %x\nencoded:  %x", original, encoded)
	}
}
