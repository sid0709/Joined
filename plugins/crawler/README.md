# Joined Scrapper

Chrome extension for Joined staff: run site routines from the side panel, scrape job listings, and stage them in the admin pool through the crawler ingest API.

## Features

- **Routines:** each supported site is a routine module in `src/routines/`: plain data that says which pages it runs on, how to move through the site, and which fields to read. The extension runs whichever routine matches the focused tab.
- **Run tab:** shows the routine for the focused tab, then runs it: the current phase and step, every field's state and hit rate, the results by outcome, and the latest jobs.
- **Routines tab:** every routine the extension knows, with its sites, fields, and steps.
- **Inspector tab:** try a CSS selector on the focused page (live match count, highlight, click), read a field, and copy it as routine code.

## Technologies Used

- **React:** A JavaScript library for building user interfaces.
- **Vite:** A fast build tool for modern web development.
- **sid-ui:** Joined's shared components and tokens for the side panel UI.
- **ESLint:** The repo's shared lint rules.
- **Chrome Extension APIs:** A set of APIs for creating Chrome extensions.

## Getting Started

The crawler is a workspace of the Joined bun monorepo (`plugins/crawler`, package `joined-scrapper`). Use bun only; run every command from the repo root.

1. Install dependencies (one `bun install` for the whole repo)
   ```sh
   bun install
   ```
2. Build the extension
   ```sh
   bun run build:crawler
   ```
   For the side panel with hot reload at http://localhost:7173, run `bun run dev:crawler`.
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable "Developer mode".
5. Click on "Load unpacked" and select `plugins/crawler/dist`.

Settings come from `VITE_*` values in `plugins/crawler/.env`; copy `.env.example` to start, and rebuild after changing them. `.env` is git-ignored because it holds the ingest token.

| Setting                      | What it is                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `VITE_API_URL`               | The Joined admin API base. Locally `http://127.0.0.1:8081` (admin-backend's `HTTP_ADDR`). |
| `VITE_CRAWLER_INGEST_TOKEN`  | The same value as `CRAWLER_INGEST_TOKEN` in `admin-backend/.env`.                         |
| `VITE_DUPLICATE_WINDOW_DAYS` | Days (1–365) a job with the same apply link counts as a duplicate.                        |
| `VITE_SCRAPE_SOURCE`         | Optional. The `createdBy` value staff filter on. Default `joined-scrapper`.               |

The panel's Start button stays disabled, and says which setting is missing, until these are set.

The side panel follows the system light/dark setting until you pick one with the sun/moon button in the header; the choice is remembered.

### Brand icons

Source art lives in `assets/logo-source.jpg`. To regenerate `public/logo.png` and `public/icons/*` after editing it:

```sh
python3 plugins/crawler/scripts/export-brand-icons.py
```

## Project Structure

- **dist/**: The built extension (not committed).
- **public/**: Contains the public assets of the extension.
- **src/**: Contains the source code of the extension.
  - **routines/**: One module per site (`JobRightRoutine.js`, `BuiltInRoutine.js`) and the registry (`index.js`). Built In crawls visibly (same-tab navigation, list-card heart after enqueue). Its parsers and handled-ID store live in `routines/builtin/`.
  - **routineKit/**: The toolkit routines are written with: field and step builders, strategies, transforms, the runner, and the page-side extractor.
  - **api/**: Runtime messaging, the focused tab, backend health, job validation, and notifications.
  - **components/**: The side panel: the header and tabs (`layout.jsx`), `Run/`, `Routines/`, and `Inspector/`.
  - **theme/colorMode.jsx**: The light/dark mode and the Joined theme provider.
  - **styles/crawler.css**: Side panel layout on top of the Joined tokens.
  - **background.js**: The service worker's startup wiring; its modules live in `background/`.
  - **contentScript/**: The content script: `index.js` is the entry, `messageHandler.js` routes messages, and `messages/routineOps.js` runs routine ops on the page.
- Lint uses the repo's shared ESLint rules (root `eslint.config.mjs`).
- **vite.config.js** builds the side panel and service worker; **vite.contentScript.config.js** builds the content script as one self-contained file, because Chrome cannot load shared chunks into a content script.

## Adding a routine

1. Copy `src/routines/JobRightRoutine.js` to `src/routines/<Site>Routine.js`.
2. Set `id`, `label`, `match.hosts`, and the `strategy` steps (`click`, `waitFor`, `waitGone`, …).
3. Describe each field with `text()`, `prop()`, `attr()`, `rawText()`, `html()`, or `pairs()`. The Inspector tab writes these for you.
4. List the routine in `src/routines/index.js`, and add a test beside it like `JobRightRoutine.test.js`.

`defineRoutine()` checks the routine when the extension loads and names every problem it finds.

## Architecture

The extension is composed of three main parts:

- **Background Script (`background.js`):** The central communication hub. It relays routine ops from the side panel to the page, keeps the job save queue, and manages the side panel.
- **Content Script (`contentScript.js`):** Runs on the page with DOM access. It answers routine ops (count, highlight, click, extract) and watches for job applications.
- **Side Panel (`index.html` + React):** The UI staff use to pick routines, run them, and inspect selectors.

The background script sends scraped jobs in batches to the Joined admin API, `POST /v1/public/crawler/jobs` with the ingest token as a bearer token. The API stages each job in `JoinedDB.temp_jobs`, skipping one whose apply link is already there inside the duplicate window, and the admin console's analyze step turns staged jobs into search records. The panel checks the API through `GET /health`.
