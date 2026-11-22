import { Crown, Diamond, Gift, Medal, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { getT } from '../../shared/i18n';
import { pickRandomTestUser } from '../../shared/testPersonas';
import { useLiveStore } from '../../store/useLiveStore';
import { UserAvatar } from '../UserAvatar';

export function SupportersPanel() {
  const language = useLiveStore((s) => s.language);
  const dataViewSource = useLiveStore((s) => s.dataViewSource);
  const setDataViewSource = useLiveStore((s) => s.setDataViewSource);
  const liveSupporters = useLiveStore((s) => s.liveSupporters);
  const testSupporters = useLiveStore((s) => s.testSupporters);
  const triggerTestEvent = useLiveStore((s) => s.triggerTestEvent);

  const t = getT(language);
  const supporters = dataViewSource === 'live' ? liveSupporters : testSupporters;
  const top3 = supporters.slice(0, 3);

  const podiumCards = [
    {
      entry: top3[1],
      rank: 2,
      title: t.supporters.secondPlace,
      border: 'border-slate-300/40',
      gradient: 'from-slate-300/15 via-[#151522] to-[#11111B]',
      accent: 'text-slate-200',
      ring: 'ring-2 ring-slate-300',
      order: 'sm:order-1 sm:mt-6',
    },
    {
      entry: top3[0],
      rank: 1,
      title: t.supporters.firstPlace,
      border: 'border-[#FFD700]/60',
      gradient: 'from-[#FFD700]/20 via-[#1A1629] to-[#11111B]',
      accent: 'text-[#FFD700]',
      ring: 'ring-2 ring-[#FFD700]',
      order: 'sm:order-2',
    },
    {
      entry: top3[2],
      rank: 3,
      title: t.supporters.thirdPlace,
      border: 'border-amber-600/45',
      gradient: 'from-amber-700/20 via-[#151522] to-[#11111B]',
      accent: 'text-amber-400',
      ring: 'ring-2 ring-amber-500',
      order: 'sm:order-3 sm:mt-8',
    },
  ];

  const seedTestLeaderboard = () => {
    setDataViewSource('test');
    const demo = [
      { idx: 0, giftId: 6369, name: 'Lion', cost: 29999 },
      { idx: 1, giftId: 5658, name: 'Galaxy', cost: 1000 },
      { idx: 2, giftId: 6070, name: 'Money Gun', cost: 500 },
    ];
    demo.forEach((d, i) => {
      window.setTimeout(() => {
        triggerTestEvent({
          type: 'gift',
          user: pickRandomTestUser(d.idx),
          giftId: d.giftId,
          giftName: d.name,
          diamondCount: d.cost,
          repeatCount: 1,
          repeatEnd: true,
          giftType: 0,
        });
      }, i * 350);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">{t.supporters.title}</h1>
          <p className="mt-1 text-xs text-slate-400">{t.supporters.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-white/8 bg-[#11111B] p-1">
            <button
              type="button"
              onClick={() => setDataViewSource('live')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                dataViewSource === 'live' ? 'bg-[#7C3AED] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.control.realData}
            </button>
            <button
              type="button"
              onClick={() => setDataViewSource('test')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                dataViewSource === 'test'
                  ? 'bg-[#00D4FF]/20 text-[#00D4FF]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.control.testData}
            </button>
          </div>
        </div>
      </div>

      {/* Animated Top 3 Royal Podium */}
      {top3.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {podiumCards.map((card) => (
            <motion.div
              key={card.rank}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col items-center rounded-xl border bg-gradient-to-b p-5 text-center ${card.border} ${card.gradient} ${card.order}`}
            >
              <div className={`mb-3 inline-flex items-center gap-1.5 text-xs font-bold ${card.accent}`}>
                {card.rank === 1 ? (
                  <Crown className="h-4 w-4" />
                ) : (
                  <Medal className="h-4 w-4" />
                )}
                <span>{card.title}</span>
              </div>

              {card.entry ? (
                <>
                  <UserAvatar
                    src={card.entry.avatar}
                    name={card.entry.nickname}
                    sizeClass={card.rank === 1 ? 'h-16 w-16' : 'h-14 w-14'}
                    ringClass={card.ring}
                  />
                  <p className="mt-3 max-w-full truncate text-base font-bold text-white">
                    {card.entry.nickname}
                  </p>
                  <p className="font-mono-num mt-0.5 text-xs text-slate-400">
                    @{card.entry.uniqueId}
                  </p>
                  <div className={`font-mono-num mt-3 inline-flex items-center gap-1.5 text-lg font-extrabold ${card.accent}`}>
                    <Diamond className="h-4 w-4" />
                    {card.entry.totalPoints.toLocaleString()}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {card.entry.giftsCount.toLocaleString()} {t.supporters.gifts} · {card.entry.lastGiftName}
                  </p>
                </>
              ) : (
                <div className="py-6 text-xs text-slate-500">
                  {language === 'ar' ? 'بانتظار داعم' : 'Open Spot'}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/8 bg-[#11111B] px-6 py-12 text-center">
          <Trophy className="mb-3 h-9 w-9 text-[#FFD700]/60" />
          <p className="text-sm font-semibold text-white">{t.supporters.empty}</p>
          <button
            type="button"
            onClick={seedTestLeaderboard}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#6D28D9]"
          >
            <Gift className="h-3.5 w-3.5" />
            {language === 'ar' ? 'تجربة منصة الداعمين الآن' : 'Populate Test Podium'}
          </button>
        </div>
      )}

      {/* Full Top 10 / 20 Tabular Leaderboard */}
      {supporters.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/8 bg-[#11111B]">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-white/8 text-slate-400">
                  <th className="px-4 py-3 text-start font-semibold">{t.supporters.rank}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t.supporters.supporter}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t.supporters.lastGift}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t.supporters.gifts}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t.supporters.points}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {supporters.map((s) => (
                  <tr key={s.userId} className="transition hover:bg-white/[0.02]">
                    <td className="font-mono-num px-4 py-3 font-bold">
                      <span
                        className={
                          s.rank === 1
                            ? 'text-[#FFD700]'
                            : s.rank === 2
                              ? 'text-slate-200'
                              : s.rank === 3
                                ? 'text-amber-400'
                                : 'text-slate-400'
                        }
                      >
                        #{s.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar src={s.avatar} name={s.nickname} sizeClass="h-8 w-8" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{s.nickname}</p>
                          <p className="font-mono-num truncate text-[11px] text-slate-500">
                            @{s.uniqueId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{s.lastGiftName}</td>
                    <td className="font-mono-num px-4 py-3 text-end text-slate-200">
                      {s.giftsCount.toLocaleString()}
                    </td>
                    <td className="font-mono-num px-4 py-3 text-end font-bold text-[#FFD700]">
                      {s.totalPoints.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
