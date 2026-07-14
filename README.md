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
  in-progress session (including the running rest timer) survives a page reload.
- **Profile** — total volume, body metrics with sparklines, per-exercise progression,
  an 18-week consistency heatmap, and a personal-records list.
- **Settings** — theme (system/light/dark), 10 accent palettes, kg/lbs, reset routine,
  cloud sync, and JSON export/import.

## Data storage

All app data lives in **your browser's `localStorage`** under the key
`get-gym-done:v1` (a single Zustand store persisted via its `persist` middleware).
Nothing is sent anywhere unless you configure cloud sync. Weights are stored
internally in **kilograms** and converted to your chosen unit only for display; times
are epoch milliseconds. Seed data (splits + exercise catalog) is loaded on first run.

Because storage is per-browser, clearing site data or switching browsers/devices
starts fresh — use **Export** or **Cloud Sync** to move your data.

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

## Notes / scope

Dropped from the Android app on the web port: the friends/social/Firebase layer, QR
codes, exercise-media file uploads, the debug screen, and OS push notifications
(rest-timer end still fires a Web Notification when the tab is hidden and permission
is granted). Everything is progressively enhanced and guarded behind feature checks,
so it degrades cleanly where an API is unavailable.
