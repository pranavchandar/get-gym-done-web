# Get Gym Done — Web · Full UI Teardown Report

**Session:** 2026-07-15 · Chromium (Playwright), 390×844 mobile viewport (+ 1280×800 desktop pass)
**Coverage:** splash → onboarding (all 3 steps, preset + build-my-own), Home/Today (stats, up-next, calendar, log activity, edit week), Day overview (exercises/warmup/switch/edit), Active workout (steppers, keypad, rest timer, reload persistence, add/replace/remove exercise, finish), Workout complete (PRs, volume, bodyweight log, confetti), Workouts tab, Profile (edit, body metrics, sparklines, heatmap, PRs), Settings (theme, 10 accents, kg/lbs, export/import, cloud sync, reset), invalid deep links, empty days, rest days, long inputs, desktop viewport.

Everything below is a task to fix, ordered by severity. File references point at the code responsible.

---

## P0 — Data loss

### 1. Import accepts any JSON object and silently wipes ALL user data
`parseBackup` only checks `typeof data === 'object'` (`src/backup/backup.ts:106`). Importing `{"not":"a backup"}` and confirming REPLACE erased every table (exercises: 0, splits: 0, sessions: 0), reset onboarding, dumped the user to the splash screen — and showed a **"Data imported" success toast**. All workout history, routine, and body metrics are unrecoverable (the seed catalog re-seeds on next load, user data does not).
**Fix:** validate `version === 2` and required array fields before enabling REPLACE; write an automatic safety export (download or localStorage backup) before applying; show an error toast for invalid files.

### 2. "Rest day" checkbox in Build Your Routine permanently deletes the day's exercises
`CustomizeRoutine.tsx:129` sets `exercises: []` when checked; unchecking restores the already-emptied array. Verified: check + uncheck on Push A → all 6 template exercises gone, no warning, no undo.
**Fix:** keep the exercise list in the draft and only hide it while `isRestDay` is true.

### 3. Days-per-week stepper roundtrip destroys trimmed days
`setDayCount` (`CustomizeRoutine.tsx:46`) pops days when shrinking and pushes empty `Day N` days when growing. Going 7 → 2 → 7 replaces the PPL template days 3–7 with empty days. No warning, no undo.
**Fix:** retain removed days in the draft for the lifetime of the screen; only drop them on commit.

---

## P1 — Bugs and broken flows

### 4. Scroll container never scrolls — scroll position bleeds across tabs and routes
`.screen-scroll { flex: 1; overflow-y: auto }` is missing `min-height: 0`, so it stretches to its content (measured 1456px in an 844px viewport) and the *whole* `.app-frame` scrolls instead. Consequences observed:
- Scroll position carries across navigation: locking in a routine landed on Home **pre-scrolled to the calendar** (shot `17`); Home scrolled to 677px → switching tabs left Workouts at 107px → switching back left Today at 107px. Tabs neither reset to top nor remember their own position.
- Mouse-wheel scrolling was unreliable in testing (worked on some screens, dead on others) — needs verification in headed desktop browsers.
**Fix:** add `min-height: 0` to `.screen`/`.screen-scroll` so each screen owns its scroll, and reset scroll (or restore per-tab) on tab/route change. `src/styles/global.css:128-129`.

### 5. Tapping ±30s on the rest timer permanently rewrites the default rest duration
`adjustRestTimer` writes `prefs.restSeconds = newDur` (`src/store/store.ts:539`). Verified: after one +30s, every later set says "120s rest" instead of 90s. There is **no rest-duration setting in Settings**, so users can't see or undo this.
**Fix:** apply ± to the running timer only; add an explicit "Default rest" setting in Settings → Workout.

### 6. Sets with 0 kg × 0 reps log without validation
Steppers and keypad allow 0; "Complete set" accepted `0 kg · 0 reps` (shot `31`). These pollute volume, PR detection, and progression suggestions.
**Fix:** require reps ≥ 1 to complete a set (weight 0 is legitimate for bodyweight movements — but then label it, see task 33).

### 7. Finishing a workout with entirely un-logged exercises is silent
"Finish workout" appears once the *current/last* exercise is done; other exercises can be untouched. Verified: finished with one exercise logged — completion screen simply says "1 exercises · 3 sets". No "2 exercises skipped" warning or confirm.
**Fix:** confirm dialog listing unfinished exercises before `finishWorkout()`.

### 8. No "workout in progress" indicator anywhere
Closing a workout (X) and returning Home shows the identical "START WORKOUT" card — no resume badge, no elapsed indicator, nothing in the tab bar. The session does resume on re-entry, but the user has no way to know it's alive.
**Fix:** swap the up-next CTA to "Resume workout · 12 min" (or banner) while `activeSession` exists.

### 9. Body-metric inputs accept absurd values
Logged body fat **300%** successfully; it renders in the tiles, history table, and sparkline (shot `57`). Bodyweight/muscle have no range checks either.
**Fix:** clamp/validate (e.g. fat 2–70%, weight 20–400 kg) with inline errors.

### 10. Empty training day is a dead end
A day with 0 exercises still shows an enabled **START WORKOUT** CTA (day overview) which lands on a terminal "NOTHING TO DO" screen (shots `77`/`78`). The "Add day" button in Edit Week creates exactly such days.
**Fix:** disable the CTA and replace it with "Add exercises" opening the edit sheet.

### 11. Placeholder assets shipped in the core flow
Splash hero is a striped box labeled "hero — athlete" (shot `01`); every exercise row shows a striped "gif" square (shot `25`); the workout screen has a 160px striped "illustration" hero (shot `27`).
**Fix:** add real artwork, or design an intentional fallback (e.g. MuscleMap silhouette / initial-based tile) and remove the placeholder labels.

### 12. Notification permission requested with zero context
`Notification.requestPermission()` fires on first workout mount (`ActiveWorkout.tsx:48-53`). A browser permission popup with no explanation is the classic way to get permanently denied.
**Fix:** ask after the first rest timer starts, with a one-line pre-prompt, or from Settings.

---

## P2 — UX and visual defects

### 13. Home header reset button: destructive action disguised as "refresh"
The ↺ icon top-right of Today opens "Reset routine" (`Home.tsx:117`). It reads as refresh/undo, sits in prime position, and is inconsistent with Settings → Reset routine, which **skips the confirmation dialog entirely** and jumps straight to pick-split.
**Fix:** remove it from the Home header (Settings already owns this), and give the Settings entry the confirm dialog.

### 14. "Swap" icon on the up-next card actually opens Day Overview
`Home.tsx:169-176` — the ⇄ button navigates to `/day/:id`. Same ⇄ icon on Day Overview means "switch day". Two meanings, one icon, no labels.
**Fix:** use a list/eye icon (or text "Preview") for day overview; keep ⇄ only for switch-day.

### 15. Onboarding copy references a PDF that doesn't exist
Step 2 subtitle: "Curate from your PDF, or assemble exercises day-by-day." (shot `05`). There is no PDF anywhere in the web app.
**Fix:** rewrite, e.g. "Use the preset as-is, or assemble exercises day-by-day."

### 16. Step progress bar appears only on step 1 of 3
Pick-split shows a progress track; Routine-method (step 2) and Customize (step 3) don't.
**Fix:** render the same progress track on all three, or drop it everywhere.

### 17. Splash theme toggle appears broken
The toggle label shows the *current* theme ("LIGHT"/"DARK") but the splash screen itself is hard-coded dark (`Splash.tsx`), so toggling visibly changes nothing on the screen you're looking at. First impression = broken control.
**Fix:** let the splash respect the theme, or restyle the toggle as an explicit "Dark mode: on/off" switch.

### 18. Pluralization and copy bugs
- Calendar header: "**1 sessions**" (shot `21`).
- Complete screen: "**1 exercises** · 3 sets · logged." — and the trailing "· logged." reads like a fragment (shot `38`).
- PR tile: "1 **PRs**".
- Volume tile shows the word "**NEW**" under the label "VOL" — meaningless to a first-timer (it means "no prior volume to compare"). Show the actual session volume ("360 kg") with a "first time" footnote instead.

### 19. lbs mode leaks raw conversions everywhere
With lbs selected: stepper prefills "**44.09 lbs**", keypad opens at 44.09, PR list shows "44.09 lbs" (shots `83`, profile). Stepping yields 46.59, 49.09…
**Fix:** round displayed lbs to 0.5 and snap prefications/steps to 2.5/5 lb increments (`src/domain/units.ts`).

### 20. Missing unit labels on stats
Home bodyweight tile shows bare "82.5" / "183.2"; Profile "TOTAL VOLUME 360" (kg? lbs? tonnage?). Add unit suffixes.

### 21. Light theme accent contrast failures
Lime accent text/icons on the light background are borderline invisible: active tab label, "Edit" text-links, accent labels (shot `63`). Several of the 10 accents (mono/white especially) will be worse.
**Fix:** define per-theme accent-on-background text colors and audit all 10 palettes in light mode (WCAG AA for text).

### 22. Replaced exercise is labeled "· ADDED"
After "Replace this exercise", the header reads "EXERCISE 1 · ADDED" (shot `35`). Either label it "REPLACED" or drop the tag.

### 23. Stale toasts stack over the completion screen
"Set 2 logged · 120s rest" and "Set 3 logged" were still stacked on top of the BACK HOME button on the completion screen (shot `38`).
**Fix:** clear the toast queue on navigation, or cap to one toast.

### 24. Confetti replays on later Home visits
`confettiArmed` persists until an animation completes fully; interrupted once, it re-fires on each Home mount (shots `41`, `51`, `63`).
**Fix:** consume the flag on first mount, not on animation end.

### 25. "This week" and "Streak" disagree
A logged run set STREAK to "1d" while THIS WEEK stayed "0/6" (shot `21`) — activities count for streak but not for the weekly counter, with no explanation. Also "THIS WEEK" is actually a rolling 7-day window (`Home.tsx:77`), not the calendar week.
**Fix:** align definitions (or label "LAST 7 DAYS") and document what feeds the streak.

### 26. Calendar limitations
- A day with both a workout and an activity shows only the workout tag (D1 beat RUN on the 15th).
- Past completed days aren't tappable — there is no session-detail view anywhere in the app, so logged history is effectively write-only.
- The legend explains Completed/Today but not activity tags (RUN, YOG…).
**Fix:** day-tap → session summary sheet listing that day's sessions; stack or dot multiple entries.

### 27. Workouts tab: exercise chips clipped mid-word
Preview chips are cut at the card edge ("Incline Dum…", "Face…") with no ellipsis or "+N more" (shot `43`).
**Fix:** `+N more` overflow chip or fade-out mask.

### 28. Custom exercise form: alphabetical defaults
"New exercise" defaults to Primary muscle = **Abductors**, Equipment = **Band** (first alphabetical options, shot `15`). Users who don't notice create miscategorized exercises (my test exercise landed under Abductors).
**Fix:** empty "Select…" state with required validation, or default to Chest/Barbell.

### 29. Profile name silently truncated at 20 characters
Typing a 43-char name saved "PRANAV CHANDRASEKARA" with no feedback (shot `57`).
**Fix:** show maxLength counter or allow longer names and ellipsize the display.

### 30. Warmup tab is boilerplate and its CTA lies
The 4 warmup steps are hard-coded for every day; for custom splits the focus interpolates the day name: "Dynamic stretch — **Push A**, 2 min" (`DayOverview.tsx:96`, muscleGroups is `[]` for custom splits — `store.ts:216`). And "Start warmup" actually starts the workout.
**Fix:** derive focus from the day's exercises' primary muscles; rename CTA or add a real warmup step-through.

### 31. Rest overlay blocks the whole screen
During rest you cannot edit the next set's weight/reps, review form cues, or scroll (shot `31`). ±30s/Skip only.
**Fix:** consider a collapsed pill/bottom-bar timer state that lets users interact while resting.

### 32. Rest-day overview layout broken
The bed icon is pinned to the far left while "DAY 4 OF 7 / REST DAY" and body copy are centered (shot `80`).
**Fix:** center the icon in the stack (`DayOverview.tsx:51`, `.center` doesn't center flex children).

### 33. Bodyweight-exercise weight semantics
Plank/Pull Up etc. prefill 20 kg like barbell moves; a "0 kg" bodyweight set is indistinguishable from a mistake (interacts with task 6).
**Fix:** per-equipment default (bodyweight → 0/‘BW’ display, weighted option "+kg").

### 34. Seed-data inconsistencies
"Machine / Decline Crunch" has `equipment: "Bodyweight"` (`seed_data.json:654`). Audit the 155-exercise catalog for equipment/muscle mismatches. Also the MuscleMap renders glutes/hamstrings as a thin 4px sliver between the legs — nearly invisible for the Glute-Focused split's audience.

### 35. Cloud sync error surfacing
Push with an unreachable network shows raw "**Failed to fetch**" (shot `67`). Map to human messages ("Couldn't reach GitHub — check your connection"; 401 → "Token rejected — check scopes"). Also "Never synced." + "No gist yet" duplicates state.

### 36. Session summary can't be revisited
`#/complete/:sessionId` is reachable only immediately after finishing; nothing links back to it later (ties to task 26). Old data exists but is invisible.

---

## P3 — Polish / housekeeping

### 37. React Router future-flag warnings on every load
`v7_startTransition` and `v7_relativeSplatPath` warnings in the console. Opt in to the future flags or pin the behavior.

### 38. "~11 min per exercise" duration estimate
`exs.length * 11` duplicated in Home and DayOverview; ignores set counts and rest duration. Compute from sets × (rest + ~40s) and centralize.

### 39. Day name persists when a customize-draft day is marked Rest
A rest day named "Push A" (shot `10`). Clear or grey the name field when `isRestDay`.

### 40. Empty routine name commits silently as "My Routine"
Fine as a fallback, but show the fallback in the input (placeholder-as-value) or validate inline before LOCK IT IN.

### 41. Toast for "workout day counts" (`COUNT AS TODAY'S WORKOUT`) is unexplained
The switch exists in Log Activity with no hint of consequences (it substitutes the whole scheduled day). Add helper text: "Marks Day 2 · Pull A as done."

### 42. Icon-only top bars on Day Overview
⇄ (switch day) and ✎ (edit) have aria-labels but no visible labels/tooltips; with task 14's icon collision, first-time comprehension is poor.

---

## What held up well

- Rest timer: wall-clock accurate, survives full page reload mid-countdown (verified 1:58 continuing after reload), ±30s/skip work.
- In-progress session persistence: logged sets, current exercise, and timer all resume after reload; finished state is clean.
- Rep-range steppers clamp correctly (rep-low can't exceed rep-high and vice versa).
- Invalid deep links (`/day/x`, `/workout/x`, `/complete/x`) all show graceful terminal screens.
- Export produces a faithful BackupFile v2 with Android field names; kg↔lbs conversion is mathematically correct end-to-end.
- Auto rest-day logic correctly skips when a session is already logged today; up-next correctly skips rest days.
- Exercise picker: fast search, sensible grouping, custom-exercise creation works, "No matches" empty state present.
- Desktop rendering: centered max-width column looks intentional.
