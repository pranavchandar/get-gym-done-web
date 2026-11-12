# Get Gym Done — Web

A 1:1 web port of the **Get Gym Done** Android workout logger. It knows what day
of your split is next, logs your sets with progressive-overload suggestions, tracks
bodyweight and personal records, and keeps a consistency heatmap — all local-first,
no account required. It installs as a PWA and is designed phone-first.

**Live URL (placeholder):** https://pranavchandar.github.io/get-gym-done-web/

## What it does

- **Onboarding** — choose lbs or kg (guessed from your region), then pick a preset
  split (Push Pull Legs, Upper/Lower, PHUL, Bro, Arnold, Glute Focused, Full Body —
  each with a line on who it suits) or build a custom routine day-by-day.
- **Today** — a **weekly streak** (weeks in a row that hit your target of training
  days, so rest days never break it), this week's count, and bodyweight at a glance (tap
  it to weigh in); an "up next" card; a month calendar that shows routine workouts,
  imported workouts and activities; an editable weekly schedule (reorder, copy or remove
  days); log activities with duration, distance and pace. Rest days are never logged for
  you: a rotation rest day shows only the day after the workout before it, and optional
  fixed training weekdays (Settings → Schedule) make every other day a rest day.
- **History** — the Workouts tab lists every session; open one to fix a set's weight or
  reps, add a forgotten set, change its type, edit the note, or delete the session.
  Activities can be edited and deleted the same way.
- **Active workout** — per-set weight/rep steppers with a numeric keypad, set 1
  pre-filled from last time and later sets from what you just logged, a "last time" line,
  plates per side for barbell lifts, and a wall-clock rest timer (±30s / skip, beep +
  vibrate + notification; per-exercise rest times; no timer after warm-ups). Sets can be
  tagged **warm-up / top set / back-off** (warm-ups never count toward volume, records or
  suggestions), with optional **reps in reserve**. Exercise types beyond weight × reps:
  **timed holds** with a stopwatch (planks, carries), **resistance bands** by level, and
  **bodyweight moves with added or assisted load**. Added and removed sets, the running
  timer and the whole session survive leaving the screen or a reload. Exercise notes
  (seat height, grip) show every time; a workout note is saved with the session.
  Replacing an exercise can update the routine for good. The **screen stays awake**
  (Screen Wake Lock API; switchable in Settings).
- **Progression** — "time to add weight" when *every* working set at your top weight
  reached the top of the rep range, in a jump that fits the equipment (dumbbell pairs,
  machine stacks, 10 lb on lower-body barbell lifts); "ease back in" about 10% lighter
  after two weeks away; "Not today" snoozes it.
- **Exercise library** — on top of the built-in catalog, **1,324 exercises** with
  step-by-step instructions, searchable and filterable by body part and equipment (the
  equipment chips only offer combinations that have results). Picking one copies it
  into your catalog, so it behaves like any other exercise.
- **Profile** — total volume, body metrics on **dated charts** (bodyweight with a 7-day
  average; changes in your unit, body fat in percentage points) and an optional **goal
  weight**, per-exercise progression charts, an 18-week consistency heatmap, personal
  records (heaviest, most reps, longest hold, estimated 1RM), a **muscle-balance map**
  with **working sets per muscle per week**, and an **estimated 1RM** per exercise with
  a 1RM / rep-max calculator. Bodyweight moves count your bodyweight (from the nearest
  weigh-in) in load, volume, records and 1RM.
- **Workout complete** — duration, named records (no "records" the first time you do
  an exercise), volume change compared only on the exercises both sessions share, the
  muscles you hit, a note, and a **share card** (an image for the share sheet).
- **Settings** — theme, text size, 10 accent palettes, kg/lbs, keep-awake, show or hide
  estimated 1RMs, reps-in-reserve logging, body-map figure, training weekdays and weekly
  target, reset routine, cloud sync, backups, history import from **Strong, Hevy or
  FitNotes**, a history CSV, and a **PDF progress report** for a coach or physio.

## Data storage

All app data lives in **your browser's `localStorage`** under the key
`get-gym-done:v1` (a single Zustand store persisted via its `persist` middleware).
Nothing is sent anywhere unless you configure cloud sync. Weights are stored
internally in **kilograms** and converted to your chosen unit only for display; times
are epoch milliseconds. Seed data (splits + exercise catalog) is loaded on first run.

Because storage is per-browser, clearing site data or switching browsers/devices
starts fresh — use **Export** or **Cloud Sync** to move your data.

Web-only data — settings such as the goal weight, text size and training weekdays, and
fields such as set types, band levels, timed holds, distances, exercise notes and rest
times — goes in the JSON backup (settings in a `web` section, fields on their records).
The **Android backup** leaves all of it out, so the Android app only meets fields it
knows; restoring an Android file keeps this browser's web-only settings.

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

- Every workout becomes a completed session with its sets, so stats, records, estimated
  1RM, the muscle map, the calendar, the weekly streak and "last time" prefills all pick
  it up. Imported sessions aren't tied to a routine day, so your split rotation doesn't
  move.
- Exercise names are matched against your catalog and the exercise library
  ("Bench Press (Barbell)" finds "Barbell Bench Press", "Bicep Curl (Dumbbell)" finds
  "Dumbbell Curl", "Overhead Press (Dumbbell)" finds "Dumbbell Shoulder Press");
  anything unrecognised becomes a custom exercise with its muscle and equipment guessed
  from the name, so no sets are dropped. Warm-up sets, rest-timer rows and rows
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
Back up to JSON instead; Settings → Export history (CSV) gives every logged set as a
spreadsheet, and the progress report is a printable PDF of the last 12 weeks.

## Moving data between the Android app and the web app

Export/import use the **same `BackupFile` v2 JSON** as the Android app, so data moves
both ways:

- **Android → Web:** export a backup from the Android app, then Settings → **Restore
  from JSON** here (full replace after confirm). Android's `userPrefs` fields
  (`socialHandle`, `socialColor`, `avatarPhoto`) are mapped onto the web profile.
- **Web → Android:** Settings → **Backup for the Android app** (downloads
  `gymdone-android-backup-<date>.json`), then import it in the Android app. It writes
  only the fields the Android schema has and Android's `userPrefs` field names.
  `exerciseMedia` is exported as `[]` and ignored on import (media uploads are out of
  scope on the web). **Back up to JSON** (`gymdone-backup-<date>.json`) is the complete
  web backup, web-only data included.

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
