import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apertureConfig } from '../../aperture.config';
import { useAppUpdate } from '@/lib/appUpdate';

// Drives `useAppUpdate` through a probe so the test can hand it build ids the
// way a heartbeat or a snapshot refetch would.
function Probe({ build, onResult }: { build: string | null; onResult: (v: boolean) => void }) {
  onResult(useAppUpdate(build));
  return null;
}

describe('useAppUpdate', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: boolean;
  let visibility: DocumentVisibilityState;
  let reload: ReturnType<typeof vi.fn>;

  function render(build: string | null): void {
    act(() => {
      root.render(
        <Probe
          build={build}
          onResult={(v) => {
            latest = v;
          }}
        />,
      );
    });
  }

  function setVisibility(next: DocumentVisibilityState): void {
    visibility = next;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.useFakeTimers();
    latest = false;
    visibility = 'visible';
    reload = vi.fn();
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    // jsdom's `location.reload` is not configurable, so the whole object is
    // swapped for the duration of the test.
    vi.stubGlobal('location', { ...window.location, reload });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reports no update while the served build matches the loaded one', () => {
    render('build-a');
    render('build-a');
    expect(latest).toBe(false);
  });

  it('ignores a nullish build so a caller may render before the first report', () => {
    render(null);
    expect(latest).toBe(false);
    // The first real value is the baseline, not a change.
    render('build-a');
    expect(latest).toBe(false);
  });

  it('reports an update once the served build changes, and stays reporting it', () => {
    render('build-a');
    render('build-b');
    expect(latest).toBe(true);
    render('build-b');
    expect(latest).toBe(true);
  });

  it('reloads a tab left hidden past the dwell once an update is pending', () => {
    render('build-a');
    render('build-b');

    setVisibility('hidden');
    act(() => {
      vi.advanceTimersByTime(apertureConfig.APP_UPDATE_IDLE_RELOAD_MS);
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads a visible tab', () => {
    render('build-a');
    render('build-b');

    act(() => {
      vi.advanceTimersByTime(apertureConfig.APP_UPDATE_IDLE_RELOAD_MS * 4);
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('cancels the pending reload when the pilot comes back before the dwell elapses', () => {
    render('build-a');
    render('build-b');

    setVisibility('hidden');
    act(() => {
      vi.advanceTimersByTime(apertureConfig.APP_UPDATE_IDLE_RELOAD_MS - 1000);
    });
    setVisibility('visible');
    act(() => {
      vi.advanceTimersByTime(apertureConfig.APP_UPDATE_IDLE_RELOAD_MS * 2);
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload a hidden tab that is running the deployed build', () => {
    render('build-a');

    setVisibility('hidden');
    act(() => {
      vi.advanceTimersByTime(apertureConfig.APP_UPDATE_IDLE_RELOAD_MS * 2);
    });
    expect(reload).not.toHaveBeenCalled();
  });
});
