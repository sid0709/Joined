// Command auditsession mints and revokes short sessions for `bun run audit` test mode.
//
// Run it from a backend folder so it reads that backend's .env:
//
//	go run -C joined-backend github.com/sid0709/OpenSeat/backend-core/cmd/auditsession -action issue -kind user -role candidate
//
// It refuses any MONGO_URI that is not on this machine: an audit must never sign in to a shared or production database.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/database"
)

const (
	auditSessionTTL   = time.Hour
	commandTimeout    = 30 * time.Second
	actionIssue       = "issue"
	actionRevoke      = "revoke"
	kindUser          = "user"
	kindStaff         = "staff"
	staffDomainEnv    = "ADMIN_GOOGLE_DOMAIN"
	auditStaffLocal   = "local-audit"
	fallbackStaffHost = "localhost"
)

// localMongoHosts are the only hosts an audit session may be written to.
var localMongoHosts = map[string]bool{"localhost": true, "127.0.0.1": true, "::1": true}

type issued struct {
	Token string `json:"token"`
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

func main() {
	action := flag.String("action", "", "issue or revoke")
	kind := flag.String("kind", kindUser, "user or staff")
	role := flag.String("role", auth.RoleCandidate, "account role to sign in as (kind=user)")
	token := flag.String("token", "", "session token to revoke")
	flag.Parse()

	if err := run(*action, *kind, *role, *token); err != nil {
		slog.Error("audit session", "error", err)
		os.Exit(1)
	}
}

func run(action, kind, role, token string) error {
	config.LoadEnvFile()
	cfg, err := config.LoadDatabase()
	if err != nil {
		return err
	}
	if err := requireLocalMongo(cfg.MongoURI); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()
	client, err := database.Connect(ctx, cfg.MongoURI)
	if err != nil {
		return fmt.Errorf("mongo: %s", config.Redact(err, cfg.MongoURI))
	}
	defer client.Disconnect(context.Background())
	store := auth.NewStore(client, cfg.DestDB, cfg.CompaniesCollection)

	switch {
	case action == actionIssue && kind == kindUser:
		token, user, err := store.IssueAuditSession(ctx, role, auditSessionTTL, time.Now())
		if err != nil {
			return err
		}
		return json.NewEncoder(os.Stdout).Encode(issued{Token: token, Email: user.Email, Name: user.Name})
	case action == actionIssue && kind == kindStaff:
		email := auditStaffEmail()
		token, err := store.IssueAuditStaffSession(ctx, email, auditSessionTTL, time.Now())
		if err != nil {
			return err
		}
		return json.NewEncoder(os.Stdout).Encode(issued{Token: token, Email: email})
	case action == actionRevoke && kind == kindUser:
		return store.Signout(ctx, token)
	case action == actionRevoke && kind == kindStaff:
		return store.StaffSignout(ctx, token)
	}
	return fmt.Errorf("unknown -action %q with -kind %q", action, kind)
}

// requireLocalMongo fails unless every host in uri is this machine.
func requireLocalMongo(uri string) error {
	parsed, err := url.Parse(uri)
	if err != nil {
		return errors.New("MONGO_URI is not a valid URI")
	}
	if parsed.Scheme != "mongodb" {
		return fmt.Errorf("audit test mode needs a local mongodb:// URI, not %s://", parsed.Scheme)
	}
	for _, host := range strings.Split(parsed.Host, ",") {
		name := host
		if index := strings.LastIndex(host, ":"); index > 0 && !strings.HasSuffix(host, "]") {
			name = host[:index]
		}
		name = strings.Trim(name, "[]")
		if !localMongoHosts[name] {
			return fmt.Errorf("audit test mode refuses non-local MONGO_URI host %q; point this backend's .env at a local database", name)
		}
	}
	return nil
}

func auditStaffEmail() string {
	domain := config.Env(staffDomainEnv, fallbackStaffHost)
	return auditStaffLocal + "@" + domain
}
