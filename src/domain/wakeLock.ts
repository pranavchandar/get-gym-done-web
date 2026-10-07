import { useEffect } from 'react';

// Keeps the screen on while `enabled` — so the phone doesn't lock between sets. The
// browser drops the lock whenever the tab is hidden, so it is re-requested on return.
// Progressive enhancement: a no-op where the Screen Wake Lock API is missing.

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
}
interface WakeLockNavigator {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
}

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as WakeLockNavigator).wakeLock;
}

export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !wakeLockSupported()) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const s = await (navigator as WakeLockNavigator).wakeLock!.request('screen');
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        // Denied (battery saver, unfocused tab) — not worth surfacing.
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
