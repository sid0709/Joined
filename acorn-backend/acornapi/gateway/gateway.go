// Package gateway is Acorn's Socket.IO endpoint at /acorn/socket.io: the side panel, the UI
// board and the extension meet here, one private room per Joined account.
package gateway

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/zishang520/socket.io/servers/socket/v3"
	"github.com/zishang520/socket.io/v3/pkg/types"
)

const (
	// Path is the Engine.IO path the extension connects to, inside acornapi.Prefix.
	Path = "/acorn/socket.io"
	// maxBuffer leaves headroom for DOM trees, which run a few MB after the serializer caps.
	maxBuffer = 16e6

	getContentTimeout = 15 * time.Second
	executeTimeout    = 60 * time.Second
	planStepTimeout   = 45 * time.Second

	errNoExtension = "No extension connected"
)

// Account is who a socket token belongs to.
type Account struct {
	ID   string
	Name string
}

// Authenticate resolves a session token to an account.
type Authenticate func(ctx context.Context, token string) (Account, error)

type Gateway struct {
	io       *socket.Server
	registry *Registry
	auth     Authenticate
}

func New(auth Authenticate) *Gateway {
	g := &Gateway{registry: NewRegistry(), auth: auth}
	opts := socket.DefaultServerOptions()
	opts.SetPath(Path)
	opts.SetMaxHttpBufferSize(maxBuffer)
	opts.SetPerMessageDeflate(nil)
	// The token travels in the handshake payload, never a cookie the browser would attach on its own.
	opts.SetCors(&types.Cors{Origin: "*"})
	g.io = socket.NewServer(nil, opts)
	g.io.Use(g.authenticate)
	g.io.On("connection", func(args ...any) { g.onConnection(args[0].(*socket.Socket)) })
	return g
}

// Handler serves the Engine.IO endpoint.
func (g *Gateway) Handler() http.Handler { return g.io.ServeHandler(nil) }

func (g *Gateway) Close() { g.io.Close(nil) }

// Token reads the handshake token: the auth payload, or an Authorization header.
// A query-string token is never accepted: URLs land in proxy access logs.
func Token(auth map[string]any, header string) string {
	if token, ok := auth["token"].(string); ok && strings.TrimSpace(token) != "" {
		return strings.TrimSpace(token)
	}
	if token, ok := strings.CutPrefix(strings.TrimSpace(header), "Bearer "); ok {
		return strings.TrimSpace(token)
	}
	return ""
}

func (g *Gateway) authenticate(sock *socket.Socket, next func(*socket.ExtendedError)) {
	handshake := sock.Handshake()
	header := ""
	if handshake.Headers != nil {
		header = handshake.Headers.Header().Get("Authorization")
	}
	token := Token(handshake.Auth, header)
	if token == "" {
		next(socket.NewExtendedError("Acorn session required", nil))
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	account, err := g.auth(ctx, token)
	if err != nil {
		message := "Acorn session expired or invalid"
		if !errors.Is(err, ErrUnauthorized) {
			slog.Error("acorn socket auth", "error", err)
			message = "Acorn session could not be checked"
		}
		next(socket.NewExtendedError(message, nil))
		return
	}
	sock.SetData(account)
	next(nil)
}

// ErrUnauthorized is the token is not a live session.
var ErrUnauthorized = errors.New("unauthorized")

func room(accountID string) socket.Room { return socket.Room("acorn:acct:" + accountID) }

func queryValue(sock *socket.Socket, key string) string {
	return sock.Handshake().Query.Query().Get(key)
}

func (g *Gateway) onConnection(sock *socket.Socket) {
	account := sock.Data().(Account)
	r := room(account.ID)
	kind := queryValue(sock, "type")
	if kind == "" {
		kind = "unknown"
	}
	name := queryValue(sock, "name")
	if name == "" {
		name = account.Name
	}
	if name == "" {
		name = "anonymous"
	}

	sock.Join(r)
	client := g.registry.Add(sock, Client{AccountID: account.ID, Type: kind, Name: name, ProfileID: account.ID, ApplierName: account.Name})
	slog.Info("acorn socket connected", "type", kind, "name", name, "id", client.ID)

	_ = sock.Emit("connected", map[string]any{"id": client.ID, "type": kind, "clients": g.registry.SummaryFor(account.ID)})
	_ = g.io.To(r).Emit("clients:update", g.registry.SummaryFor(account.ID))

	sock.On("dom:tree", func(args ...any) {
		payload := firstPayload(args)
		meta := map[string]any{
			"from":       client.ID,
			"clientType": kind,
			"clientName": name,
			"url":        orDefault(payload["url"], "unknown"),
			"title":      orDefault(payload["title"], "unknown"),
			"tabId":      payload["tabId"],
			"frameId":    payload["frameId"],
			"timestamp":  time.Now().UnixMilli(),
			"nodeCount":  CountNodes(payload["tree"]),
		}
		out := map[string]any{"meta": meta}
		for key, value := range payload {
			out[key] = value
		}
		out["meta"] = meta
		_ = sock.To(r).Emit("dom:tree", out)
		_ = sock.Emit("dom:tree:sent", meta)
	})

	sock.On("pipeline:progress", func(args ...any) {
		_ = sock.To(r).Emit("pipeline:progress", firstPayload(args))
	})

	sock.On("dom:highlight", func(args ...any) {
		payload := firstPayload(args)
		if payload["nodeId"] == nil || payload["tabId"] == nil || payload["tabId"] == "" {
			return
		}
		out := map[string]any{"nodeId": payload["nodeId"], "tabId": payload["tabId"], "url": payload["url"]}
		if id, ok := payload["extensionId"].(string); ok && id != "" {
			target, owned := g.registry.OwnedBy(id, account.ID)
			if !owned {
				slog.Warn("acorn dom:highlight rejected cross-account target", "from", client.ID)
				return
			}
			_ = target.socket.Emit("dom:highlight", out)
			return
		}
		for _, other := range g.registry.SummaryFor(account.ID) {
			if other.Type != "extension" {
				continue
			}
			if target, ok := g.registry.OwnedBy(other.ID, account.ID); ok {
				_ = target.socket.Emit("dom:highlight", out)
			}
		}
	})

	sock.On("dom:get-content", func(args ...any) {
		payload, ack := payloadAndAck(args)
		if payload["nodeId"] == nil || payload["tabId"] == nil || payload["tabId"] == "" {
			reply(ack, map[string]any{"error": "Missing nodeId or tabId"})
			return
		}
		g.relay(account.ID, payload, "dom:get-content", ack, getContentTimeout, false)
	})

	sock.On("dom:execute-actions", func(args ...any) {
		payload, ack := payloadAndAck(args)
		if payload["nodeId"] == nil || payload["tabId"] == nil || payload["tabId"] == "" {
			reply(ack, map[string]any{"error": "Missing nodeId or tabId"})
			return
		}
		g.relay(account.ID, payload, "dom:execute-actions", ack, executeTimeout, false)
	})

	sock.On("dom:plan-step", func(args ...any) {
		payload, ack := payloadAndAck(args)
		step, _ := payload["step"].(map[string]any)
		if payload["tabId"] == nil || payload["tabId"] == "" || step == nil || step["action"] == nil || step["action"] == "" {
			reply(ack, map[string]any{"ok": false, "error": "Missing tabId or step"})
			return
		}
		slog.Info("acorn dom:plan-step", "action", step["action"], "index", step["element_index"], "tab", payload["tabId"])
		g.relay(account.ID, payload, "dom:plan-step", ack, planStepTimeout, true)
	})

	sock.On("disconnect", func(...any) {
		g.registry.Remove(client.ID)
		slog.Info("acorn socket disconnected", "type", kind, "name", name, "id", client.ID)
		_ = g.io.To(r).Emit("clients:update", g.registry.SummaryFor(account.ID))
	})
}

// relay forwards a command to the account's extension and returns its answer to
// the caller. A caller-supplied extensionId is honoured only when that socket
// belongs to the same account.
func (g *Gateway) relay(accountID string, payload map[string]any, event string, ack socket.Ack, timeout time.Duration, withOK bool) {
	fail := func(message string) {
		if withOK {
			reply(ack, map[string]any{"ok": false, "error": message})
			return
		}
		reply(ack, map[string]any{"error": message})
	}

	var target *Client
	if id, ok := payload["extensionId"].(string); ok && id != "" {
		owned, found := g.registry.OwnedBy(id, accountID)
		if !found {
			fail(errNoExtension)
			return
		}
		target = owned
	} else {
		found, ok := g.registry.Extension(accountID)
		if !ok {
			fail(errNoExtension)
			return
		}
		target = found
	}

	target.socket.Timeout(timeout).Emit(event, payload, func(res []any, err error) {
		if err != nil {
			message := err.Error()
			if message == "" {
				message = "Extension request timed out"
			}
			fail(message)
			return
		}
		if len(res) == 0 || res[0] == nil {
			fail("No response from extension")
			return
		}
		reply(ack, res[0])
	})
}

func reply(ack socket.Ack, value any) {
	if ack != nil {
		ack([]any{value}, nil)
	}
}

func firstPayload(args []any) map[string]any {
	if len(args) > 0 {
		if payload, ok := args[0].(map[string]any); ok {
			return payload
		}
	}
	return map[string]any{}
}

func payloadAndAck(args []any) (map[string]any, socket.Ack) {
	var ack socket.Ack
	if len(args) > 0 {
		if fn, ok := args[len(args)-1].(socket.Ack); ok {
			ack = fn
			args = args[:len(args)-1]
		} else if fn, ok := args[len(args)-1].(func([]any, error)); ok {
			ack = fn
			args = args[:len(args)-1]
		}
	}
	return firstPayload(args), ack
}

func orDefault(value any, fallback string) any {
	if value == nil {
		return fallback
	}
	return value
}
