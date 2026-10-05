# AIMS-extension

This is the browser extension for the AIMS (Automated intelligent-sourcing for jobs) application. It provides a sidebar interface that allows users to interact with web pages and automate tasks related to job applications.

## Features

- **Routines:** each supported site is a routine module in `src/routines/`: plain data that says which pages it runs on, how to move through the site, and which fields to read. The crawler runs whichever routine matches the focused tab.
- **Run tab:** shows the routine for the focused tab, then runs it: the current phase and step, every field's state and hit rate, the results by outcome, and the latest jobs.
- **Routines tab:** every routine the crawler knows, with its sites, fields, and steps.
- **Inspector tab:** try a CSS selector on the focused page (live match count, highlight, click), read a field, and copy it as routine code.

## Technologies Used

- **React:** A JavaScript library for building user interfaces.
- **Vite:** A fast build tool for modern web development.
- **@joined/design-system:** Joined's shared components and tokens for the side panel UI.
- **ESLint:** The repo's shared lint rules.
- **Chrome Extension APIs:** A set of APIs for creating Chrome extensions.

## Getting Started

The crawler is a workspace of the Joined bun monorepo (`plugins/crawler`, package `avalon-scrapper`). Use bun only; run every command from the repo root.

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

Server URLs and the duplicate window come from `VITE_*` settings in `plugins/crawler/.env`. Rebuild after changing them.

The side panel follows the system light/dark setting until you pick one with the sun/moon button in the header; the choice is remembered.

## Project Structure

- **dist/**: The built extension (not committed).
- **public/**: Contains the public assets of the extension.
- **src/**: Contains the source code of the extension.
  - **routines/**: One module per site (`JobRightRoutine.js`) and the registry (`index.js`).
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
- **Sidebar UI (React components):** Picks the routine for the focused tab and runs it through the routine runner, one op at a time.

## Communication

The different parts of the extension communicate with each other using the `chrome.runtime.onMessage` and `chrome.tabs.sendMessage` APIs. The background script acts as a message broker, relaying messages between the UI and the content script.

The extension communicates with Athens-server over REST. Backend availability is checked through the `/healthz` HTTP endpoint.
