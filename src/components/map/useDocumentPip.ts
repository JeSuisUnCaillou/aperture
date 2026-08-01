'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

// Stable no-op subscription — capability never changes within a session.
const NEVER_CHANGES = () => () => {};

// Minimal typings for the Document Picture-in-Picture API (Chromium 116+). Not
// yet in the DOM lib, so we declare just the surface we use.
interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
}

interface DocumentPictureInPictureApi {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  readonly window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureApi;
  }
}

export interface DocumentPipController {
  /** The live PiP window, or null when closed. Portal target for overlay content. */
  pipWindow: Window | null;
  isOpen: boolean;
  /** Chromium-only; false on the server and in non-supporting browsers. */
  isSupported: boolean;
  open: (size?: { width?: number; height?: number }) => Promise<void>;
  close: () => void;
}

// Copy every stylesheet from the opener document into the PiP document so the
// portalled subtree renders with the same Tailwind utilities. Dev injects styles
// as <style>, prod as <link rel="stylesheet"> — clone both.
function cloneStyles(target: Window): void {
  const nodes = document.head.querySelectorAll('style, link[rel="stylesheet"]');
  for (const node of Array.from(nodes)) {
    target.document.head.appendChild(node.cloneNode(true));
  }
}

const PIP_SIZE_STORAGE_KEY = 'aperture:pip-window-size';

interface StoredPipSize {
  width: number;
  height: number;
}

// localStorage survives across sessions, unlike the PiP window itself which is
// torn down and recreated on every open() — it's the only place a remembered
// size can live.
function readStoredPipSize(): StoredPipSize | null {
  try {
    const raw = window.localStorage.getItem(PIP_SIZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as StoredPipSize).width === 'number' &&
      typeof (parsed as StoredPipSize).height === 'number'
    ) {
      return parsed as StoredPipSize;
    }
  } catch {
    // Malformed or inaccessible storage (e.g. private browsing) — fall back to defaults.
  }
  return null;
}

function writeStoredPipSize(size: StoredPipSize): void {
  try {
    window.localStorage.setItem(PIP_SIZE_STORAGE_KEY, JSON.stringify(size));
  } catch {
    // Storage unavailable — the size just won't persist to the next session.
  }
}

/**
 * Owns one Document Picture-in-Picture window's lifecycle. `open()` requests the
 * OS-level always-on-top window (must be called from a user gesture), clones the
 * opener's stylesheets and dark-mode class so portalled content is themed, and
 * fills the body with the app's dark surface. The window is closed on unmount,
 * on explicit `close()`, and its own chrome ✕ clears state via `pagehide`.
 */
export function useDocumentPip(): DocumentPipController {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  // `useSyncExternalStore` resolves false on the server and true (if supported)
  // on the client without a hydration mismatch on the button's disabled state.
  const isSupported = useSyncExternalStore(
    NEVER_CHANGES,
    () => 'documentPictureInPicture' in window,
    () => false,
  );

  const open = useCallback(async (size?: { width?: number; height?: number }) => {
    if (typeof window === 'undefined' || !window.documentPictureInPicture) return;
    // A remembered size (from the last time the user resized the window) always
    // wins over the caller's requested default.
    const stored = readStoredPipSize();
    const pip = await window.documentPictureInPicture.requestWindow({
      width: stored?.width ?? size?.width ?? 320,
      height: stored?.height ?? size?.height ?? 420,
    });
    cloneStyles(pip);
    // Mirror the .dark custom-variant class so themed tokens resolve identically.
    pip.document.documentElement.className = document.documentElement.className;
    // Fill the whole window with the app surface so transparent gaps don't flash white.
    pip.document.body.className = 'bg-background text-foreground min-h-screen';
    pip.addEventListener('pagehide', () => setPipWindow(null), { once: true });

    // Persist the live size on resize (debounced) so the next open() restores it.
    let resizeTimer: ReturnType<typeof setTimeout>;
    pip.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        writeStoredPipSize({ width: pip.innerWidth, height: pip.innerHeight });
      }, 300);
    });

    setPipWindow(pip);
  }, []);

  const close = useCallback(() => {
    setPipWindow((w) => {
      w?.close();
      return null;
    });
  }, []);

  // Close the PiP if the opener component unmounts (Document PiP keeps the window
  // alive otherwise, orphaning a now-empty portal target).
  useEffect(() => {
    return () => {
      pipWindow?.close();
    };
  }, [pipWindow]);

  return { pipWindow, isOpen: pipWindow !== null, isSupported, open, close };
}
