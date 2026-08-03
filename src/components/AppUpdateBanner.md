## AppUpdateBanner

**Purpose:** Tells a pilot whose tab has been open across a deploy that they are running stale code, and offers a one-click reload.
**File:** `src/components/AppUpdateBanner.tsx`

### Renders
A banner strip with a short message and a Reload button, or nothing at all while the tab is running the deployed build.

### Behaviour & Interactions
- Reads the `build` id off every inbound `healthCheck` envelope; `useAppUpdate` latches the first one and flips the banner on when a later one differs.
- Reload is `window.location.reload()`. A tab left hidden long enough reloads itself without ever showing the banner (`useAppUpdate`).
- Must be mounted inside a `RealtimeProvider`.

### Depends On
- `useRealtimeEvents` — the envelope stream.
- `healthCheckLoadSchema` — validates the load before the build id is trusted.
- `useAppUpdate` — the stale-build latch and hidden-tab reload.
