import {
  Crown,
  Flame,
  Gift,
  Heart,
  MessageCircle,
  RotateCcw,
  Share2,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import { EffectsStage } from '../../engines/EffectsStage';
import { ALL_VISUAL_EFFECTS } from '../../shared/giftCatalog';
import { getT } from '../../shared/i18n';
import { pickRandomTestUser } from '../../shared/testPersonas';
import type { ThreeDModelPreset, VisualEffectType } from '../../shared/types';
import { useLiveStore } from '../../store/useLiveStore';

const SAMPLE_COMMENTS_AR = [
  'البث اليوم أسطوري! المؤثرات خرافية 🔥',
  'أقوى منصة مؤثرات تيك توك شفتها!',
  'واصل يا بطل، ننتظر الأسد والكون 👑',
  'التصميم والألوان في OBS واضحة جداً',
];

const SAMPLE_COMMENTS_EN = [
  'These 3D gift effects look insane on stream!',
  'Drop a Galaxy or Lion to test the WebGL engine!',
  'OBS transparent overlay synced instantly!',
  'Cleanest TikTok LIVE effects setup ever!',
];

export function TestingLabPanel() {
  const language = useLiveStore((s) => s.language);
  const giftMappings = useLiveStore((s) => s.giftMappings);
  const triggerTestEvent = useLiveStore((s) => s.triggerTestEvent);
  const resetTestSession = useLiveStore((s) => s.resetTestSession);
  const setDataViewSource = useLiveStore((s) => s.setDataViewSource);
  const testStats = useLiveStore((s) => s.testStats);

  const t = getT(language);

  const runTestGift = (
    giftId: number,
    giftName: string,
    diamondCount: number,
    repeatCount = 1,
    giftType = 0
  ) => {
    setDataViewSource('test');
    triggerTestEvent({
      type: 'gift',
      user: pickRandomTestUser(),
      giftId,
      giftName,
      diamondCount,
      repeatCount,
      repeatEnd: true,
      giftType,
    });
  };

  const runSingleEffect = (effectType: VisualEffectType, label: string, accent: string) => {
    setDataViewSource('test');
    const modelMap: Partial<Record<VisualEffectType, ThreeDModelPreset>> = {
      '3d_gift': 'galaxy',
      legendary: 'lion',
    };
    triggerTestEvent({
      type: 'gift',
      user: pickRandomTestUser(),
      giftId: 9900,
      giftName: label,
      diamondCount: effectType === 'legendary' ? 29999 : 250,
      repeatCount: 1,
      repeatEnd: true,
      giftType: 0,
      forceEffect: effectType,
      force3DModel: modelMap[effectType],
      forceConfig: {
        primaryColor: accent,
        secondaryColor: '#00D4FF',
        giftName: label,
        giftNameAr: label,
      },
    });
  };

  const simulateComboStreak = () => {
    setDataViewSource('test');
    const sender = pickRandomTestUser(0);
    [1, 5, 10, 15].forEach((count, idx) => {
      window.setTimeout(() => {
        triggerTestEvent({
          type: 'gift',
          user: sender,
          giftId: 5655,
          giftName: 'Rose',
          diamondCount: 1,
          repeatCount: count,
          repeatEnd: count === 15,
          giftType: 1,
        });
      }, idx * 420);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">{t.testing.title}</h1>
          <p className="mt-1 text-xs text-slate-400">{t.testing.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono-num text-xs text-slate-400">
            {language === 'ar' ? 'أحداث الاختبار:' : 'Test Events:'}{' '}
            <strong className="text-[#00D4FF]">{testStats.eventsReceived}</strong>
          </span>
          <button
            type="button"
            onClick={resetTestSession}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-[#171726] px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-rose-500/50 hover:text-rose-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t.testing.resetTest}
          </button>
        </div>
      </div>

      {/* Live Preview Stage */}
      <div className="overflow-hidden rounded-xl border border-white/8 bg-[#11111B]">
        <EffectsStage compact className="aspect-video w-full max-h-[420px]" />
      </div>

      {/* Row 1: Iconic Gifts & Engagement Events */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-white/8 bg-[#11111B] p-5">
          <h2 className="mb-3.5 flex items-center gap-2 text-sm font-bold text-white">
            <Gift className="h-4 w-4 text-[#FFD700]" />
            {t.testing.quickGifts}
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {giftMappings.slice(0, 9).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => runTestGift(g.giftId, g.giftName, g.diamondCost)}
                className="group flex flex-col items-start rounded-lg border border-white/8 bg-[#161624] p-3 text-start transition hover:border-[#7C3AED] hover:bg-[#1C1C2E]"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-white">
                    {language === 'ar' ? g.giftNameAr : g.giftName}
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: g.primaryColor }}
                  />
                </div>
                <span className="font-mono-num mt-1 text-[11px] text-slate-400">
                  ID {g.giftId} · {g.diamondCost.toLocaleString()} ◆
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-[#11111B] p-5">
          <h2 className="mb-3.5 flex items-center gap-2 text-sm font-bold text-white">
            <Sparkles className="h-4 w-4 text-[#00D4FF]" />
            {t.testing.quickEvents}
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={simulateComboStreak}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#161624] px-3 py-2.5 text-xs font-semibold text-white transition hover:border-[#7C3AED]"
            >
              <Flame className="h-4 w-4 shrink-0 text-orange-400" />
              <span className="truncate">{t.testing.sendStreak}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDataViewSource('test');
                triggerTestEvent({ type: 'follow', user: pickRandomTestUser() });
              }}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#161624] px-3 py-2.5 text-xs font-semibold text-white transition hover:border-[#00D4FF]"
            >
              <UserPlus className="h-4 w-4 shrink-0 text-[#00D4FF]" />
              <span className="truncate">{t.testing.sendFollower}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDataViewSource('test');
                const pool = language === 'ar' ? SAMPLE_COMMENTS_AR : SAMPLE_COMMENTS_EN;
                triggerTestEvent({
                  type: 'chat',
                  user: pickRandomTestUser(),
                  message: pool[Math.floor(Math.random() * pool.length)],
                });
              }}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#161624] px-3 py-2.5 text-xs font-semibold text-white transition hover:border-[#7C3AED]"
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-[#A78BFA]" />
              <span className="truncate">{t.testing.sendComment}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDataViewSource('test');
                triggerTestEvent({ type: 'like', user: pickRandomTestUser(), likeCount: 25 });
              }}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#161624] px-3 py-2.5 text-xs font-semibold text-white transition hover:border-pink-400"
            >
              <Heart className="h-4 w-4 shrink-0 text-pink-400" />
              <span className="truncate">{t.testing.sendLikes}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDataViewSource('test');
                triggerTestEvent({ type: 'share', user: pickRandomTestUser() });
              }}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#161624] px-3 py-2.5 text-xs font-semibold text-white transition hover:border-emerald-400"
            >
              <Share2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="truncate">{t.testing.sendShare}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDataViewSource('test');
                triggerTestEvent({ type: 'subscribe', user: pickRandomTestUser() });
              }}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#161624] px-3 py-2.5 text-xs font-semibold text-white transition hover:border-[#FFD700]"
            >
              <Crown className="h-4 w-4 shrink-0 text-[#FFD700]" />
              <span className="truncate">{t.testing.sendSubscribe}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDataViewSource('test');
                triggerTestEvent({ type: 'member', user: pickRandomTestUser() });
              }}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#161624] px-3 py-2.5 text-xs font-semibold text-white transition hover:border-slate-400"
            >
              <Users className="h-4 w-4 shrink-0 text-slate-300" />
              <span className="truncate">{t.testing.sendMember}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDataViewSource('test');
                const freshSupporter = {
                  userId: `top10_${Date.now()}`,
                  uniqueId: `vip_${Math.floor(Math.random() * 999)}`,
                  nickname: language === 'ar' ? `داعم ملكي #${Math.floor(Math.random() * 99)}` : `VIP Supporter #${Math.floor(Math.random() * 99)}`,
                  avatar: pickRandomTestUser().avatar,
                };
                triggerTestEvent({
                  type: 'gift',
                  user: freshSupporter,
                  giftId: 6070,
                  giftName: 'Money Gun',
                  diamondCount: 500,
                  repeatCount: 1,
                  repeatEnd: true,
                  giftType: 0,
                });
              }}
              className="flex items-center gap-2 rounded-lg border border-[#FFD700]/35 bg-[#FFD700]/10 px-3 py-2.5 text-xs font-semibold text-[#FFD700] transition hover:bg-[#FFD700]/20"
            >
              <Trophy className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.testing.sendTop10}</span>
            </button>

            <button
              type="button"
              onClick={() => runTestGift(6646, 'TikTok Universe', 44999)}
              className="flex items-center gap-2 rounded-lg border border-[#7C3AED]/60 bg-[#7C3AED]/20 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#7C3AED]/35"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-[#FFD700]" />
              <span className="truncate">{t.testing.sendLegendary}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Test ALL 15 Visual Effects Individually */}
      <div className="rounded-xl border border-white/8 bg-[#11111B] p-5">
        <h2 className="mb-3.5 text-sm font-bold text-white">{t.testing.all15Effects}</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {ALL_VISUAL_EFFECTS.map((ef, index) => (
            <button
              key={ef.type}
              type="button"
              onClick={() =>
                runSingleEffect(ef.type, language === 'ar' ? ef.labelAr : ef.labelEn, ef.accent)
              }
              className="flex flex-col items-start justify-between rounded-lg border border-white/8 bg-[#161624] p-3 text-start transition hover:border-[#7C3AED] hover:bg-[#1D1D30]"
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-mono-num text-[11px] font-semibold text-slate-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ef.accent }}
                />
              </div>
              <p className="mt-2 text-xs font-bold text-white">
                {language === 'ar' ? ef.labelAr : ef.labelEn}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                {language === 'ar' ? ef.descriptionAr : ef.descriptionEn}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
