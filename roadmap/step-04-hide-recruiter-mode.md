# Step 04: Hide company/recruiter mode for launch

- **Week:** W1, Foundations
- **Owner:** Leo (lane: Next.js frontends, `packages/design-system`, `packages/google-signin`)
- **Target branch:** `stage-roadmap`
- **PR title:** `roadmap step-04: hide company mode for launch`

## Goal

The launch build of joinedhq.com shows only the job seeker experience. Company and recruiter mode is hidden behind a flag, not deleted.

## In scope

- A single flag (for example `NEXT_PUBLIC_COMPANY_MODE_ENABLED`, default off) in `joined-frontend`.
- With the flag off: hide every nav link, button, switcher, and CTA into company mode; `/company/**` routes redirect to `/` (server side, for example middleware or layout redirect); sign-up does not offer a company path.
- With the flag on: today's behavior is unchanged.
- Document the flag in the app's `.env.example` or README.
- Tests where the app already has a test setup.

## Out of scope

- No backend changes; company APIs stay as they are.
- No deleting company code.
- No other apps.

## Acceptance criteria

1. Build, typecheck, lint, format pass for `joined-frontend`.
2. Flag off: no visible path into company mode, `/company` redirects to `/`.
3. Flag on: company mode works as before.
4. Diff stays inside Leo's lane.
