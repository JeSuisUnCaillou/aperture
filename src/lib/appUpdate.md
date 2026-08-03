## appUpdate.ts

**Purpose:** Client hook that reports when the server has been redeployed under a still-open tab, and reloads that tab in the background once it has been hidden long enough for a reload to go unnoticed.
**File:** `src/lib/appUpdate.ts`

---

### useAppUpdate(observedBuild: string | null | undefined): boolean
Latches the first non-empty `observedBuild` it is handed as the build this page was loaded from, and flips to pending the moment a later value differs. Once pending it stays pending — the loaded bundle can only get staler.

While pending, the hook watches `visibilitychange`: after the tab has been continuously hidden for `APP_UPDATE_IDLE_RELOAD_MS` it calls `window.location.reload()`. The timer is cancelled the instant the tab becomes visible again, so a tab in front of the pilot is never reloaded out from under them; the caller's banner is what serves that case.

**Parameters:**
- `observedBuild` — the build id most recently reported by the server. Callers source it from the `healthCheck` envelope (session sockets) or the public snapshot response (spectator view). Nullish values are ignored, so a caller may pass one before the first report arrives.

**Returns:** Whether a newer build is deployed than the one this page is running.

### Tested by
- `tests/unit/app-update.test.tsx` — the latch (baseline, nullish tolerance, stickiness) and the dwell reload (hidden past the dwell reloads; visible never does; returning early cancels).
