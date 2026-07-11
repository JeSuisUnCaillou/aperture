import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransitSignaturePrompt } from '@/components/map/TransitSignaturePrompt';
import type { MapConnectionEdge, MapSignature, MapSystemNode } from '@/types';

// Capture the traversal callback the component registers so the test can fire a
// jump at it directly, standing in for a `characterUpdate` from the presence
// store. The real hook holds the callback in a ref; here we just keep the latest.
let traversalCb: ((t: { characterId: number; fromSystemId: number; toSystemId: number; at: string }) => void) | null =
  null;
vi.mock('@/components/map/MapPresenceContext', () => ({
  useTraversals: (cb: typeof traversalCb) => {
    traversalCb = cb;
  },
}));

// Empty catalog ⇒ typed sigs are treated as "leads anywhere", so a candidate
// always survives the class filter (class matching is covered by
// tests/transitCandidates.test.ts).
vi.mock('@/lib/map/client', () => ({
  fetchWormholeCatalog: async () => ({ ok: true, data: [] as unknown[] }),
}));

const SOURCE = 100;
const DEST = 200;

function system(id: string, systemId: number, name: string): MapSystemNode {
  return {
    id,
    systemId,
    name,
    alias: null,
    security: 'C3',
  } as unknown as MapSystemNode;
}

function whConnection(): MapConnectionEdge {
  return { id: 'conn-wh', source: 'src', target: 'dst', scope: 'wh' } as unknown as MapConnectionEdge;
}

function gateConnection(): MapConnectionEdge {
  return {
    id: 'conn-gate',
    source: 'src',
    target: 'dst',
    scope: 'stargate',
  } as unknown as MapConnectionEdge;
}

function sig(): MapSignature {
  return {
    id: 'sig-1',
    mapSystemId: 'src',
    mapConnectionId: null,
    sigId: 'ABC-123',
    groupKey: 'wormhole',
    classKind: null,
    typeId: 500,
    eolStage: 'none',
    wormholeCode: 'D845',
    name: null,
    description: null,
    expiresAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as MapSignature;
}

const systems = [system('src', SOURCE, 'J111111'), system('dst', DEST, 'J222222')];
const viewerCharacters = [{ id: 1, name: 'Pilot One' }];
const noop = () => {};

function render(root: Root, connections: MapConnectionEdge[]) {
  act(() => {
    root.render(
      <TransitSignaturePrompt
        systems={systems}
        connections={connections}
        signatures={[sig()]}
        viewerCharacters={viewerCharacters}
        onPatchSignature={noop}
        onConnectionPatch={noop}
      />,
    );
  });
}

function fireJump() {
  act(() => {
    traversalCb?.({ characterId: 1, fromSystemId: SOURCE, toSystemId: DEST, at: '2026-01-01T00:00:00.000Z' });
  });
}

describe('TransitSignaturePrompt buffered retry', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    traversalCb = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('opens once the connection lands even though the traversal fired first', () => {
    // Fold has not reached client state yet: no wh connection.
    render(root, []);
    fireJump();
    expect(container.textContent).not.toContain('ABC-123');

    // connection.create folds in — the resolver effect must retry and open.
    render(root, [whConnection()]);
    expect(container.textContent).toContain('ABC-123');
    expect(container.textContent).toContain('Pilot One');
  });

  it('stays silent for a gate jump even after the connection lands', () => {
    render(root, []);
    fireJump();
    // A stargate link between the two systems appears — a gate jump, never a WH transit.
    render(root, [gateConnection()]);
    expect(container.textContent).not.toContain('ABC-123');
  });

  it('gives up if the connection does not arrive within the TTL', () => {
    vi.useFakeTimers();
    render(root, []);
    fireJump();

    // The 3s buffer TTL elapses with no fold — the prune timer forgets the jump.
    act(() => vi.advanceTimersByTime(3100));

    // The fold arrives too late — nothing is left to show.
    render(root, [whConnection()]);
    expect(container.textContent).not.toContain('ABC-123');
  });

  it('keeps a shown prompt past the TTL until it is acted on', () => {
    vi.useFakeTimers();
    render(root, []);
    fireJump();
    render(root, [whConnection()]);
    expect(container.textContent).toContain('ABC-123');

    // The TTL bounds only the wait for the fold; once shown the prompt persists.
    // (Also asserts the prune timer doesn't busy-loop re-arming on a kept entry.)
    act(() => vi.advanceTimersByTime(10000));
    expect(container.textContent).toContain('ABC-123');
  });
});
