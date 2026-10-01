import { useEffect } from 'react';
import { useRunStore } from '@/stores/useRunStore';
import { keepScreenOn, watchPosition } from '@/lib/geolocation';

/**
 * Records GPS for the active run from anywhere in the app, so looking at
 * another screen mid-run doesn't stop the recording. Mounted once in the root
 * layout; renders nothing. The recorder screen only displays the run.
 */
export function RunTracker() {
  const status = useRunStore((s) => s.status);
  const addPoint = useRunStore((s) => s.addPoint);

  useEffect(() => {
    if (status !== 'recording') return;
    return watchPosition(
      (fix) => addPoint({ lat: fix.lat, lng: fix.lng, alt: fix.alt, acc: fix.acc, timestamp: fix.timestamp }),
      () => {
        // The recorder screen shows GPS problems; here we just keep listening.
      }
    );
  }, [status, addPoint]);

  // Browsers stop GPS when the screen turns off — keep it on while a run is under way.
  useEffect(() => {
    if (status === 'idle') return;
    return keepScreenOn();
  }, [status]);

  return null;
}
