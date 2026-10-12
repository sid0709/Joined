// Command auditsession mints and revokes short sessions for `bun run audit` test mode.
//
// Run it from a backend folder so it reads that backend's .env:
//
//	go run -C joined-backend github.com/sid0709/Joined/backend-core/cmd/auditsession \
//	  -action issue -kind user -user-id <id> -email <email>
//
// A user session is only ever for one pinned test account: the id and email must name the same
// account. A staff session skips Google Workspace sign-in, so it is refused unless MONGO_URI is
// on this machine.
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

	"github.com/sid0709/Joined/backend-core/auth"
	"github.com/sid0709/Joined/backend-core/config"
	"github.com/sid0709/Joined/backend-core/database"
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
	// exitRefused tells `bun run audit` the session was refused on purpose, so it scans signed out.
	exitRefused = 3
)

// localMongoHosts are the only hosts a staff audit session may be written to.
var localMongoHosts = map[string]bool{"localhost": true, "127.0.0.1": true, "::1": true}

var errRefused = errors.New("refused")

type issued struct {
	Token string `json:"token"`
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

func main() {
	action := flag.String("action", "", "issue or revoke")
	kind := flag.String("kind", kindUser, "user or staff")
	userID := flag.String("user-id", "", "the test account's id field (kind=user)")
	email := flag.String("email", "", "the test account's email; must match -user-id (kind=user)")
	token := flag.String("token", "", "session token to revoke")
	flag.Parse()

	err := run(*action, *kind, *userID, *email, *token)
	if errors.Is(err, errRefused) {
		slog.Warn("audit session", "refused", err)
		os.Exit(exitRefused)
	}
	if err != nil {
		slog.Error("audit session", "error", err)
		os.Exit(1)
	}
}

func run(action, kind, userID, email, token string) error {
	config.LoadEnvFile()
	cfg, err := config.LoadDatabase()
	if err != nil {
		return err
	}
	if kind == kindStaff {
		if err := requireLocalMongo(cfg.MongoURI); err != nil {
			return err
		}
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
		token, user, err := store.IssueAuditSession(ctx, userID, email, auditSessionTTL, time.Now())
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

// requireLocalMongo fails with errRefused unless every host in uri is this machine.
func requireLocalMongo(uri string) error {
	parsed, err := url.Parse(uri)
	if err != nil {
		return errors.New("MONGO_URI is not a valid URI")
	}
	if parsed.Scheme != "mongodb" {
		return fmt.Errorf("%w: staff audit sessions need a local mongodb:// URI, not %s://", errRefused, parsed.Scheme)
	}
	for _, host := range strings.Split(parsed.Host, ",") {
		name := host
		if index := strings.LastIndex(host, ":"); index > 0 && !strings.HasSuffix(host, "]") {
			name = host[:index]
		}
		name = strings.Trim(name, "[]")
		if !localMongoHosts[name] {
			return fmt.Errorf("%w: staff audit sessions need a local database, not host %q", errRefused, name)
		}
	}
	return nil
}

func auditStaffEmail() string {
	domain := config.Env(staffDomainEnv, fallbackStaffHost)
	return auditStaffLocal + "@" + domain
}
