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
- **Socket.io-client:** A library for real-time, bidirectional communication between web clients and servers.
- **ESLint:** A tool for identifying and reporting on patterns found in ECMAScript/JavaScript code.
- **Chrome Extension APIs:** A set of APIs for creating Chrome extensions.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- Node.js
- npm or yarn

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/your_username_/AIMS.git
   ```
2. Navigate to the Extension directory
   ```sh
   cd Extension
   ```
3. Install NPM packages
   ```sh
   npm install
   ```
4. Build the extension
   ```sh
   npm run build
   ```
5. Open Chrome and navigate to `chrome://extensions`.
6. Enable "Developer mode".
7. Click on "Load unpacked" and select the `dist` directory within the `Extension` directory.

## Project Structure

The project structure is as follows:

- **dist/**: Contains the built extension files.
- **public/**: Contains the public assets of the extension.
- **src/**: Contains the source code of the extension.
  - **api/**: Contains the REST API, backend health, and notification hooks.
  - **assets/**: Contains the static assets of the extension, such as images and fonts.
  - **components/**: Contains the reusable components of the extension.
  - **App.jsx**: The main component of the extension's UI.
  - **main.jsx**: The entry point of the extension's UI.
  - **background.js**: The background script of the extension.
  - **contentScript.js**: The content script of the extension.
- **.eslintrc.cjs**: The ESLint configuration file.
- **.gitignore**: The gitignore file.
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
