# Scout Extension

A Chrome extension (Manifest V3) for Scout.

## Development

Watch mode for local unpacked loading (localhost API and Scoutwell web origin):

```bash
# From repo root
bun --filter scout-extension dev
```

Production build (used by the store package; talks to production Scout hosts):

```bash
bun --filter scout-extension build
```

Type checking:

```bash
bun --filter scout-extension typecheck
```

## Loading in Chrome

1. Build a development copy with `bun --filter scout-extension dev` (or use the `dist/` folder it writes)
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `scout-extension/dist` folder

The Scout extension should now appear in your extensions list. Click the Scout icon in the toolbar to open the side panel.

## Job capture

On a job posting page, open the side panel. Scout detects Greenhouse, Lever, Ashby, Workday, and LinkedIn job pages, then shows a **Detected job** card with title, company, location, apply URL, and description. Pages without a job show **No job found on this page**. **Save to drafts** stores the captured job on this device. The **Drafts** list can edit, delete, submit one, or submit all. Submitting calls `POST /v1/scout/submissions/extension` with a stable `Idempotency-Key` per draft. Drafts stay local while signed out; submitting requires the Scout session.

Capture uses `activeTab` plus on-demand `scripting`. The extractor is injected into the current tab when the panel asks for it. There are no host permissions for ATS origins.

## How to release

Unlisted Chrome Web Store upload is a human step. This repo only builds the zip and listing materials.

1. Confirm `scout-extension/package.json` version, and set `VITE_SCOUT_API_HOST` / `VITE_SCOUTWELL_WEB_ORIGIN` if production hosts should differ from the defaults in `src/api/hosts.ts`.
2. From the repo root, run `bun --filter scout-extension package`. That production-builds `dist/`, fails if the built manifest still has localhost, `127.0.0.1`, or a development API host, then writes `scout-extension/release/scout-<version>.zip` (`release/` is gitignored).
3. In the Chrome Web Store developer dashboard, create or update an **unlisted** item and upload that zip. Do not publish listed until store assets are real screenshots.
4. Paste listing copy from `scout-extension/store/` (listing text, single-purpose statement, permission justifications, privacy-practices answers). Follow `store/assets.md` for icon and screenshot sizes; those files are specs, not uploads.
