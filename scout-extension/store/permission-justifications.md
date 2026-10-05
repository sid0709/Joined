# Permission justifications

These match the production Manifest V3 permissions. Do not add permissions to justify a future feature.

## `activeTab`

Used when the scout opens Scout on the current tab so the side panel can work with that page. The extension does not request `<all_urls>` or a broad content-script match list.

## `storage`

Stores the scout's local draft queue on this device (`chrome.storage.local`) so saved jobs survive closing the side panel and restarting the browser. Captured fields stay on-device until the scout submits them. It is not used as a profile warehouse; the Scout API remains the source of account data.

## `scripting`

Injects the job-capture extractor into the current tab when the scout opens the side panel on a posting. The script runs on demand with `activeTab`; the extension does not register a broad content-script match list.

## `sidePanel`

Shows the Scout side panel. That panel is the product UI (sign-in, job capture, and the draft queue). There is no separate popup chrome.

## `cookies`

Reads the Scoutwell session cookie on the Scout website origin after the scout signs in in a tab the extension opened. The cookie is sent only to the Scout API as a bearer token. The extension does not read cookies from other sites.

## `alarms`

Wakes the service worker on a timer so Scout can refresh the toolbar badge and poll `GET /v1/scout/notifications?since=` for submission status changes. The alarm does not run in web pages.

## `notifications`

Shows a Chrome notification when a submission is accepted, rejected, or earns a reward. The scout can turn these off in the side panel. The extension does not send notifications for other sites or for browsing activity.

## Host permissions (production)

Production builds keep host permissions only for the Scout API host and the Scoutwell website origin (`https://scout.joinedhq.com/*` by default, overridable with `VITE_SCOUT_API_HOST` and `VITE_SCOUTWELL_WEB_ORIGIN`).

Those hosts are required to:

- Open the Scoutwell sign-in page
- Read the Scoutwell session cookie on that origin
- Call `/v1/scout/me`, `POST /v1/scout/submissions/extension`, and `GET /v1/scout/notifications?since=` on the Scout API

Development unpacked builds may still list localhost hosts. The packaging check rejects those hosts in the production zip.
