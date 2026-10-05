# Permission justifications

These match the production Manifest V3 permissions. Do not add permissions to justify a future feature.

## `activeTab`

Used when the scout opens Scout on the current tab so the side panel can work with that page. The extension does not request `<all_urls>` or a broad content-script match list.

## `storage`

Stores short-lived side-panel state on this device so the panel can recover its last view after Chrome parks the worker. It is not used as a profile warehouse; the Scout API remains the source of account data.

## `sidePanel`

Shows the Scout side panel. That panel is the product UI (sign-in, signed-in profile, later job capture). There is no separate popup chrome.

## `cookies`

Reads the Scoutwell session cookie on the Scout website origin after the scout signs in in a tab the extension opened. The cookie is sent only to the Scout API as a bearer token. The extension does not read cookies from other sites.

## Host permissions (production)

Production builds keep host permissions only for the Scout API host and the Scoutwell website origin (`https://scout.joinedhq.com/*` by default, overridable with `VITE_SCOUT_API_HOST` and `VITE_SCOUTWELL_WEB_ORIGIN`).

Those hosts are required to:

- Open the Scoutwell sign-in page
- Read the Scoutwell session cookie on that origin
- Call `/v1/scout/me` on the Scout API

Development unpacked builds may still list localhost hosts. The packaging check rejects those hosts in the production zip.
