package main

import (
	"errors"
	"testing"
)

func TestRequireLocalMongo(t *testing.T) {
	cases := []struct {
		uri   string
		local bool
	}{
		{"mongodb://localhost:27017", true},
		{"mongodb://127.0.0.1", true},
		{"mongodb://user:pass@[::1]:27017/db", true},
		{"mongodb://localhost:27017,127.0.0.1:27018/?replicaSet=rs", true},
		{"mongodb://45.61.176.179:27017", false},
		{"mongodb://localhost:27017,db.example.com:27017", false},
		{"mongodb+srv://cluster.example.com", false},
		{"mongodb://localhost.example.com", false},
	}
	for _, c := range cases {
		err := requireLocalMongo(c.uri)
		if (err == nil) != c.local {
			t.Errorf("requireLocalMongo(%q) error = %v, want local=%v", c.uri, err, c.local)
		}
		if !c.local && !errors.Is(err, errRefused) {
			t.Errorf("requireLocalMongo(%q) error = %v, want errRefused", c.uri, err)
		}
	}
}
