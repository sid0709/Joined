# Step 02: Scout extension sign-in state

- **Week:** W1 (Oct 5 to 11), Scout extension
- **Owner:** Maya (lane: `scout-extension/**`)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `roadmap step-02: Scout extension sign-in state`

## Goal

The Scout extension knows whether the user is signed in to Scout and shows that in the side panel.

## In scope

- A small typed API client in `scout-extension/src/` that asks the Scout backend (scoutwell-backend, local `http://127.0.0.1:8082`, prod host configurable) who the current user is, reusing whatever session/me endpoint already exists. Investigate the existing Scoutwell auth first.
- Side panel states: loading, signed out (button opens the Scout website sign-in page in a new tab), signed in (shows scout name or email), error.
- Re-check on panel open and when the sign-in tab closes or after a short poll.
- Host permissions only for the Scout API host(s) needed, configurable for dev and prod via build-time env.
- Unit tests for the client and state logic if the workspace test setup allows.

## Out of scope

- No changes outside `scout-extension/**`. If the backend lacks a usable "me" endpoint, stub it behind the client interface, note it in the PR, and tell Elon (Penny owns the backend side).
- No job capture, submit, earnings, or notifications.
- No new root dependencies; if one is truly needed, stop and ask Elon.

## Acceptance criteria

1. `bun --filter scout-extension build`, `typecheck`, repo lint and format pass.
2. Loaded unpacked, the panel shows signed-out state with no backend running, and signed-in state against a local Scoutwell session.
3. Diff touches only `scout-extension/**` (plus `bun.lock` only if unavoidable, flagged in the PR).
