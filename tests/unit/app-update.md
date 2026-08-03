## app-update.test.tsx

**Purpose:** Proves `useAppUpdate` reports a tab as stale only once the served build actually changes, and that its background reload fires exclusively for a tab that has been hidden past the dwell — a visible tab is never reloaded from under the pilot.
**File:** `tests/unit/app-update.test.tsx`

### Setup
- Renders with `react-dom/client` `createRoot` + React's `act` (sets `IS_REACT_ACT_ENVIRONMENT`). No `@testing-library/react` dependency.
- A `Probe` component calls `useAppUpdate(build)` and pushes each returned value into an array, so the test asserts on the latest.
- `document.visibilityState` is a getter spy backed by a mutable variable; the test flips it and dispatches a `visibilitychange` event.
- `location` is swapped wholesale via `vi.stubGlobal` because jsdom's `location.reload` is not configurable; the replacement's `reload` is a `vi.fn()`.
- Fake timers drive the dwell (`APP_UPDATE_IDLE_RELOAD_MS`).

### Cases
- **reports no update while the served build matches the loaded one** — same id twice.
- **ignores a nullish build** — a `null` first, then a real id, still reads as the baseline rather than a change.
- **reports an update once the served build changes, and stays reporting it** — a repeat of the new id does not clear it.
- **reloads a tab left hidden past the dwell once an update is pending**.
- **never reloads a visible tab** — four dwells of elapsed time with the tab visible.
- **cancels the pending reload when the pilot comes back before the dwell elapses**.
- **does not reload a hidden tab that is running the deployed build** — the dwell timer is armed by a pending update, not by hiding.

### Depends On
- `@/lib/appUpdate` (`useAppUpdate`), `aperture.config` (`APP_UPDATE_IDLE_RELOAD_MS`).
