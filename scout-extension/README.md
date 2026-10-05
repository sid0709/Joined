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
