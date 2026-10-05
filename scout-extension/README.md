# Scout Extension

A Chrome extension (Manifest V3) for Scout.

## Development

Build the extension:

```bash
# From repo root
bun --filter scout-extension build
```

Watch mode for development:

```bash
bun --filter scout-extension dev
```

Type checking:

```bash
bun --filter scout-extension typecheck
```

## Loading in Chrome

1. Build the extension with `bun --filter scout-extension build`
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `scout-extension/dist` folder

The Scout extension should now appear in your extensions list. Click the Scout icon in the toolbar to open the side panel.

## Job capture

On a job posting page, open the side panel. Scout detects Greenhouse, Lever, Ashby, Workday, and LinkedIn job pages, then shows a **Detected job** card with title, company, location, apply URL, and description. Pages without a job show **No job found on this page**.

Capture uses `activeTab` plus on-demand `scripting`. The extractor is injected into the current tab when the panel asks for it. There are no host permissions for ATS origins.
