import { useEffect } from 'react';
import { useLiveStore } from '../store/useLiveStore';
import { Canvas2DEffectsLayer } from './Canvas2DEffectsLayer';
import { CinematicOverlayLayer } from './CinematicOverlayLayer';
import { ThreeDStage } from './ThreeDStage';

interface Props {
  transparent?: boolean;
  compact?: boolean;
  className?: string;
}

export function EffectsStage({ transparent = false, compact = false, className = '' }: Props) {
  const activeEffects = useLiveStore((s) => s.activeEffects);
  const activeAlerts = useLiveStore((s) => s.activeAlerts);
  const liveComments = useLiveStore((s) => s.liveComments);
  const liveSupporters = useLiveStore((s) => s.liveSupporters);
  const testSupporters = useLiveStore((s) => s.testSupporters);
  const liveStats = useLiveStore((s) => s.liveStats);
  const testStats = useLiveStore((s) => s.testStats);
  const dataViewSource = useLiveStore((s) => s.dataViewSource);
  const connectionStatus = useLiveStore((s) => s.connection.status);
  const alertStyle = useLiveStore((s) => s.alertStyle);
  const overlayLayout = useLiveStore((s) => s.overlayLayout);
  const language = useLiveStore((s) => s.language);
  const pruneExpiredEffects = useLiveStore((s) => s.pruneExpiredEffects);

  // Tick effect queue expiration cleanly (only updates state when items expire/promote)
  useEffect(() => {
    const id = window.setInterval(() => {
      pruneExpiredEffects();
    }, 250);
    return () => clearInterval(id);
  }, [pruneExpiredEffects]);

  // In OBS transparent mode, automatically show live supporters when connected, otherwise test supporters when testing
  const useLive = transparent
    ? connectionStatus === 'connected' && liveSupporters.length > 0
      ? true
      : liveSupporters.length >= testSupporters.length && liveSupporters.length > 0
    : dataViewSource === 'live';

  const supporters = useLive ? liveSupporters : testSupporters;
  const stats = useLive ? liveStats : testStats;

  return (
    <div
      className={`relative overflow-hidden ${transparent ? 'bg-transparent' : 'bg-[#09090F]'} ${className}`}
    >
      {/* Subtle studio preview grid ONLY in dashboard preview — NEVER in transparent OBS overlay */}
      {!transparent && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 35%, rgba(124,58,237,0.16), transparent 62%), radial-gradient(circle at 80% 80%, rgba(0,212,255,0.09), transparent 50%), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 100% 100%, 36px 36px, 36px 36px',
          }}
        />
      )}

      {/* Layer 1: HTML5 Canvas 2D Physics & Particles Engine */}
      {overlayLayout.showEffects && (
        <Canvas2DEffectsLayer
          activeEffects={activeEffects}
          performanceMode={overlayLayout.performanceMode}
        />
      )}

      {/* Layer 2: Three.js WebGL 3D Gift Renderer (On-Demand — 0% CPU when idle) */}
      {overlayLayout.showEffects && (
        <ThreeDStage
          activeEffects={activeEffects}
          performanceMode={overlayLayout.performanceMode}
        />
      )}

      {/* Layer 3: GSAP + Motion Cinematic Cards, 3D Text, Podium, Comments & Alerts */}
      <CinematicOverlayLayer
        activeEffects={activeEffects}
        activeAlerts={activeAlerts}
        liveComments={liveComments}
        supporters={supporters}
        stats={stats}
        alertStyle={alertStyle}
        overlayLayout={overlayLayout}
        language={language}
        compact={compact}
      />
    </div>
  );
}
