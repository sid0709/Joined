package killswitch

import (
	"strings"
	"time"
)

// Name is one feature staff can turn off without a deploy.
type Name string

const (
	// Signup is email and Google account creation. Existing sign-in stays up.
	Signup Name = "signup"
	// Email is outbound transactional mail (verification, password reset).
	Email Name = "email"
	// JobImports is Athens → Joined copies (admin migration and copy CLIs).
	JobImports Name = "job_imports"
	// AcornAI is Acorn's model-backed routes.
	AcornAI Name = "acorn_ai"
	// ScoutSubmissions is new scout job submissions (Penny wires Scoutwell).
	ScoutSubmissions Name = "scout_submissions"
	// Checkout is Premium Stripe Checkout (Penny wires billing).
	Checkout Name = "checkout"
)

const (
	envSignup           = "KILLSWITCH_SIGNUP"
	envEmail            = "KILLSWITCH_EMAIL"
	envJobImports       = "KILLSWITCH_JOB_IMPORTS"
	envAcornAI          = "KILLSWITCH_ACORN_AI"
	envScoutSubmissions = "KILLSWITCH_SCOUT_SUBMISSIONS"
	envCheckout         = "KILLSWITCH_CHECKOUT"
	envCacheMS          = "KILLSWITCH_CACHE_MS"
	sourceEnv           = "env"
	sourceOverride      = "override"
	collectionName      = "kill_switches"
	auditCollection     = "admin_audit"
	auditSubject        = "kill_switch"
	auditActionEnable   = "kill_switch.enable"
	auditActionDisable  = "kill_switch.disable"
	maxNoteLength       = 1000
)

// DefaultCache is how long a process keeps Mongo overrides before re-reading.
const DefaultCache = 5 * time.Second

// Names is every switch, in the order staff APIs list them.
var Names = []Name{Signup, Email, JobImports, AcornAI, ScoutSubmissions, Checkout}

var envKeys = map[Name]string{
	Signup:           envSignup,
	Email:            envEmail,
	JobImports:       envJobImports,
	AcornAI:          envAcornAI,
	ScoutSubmissions: envScoutSubmissions,
	Checkout:         envCheckout,
}

var disabledMessages = map[Name]string{
	Signup:           "Sign-up is temporarily unavailable.",
	Email:            "Email is temporarily unavailable.",
	JobImports:       "Job imports are temporarily unavailable.",
	AcornAI:          "Acorn AI is temporarily unavailable.",
	ScoutSubmissions: "Scout submissions are temporarily unavailable.",
	Checkout:         "Checkout is temporarily unavailable.",
}

// Known reports whether name is one of the launch kill switches.
func Known(name Name) bool {
	_, ok := envKeys[name]
	return ok
}

// Message is the 503 body when name is off.
func Message(name Name) string {
	if text, ok := disabledMessages[name]; ok {
		return text
	}
	return "This feature is temporarily unavailable."
}

func parseEnabled(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "off", "false", "0", "no", "disabled":
		return false
	default:
		return true
	}
}
