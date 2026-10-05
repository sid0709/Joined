package gateway

import (
	"sort"
	"sync"
	"time"

	"github.com/zishang520/socket.io/servers/socket/v3"
)

// Client is one connected socket, scoped to the account that signed it in.
type Client struct {
	ID          string `json:"id"`
	AccountID   string `json:"accountId"`
	Type        string `json:"type"`
	Name        string `json:"name"`
	ProfileID   string `json:"profileId"`
	ApplierName string `json:"applierName"`
	ConnectedAt int64  `json:"connectedAt"`

	socket *socket.Socket
}

// Registry tracks sockets by id. Every lookup is scoped to an account so one
// account can never see or drive another's browser.
type Registry struct {
	mu      sync.RWMutex
	clients map[string]*Client
}

func NewRegistry() *Registry { return &Registry{clients: map[string]*Client{}} }

func (r *Registry) Add(sock *socket.Socket, client Client) *Client {
	client.ID = string(sock.Id())
	client.ConnectedAt = time.Now().UnixMilli()
	client.socket = sock
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[client.ID] = &client
	return &client
}

func (r *Registry) Remove(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.clients, id)
}

// SummaryFor lists one account's clients, oldest first.
func (r *Registry) SummaryFor(accountID string) []Client {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := []Client{}
	for _, client := range r.clients {
		if client.AccountID == accountID {
			out = append(out, *client)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ConnectedAt < out[j].ConnectedAt })
	return out
}

// OwnedBy returns the client when socketID is connected and belongs to accountID.
func (r *Registry) OwnedBy(socketID, accountID string) (*Client, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	client, ok := r.clients[socketID]
	if !ok || client.AccountID != accountID {
		return nil, false
	}
	return client, true
}

// Extension returns the account's extension socket, if one is connected.
func (r *Registry) Extension(accountID string) (*Client, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var found *Client
	for _, client := range r.clients {
		if client.AccountID == accountID && client.Type == "extension" {
			if found == nil || client.ConnectedAt < found.ConnectedAt {
				found = client
			}
		}
	}
	return found, found != nil
}

// CountNodes counts a DOM tree's nodes.
func CountNodes(node any) int {
	row, ok := node.(map[string]any)
	if !ok {
		return 0
	}
	children, ok := row["children"].([]any)
	if !ok {
		return 1
	}
	total := 1
	for _, child := range children {
		total += CountNodes(child)
	}
	return total
}
