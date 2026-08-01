## useDocumentPip.ts

**Purpose:** Client hook owning one Document Picture-in-Picture window's lifecycle — opens an OS-level always-on-top window, clones the opener's stylesheets + theme into it, and exposes it as a portal target.
**File:** `src/components/map/useDocumentPip.ts`

---

### useDocumentPip(): DocumentPipController
Returns a controller for a single PiP window. Reads `window.documentPictureInPicture` (Chromium 116+); on the server and in unsupporting browsers `isSupported` is false and `open()` is a no-op.

**Returns:** `DocumentPipController`:
- `pipWindow: Window | null` — the live PiP window (portal target via `createPortal(..., pipWindow.document.body)`), or null when closed.
- `isOpen: boolean` — `pipWindow !== null`.
- `isSupported: boolean` — Chromium-only capability flag. Resolved in a mount effect (not at render) so the server and first client render agree — avoids a hydration mismatch on a consumer's disabled state.
- `open(size?): Promise<void>` — `await window.documentPictureInPicture.requestWindow(...)`. **Must be called from a user gesture.** The size the user last resized the window to (persisted in `localStorage`) takes precedence over the `size` argument, which itself falls back to 320×420; the caller's `size` therefore only applies to the very first open on a given browser profile. Clones every `<style>` / `<link rel="stylesheet">` from `document.head` into the PiP document (dev = `<style>`, prod = `<link>`), mirrors `document.documentElement.className` (the `.dark` custom-variant class), and sets `body` to `bg-background text-foreground min-h-screen` so the dark surface fills the window. Wires the window's `pagehide` to clear state.
- `close(): void` — closes the window and clears state.

### Behaviour
- The window is closed on component unmount (a cleanup effect keyed on `pipWindow`), on explicit `close()`, and when the user closes the PiP chrome (`pagehide` clears state).
- Document PiP requires the opener tab to stay open; closing the opener closes the PiP automatically.
- The window's `resize` event is watched (debounced 300ms) and the current size is written to `localStorage` under `aperture:pip-window-size`, so the next `open()` — in this or a future session — restores it. Storage read/write failures (e.g. private browsing) are swallowed; the size just won't persist.

### Depends On
- `window.documentPictureInPicture` (declared inline — not yet in the DOM lib).
- `window.localStorage` for cross-session size persistence.
