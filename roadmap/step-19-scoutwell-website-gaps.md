# Step 19: Scout website gaps

Status: Done (merged in W2)

- **Week:** W2, Scout complete
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(scoutwell-frontend): close scout website launch gaps (roadmap step-19)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after: nothing, can start now.** Works only in `scoutwell-frontend`, so it cannot conflict with Leo's step-04 or step-10 in `joined-frontend`.

## Goal
The Scout website has every page a new scout needs at launch: what Scout is, how pay works, how to install the extension, and a clean sign-in path from the extension.

## In scope
- Investigate the current `scoutwell-frontend` pages and list the gaps in the PR description.
- Pages or sections: landing, how it works, how scouts earn (share-of-applies, numbers read from config or copy, not hard-coded rates), install the extension (store link from env, placeholder until step-15 is published), FAQ.
- A sign-in landing that the step-02 extension opens: after sign-in it shows "You can close this tab and return to the extension".
- Use `@joined/design-system`; responsive; basic metadata per page.

## Out of scope
- No earnings dashboard (step-20), no backend changes, no other apps.

## Acceptance criteria
1. Build, typecheck, lint, format pass for `scoutwell-frontend`.
2. All new pages render locally and are linked from the main navigation.
3. Diff stays in Leo's lane.
