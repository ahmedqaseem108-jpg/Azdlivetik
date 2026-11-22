import {
  Check,
  Copy,
  ExternalLink,
  Gift,
  Heart,
  Link2,
  MessageCircle,
  Power,
  Radio,
  Search,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { EffectsStage } from '../../engines/EffectsStage';
import { getT } from '../../shared/i18n';
import { pickRandomTestUser } from '../../shared/testPersonas';
import { useLiveStore } from '../../store/useLiveStore';
import { UserAvatar } from '../UserAvatar';

function formatDuration(connectedAt: number | null): string {
  if (!connectedAt) return '00:00:00';
  const sec = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000));
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function LiveControlPanel() {
  const language = useLiveStore((s) => s.language);
  const connection = useLiveStore((s) => s.connection);
  const liveStats = useLiveStore((s) => s.liveStats);
  const testStats = useLiveStore((s) => s.testStats);
  const dataViewSource = useLiveStore((s) => s.dataViewSource);
  const setDataViewSource = useLiveStore((s) => s.setDataViewSource);
  const recentEvents = useLiveStore((s) => s.recentEvents);
  const overlayId = useLiveStore((s) => s.overlayId);
  const overlayLayout = useLiveStore((s) => s.overlayLayout);
  const updateOverlayLayout = useLiveStore((s) => s.updateOverlayLayout);
  const connectTikTok = useLiveStore((s) => s.connectTikTok);
  const disconnectTikTok = useLiveStore((s) => s.disconnectTikTok);
  const checkLiveStatus = useLiveStore((s) => s.checkLiveStatus);
  const triggerTestEvent = useLiveStore((s) => s.triggerTestEvent);
  const connectedOverlaysCount = useLiveStore((s) => s.connectedOverlaysCount);

  const t = getT(language);
  const [usernameInput, setUsernameInput] = useState(connection.username || '');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [uptimeStr, setUptimeStr] = useState('00:00:00');

  useEffect(() => {
    if (connection.username && !usernameInput) {
      setUsernameInput(connection.username);
    }
  }, [connection.username, usernameInput]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setUptimeStr(formatDuration(liveStats.connectedAt));
    }, 1000);
    return () => clearInterval(id);
  }, [liveStats.connectedAt]);

  const isConnected =
    connection.status === 'connected' ||
    connection.status === 'waiting_live' ||
    connection.status === 'connecting';

  const activeStats = dataViewSource === 'live' ? liveStats : testStats;
  const filteredEvents = recentEvents.filter((e) => e.source === dataViewSource);
  const overlayUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/overlay/${overlayId}` : `/overlay/${overlayId}`;

  const cleanUsername = (raw: string) => {
    const urlMatch = raw.trim().match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i);
    const extracted = urlMatch?.[1] || raw.trim();
    return extracted.replace(/^@+/, '').split(/[/?#\s]/)[0].trim();
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanUsername(usernameInput);
    if (!clean) return;
    setUsernameInput(clean);
    setBusy(true);
    setFeedback(null);
    const res = await connectTikTok(clean);
    setBusy(false);
    if (!res.ok && res.error) {
      setFeedback({ kind: 'error', text: res.error });
    }
  };

  const handleCheck = async () => {
    const clean = cleanUsername(usernameInput);
    if (!clean) return;
    setUsernameInput(clean);
    setChecking(true);
    setFeedback(null);
    const res = await checkLiveStatus(clean);
    setChecking(false);
    if (!res.ok) {
      setFeedback({ kind: 'error', text: res.error || 'Error checking live status' });
    } else if (res.data) {
      const cacheNote = res.data.rateLimit?.cache ? ` · Cache: ${res.data.rateLimit.cache}` : '';
      setFeedback({
        kind: 'info',
        text: res.data.isLive
          ? language === 'ar'
            ? `@${res.data.username} يبث الآن (${res.data.viewerCount.toLocaleString()} مشاهد)${cacheNote}`
            : `@${res.data.username} is currently LIVE (${res.data.viewerCount.toLocaleString()} viewers)${cacheNote}`
          : language === 'ar'
            ? `@${res.data.username} غير متصل ببث مباشر حالياً${cacheNote}`
            : `@${res.data.username} is currently offline${cacheNote}`,
      });
    }
  };

  const handleCopyOverlay = async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const statusColor =
    connection.status === 'connected'
      ? 'text-emerald-400'
      : connection.status === 'waiting_live' || connection.status === 'connecting'
        ? 'text-amber-400'
        : connection.status === 'error'
          ? 'text-rose-400'
          : 'text-slate-400';

  return (
    <div className="space-y-6">
      {/* Server API Key Honest Notice when not yet configured */}
      {!connection.apiKeyConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/8 px-5 py-3.5 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-200">{t.control.apiKeyNoticeTitle}</p>
            <p className="mt-0.5 text-xs text-amber-200/80 leading-relaxed">
              {t.control.apiKeyNoticeBody}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDataViewSource('test');
              triggerTestEvent({
                type: 'gift',
                user: pickRandomTestUser(0),
                giftId: 5658,
                giftName: 'Galaxy',
                diamondCount: 1000,
                repeatCount: 1,
                repeatEnd: true,
                giftType: 0,
              });
            }}
            className="shrink-0 whitespace-nowrap rounded-lg bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#6D28D9]"
          >
            {language === 'ar' ? 'تجربة مؤثر المجرة الآن' : 'Preview Galaxy Effect'}
          </button>
        </div>
      )}

      {/* Connection Bar & Creator Card */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-xl border border-white/8 bg-[#11111B] p-5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold text-white">{t.control.title}</h1>
              <p className="mt-1 text-xs text-slate-400">{t.control.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Radio className={`h-3.5 w-3.5 ${statusColor}`} />
              <span className={statusColor}>
                {connection.reconnecting ? t.status.reconnecting : t.status[connection.status]}
              </span>
            </div>
          </div>

          <form onSubmit={handleConnect} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-sm font-semibold text-slate-500">
                @
              </span>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder={t.control.usernamePlaceholder}
                className="w-full rounded-lg border border-white/10 bg-[#09090F] py-2.5 pe-4 ps-8 text-sm text-white placeholder-slate-500 outline-none transition focus:border-[#7C3AED]"
              />
            </div>

            <button
              type="button"
              onClick={handleCheck}
              disabled={checking || !usernameInput.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-[#171726] px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#1E1E32] disabled:opacity-45"
            >
              <Search className="h-3.5 w-3.5" />
              {t.control.checkStatus}
            </button>

            {!isConnected ? (
              <button
                type="submit"
                disabled={busy || !usernameInput.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#7C3AED] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#7C3AED]/25 transition hover:bg-[#6D28D9] disabled:opacity-45"
              >
                <Radio className="h-3.5 w-3.5" />
                {busy ? t.status.connecting : t.control.connectLive}
              </button>
            ) : (
              <button
                type="button"
                onClick={disconnectTikTok}
                className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-rose-500"
              >
                <Power className="h-3.5 w-3.5" />
                {t.control.disconnect}
              </button>
            )}
          </form>

          {(feedback || connection.errorMessage) && (
            <p
              className={`mt-3 text-xs ${
                feedback?.kind === 'info' ? 'text-[#00D4FF]' : 'text-rose-400'
              }`}
            >
              {feedback?.text || connection.errorMessage}
            </p>
          )}
        </div>

        {/* Creator Profile & Quick OBS Link */}
        <div className="flex flex-col justify-between rounded-xl border border-white/8 bg-[#11111B] p-5 lg:col-span-4">
          <div className="flex items-center gap-3.5">
            <UserAvatar
              src={connection.creator?.avatar}
              name={connection.creator?.nickname || connection.username || 'TT'}
              sizeClass="h-12 w-12"
              ringClass={
                connection.creator?.isLive
                  ? 'ring-2 ring-emerald-400'
                  : 'ring-1 ring-white/15'
              }
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {connection.creator?.nickname ||
                  (connection.username ? `@${connection.username}` : language === 'ar' ? 'بانتظار اسم المستخدم' : 'Awaiting Creator')}
              </p>
              <p className="truncate text-xs text-slate-400">
                {connection.creator?.title ||
                  (connection.creator?.roomId
                    ? `Room #${connection.creator.roomId}`
                    : language === 'ar'
                      ? 'لا يتطلب تسجيل دخول أو Cookies'
                      : 'No TikTok login or cookies needed')}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/8 pt-3.5">
            <div className="min-w-0 text-xs text-slate-400">
              <span>OBS Overlay</span>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span className="font-mono-num text-[#00D4FF]">{connectedOverlaysCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyOverlay}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-[#171726] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-[#00D4FF]/50"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t.control.copied : t.control.copyObsQuick}
              </button>
              <a
                href={`/overlay/${overlayId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-white/10 bg-[#171726] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Tabular KPI Metrics Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-white/8 bg-[#11111B] p-1">
          <button
            type="button"
            onClick={() => setDataViewSource('live')}
            className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              dataViewSource === 'live'
                ? 'bg-[#7C3AED] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.control.realData}
          </button>
          <button
            type="button"
            onClick={() => setDataViewSource('test')}
            className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              dataViewSource === 'test'
                ? 'bg-[#00D4FF]/20 text-[#00D4FF]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.control.testData}
          </button>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs text-slate-300">
          <Zap className={`h-3.5 w-3.5 ${overlayLayout.performanceMode ? 'text-[#FFD700]' : 'text-slate-500'}`} />
          <span>{t.control.performanceMode}</span>
          <input
            type="checkbox"
            checked={overlayLayout.performanceMode}
            onChange={(e) => updateOverlayLayout({ performanceMode: e.target.checked })}
            className="h-4 w-4 accent-[#7C3AED]"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: t.control.viewers,
            value: (connection.creator?.viewerCount || activeStats.viewerCount).toLocaleString(),
            accent: 'text-[#00D4FF]',
          },
          {
            label: t.control.duration,
            value: uptimeStr,
            accent: 'text-white',
          },
          {
            label: t.control.giftsReceived,
            value: activeStats.giftsCount.toLocaleString(),
            accent: 'text-[#A78BFA]',
          },
          {
            label: t.control.supporters,
            value: activeStats.supportersCount.toLocaleString(),
            accent: 'text-emerald-400',
          },
          {
            label: t.control.totalPoints,
            value: activeStats.totalDiamonds.toLocaleString(),
            accent: 'text-[#FFD700]',
          },
          {
            label: t.control.eventsStream,
            value: activeStats.eventsReceived.toLocaleString(),
            accent: 'text-slate-200',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-white/8 bg-[#11111B] px-4 py-3.5">
            <p className="text-xs text-slate-400">{kpi.label}</p>
            <p className={`font-mono-num mt-1.5 text-xl font-bold ${kpi.accent}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Main Split: Live Visual Effects Stage (Left/Start 8 cols) + Live Events Stream (Right/End 4 cols) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col overflow-hidden rounded-xl border border-white/8 bg-[#11111B] lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#7C3AED]" />
              <h2 className="text-sm font-bold text-white">{t.control.stageTitle}</h2>
              <span className="text-xs text-slate-500">· {overlayLayout.resolution}</span>
            </div>

            {/* One-click quick test triggers right on the stage header */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: language === 'ar' ? 'وردة' : 'Rose', giftId: 5655, name: 'Rose', cost: 1 },
                { label: language === 'ar' ? 'المجرة' : 'Galaxy', giftId: 5658, name: 'Galaxy', cost: 1000 },
                { label: language === 'ar' ? 'الأسد' : 'Lion', giftId: 6369, name: 'Lion', cost: 29999 },
                { label: language === 'ar' ? 'الكون' : 'Universe', giftId: 6646, name: 'TikTok Universe', cost: 44999 },
              ].map((g) => (
                <button
                  key={g.giftId}
                  type="button"
                  onClick={() => {
                    setDataViewSource('test');
                    triggerTestEvent({
                      type: 'gift',
                      user: pickRandomTestUser(),
                      giftId: g.giftId,
                      giftName: g.name,
                      diamondCount: g.cost,
                      repeatCount: 1,
                      repeatEnd: true,
                      giftType: 0,
                    });
                  }}
                  className="whitespace-nowrap rounded-md border border-white/10 bg-[#171726] px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-[#7C3AED] hover:text-white"
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <EffectsStage compact className="aspect-video w-full min-h-[360px]" />
        </div>

        {/* Real-Time Event Feed */}
        <div className="flex h-[440px] flex-col rounded-xl border border-white/8 bg-[#11111B] lg:col-span-4 lg:h-auto lg:max-h-[520px]">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <h2 className="text-sm font-bold text-white">{t.control.liveFeed}</h2>
            <span className="font-mono-num text-xs text-slate-400">
              {filteredEvents.length}
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {filteredEvents.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center text-xs text-slate-500">
                <Link2 className="mb-2 h-6 w-6 text-slate-600" />
                <p>{t.control.noEvents}</p>
              </div>
            ) : (
              filteredEvents.slice(0, 40).map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2.5 rounded-lg border border-white/6 bg-[#0D0D17] px-3 py-2 text-xs"
                >
                  <UserAvatar src={ev.user.avatar} name={ev.user.nickname} sizeClass="h-7 w-7 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-white">{ev.user.nickname}</span>
                      <span className="font-mono-num shrink-0 text-[10px] text-slate-500">
                        {new Date(ev.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-slate-300">
                      {ev.type === 'gift' && (
                        <>
                          <Gift className="h-3 w-3 shrink-0 text-[#FFD700]" />
                          <span className="truncate">
                            {ev.giftName || `Gift #${ev.giftId}`} ×{ev.repeatCount || 1} (
                            {((ev.diamondCount || 0) * (ev.repeatCount || 1)).toLocaleString()})
                          </span>
                        </>
                      )}
                      {ev.type === 'chat' && (
                        <>
                          <MessageCircle className="h-3 w-3 shrink-0 text-[#00D4FF]" />
                          <span className="truncate">{ev.message}</span>
                        </>
                      )}
                      {ev.type === 'follow' && (
                        <>
                          <UserPlus className="h-3 w-3 shrink-0 text-emerald-400" />
                          <span>{language === 'ar' ? 'متابع جديد' : 'New Follower'}</span>
                        </>
                      )}
                      {ev.type === 'like' && (
                        <>
                          <Heart className="h-3 w-3 shrink-0 text-pink-400" />
                          <span>+{ev.likeCount || 1} Likes</span>
                        </>
                      )}
                      {ev.type === 'top10_enter' && (
                        <>
                          <Trophy className="h-3 w-3 shrink-0 text-[#FFD700]" />
                          <span className="text-[#FFD700]">
                            TOP 10 #{ev.rank} ({ev.totalPoints?.toLocaleString()})
                          </span>
                        </>
                      )}
                      {(ev.type === 'share' || ev.type === 'subscribe' || ev.type === 'member') && (
                        <>
                          <Users className="h-3 w-3 shrink-0 text-[#A78BFA]" />
                          <span className="capitalize">{ev.type}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
