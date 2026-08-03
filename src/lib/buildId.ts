import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Identity of the build this process is serving. `next build` writes a fresh
 * random `.next/BUILD_ID` every time, so it changes on every deploy and stays
 * put across a bare container restart — a restart is not something a client
 * needs to reload for.
 */

const DEV_BUILD_ID = 'development';

let cached: string | null = null;

export function getBuildId(): string {
  if (cached !== null) return cached;
  try {
    // Read lazily rather than at module scope: during `next build` the file on
    // disk still belongs to the previous build.
    cached = readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim() || DEV_BUILD_ID;
  } catch {
    cached = DEV_BUILD_ID;
  }
  return cached;
}
