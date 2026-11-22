import { Check, Copy, ExternalLink, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { EffectsStage } from '../../engines/EffectsStage';
import { getT } from '../../shared/i18n';
import { pickRandomTestUser } from '../../shared/testPersonas';
import type { OverlayLayoutConfig, OverlayResolution } from '../../shared/types';
import { useLiveStore } from '../../store/useLiveStore';

export function ObsStudioPanel() {
  const language = useLiveStore((s) => s.language);
  const overlayId = useLiveStore((s) => s.overlayId);
  const overlayLayout = useLiveStore((s) => s.overlayLayout);
  const updateOverlayLayout = useLiveStore((s) => s.updateOverlayLayout);
  const regenerateOverlayId = useLiveStore((s) => s.regenerateOverlayId);
  const connectedOverlaysCount = useLiveStore((s) => s.connectedOverlaysCount);
  const triggerTestEvent = useLiveStore((s) => s.triggerTestEvent);

  const t = getT(language);
  const [copied, setCopied] = useState(false);

  const overlayUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/overlay/${overlayId}`
      : `/overlay/${overlayId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleRegenerate = () => {
    regenerateOverlayId();
  };

  const isVertical = overlayLayout.resolution === '1080x1920';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">{t.obs.title}</h1>
          <p className="mt-1 text-xs text-slate-400">{t.obs.subtitle}</p>
        </div>

        <div className="text-xs text-slate-400">
          <span>{t.obs.connectedInstances}:</span>{' '}
          <strong className="font-mono-num text-[#00D4FF]">{connectedOverlaysCount}</strong>
        </div>
      </div>

      {/* Shareable Unique Browser Source URL */}
      <div className="rounded-xl border border-[#7C3AED]/40 bg-[#11111B] p-5">
        <label className="mb-2 block text-xs font-bold text-white">{t.obs.overlayUrl}</label>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            type="text"
            readOnly
            value={overlayUrl}
            dir="ltr"
            className="font-mono-num min-w-0 flex-1 rounded-lg border border-white/10 bg-[#09090F] px-3.5 py-2.5 text-xs text-[#00D4FF] outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#7C3AED] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#6D28D9]"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t.control.copied : t.control.copyObsQuick}
            </button>
            <a
              href={`/overlay/${overlayId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-[#171726] px-4 py-2.5 text-xs font-semibold text-white transition hover:border-[#00D4FF]/50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t.control.openObsTab}
            </a>
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-[#171726] px-3.5 py-2.5 text-xs font-semibold text-slate-300 transition hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t.obs.regenerateId}
            </button>
          </div>
        </div>

        <ol className="mt-4 grid grid-cols-1 gap-2 border-t border-white/8 pt-4 text-xs text-slate-400 sm:grid-cols-3">
          <li>1. {t.obs.step1}</li>
          <li>2. {t.obs.step2}</li>
          <li>3. {t.obs.step3}</li>
        </ol>
      </div>

      {/* Controls + Resolution-Accurate Live Preview */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 rounded-xl border border-white/8 bg-[#11111B] p-5 lg:col-span-5">
          {/* Resolution Presets */}
          <div>
            <p className="mb-2.5 text-xs font-bold text-white">{t.obs.resolution}</p>
            <div className="space-y-2">
              {(
                [
                  { id: '1920x1080', label: t.obs.landscapeHD, icon: Monitor },
                  { id: '1080x1920', label: t.obs.verticalTikTok, icon: Smartphone },
                  { id: '1280x720', label: t.obs.hd720, icon: Monitor },
                ] as Array<{ id: OverlayResolution; label: string; icon: typeof Monitor }>
              ).map((res) => {
                const Icon = res.icon;
                const active = overlayLayout.resolution === res.id;
                return (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => updateOverlayLayout({ resolution: res.id })}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition ${
                      active
                        ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-white'
                        : 'border-white/6 bg-[#161624] text-slate-300 hover:border-white/15'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[#00D4FF]" />
                    <span>{res.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Independent Element Visibility Toggles */}
          <div className="border-t border-white/8 pt-4">
            <p className="mb-2.5 text-xs font-bold text-white">{t.obs.layersVisibility}</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: 'showEffects', ar: 'مؤثرات الهدايا', en: 'Gift Effects' },
                  { key: 'showTop3Podium', ar: 'منصة أفضل 3', en: 'Top 3 Podium' },
                  { key: 'showTop10List', ar: 'قائمة TOP 10', en: 'Top 10 List' },
                  { key: 'showComments', ar: 'التعليقات', en: 'Comments' },
                  { key: 'showAlerts', ar: 'التنبيهات', en: 'Alerts' },
                  { key: 'showLiveStats', ar: 'شريط الإحصائيات', en: 'Live Stats HUD' },
                ] as Array<{ key: keyof OverlayLayoutConfig; ar: string; en: string }>
              ).map((layer) => (
                <label
                  key={layer.key}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-white/6 bg-[#161624] px-3 py-2 text-xs text-slate-200"
                >
                  <span>{language === 'ar' ? layer.ar : layer.en}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(overlayLayout[layer.key])}
                    onChange={(e) => updateOverlayLayout({ [layer.key]: e.target.checked })}
                    className="h-4 w-4 accent-[#7C3AED]"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Scale & Offset Sliders */}
          <div className="space-y-3 border-t border-white/8 pt-4">
            <p className="text-xs font-bold text-white">{t.obs.positionScale}</p>

            <div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>{language === 'ar' ? 'حجم المؤثرات' : 'Effects Scale'}</span>
                <span className="font-mono-num">{overlayLayout.effectsScale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={overlayLayout.effectsScale}
                onChange={(e) => updateOverlayLayout({ effectsScale: Number(e.target.value) })}
                className="mt-1 w-full accent-[#7C3AED]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Offset X</span>
                  <span className="font-mono-num">{overlayLayout.effectsOffsetX}%</span>
                </div>
                <input
                  type="range"
                  min={-35}
                  max={35}
                  value={overlayLayout.effectsOffsetX}
                  onChange={(e) => updateOverlayLayout({ effectsOffsetX: Number(e.target.value) })}
                  className="mt-1 w-full accent-[#00D4FF]"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Offset Y</span>
                  <span className="font-mono-num">{overlayLayout.effectsOffsetY}%</span>
                </div>
                <input
                  type="range"
                  min={-35}
                  max={35}
                  value={overlayLayout.effectsOffsetY}
                  onChange={(e) => updateOverlayLayout({ effectsOffsetY: Number(e.target.value) })}
                  className="mt-1 w-full accent-[#00D4FF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {language === 'ar' ? 'موقع أفضل 3' : 'Podium Position'}
                </label>
                <select
                  value={overlayLayout.podiumPosition}
                  onChange={(e) =>
                    updateOverlayLayout({
                      podiumPosition: e.target.value as OverlayLayoutConfig['podiumPosition'],
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#09090F] px-2.5 py-2 text-xs text-white"
                >
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {language === 'ar' ? 'موقع التعليقات' : 'Comments Position'}
                </label>
                <select
                  value={overlayLayout.commentsPosition}
                  onChange={(e) =>
                    updateOverlayLayout({
                      commentsPosition: e.target.value as OverlayLayoutConfig['commentsPosition'],
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#09090F] px-2.5 py-2 text-xs text-white"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Live OBS Resolution Canvas Preview */}
        <div className="flex flex-col rounded-xl border border-white/8 bg-[#11111B] p-5 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-white">
              {language === 'ar' ? 'معاينة إطار OBS الشفاف' : 'Transparent OBS Frame Preview'} ({overlayLayout.resolution})
            </span>
            <button
              type="button"
              onClick={() =>
                triggerTestEvent({
                  type: 'gift',
                  user: pickRandomTestUser(),
                  giftId: 6369,
                  giftName: 'Lion',
                  diamondCount: 29999,
                  repeatCount: 1,
                  repeatEnd: true,
                  giftType: 0,
                })
              }
              className="whitespace-nowrap rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#6D28D9]"
            >
              {language === 'ar' ? 'إطلاق اختبار على OBS' : 'Fire Test on OBS'}
            </button>
          </div>

          <div
            className="flex flex-1 items-center justify-center rounded-xl border border-white/8 p-4"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #13131f 25%, transparent 25%), linear-gradient(-45deg, #13131f 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #13131f 75%), linear-gradient(-45deg, transparent 75%, #13131f 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              backgroundColor: '#0B0B12',
            }}
          >
            <div
              className={`relative overflow-hidden rounded-lg border border-[#00D4FF]/40 ${
                isVertical ? 'aspect-[9/16] h-[460px]' : 'aspect-video w-full'
              }`}
            >
              <EffectsStage transparent compact className="h-full w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
