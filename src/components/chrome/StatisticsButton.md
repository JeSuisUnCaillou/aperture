## StatisticsButton

**Purpose:** Header icon button that launches the Statistics dialog.
**File:** `src/components/chrome/StatisticsButton.tsx`

### Renders
A ghost `BarChart3` icon button; renders `StatisticsDialog` and owns its open-state.

### Behaviour & Interactions
- Reads `useCurrentMapScope()` and passes it as the dialog's `defaultScope`, so opening the dialog while viewing a corp/alliance map lands on that scope's tab.

### Depends On
- `StatisticsDialog`.
- `Button` UI primitive.
- `useCurrentMapScope` (`CurrentMapScopeContext`).
