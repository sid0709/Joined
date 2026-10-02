# Acorn face — placement and moments

Wired in the extension (sidebar companion, per-card badges, worker-count chip, Help guide, selection-QA chip). Toolbar icons stay still PNGs. There is no floating acorn on the employer page.

The acorn is Acorn’s mascot: one painted body (`art/acorn-body.png` in the package) with eyes, lids, and effects drawn in code, so every frame is the same character. It appears on operator surfaces in the sidebar and on the selection-QA chip. It never goes inside a form.

Lib: [`packages/acorn-face`](../packages/acorn-face). API: `mount(el)`, `setMode(name)`, `destroy()`. One mode at a time.

Modes: `waiting` `thinking` `working` `help` `smile` `wink` `sad` `sleeping` (the original seven plus `help`; never drop one)

---

## 1. Placement

| Surface                      | Where                                       | Size              | Live?                                                                                                               | Whose status                                                              |
| ---------------------------- | ------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Chrome toolbar + store icons | `manifest.json` `action` / `icons`          | 16 / 48 / 128 PNG | **Still.** Brand mark (growth chart). `renderStill` / `bun run icons` can export an acorn set if the brand changes. | Brand only                                                                |
| Sidebar identity row         | `AcornFaceView` in `SidebarApp`             | 28px              | Live                                                                                                                | **Companion** — focused tab, else any-tab work, else session              |
| Worker-count chip            | Identity row, before Help                   | 18px + number     | Live while any tab is thinking or working                                                                           | **Pool** — unique `tabId`s in thinking/working                            |
| Help guide                   | Sidebar page from the Help button           | ~148px each       | Live                                                                                                                | **Catalog** — one face per mode                                           |
| Fill list card               | 32px logo + 18px badge in `SidebarListCard` | 18px acorn        | Live only if busy, selected, or on-screen and not `waiting`. Idle off-screen rows are a still pose.                 | **That job**                                                              |
| Custom list card             | Same slot, same card component              | 18px acorn        | Same as Fill                                                                                                        | **That remembered tab**                                                   |
| Selection-QA chip            | Existing chip in `selection-qa.ts`          | 18–32px           | Live while the chip is shown                                                                                        | Q&A for this selection (same tab)                                         |
| Notices / Fill pill / footer | —                                           | —                 | No acorn                                                                                                            | Facts stay on those surfaces. The face comments; it does not become them. |

### Identity row

Keep `h2` “Acorn”, display name, worker-count chip, Help, sign-out. The 56px mark (`ACORN_FACE_BRAND_PX`) is a mounted face, not `public/icon-128.png`. The chip always shows the number of unique tabs in `thinking` or `working` (including `0`). Help opens a page of large live faces for every mode; chrome stays.

### List cards — logo plus badge

Fill and Custom share `SidebarListCard`. The leading 32px slot is the **company logo** (Fill) or **tab favicon** (Custom). An 18px Acorn Face badge hangs on the bottom-right corner as a silhouette — no plate or colored circle. Both stay visible. The acorn follows that row’s fill/generate mode.

Job and page identity stay in type: title + subtitle (company or host) + résumé line. Do not add a second 32px column.

`WorkerPoolList` must pass that job’s pipeline (via `attachments[job.id].tabId` → `pipelines[tabId]`). `CustomTabList` already has `generateStatus` and `pipelines[tabId]`. Count busy workers by unique `tabId` (fill wins if the same tab is also generating).

Generate progress bars stay. The acorn does not replace the bar.

### Toolbar

Still `waiting` PNGs. Optional later: swap stills per session (working/sad) via `chrome.action.setIcon` — not required for v1.

---

## 2. Director

One function, three subjects:

```
resolveMode(subject: 'companion' | 'row') → AcornFaceMode
```

**Priority (high → low):** `working` → `thinking` → `sad` → `help` → one-shot (`smile` / `wink`) → `sleeping` → `waiting`

Hold poses: `waiting` `thinking` `working` `help` `sleeping` `sad` last until the situation ends.

One-shots: `smile` and `wink` last 0.5–1.0s (wink = one close–hold–open), then fall back to the hold pose underneath.

`prefers-reduced-motion`: each mood’s resting pose, no glances, breathing, hops, or drifting effects; the face stops redrawing once settled.

Do not fake slits. Send `sleeping`. Do not loop wink as a hold.

### Companion (header)

1. Focused tab fill/generate → that tab’s hold mode.
2. Else `anyTabWorking` → `working` (other tab is busy).
3. Else latest notice one-shot (`success` → `smile`, `error` → `sad`, reconnect → `wink`).
4. Else AFK ~3 min → `sleeping`.
5. Else signed out, name field unfocused → `sleeping`.
6. Else `waiting`.

### Row (this card only)

Ignore other tabs. Ignore header notices unless they belong to this item.

Surfaces may disagree on purpose: header `working` (tab B generating) while row A is `waiting`.

---

## 3. Mode looks

| Mode       | Eyes and body                                       | Effect (64px and up)   |
| ---------- | --------------------------------------------------- | ---------------------- |
| `waiting`  | Round eyes, glances around, blinks, breathes        | —                      |
| `thinking` | Looks up and to the side, slight tilt               | Rising thought bubbles |
| `working`  | Half-lidded, reading sweep left to right, small bob | —                      |
| `help`     | Wide eyes, questioning head tilt                    | `?` bubble             |
| `smile`    | Happy `^ ^` eyes, hop with squash and stretch       | Sparkles               |
| `wink`     | Right eye `^`, playful lean                         | Twinkle by the eye     |
| `sad`      | Lids slant inner-corner-up, gaze drops, sway        | Tear                   |
| `sleeping` | Closed `‿ ‿` eyes, slow deep breathing              | Floating `z`s          |

Below 64px the acorn fills its square (no effects, bigger eyes), so every mood reads from the eyes alone.

---

## 4. Update style → mode

Use this first, then apply the specific rows in §5.

| Update                                             | Mode                           |
| -------------------------------------------------- | ------------------------------ |
| `kind: 'success'`                                  | `smile`                        |
| `kind: 'info'` (courtesy: remembered, connected)   | `wink`                         |
| `kind: 'info'` (invitation / missing precondition) | `thinking` or `sad` (see rows) |
| `kind: 'error'`                                    | `sad`                          |
| Fill `fetching` / `running`                        | `working`                      |
| Fill `analyzing`                                   | `thinking`                     |
| Fill `done`                                        | `smile` → `waiting`            |
| Fill `error`                                       | `sad`                          |
| Generate `extract-jd` / `queued`                   | `thinking`                     |
| Generate sections (`running`)                      | `working`                      |
| Generate `completed`                               | `smile` → `waiting`            |
| Generate `failed`                                  | `sad`                          |
| Socket reconnect                                   | `wink`                         |
| Socket drop while signed in                        | `sad`                          |
| No session                                         | `sleeping` (companion)         |

---

## 5. Moments

Hold times are for the director, not current product code.

### Companion — waiting

| Situation                                                    | Mode                  | Hold                         |
| ------------------------------------------------------------ | --------------------- | ---------------------------- |
| Signed in, Fill list visible, focused tab idle, footer Ready | waiting               | Until next event             |
| Q&A tab, empty question                                      | waiting               | Until Generate or tab switch |
| Apply tab already bound (`openWorkerJob` reused)             | waiting               | Immediate                    |
| After smile/wink expires                                     | waiting               | —                            |
| First-run, no job selected                                   | thinking then waiting | 1.2s then waiting            |
| Empty Custom list (“Remember the current tab…”)              | thinking              | Until Remember or navigate   |
| Worker pool Refresh                                          | thinking              | Until jobs return            |
| Inspect panel open                                           | thinking              | While open                   |
| Connection `<details>` open                                  | thinking              | While open                   |

### Companion — thinking / working

| Situation                                  | Mode     | Hold                    |
| ------------------------------------------ | -------- | ----------------------- |
| Focused tab `phase: 'analyzing'`           | thinking | Entire phase            |
| Focused Custom `extract-jd` / `queued`     | thinking | Until `running` or fail |
| Q&A “Writing…”                             | thinking | Until answer or error   |
| Focused tab `fetching` / `running`         | working  | Entire phase            |
| Focused Custom generating sections         | working  | Until completed/failed  |
| Opening apply URL / remember tab in flight | working  | Until notice            |
| Download on focused card                   | working  | Until download starts   |
| Mark applied in flight                     | working  | Until success/rollback  |
| `anyTabWorking` and focused tab idle       | working  | Until all tabs idle     |

### Companion — sleeping / smile / wink / sad

| Situation                                           | Mode     | Hold                               |
| --------------------------------------------------- | -------- | ---------------------------------- |
| No pointer, no pipeline, no generate ~3 min         | sleeping | Until pointer, key, or click       |
| Signed out, idle sign-in (no `authBusy`)            | sleeping | Until name field focuses           |
| No token / socket never connected                   | sleeping | Until sign-in                      |
| Empty Worker pool, no interaction ~90s              | sleeping | Until jobs or interaction          |
| Signed in                                           | smile    | 0.9s                               |
| Signed out success                                  | smile    | 0.7s                               |
| Preview eye on focused card                         | wink     | One wink                           |
| Socket green after brief offline                    | wink     | One wink                           |
| Tab switch Fill / Q&A / Custom                      | thinking | 0.9s then previous hold            |
| Any `kind: 'error'` notice (sign-in, fill, jobs, …) | sad      | Until dismiss/retry or notice ends |
| Empty Worker pool (with interaction)                | sad      | Until jobs, or 90s → sleeping      |
| Error boundary                                      | sad      | Until Try again                    |

### Fill card (that job)

Need `tabId` from `attachments[job.id]`. Unattached idle jobs still get an acorn (`waiting`).

| Situation                                | Mode            | Hold                        |
| ---------------------------------------- | --------------- | --------------------------- |
| Idle in the pool                         | waiting         | Continuous                  |
| `recommendWarning`                       | sad             | While that card is selected |
| No apply URL / blocked card              | sad             | While blocked               |
| Opening this job’s apply URL             | working         | Until bind                  |
| This tab `analyzing`                     | thinking        | Phase                       |
| This tab `fetching` / `running` / upload | working         | Phase                       |
| This tab `done`                          | smile → waiting | 0.9s                        |
| This tab `error` / blocked / failed step | sad             | Until retry                 |
| Marking this job applied                 | smile           | 1.0s (card leaves)          |
| Couldn’t mark / open this job            | sad             | Notice + 0.6s               |
| Download this résumé                     | working         | Until fetch starts          |
| Preview this résumé                      | wink            | One wink                    |
| Preview empty / failed                   | sad             | Until close                 |

### Custom card (that remembered tab)

| Situation                                                       | Mode                           | Hold                         |
| --------------------------------------------------------------- | ------------------------------ | ---------------------------- |
| Remembered, idle, résumé exists                                 | waiting                        | Continuous                   |
| Remembered, “Not generated...”                                  | sad                            | Until Generate               |
| `extract-jd` / `queued` / “Finding job description…”            | thinking                       | Until generate or fail       |
| Generating summary / skills / experience                        | working                        | Until completed/failed       |
| “Resume generated”                                              | smile → waiting                | 1.0s                         |
| Generate failed / cancelled / 5 min timeout / no Firestore file | sad                            | Until Continue or Start over |
| Continue from a failed step                                     | thinking then working          | Remaining steps only         |
| View JD (JD loaded)                                             | waiting (or current)           | Overlay inspect              |
| No JD on this page                                              | sad                            | Until the page changes       |
| This tab filling                                                | working (analyzing → thinking) | Phase                        |
| Fill done / error                                               | smile / sad                    | Same as Fill card            |
| Download / preview                                              | working / wink                 | Same as Fill card            |
| Couldn’t remember / forget / switch this tab                    | sad                            | Notice hold                  |

### Selection-QA (this tab)

| Situation         | Mode     | Hold       |
| ----------------- | -------- | ---------- |
| Request in flight | thinking | Until HTML |
| Chip click        | wink     | One wink   |
| Copied            | smile    | 0.5s       |

### Q&A (companion + selection chip)

| Situation                | Mode     | Hold        |
| ------------------------ | -------- | ----------- |
| Empty question           | waiting  | —           |
| Writing                  | thinking | Until done  |
| Copied                   | smile    | 0.5s        |
| Error / sign-in required | sad      | Until fixed |

---

## 6. Implementation notes

- Sidebar: `AcornFaceView` / `AcornFaceSlot` / `FaceGuidePanel`. Modes: `acorn-face/director.ts` (`countBusyWorkers` for the chip).
- Idle off-screen rows call `setPaused(true)`. Companion, Help faces, selected rows, and non-waiting rows stay live.
- Worker Pool rows read `attachments[job.id].tabId` → `pipelines[tabId]`.
- Extension version bumped with this ship. Toolbar stays still PNGs.
- Rendering: one shared Web Worker draws every face on extension pages (OffscreenCanvas); content scripts on job sites fall back to the main thread. One frame loop per thread, frame-rate caps by size (24/30/60fps), and nothing runs for paused, off-screen, or hidden faces.

---

## 7. Do not

- Insert the acorn into `<form>` or a child form iframe.
- Float a page HUD on the employer site.
- Replace notices, the generate bar, or the Fill pill with the face.
- Animate the Chrome toolbar with `rAF`.
- Put a live engine on every idle card.
- Use removed modes (`stuck`, `neutral`, `roll`, `surprise`).
