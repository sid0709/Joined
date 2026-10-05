---
paths:
  - "{connected-frontend,joined-frontend,admin-frontend,scoutwell-frontend,acorn-frontend}/**/*.{ts,tsx,css}"
  - "packages/scout/**/*.{ts,tsx,css}"
  - "acorn/extension/**/*.{ts,tsx,css}"
---

# Design system is required

Product UI uses `sid-ui`. This covers `connected-frontend`, `joined-frontend`, `admin-frontend`, `scoutwell-frontend`, `acorn-frontend`, `packages/scout`, and `acorn/extension`.

The catalog is `sid-ui-theme` in the sid-ui repo. Build app UI from the same public components and tokens that catalog shows.

## Components

Import the public entry. Never import `sid-ui/src/*`.

Use an existing primitive for every control. Button, text input, link, modal, drawer, toast, badge, heading, and stack already exist. A screen does not get its own button, input, or dialog.

When a primitive is missing, add it in the sid-ui repo (https://github.com/sid0709/sid-ui), publish it, bump the `sid-ui` catalog pin, and show it in `sid-ui-theme` in the same change. Leave the markup out of the app.

Semantic structure with no primitive (`main`, `section`, `form`, a list of app data) can stay local. Interactive controls and visual chrome cannot.

Acorn-only pieces (Acorn Face, row logo mark, generate progress, plan steps) stay in `acorn/extension` and only arrange design-system components. Follow `acorn/.cursor/rules/acorn-ui-design.mdc`.

## Tokens

Each Next app's global CSS imports `sid-ui/styles/joined.css`. Color, spacing, type, radius, and shadow come from those tokens: `var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`, `var(--font-*)`.

No hex, rgb, or hsl in app or extension code. No raw font pixel sizes. No `style` color, padding, or radius. No app-local color palette.

```tsx
// ❌ local control and raw values
<button style={{ background: "#1877f2", padding: 12 }}>Save</button>;

// ✅ public primitive
import { Button } from "sid-ui";
<Button variant="primary" label="Save" onClick={onSave} />;
```
