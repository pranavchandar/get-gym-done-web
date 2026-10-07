# Get Gym Done — Web

A 1:1 web port of the **Get Gym Done** Android workout logger. It knows what day
of your split is next, logs your sets with progressive-overload suggestions, tracks
bodyweight and personal records, and keeps a consistency heatmap — all local-first,
no account required. It installs as a PWA and is designed phone-first.

**Live URL (placeholder):** https://pranavchandar.github.io/get-gym-done-web/

## What it does

- **Onboarding** — pick a preset split (Push Pull Legs, Upper/Lower, PHUL, Bro,
  Arnold, Glute Focused, Full Body) or build a custom routine day-by-day.
- **Today** — streak, weekly progress and bodyweight at a glance; an "up next" card
  that skips scheduled rest days; a month calendar; an editable weekly schedule;
  log non-lifting activities; automatic rest-day logging.
- **Active workout** — per-set weight/rep steppers with a numeric keypad, a wall-clock
  rest timer (with ±30s / skip, beep + vibrate + notification), progressive-overload
  "time to add weight" prompts, and add/replace/remove exercise on the fly. The whole
  in-progress session (including the running rest timer) survives a page reload. An
  anatomical body map shows what the exercise targets, the best estimated 1RM sits
  next to the prescription, and the **screen stays awake** for the whole session
  (Screen Wake Lock API; switchable in Settings).
- **Exercise library** — on top of the built-in catalog, **1,324 exercises** with
  step-by-step instructions, searchable and filterable by body part and equipment (the
  equipment chips only offer combinations that have results). Picking one copies it
  into your catalog, so it behaves like any other exercise.
- **Profile** — total volume, body metrics with sparklines and an optional **goal
  weight** (dashed line; the trend arrow goes green when you move toward it),
  per-exercise progression, an 18-week consistency heatmap, a personal-records list, a
  **muscle-balance map** (front/back, male or female figure) shaded by sets per muscle
  over a week / month / all time that names the muscles you *haven't* trained, and an
  **estimated 1RM** per exercise (Epley, from your best set of ≤12 reps — it names the
  set) with a trend line and a 1RM / rep-max calculator.
- **Workout complete** — the muscles you just hit, plus any new estimated-1RM records.
- **Settings** — theme (system/light/dark), 10 accent palettes, kg/lbs, keep-awake,
  body-map figure, reset routine, cloud sync, JSON export/import, and importing history
  from **Strong, Hevy or FitNotes**.

## Data storage

All app data lives in **your browser's `localStorage`** under the key
`get-gym-done:v1` (a single Zustand store persisted via its `persist` middleware).
Nothing is sent anywhere unless you configure cloud sync. Weights are stored
internally in **kilograms** and converted to your chosen unit only for display; times
are epoch milliseconds. Seed data (splits + exercise catalog) is loaded on first run.

Because storage is per-browser, clearing site data or switching browsers/devices
starts fresh — use **Export** or **Cloud Sync** to move your data.

The goal weight, body-map figure and keep-awake switch are web-only settings: the
shared `BackupFile` format has no field for them, so they stay in this browser and are
kept as-is when you import a backup.

## Running locally

```bash
npm install
npm run dev      # start the dev server (Vite)
npm run build    # type-check (strict) + production build to dist/
npm run preview  # serve the production build
```

Requires Node 18+ (CI uses Node 22). The app is served from the `/get-gym-done-web/`
base path (GitHub Pages sub-path) and uses `HashRouter`, so deep links work on Pages.

## Cloud sync (GitHub Gist)

Settings → **Cloud Sync** syncs your data to a **private GitHub Gist**.

1. Create a GitHub personal access token:
   - **Classic token** with the **`gist`** scope, or
   - **Fine-grained token** with **Gists: Read and write** permission.
2. Paste it into Settings → Cloud Sync and press **Save token**. It is stored in
   `localStorage` (`get-gym-done:gist-token`); the gist id is stored in
   `get-gym-done:gist-id` and the last sync time in `get-gym-done:last-sync`.
3. **Push to cloud** creates (first time) or updates a private gist named
   `get-gym-done-backup.json`. **Pull from cloud** replaces all local data with the
   gist contents (after a confirm).
4. After you finish a workout, the app auto-pushes silently if a token + gist are
   configured. All sync errors are non-fatal and shown inline in Settings.

The token never leaves your browser except in direct requests to `api.github.com`.

## Importing history from other apps (Settings → Data)

**Import history from Strong, Hevy or FitNotes** reads those apps' CSV exports; the
format is detected from the header row.

- Every workout becomes a completed session with its sets, so stats, PRs, estimated
  1RM, the muscle map and "last time" weight prefills all pick it up. Imported sessions
  aren't tied to a routine day, so your split rotation doesn't move.
- Exercise names are matched against your catalog and the exercise library
  ("Bench Press (Barbell)" finds "Barbell Bench Press"); anything unrecognised becomes a
  custom exercise, so no sets are dropped. Warm-up sets, rest-timer rows and rows
  without reps (cardio, timed holds) are skipped and counted in the preview.
- When a file doesn't record the weight unit (older Strong exports), the preview asks
  for it. Importing merges into your data; re-importing the same file adds nothing twice.

## Exporting your routine (Workouts → Export)

The **Workouts** tab exports the active split as a shareable document — this is the
routine itself (days, exercises, prescriptions), not your logged history:

| Format | File | Use |
| --- | --- | --- |
| PDF | `<routine>-routine.pdf` | Printable A4 sheet, one table per day, paginated |
| Excel | `<routine>-routine.xlsx` | Real `.xlsx` — opens in Excel, Numbers, Sheets |
| CSV | `<routine>-routine.csv` | UTF-8 with BOM, RFC 4180 quoting |
| JSON | `<routine>-routine.json` | Structured, includes form cues and muscle groups |

All four are generated in-browser with no dependencies: `src/export/zip.ts` is a
minimal STORE-only ZIP writer (the `.xlsx` container) and `src/export/pdf.ts` emits
PDF 1.4 using the standard Helvetica fonts, so nothing is uploaded and no CDN is
involved. For a full data backup (sessions, sets, body metrics) use Settings →
Export to JSON instead.

## Moving data between the Android app and the web app

Export/import use the **same `BackupFile` v2 JSON** as the Android app, so data moves
both ways:

- **Android → Web:** export a backup from the Android app, then Settings → **Import
  from JSON** here (full replace after confirm). Android's `userPrefs` fields
  (`socialHandle`, `socialColor`, `avatarPhoto`) are mapped onto the web profile.
- **Web → Android:** Settings → **Export to JSON** (downloads `gymdone-backup.json`),
  then import it in the Android app. The web export writes Android's `userPrefs` field
  names so round-trips are lossless. `exerciseMedia` is exported as `[]` and ignored on
  import (media uploads are out of scope on the web).

## Third-party data

The body-map outlines come from [MuscleMap](https://github.com/melihcolpan/MuscleMap)
(MIT) and the exercise library's text from
[exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (MIT, text only —
its images/GIFs are © Gym visual and are not used). Both load on demand and are
precached for offline use. Regenerate them with the scripts in `scripts/`; licenses are
in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Notes / scope

Dropped from the Android app on the web port: the friends/social/Firebase layer, QR
codes, exercise-media file uploads, the debug screen, and OS push notifications
(rest-timer end still fires a Web Notification when the tab is hidden and permission
is granted). Everything is progressively enhanced and guarded behind feature checks,
so it degrades cleanly where an API is unavailable.
