import gsap from 'gsap';
import { Crown, Diamond, Flame, Heart, MessageCircle, Share2, Sparkles, Trophy, UserPlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { UserAvatar } from '../components/UserAvatar';
import type {
  AlertStyleConfig,
  Language,
  LiveEventPayload,
  OverlayLayoutConfig,
  SessionStats,
  SupporterEntry,
} from '../shared/types';
import type { ActiveEffectInstance, AlertToastItem } from '../store/useLiveStore';

interface Props {
  activeEffects: ActiveEffectInstance[];
  activeAlerts: AlertToastItem[];
  liveComments: LiveEventPayload[];
  supporters: SupporterEntry[];
  stats: SessionStats;
  alertStyle: AlertStyleConfig;
  overlayLayout: OverlayLayoutConfig;
  language: Language;
  compact?: boolean;
}

function positionToAlign(pos: string): string {
  switch (pos) {
    case 'top':
      return 'items-start justify-center pt-10';
    case 'bottom':
      return 'items-end justify-center pb-12';
    case 'top-left':
      return 'items-start justify-start p-8';
    case 'top-right':
      return 'items-start justify-end p-8';
    case 'bottom-left':
      return 'items-end justify-start p-8';
    case 'bottom-right':
      return 'items-end justify-end p-8';
    default:
      return 'items-center justify-center';
  }
}

function cornerClass(pos: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'): string {
  switch (pos) {
    case 'top-left':
      return 'top-4 left-4';
    case 'top-right':
      return 'top-4 right-4';
    case 'bottom-left':
      return 'bottom-4 left-4';
    case 'bottom-right':
      return 'bottom-4 right-4';
  }
}

function GiftSpotlightCard({
  instance,
  language,
}: {
  instance: ActiveEffectInstance;
  language: Language;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { event, config, streakCount } = instance;
  const allTypes = new Set([config.primaryEffect, ...config.secondaryEffects]);
  const isLegendary = config.primaryEffect === 'legendary' || config.priority >= 4;
  const showAvatarEntrance = allTypes.has('avatar_entrance') || isLegendary;
  const show3DText = allTypes.has('3d_floating_text') || isLegendary;

  useEffect(() => {
    if (!cardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { scale: 0.72, y: 38, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.6)' }
      );
    });
    return () => ctx.revert();
  }, [instance.instanceId]);

  const giftLabel =
    language === 'ar'
      ? config.giftNameAr || event.giftName || config.giftName
      : event.giftName || config.giftName;

  const totalDiamonds = (event.diamondCount || config.diamondCost || 1) * streakCount;

  return (
    <div
      ref={cardRef}
      className="pointer-events-none flex flex-col items-center gap-3 text-center"
      style={{
        transform: `scale(${Math.min(1.35, Math.max(0.75, config.scale))})`,
      }}
    >
      {/* Avatar Entrance Animation */}
      {showAvatarEntrance && (
        <div className="relative flex items-center justify-center">
          <div
            className="absolute -inset-3 rounded-full opacity-75 blur-md"
            style={{
              background: `conic-gradient(from 0deg, ${config.primaryColor}, ${config.secondaryColor}, ${config.primaryColor})`,
            }}
          />
          <div
            className="relative rounded-full p-1"
            style={{
              background: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})`,
            }}
          >
            <UserAvatar
              src={event.user.avatar}
              name={event.user.nickname}
              sizeClass={isLegendary ? 'h-20 w-20' : 'h-16 w-16'}
              ringClass="ring-2 ring-[#09090F]"
            />
          </div>
          {isLegendary && (
            <div className="absolute -top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#FFD700] text-[#09090F] shadow-lg">
              <Crown className="h-4 w-4" />
            </div>
          )}
        </div>
      )}

      {/* 3D Floating Perspective Text */}
      {show3DText && (
        <div className="relative select-none" style={{ perspective: '700px' }}>
          <div
            className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
            style={{
              transform: 'rotateX(12deg)',
              backgroundImage: `linear-gradient(180deg, #FFFFFF 0%, ${config.primaryColor} 58%, ${config.secondaryColor} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(0 6px 18px ${config.primaryColor}88)`,
            }}
          >
            {giftLabel} {streakCount > 1 ? `×${streakCount}` : ''}
          </div>
        </div>
      )}

      {/* Animated Broadcast Gift Card */}
      <div
        className="relative overflow-hidden rounded-2xl border px-5 py-3 shadow-2xl"
        style={{
          backgroundColor: 'rgba(13, 13, 24, 0.88)',
          borderColor: `${config.primaryColor}88`,
          boxShadow: `0 12px 42px -8px ${config.primaryColor}55`,
          minWidth: isLegendary ? '340px' : '270px',
        }}
      >
        {/* Metallic sheen sweep */}
        <div
          className="animate-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 opacity-25"
          style={{
            background: `linear-gradient(90deg, transparent, ${config.secondaryColor}, transparent)`,
          }}
        />

        <div className="relative flex items-center gap-3.5">
          {!showAvatarEntrance && (
            <UserAvatar
              src={event.user.avatar}
              name={event.user.nickname}
              sizeClass="h-12 w-12"
              ringClass="ring-2 ring-white/20"
            />
          )}

          <div className="min-w-0 flex-1 text-start">
            <div className="flex items-center gap-2">
              {isLegendary && <Flame className="h-4 w-4 shrink-0 text-[#FFD700]" />}
              <p className="truncate text-base font-bold text-white">{event.user.nickname}</p>
            </div>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-300">
              <span style={{ color: config.secondaryColor }} className="font-semibold">
                {giftLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num inline-flex items-center gap-1 text-[#FFD700]">
                <Diamond className="h-3 w-3" />
                {totalDiamonds.toLocaleString()}
              </span>
            </p>
          </div>

          <div
            className="font-mono-num flex shrink-0 items-center justify-center rounded-xl px-3 py-1.5 text-lg font-extrabold text-white"
            style={{
              background: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})`,
            }}
          >
            ×{streakCount}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CinematicOverlayLayer({
  activeEffects,
  activeAlerts,
  liveComments,
  supporters,
  stats,
  alertStyle,
  overlayLayout,
  language,
  compact = false,
}: Props) {
  const top3 = supporters.slice(0, 3);
  const top10 = supporters.slice(0, 10);
  const textDir =
    alertStyle.direction === 'auto'
      ? language === 'ar'
        ? 'rtl'
        : 'ltr'
      : alertStyle.direction;

  const fontStack =
    alertStyle.fontFamily === 'Outfit'
      ? '"Outfit", "Cairo", sans-serif'
      : alertStyle.fontFamily === 'JetBrains Mono'
        ? '"JetBrains Mono", "Cairo", monospace'
        : '"Cairo", "Outfit", sans-serif';

  const podiumColors = [
    {
      label: language === 'ar' ? 'الأول' : '1ST',
      ring: 'ring-2 ring-[#FFD700]',
      bg: 'from-[#FFD700]/25 via-[#171726]/90 to-[#11111B]/95',
      border: 'border-[#FFD700]/55',
      text: 'text-[#FFD700]',
    },
    {
      label: language === 'ar' ? 'الثاني' : '2ND',
      ring: 'ring-2 ring-slate-300',
      bg: 'from-slate-300/20 via-[#171726]/90 to-[#11111B]/95',
      border: 'border-slate-300/40',
      text: 'text-slate-200',
    },
    {
      label: language === 'ar' ? 'الثالث' : '3RD',
      ring: 'ring-2 ring-amber-600',
      bg: 'from-amber-600/25 via-[#171726]/90 to-[#11111B]/95',
      border: 'border-amber-600/45',
      text: 'text-amber-400',
    },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 20, fontFamily: fontStack }}
      dir={textDir}
    >
      {/* 1. Active Gift Spotlight / Cards / 3D Text / Avatar Entrance */}
      {overlayLayout.showEffects && (
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${overlayLayout.effectsOffsetX}%, ${overlayLayout.effectsOffsetY}%) scale(${overlayLayout.effectsScale})`,
            transformOrigin: 'center center',
          }}
        >
          <AnimatePresence>
            {activeEffects.map((item) => (
              <motion.div
                key={item.instanceId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -16 }}
                transition={{ duration: 0.35 }}
                className={`absolute inset-0 flex ${positionToAlign(item.config.position)}`}
              >
                <div className={item.config.use3D ? 'mt-44 sm:mt-52' : ''}>
                  <GiftSpotlightCard instance={item} language={language} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 2. Top 3 Royal Podium (Animated Gold / Silver / Bronze) */}
      {overlayLayout.showTop3Podium && top3.length > 0 && (
        <div
          className={`absolute ${cornerClass(overlayLayout.podiumPosition)} flex flex-col gap-2`}
          style={{
            transform: `scale(${compact ? overlayLayout.podiumScale * 0.82 : overlayLayout.podiumScale})`,
            transformOrigin: overlayLayout.podiumPosition.includes('right') ? 'top right' : 'top left',
            width: compact ? '230px' : '275px',
          }}
        >
          <div className="flex items-center justify-between px-1 text-xs font-bold tracking-wide text-slate-200">
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-[#FFD700]" />
              {language === 'ar' ? 'أفضل 3 داعمين' : 'TOP 3 SUPPORTERS'}
            </span>
          </div>
          <AnimatePresence mode="popLayout">
            {top3.map((sup, idx) => {
              const style = podiumColors[idx];
              return (
                <motion.div
                  key={sup.userId}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25 }}
                  className={`flex items-center gap-2.5 rounded-xl border bg-gradient-to-r px-3 py-2 shadow-lg ${style.bg} ${style.border}`}
                >
                  <span className={`font-mono-num w-6 text-center text-xs font-extrabold ${style.text}`}>
                    #{idx + 1}
                  </span>
                  <UserAvatar src={sup.avatar} name={sup.nickname} sizeClass="h-8 w-8" ringClass={style.ring} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{sup.nickname}</p>
                    <p className="truncate text-[11px] text-slate-400">{sup.lastGiftName}</p>
                  </div>
                  <div className={`font-mono-num text-xs font-bold ${style.text}`}>
                    {sup.totalPoints.toLocaleString()}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* 3. Optional Full Top 10 List Overlay */}
      {overlayLayout.showTop10List && top10.length > 0 && (
        <div
          className="absolute left-4 top-4 w-64 rounded-xl border border-white/10 bg-[#0C0C16]/88 p-3 shadow-xl"
          style={{ transform: `scale(${compact ? 0.8 : 1})`, transformOrigin: 'top left' }}
        >
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#FFD700]">
            <span>{language === 'ar' ? 'قائمة TOP 10' : 'TOP 10 LEADERBOARD'}</span>
            <span className="font-mono-num text-slate-400">{top10.length}/10</span>
          </div>
          <div className="space-y-1">
            {top10.map((s) => (
              <div key={s.userId} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono-num w-5 text-slate-400">#{s.rank}</span>
                <span className="flex-1 truncate text-slate-100">{s.nickname}</span>
                <span className="font-mono-num font-semibold text-[#00D4FF]">
                  {s.totalPoints.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Optional Live Stats HUD */}
      {overlayLayout.showLiveStats && (
        <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-white/10 bg-[#0C0C16]/88 px-4 py-2 text-xs text-slate-200 shadow-lg">
          <span className="font-mono-num">
            {language === 'ar' ? 'الهدايا:' : 'Gifts:'}{' '}
            <strong className="text-white">{stats.giftsCount.toLocaleString()}</strong>
          </span>
          <span aria-hidden="true" className="text-white/20">·</span>
          <span className="font-mono-num">
            {language === 'ar' ? 'النقاط:' : 'Points:'}{' '}
            <strong className="text-[#FFD700]">{stats.totalDiamonds.toLocaleString()}</strong>
          </span>
          <span aria-hidden="true" className="text-white/20">·</span>
          <span className="font-mono-num">
            {language === 'ar' ? 'الإعجابات:' : 'Likes:'}{' '}
            <strong className="text-[#00D4FF]">{stats.totalLikes.toLocaleString()}</strong>
          </span>
        </div>
      )}

      {/* 5. Alerts Stack (Top 10 Entry, Follow, Share, Subscribe, Likes, Member) */}
      {overlayLayout.showAlerts && activeAlerts.length > 0 && (
        <div className="absolute left-1/2 top-16 flex w-[340px] max-w-[90%] -translate-x-1/2 flex-col gap-2">
          <AnimatePresence>
            {activeAlerts.slice(0, 3).map(({ id, event }) => {
              const isTop10 = event.type === 'top10_enter';
              const icon =
                event.type === 'top10_enter' ? (
                  <Trophy className="h-4 w-4 text-[#FFD700]" />
                ) : event.type === 'follow' ? (
                  <UserPlus className="h-4 w-4 text-[#00D4FF]" />
                ) : event.type === 'share' ? (
                  <Share2 className="h-4 w-4 text-emerald-400" />
                ) : event.type === 'subscribe' ? (
                  <Crown className="h-4 w-4 text-[#FFD700]" />
                ) : event.type === 'like' ? (
                  <Heart className="h-4 w-4 text-pink-400" />
                ) : (
                  <Sparkles className="h-4 w-4 text-[#7C3AED]" />
                );

              const label =
                event.type === 'top10_enter'
                  ? language === 'ar'
                    ? `دخل قائمة TOP 10 في المركز #${event.rank || 1}!`
                    : `Entered TOP 10 at Rank #${event.rank || 1}!`
                  : event.type === 'follow'
                    ? language === 'ar'
                      ? 'بدأ بمتابعة البث الآن'
                      : 'Just followed the LIVE'
                    : event.type === 'share'
                      ? language === 'ar'
                        ? 'شارك البث المباشر'
                        : 'Shared the LIVE stream'
                      : event.type === 'subscribe'
                        ? language === 'ar'
                          ? 'اشترك كعضو مميز في البث!'
                          : 'Subscribed to the channel!'
                        : event.type === 'like'
                          ? language === 'ar'
                            ? `أرسل ${event.likeCount || 1} إعجاب`
                            : `Sent ${event.likeCount || 1} likes`
                          : language === 'ar'
                            ? 'انضم إلى البث'
                            : 'Joined the LIVE';

              return (
                <motion.div
                  key={id}
                  initial={
                    alertStyle.animationStyle === 'scale'
                      ? { opacity: 0, scale: 0.78 }
                      : { opacity: 0, y: -18 }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14, scale: 0.92 }}
                  transition={{ duration: 0.28 }}
                  className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-xl"
                  style={{
                    backgroundColor: isTop10 ? 'rgba(28, 20, 48, 0.94)' : `${alertStyle.backgroundColor}E6`,
                    borderColor: isTop10 ? '#FFD700' : `${alertStyle.accentColor}88`,
                    color: alertStyle.textColor,
                  }}
                >
                  <UserAvatar
                    src={event.user.avatar}
                    name={event.user.nickname}
                    sizeClass="h-9 w-9"
                    ringClass={isTop10 ? 'ring-2 ring-[#FFD700]' : 'ring-1 ring-white/20'}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {icon}
                      <span className="truncate text-sm font-bold">{event.user.nickname}</span>
                    </div>
                    <p className="truncate text-xs opacity-85">{label}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* 6. Comments Stream Overlay */}
      {overlayLayout.showComments && alertStyle.showComments && liveComments.length > 0 && (
        <div
          className={`absolute ${cornerClass(overlayLayout.commentsPosition)} flex flex-col gap-2`}
          style={{
            width: compact ? '250px' : '330px',
            transform: `scale(${compact ? overlayLayout.commentsScale * 0.85 : overlayLayout.commentsScale})`,
            transformOrigin: overlayLayout.commentsPosition.includes('right')
              ? 'bottom right'
              : 'bottom left',
          }}
        >
          <AnimatePresence initial={false}>
            {liveComments.slice(0, compact ? 3 : 5).map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="flex items-start gap-2.5 rounded-xl border px-3 py-2 shadow-lg"
                style={{
                  backgroundColor: `${alertStyle.backgroundColor}DE`,
                  borderColor: `${alertStyle.accentColor}44`,
                  color: alertStyle.textColor,
                  fontSize: `${Math.max(12, compact ? alertStyle.fontSize - 2 : alertStyle.fontSize)}px`,
                }}
              >
                <UserAvatar src={c.user.avatar} name={c.user.nickname} sizeClass="h-7 w-7 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <MessageCircle
                      className="h-3 w-3 shrink-0"
                      style={{ color: alertStyle.accentColor }}
                    />
                    <span
                      className="truncate text-xs font-bold"
                      style={{ color: alertStyle.accentColor }}
                    >
                      {c.user.nickname}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words leading-snug">{c.message}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
