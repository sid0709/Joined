package jobschema

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestCleanTitle(t *testing.T) {
	cases := []struct{ in, want string }{
		{"Senior Software Engineer", "Senior Software Engineer"},
		{"AWS Software Platform Engineer: Developer Tooling (TypeScript) | Remote", "AWS Software Platform Engineer: Developer Tooling (TypeScript)"},
		{"Python and Kubernetes Software Engineer - Data, Workflows, AI/ML & Analytics", "Python and Kubernetes Software Engineer - Data, Workflows, AI/ML & Analytics"},
		{"Senior Staff Full-stack Engineer (Remote-Eligible) - Global Payment Network", "Senior Staff Full-stack Engineer - Global Payment Network"},
		{"GenAI Full Stack Developer/ BQML (Contract to Hire) – Remote Hybrid – Western States Residents only", "GenAI Full Stack Developer/ BQML"},
		{"Ansible Automation & Release Engineer (m/w/d) (remote) mit Erfahrung im öffentlichen Umfeld", "Ansible Automation & Release Engineer mit Erfahrung im öffentlichen Umfeld"},
		{"Software Development Engineer | Location: Seattle, WA – Remote | USC Only.", "Software Development Engineer"},
		{"Senior Android Developer (Java/Kotlin & REST) | $120-150K | Exciting IT Consulting Firm", "Senior Android Developer (Java/Kotlin & REST)"},
		{"Java Senior Engineer with Network Experience for Critical Infrastructure - Remote USA ONLY", "Java Senior Engineer with Network Experience for Critical Infrastructure"},
		{"Site Reliability Engineer (Senior or Staff), Storage Layer Services (SLS)", "Site Reliability Engineer (Senior or Staff), Storage Layer Services (SLS)"},
		{"Developer, Applied AI, Penguin Random House (Open to Remote) Job Details | Apply now!", "Developer, Applied AI, Penguin Random House"},
		{"SENIOR SOFTWARE DEVELOPER – ALGORITHMS AND AI FOR CHIP DESIGN AUTOMATION – REMOTE US", "SENIOR SOFTWARE DEVELOPER - ALGORITHMS AND AI FOR CHIP DESIGN AUTOMATION"},
		{"Sr. Java Developer with Kafka and Cassandra- Full Time-Remote- 11+years", "Sr. Java Developer with Kafka and Cassandra"},
		{"Full-stack Engineer", "Full-stack Engineer"},
		{"Senior iOS Engineer — Swift/SwiftUI | Social, Messaging & Video ****** Senior Android Engineer — Kotlin", "Senior iOS Engineer - Swift/SwiftUI"},
		{"Senior ServiceNow Developer - Remote (US) Remote / Typescript Python ) Python , Js) Python / Typescript AI Software & Operations)", "Senior ServiceNow Developer"},
		{"Sr. Application Solutions Engineer / Architect (IL) (1429) Job Details | HYUNDAI Translead Inc", "Sr. Application Solutions Engineer / Architect"},
		{"  Remote  ", "Remote"},
		{"", ""},
	}
	for _, tc := range cases {
		if got := CleanTitle(tc.in); got != tc.want {
			t.Errorf("CleanTitle(%q)\n got %q\nwant %q", tc.in, got, tc.want)
		}
	}
}

func TestCleanTitleCapsLength(t *testing.T) {
	long := strings.Repeat("Platform ", 30) + "Engineer"
	got := CleanTitle(long)
	if utf8.RuneCountInString(got) > MaxCleanTitleRunes {
		t.Fatalf("cleaned title has %d runes, want <= %d", utf8.RuneCountInString(got), MaxCleanTitleRunes)
	}
	if strings.HasSuffix(got, " ") || got == "" {
		t.Fatalf("cleaned title %q should end on a word", got)
	}
}
