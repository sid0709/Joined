package jobs

import (
	"encoding/json"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func documentJSON(doc bson.M) (json.RawMessage, error) {
	return json.Marshal(normalize(doc))
}

func normalize(value any) any {
	switch typed := value.(type) {
	case bson.M:
		out := make(map[string]any, len(typed))
		for key, item := range typed {
			out[key] = normalize(item)
		}
		return out
	case bson.D:
		out := make(map[string]any, len(typed))
		for _, element := range typed {
			out[element.Key] = normalize(element.Value)
		}
		return out
	case bson.A:
		out := make([]any, len(typed))
		for i, item := range typed {
			out[i] = normalize(item)
		}
		return out
	case bson.ObjectID:
		return typed.Hex()
	case bson.DateTime:
		return typed.Time().UTC().Format(time.RFC3339Nano)
	case time.Time:
		return typed.UTC().Format(time.RFC3339Nano)
	case bson.Decimal128:
		return typed.String()
	case bson.Binary:
		return typed.Data
	case bson.Regex:
		return typed.Pattern
	case bson.Timestamp:
		return map[string]any{"t": typed.T, "i": typed.I}
	default:
		return value
	}
}
