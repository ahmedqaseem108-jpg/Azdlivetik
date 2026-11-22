import { useEffect } from 'react';
import { EffectsStage } from '../engines/EffectsStage';
import { useLiveStore } from '../store/useLiveStore';

interface Props {
  overlayId: string;
}

/**
 * Standalone 100% Transparent OBS Studio Browser Source (/overlay/:uniqueId)
 * - Transparent background (no control panel, no scrollbars, no dashboard chrome)
 * - Auto-connects via WebSocket to the backend room & updates instantaneously without OBS refresh
 * - Works even when Control Panel is open in another browser or device
 */
export function ObsOverlayView({ overlayId }: Props) {
  const initRoomSocket = useLiveStore((s) => s.initRoomSocket);

  useEffect(() => {
    document.documentElement.classList.add('obs-transparent');
    const cleanup = initRoomSocket(overlayId, 'overlay');
    return () => {
      cleanup();
      document.documentElement.classList.remove('obs-transparent');
    };
  }, [overlayId, initRoomSocket]);

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-transparent">
      <EffectsStage transparent className="h-full w-full" />
    </div>
  );
}
