package config

import (
	"os"
	"testing"
)

func TestSearchEnsureIndex(t *testing.T) {
	tests := []struct {
		name    string
		envVal  string
		want    bool
		cleanup bool
	}{
		{
			name:    "defaults to false when unset",
			envVal:  "",
			want:    false,
			cleanup: false,
		},
		{
			name:    "explicit true",
			envVal:  "true",
			want:    true,
			cleanup: true,
		},
		{
			name:    "explicit 1",
			envVal:  "1",
			want:    true,
			cleanup: true,
		},
		{
			name:    "explicit false",
			envVal:  "false",
			want:    false,
			cleanup: true,
		},
		{
			name:    "explicit 0",
			envVal:  "0",
			want:    false,
			cleanup: true,
		},
		{
			name:    "whitespace around true",
			envVal:  "  true  ",
			want:    true,
			cleanup: true,
		},
		{
			name:    "empty string explicit",
			envVal:  " ",
			want:    false,
			cleanup: true,
		},
	}

	originalVal, originalSet := os.LookupEnv("SEARCH_ENSURE_INDEX")
	defer func() {
		if originalSet {
			os.Setenv("SEARCH_ENSURE_INDEX", originalVal)
		} else {
			os.Unsetenv("SEARCH_ENSURE_INDEX")
		}
	}()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.cleanup {
				os.Setenv("SEARCH_ENSURE_INDEX", tt.envVal)
				defer os.Unsetenv("SEARCH_ENSURE_INDEX")
			} else {
				os.Unsetenv("SEARCH_ENSURE_INDEX")
			}

			got := SearchEnsureIndex()
			if got != tt.want {
				t.Errorf("SearchEnsureIndex() = %v, want %v (env=%q)", got, tt.want, tt.envVal)
			}
		})
	}
}

func TestSearchEnsureIndexDoesNotInferFromAddress(t *testing.T) {
	originalVal, originalSet := os.LookupEnv("SEARCH_ENSURE_INDEX")
	defer func() {
		if originalSet {
			os.Setenv("SEARCH_ENSURE_INDEX", originalVal)
		} else {
			os.Unsetenv("SEARCH_ENSURE_INDEX")
		}
	}()

	os.Unsetenv("SEARCH_ENSURE_INDEX")

	got := SearchEnsureIndex()
	if got != false {
		t.Error("SearchEnsureIndex() should return false when SEARCH_ENSURE_INDEX is unset, regardless of address")
	}
}
