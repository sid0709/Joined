# AIMS-extension

This is the browser extension for the AIMS (Automated intelligent-sourcing for jobs) application. It provides a sidebar interface that allows users to interact with web pages and automate tasks related to job applications.

## Features

- **Sidebar UI:** Provides a user interface within a side panel in the browser.
- **Element Highlighting:** Highlights elements on the web page based on user-defined patterns.
- **Action Execution:** Executes actions such as 'click', 'fill', and 'type' on web page elements.
- **Real-time Communication:** Communicates with the AIMS backend in real-time using Socket.io.

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

The project structure is as follows:

- **dist/**: The built extension (not committed).
- **public/**: Contains the public assets of the extension.
- **src/**: Contains the source code of the extension.
  - **api/**: The REST API, backend health, runtime messaging, and notification hooks.
  - **components/**: The side panel: the header and tabs (`layout.jsx`), the Scrap panel (`Scrapper/Scrap/`), and the Tracker.
  - **theme/colorMode.jsx**: The light/dark mode and the Joined theme provider.
  - **styles/crawler.css**: Side panel layout on top of the Joined tokens.
  - **App.jsx**: The main component of the extension's UI.
  - **main.jsx**: The entry point of the extension's UI.
  - **background.js**: The service worker's startup wiring; its modules live in `background/`.
  - **contentScript/**: The content script: `index.js` is the entry, `messageHandler.js` routes messages to `messages/`, and `actionExecutor.js` runs actions from `actions/`.
- Lint uses the repo's shared ESLint rules (root `eslint.config.mjs`).
- **package.json**: The package.json file.
- **vite.config.js**: The Vite configuration file.

## Architecture

The extension is composed of three main parts:

- **Background Script (`background.js`):** The background script is the central communication hub of the extension. It listens for messages from the UI and the content script and forwards them to the appropriate destination. It also manages the side panel.
- **Content Script (`contentScript.js`):** The content script is injected into the web page and has access to the DOM. It is responsible for highlighting elements, executing actions, and fetching data from the page.
- **Sidebar UI (React components):** The sidebar UI is built with React and provides the user interface for interacting with the extension. It communicates with the background script to send commands and receive data.

## Communication

The different parts of the extension communicate with each other using the `chrome.runtime.onMessage` and `chrome.tabs.sendMessage` APIs. The background script acts as a message broker, relaying messages between the UI and the content script.

The extension communicates with Athens-server over REST. Backend availability is checked through the `/healthz` HTTP endpoint.
