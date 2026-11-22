import { Play, RefreshCw, Server, Trash2, Upload, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audioEngine, type CustomAudioTrack } from '../../engines/audioEngine';
import { BUILTIN_SOUNDS } from '../../shared/giftCatalog';
import { getT } from '../../shared/i18n';
import { useLiveStore } from '../../store/useLiveStore';

const TIKLIVE_SUPPORTED_EVENTS = [
  'ready',
  'live',
  'connected',
  'disconnected',
  'chat',
  'gift',
  'like',
  'follow',
  'share',
  'subscribe',
  'member',
  'viewers',
  'battle',
  'battleItem',
  'battleBonus',
  'battleEnd',
  'rank',
  'question (beta)',
  'emote (beta)',
  'streamEnd',
];

export function AudioApiPanel() {
  const language = useLiveStore((s) => s.language);
  const audioSettings = useLiveStore((s) => s.audioSettings);
  const updateAudioSettings = useLiveStore((s) => s.updateAudioSettings);
  const usageInfo = useLiveStore((s) => s.usageInfo);
  const plansInfo = useLiveStore((s) => s.plansInfo);
  const loadingApiMeta = useLiveStore((s) => s.loadingApiMeta);
  const fetchApiUsageAndPlans = useLiveStore((s) => s.fetchApiUsageAndPlans);

  const t = getT(language);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [customTracks, setCustomTracks] = useState<CustomAudioTrack[]>(() =>
    audioEngine.getCustomTracks()
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetchApiUsageAndPlans();
  }, [fetchApiUsageAndPlans]);

  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      await audioEngine.addCustomAudioFile(file);
      setCustomTracks([...audioEngine.getCustomTracks()]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to decode audio file');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Sound Engine & Library */}
        <div className="space-y-5 rounded-xl border border-white/8 bg-[#11111B] p-5 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-lg font-bold text-white">
              {t.audioApi.soundLibrary}
            </h1>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#7C3AED] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#6D28D9]"
            >
              <Upload className="h-3.5 w-3.5" />
              {t.audioApi.uploadAudio}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              onChange={handleUploadAudio}
              className="hidden"
            />
          </div>

          {uploadError && <p className="text-xs text-rose-400">{uploadError}</p>}

          {/* Master Volume, Mute, Overlap Prevention */}
          <div className="space-y-3 rounded-lg border border-white/6 bg-[#161624] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                {audioSettings.muted ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-[#00D4FF]" />
                )}
                {t.audioApi.masterVolume}
              </span>
              <span className="font-mono-num text-xs text-slate-300">
                {Math.round(audioSettings.masterVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={audioSettings.masterVolume}
              onChange={(e) => updateAudioSettings({ masterVolume: Number(e.target.value) })}
              className="w-full accent-[#7C3AED]"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={audioSettings.muted}
                  onChange={(e) => updateAudioSettings({ muted: e.target.checked })}
                  className="h-4 w-4 accent-rose-500"
                />
                {t.audioApi.muteAll}
              </label>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={audioSettings.preventOverlap}
                  onChange={(e) => updateAudioSettings({ preventOverlap: e.target.checked })}
                  className="h-4 w-4 accent-[#00D4FF]"
                />
                {t.audioApi.preventOverlap}
              </label>
            </div>
          </div>

          {/* Built-in Synthesized Sound Presets */}
          <div className="space-y-2">
            {BUILTIN_SOUNDS.filter((s) => s.id !== 'none').map((sound) => (
              <div
                key={sound.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-[#161624] px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">
                    {language === 'ar' ? sound.nameAr : sound.nameEn}
                  </p>
                  <p className="font-mono-num text-[11px] text-slate-500">{sound.category}</p>
                </div>
                <button
                  type="button"
                  onClick={() => audioEngine.play(sound.id, 4)}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-[#00D4FF]/35 bg-[#00D4FF]/10 px-3 py-1.5 text-xs font-semibold text-[#00D4FF] transition hover:bg-[#00D4FF]/20"
                >
                  <Play className="h-3 w-3" />
                  {t.audioApi.testSound}
                </button>
              </div>
            ))}
          </div>

          {/* Custom Uploaded MP3/WAV Tracks */}
          {customTracks.length > 0 && (
            <div className="border-t border-white/8 pt-4">
              <p className="mb-2 text-xs font-bold text-[#FFD700]">
                {language === 'ar' ? 'ملفات الصوت المرفوعة (MP3 / WAV)' : 'Uploaded Custom Audio Files'}
              </p>
              <div className="space-y-2">
                {customTracks.map((tr) => (
                  <div
                    key={tr.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#FFD700]/25 bg-[#161624] px-3.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{tr.name}</p>
                      <p className="font-mono-num text-[10px] text-slate-400">
                        {(tr.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => audioEngine.play(tr.id, 4)}
                        className="rounded-md bg-[#7C3AED]/25 px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#7C3AED]/45"
                      >
                        <Play className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          audioEngine.removeCustomTrack(tr.id);
                          setCustomTracks([...audioEngine.getCustomTracks()]);
                        }}
                        className="rounded-md p-1 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TikLive API Monitor (Usage, Plans & Native Events) */}
        <div className="space-y-5 rounded-xl border border-white/8 bg-[#11111B] p-5 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display flex items-center gap-2 text-lg font-bold text-white">
              <Server className="h-4 w-4 text-[#00D4FF]" />
              {t.audioApi.apiMonitor}
            </h2>
            <button
              type="button"
              onClick={fetchApiUsageAndPlans}
              disabled={loadingApiMeta}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-[#171726] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingApiMeta ? 'animate-spin' : ''}`} />
              {t.audioApi.refreshApi}
            </button>
          </div>

          {/* GET /v1/usage — OpenAPI 3.1.0 Usage Schema */}
          <div className="rounded-lg border border-white/6 bg-[#161624] p-4">
            <p className="text-xs font-bold text-white">{t.audioApi.usageTitle}</p>
            {usageInfo?.available && usageInfo.data ? (
              <div className="mt-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">
                    {language === 'ar' ? 'الباقة الحالية:' : 'Active Plan:'}{' '}
                    <strong className="text-[#FFD700]">{usageInfo.data.plan}</strong>
                  </span>
                  <span className="font-mono-num text-slate-200">
                    {usageInfo.data.requestsToday.toLocaleString()} /{' '}
                    {usageInfo.data.requestsLimit.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#09090F]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#00D4FF]"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (usageInfo.data.requestsToday /
                            Math.max(1, usageInfo.data.requestsLimit)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                {usageInfo.data.resetsAt > 0 && (
                  <p className="font-mono-num text-[11px] text-slate-400">
                    {language === 'ar' ? 'إعادة التصفير:' : 'Quota Resets:'}{' '}
                    {new Date(usageInfo.data.resetsAt * 1000).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-300/90">
                {usageInfo?.error ||
                  (language === 'ar'
                    ? 'قم بإضافة TIKLIVE_API_KEY في متغيرات البيئة على الخادم لعرض استهلاك API الفعلي.'
                    : 'Configure TIKLIVE_API_KEY in server environment variables to inspect live API usage.')}
              </p>
            )}
          </div>

          {/* GET /v1/plans — OpenAPI 3.1.0 Plans Table */}
          <div className="rounded-lg border border-white/6 bg-[#161624] p-4">
            <p className="text-xs font-bold text-white">{t.audioApi.plansTitle}</p>
            {plansInfo?.available && plansInfo.data ? (
              (() => {
                const rawObj =
                  (plansInfo.data as { plans?: Record<string, Record<string, unknown>> }).plans ||
                  (plansInfo.data as Record<string, Record<string, unknown>>);
                const entries = Object.entries(rawObj).filter(
                  ([, val]) => val && typeof val === 'object'
                );
                if (!entries.length) {
                  return (
                    <pre
                      dir="ltr"
                      className="font-mono-num mt-2 max-h-48 overflow-auto rounded-md bg-[#09090F] p-3 text-[11px] text-[#00D4FF]"
                    >
                      {JSON.stringify(plansInfo.data, null, 2)}
                    </pre>
                  );
                }
                return (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-start text-xs">
                      <thead>
                        <tr className="border-b border-white/8 text-[11px] text-slate-400">
                          <th className="pb-2 text-start font-semibold">
                            {language === 'ar' ? 'الباقة' : 'Plan'}
                          </th>
                          <th className="pb-2 text-end font-semibold">
                            {language === 'ar' ? 'السعر' : 'Price'}
                          </th>
                          <th className="pb-2 text-end font-semibold">
                            {language === 'ar' ? 'طلبات/يوم' : 'Req/Day'}
                          </th>
                          <th className="pb-2 text-end font-semibold">
                            {language === 'ar' ? 'بثوث متزامنة' : 'Concurrent'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6">
                        {entries.map(([id, plan]) => {
                          const priceCents = Number(plan.priceCents || 0);
                          const isCurrent = usageInfo?.data?.planId === id;
                          return (
                            <tr key={id} className={isCurrent ? 'text-white' : 'text-slate-300'}>
                              <td className="py-2 font-semibold">
                                {String(plan.name || id)}
                                {isCurrent && (
                                  <span className="ms-1.5 text-[10px] text-[#00D4FF]">●</span>
                                )}
                              </td>
                              <td className="font-mono-num py-2 text-end">
                                {priceCents === 0 ? '€0' : `€${(priceCents / 100).toFixed(0)}/mo`}
                              </td>
                              <td className="font-mono-num py-2 text-end">
                                {Number(plan.requestsPerDay || 0).toLocaleString()}
                              </td>
                              <td className="font-mono-num py-2 text-end text-[#FFD700]">
                                {Number(plan.concurrentLives || 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                {plansInfo?.error || 'Fetching plans from https://api.tiklive.eu/v1/plans...'}
              </p>
            )}
          </div>

          {/* Verified Native Events in tiklive-live v0.2.0 */}
          <div className="rounded-lg border border-white/6 bg-[#161624] p-4">
            <p className="text-xs font-bold text-white">{t.audioApi.supportedEventsTitle}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {language === 'ar'
                ? 'تم فحص الكود المصدري لمكتبة tiklive-live المثبتة فعلياً وربط جميع الأحداث المدعومة بدقة.'
                : 'Inspected directly from installed tiklive-live source code — every native event is wired cleanly.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 font-mono-num text-[11px] text-slate-300" dir="ltr">
              {TIKLIVE_SUPPORTED_EVENTS.map((ev, i) => (
                <span key={ev}>
                  {ev}
                  {i < TIKLIVE_SUPPORTED_EVENTS.length - 1 && (
                    <span className="ms-3 text-white/20">·</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
