package jobs

import "go.mongodb.org/mongo-driver/v2/bson"

// exactDocument inserts the original BSON bytes without re-encoding fields.
type exactDocument []byte

func (d exactDocument) MarshalBSON() ([]byte, error) {
	if err := bson.Raw(d).Validate(); err != nil {
		return nil, err
	}
	out := make([]byte, len(d))
	copy(out, d)
	return out, nil
}
