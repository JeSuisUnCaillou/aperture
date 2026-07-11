## JumpInfoDialog

**Purpose:** Static reference dialog for wormhole mass / lifetime / sig-strength and statics by source class.
**File:** `src/components/dialogs/JumpInfoDialog.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| open | boolean | yes | Controls dialog visibility |
| onOpenChange | (open: boolean) => void | yes | Open-state callback (owned by the parent menu) |

### Renders
Two sections inside a scrollable body:
- **Wormhole mass** — a table of every WH code with leads-to destination, total mass, jump mass, lifetime, sig strength.
- **Statics by source class** — the same rows grouped by `sourceClasses`; a multi-source hole (e.g. S199 in L+0.0) appears under each of its classes, an unspecified source (null) → "Any" (sorted last), each listing code → destination.

The "leads to" cell shows the pinned destination system name when the type has a fixed destination (J377 → Turnur), with its class muted in parentheses; otherwise the leads-to class, or an em-dash when neither is known.

### Behaviour & Interactions
- Lazy-loads `fetchWormholeJumpInfo()` (`@/lib/reference/client`) on first open; shows a loading then empty/loaded state. The client helper memoises, so reopens don't re-fetch.
- Mass is formatted in kilotonnes (kg ÷ 1e6), lifetime in hours (min ÷ 60), sig strength as a percentage.

### Depends On
- `fetchWormholeJumpInfo` — `@/lib/reference/client`
- `formatWormholeMass`, `formatWormholeLifetime` — `@/lib/eve/wormholeFormat`
- `WormholeJumpInfoRow` — `@/types`
- `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription` — `@/components/ui/dialog`
