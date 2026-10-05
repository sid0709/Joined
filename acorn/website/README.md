# Acorn website

Next.js app for Acorn's public site. This scaffold has a landing page and a
sign-in placeholder that reuses the Joined `joined_session` cookie. Profile,
resume, and billing pages come later.

## Local

From the repo root:

```bash
bun install
bun --filter acorn-website dev
```

Then open http://localhost:6005. The port is also registered in
`tools/local-services.mjs` (`acorn-website` / `acorn-web`) so it does not clash
with the other local apps.

Sign in on Joined (`bun --filter joined-frontend dev`, then
http://localhost:6002/sign-in) in the same browser. This app only reads the
`joined_session` cookie; it does not run its own auth backend.

Optional env (see `.env.example`):

- `JOINED_WEB_URL` — where the sign-in placeholder links
- `ACORN_EXTENSION_INSTALL_URL` — landing-page install button
