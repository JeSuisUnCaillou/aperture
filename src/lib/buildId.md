## buildId.ts

**Purpose:** Reports the identity of the build the running process is serving, so a client can tell when the server it reconnected to is a different deployment.
**File:** `src/lib/buildId.ts`

---

### getBuildId(): string
The contents of `.next/BUILD_ID`, read once and cached for the process lifetime. Returns `'development'` when the file is absent or empty (`pnpm dev`, tests).

`next build` writes a fresh random id on every build, so the value changes on every deploy and is stable across a container restart of the same image.

The read is lazy, not at module scope: during `next build` the file on disk still holds the previous build's id.

**Returns:** The build id, or `'development'`.

### Notes
- No `import 'server-only'`: reachable from `wsServer.ts`, which is loaded by `server.ts` outside Next's bundler.
