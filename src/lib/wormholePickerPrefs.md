## wormholePickerPrefs.ts

**Purpose:** Client-only localStorage read/write for the wormhole-type picker's display preference, exposed as a subscribable store so a change applies to open pickers immediately.
**File:** `src/lib/wormholePickerPrefs.ts`

---

### WhPickerPrefs
`{ grouped: boolean }`. `grouped` switches `WormholeTypeSelect` between semantic category groups and a flat alphabetical list; the grouped view always orders the wandering and frig-hole sections by destination class.

### DEFAULT_WH_PICKER_PREFS
`{ grouped: true }` — the grouped view is the default.

### WH_PICKER_PREFS_KEY
The localStorage key (`'aperture:wh-picker:prefs'`) holding the JSON blob.

---

### readWhPickerPrefs(): WhPickerPrefs
Returns the current prefs, reading and JSON-parsing the localStorage blob on first call and falling back to the default per field on any missing/mistyped value or parse/storage error. Returns a cached, reference-stable value between calls (suitable as a `useSyncExternalStore` snapshot); the cache is refreshed by `writeWhPickerPrefs`.

### getServerWhPickerPrefs(): WhPickerPrefs
Server snapshot for `useSyncExternalStore` — always `DEFAULT_WH_PICKER_PREFS`.

### writeWhPickerPrefs(prefs: WhPickerPrefs): void
JSON-stringifies and persists the prefs (swallowing storage errors), updates the cache, and notifies all subscribers.

### subscribeWhPickerPrefs(listener: () => void): () => void
Registers a change listener; returns an unsubscribe function.
