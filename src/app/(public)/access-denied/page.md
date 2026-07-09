## AccessDeniedPage

**Purpose:** Landing page for a failed EVE sign-in — the `pages.error` target of the Auth.js login gate.
**File:** `src/app/(public)/access-denied/page.tsx`

### Renders
A centred heading and message with a `LoginButton` to retry, styled to match the landing page (`(public)/page.tsx`). Copy branches on the `error` query param:
- `error=AccessDenied` — "Access not granted", explaining the instance is invite-only.
- any other value (e.g. `Configuration`) — "Sign-in unavailable", a try-again message for a transient server fault.

### Behaviour & Interactions
- Reached when the `signIn` callback in `src/lib/auth.ts` returns false (→ `?error=AccessDenied`) or throws (a DB-down gate failure re-thrown as an `AuthError` → `?error=Configuration`).
- Reads `searchParams.error` (a Promise) to pick the copy; only `AccessDenied` shows the denial wording.
- Denial copy is intentionally generic — it does not disclose whether the instance is `restricted` or the character is simply unlisted.

### Depends On
- `LoginButton` — the retry CTA (`src/components/chrome/LoginButton.tsx`).
