import { MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { getT } from '../../shared/i18n';
import { pickRandomTestUser } from '../../shared/testPersonas';
import type { AlertStyleConfig } from '../../shared/types';
import { useLiveStore } from '../../store/useLiveStore';
import { UserAvatar } from '../UserAvatar';

export function AlertsCommentsPanel() {
  const language = useLiveStore((s) => s.language);
  const alertStyle = useLiveStore((s) => s.alertStyle);
  const updateAlertStyle = useLiveStore((s) => s.updateAlertStyle);
  const liveComments = useLiveStore((s) => s.liveComments);
  const triggerTestEvent = useLiveStore((s) => s.triggerTestEvent);

  const t = getT(language);
  const [customMsg, setCustomMsg] = useState('');

  const handleSendTestComment = (e: React.FormEvent) => {
    e.preventDefault();
    const text = customMsg.trim() || (language === 'ar' ? 'أهلاً بالجميع في البث المباشر!' : 'Hello everyone in the LIVE!');
    triggerTestEvent({
      type: 'chat',
      user: pickRandomTestUser(),
      message: text,
    });
    setCustomMsg('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-white">{t.alerts.title}</h1>
        <p className="mt-1 text-xs text-slate-400">{t.alerts.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Alert & Comment Customizer */}
        <div className="space-y-5 rounded-xl border border-white/8 bg-[#11111B] p-5 lg:col-span-7">
          <h2 className="text-sm font-bold text-white">{t.alerts.settings}</h2>

          {/* Visibility Checkboxes */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[
              { key: 'showComments', label: t.alerts.showComments },
              { key: 'showFollowAlerts', label: t.alerts.showFollows },
              { key: 'showShareAlerts', label: t.alerts.showShares },
              { key: 'showSubscribeAlerts', label: t.alerts.showSubscribes },
              { key: 'showMemberAlerts', label: t.alerts.showMembers },
              { key: 'showTop10Alerts', label: t.alerts.showTop10 },
            ].map((item) => {
              const k = item.key as keyof AlertStyleConfig;
              return (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-white/6 bg-[#161624] px-3.5 py-2.5 text-xs text-slate-200"
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(alertStyle[k])}
                    onChange={(e) => updateAlertStyle({ [k]: e.target.checked })}
                    className="h-4 w-4 accent-[#7C3AED]"
                  />
                </label>
              );
            })}
          </div>

          {/* Sound Triggers */}
          <div className="border-t border-white/8 pt-4">
            <p className="mb-2.5 text-xs font-semibold text-slate-300">
              {language === 'ar' ? 'تشغيل الصوت التلقائي' : 'Audio Notification Triggers'}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { key: 'soundOnGift', label: t.alerts.soundOnGift },
                { key: 'soundOnFollow', label: t.alerts.soundOnFollow },
                { key: 'soundOnComment', label: t.alerts.soundOnComment },
                { key: 'soundOnSubscribe', label: t.alerts.soundOnSubscribe },
              ].map((item) => {
                const k = item.key as keyof AlertStyleConfig;
                return (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-white/6 bg-[#161624] px-3.5 py-2 text-xs text-slate-200"
                  >
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(alertStyle[k])}
                      onChange={(e) => updateAlertStyle({ [k]: e.target.checked })}
                      className="h-4 w-4 accent-[#00D4FF]"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Colors, Fonts, Direction, Animation */}
          <div className="grid grid-cols-2 gap-4 border-t border-white/8 pt-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                {language === 'ar' ? 'لون التمييز' : 'Accent Color'}
              </label>
              <input
                type="color"
                value={alertStyle.accentColor}
                onChange={(e) => updateAlertStyle({ accentColor: e.target.value })}
                className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-[#09090F] p-1"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                {language === 'ar' ? 'خلفية البطاقة' : 'Card Background'}
              </label>
              <input
                type="color"
                value={alertStyle.backgroundColor}
                onChange={(e) => updateAlertStyle({ backgroundColor: e.target.value })}
                className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-[#09090F] p-1"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                {language === 'ar' ? 'لون النص' : 'Text Color'}
              </label>
              <input
                type="color"
                value={alertStyle.textColor}
                onChange={(e) => updateAlertStyle({ textColor: e.target.value })}
                className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-[#09090F] p-1"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">{t.alerts.font}</label>
              <select
                value={alertStyle.fontFamily}
                onChange={(e) =>
                  updateAlertStyle({
                    fontFamily: e.target.value as AlertStyleConfig['fontFamily'],
                  })
                }
                className="w-full rounded-lg border border-white/10 bg-[#09090F] px-3 py-2 text-xs text-white"
              >
                <option value="Cairo">Cairo (عربي + إنجليزي)</option>
                <option value="Outfit">Outfit (Modern Display)</option>
                <option value="JetBrains Mono">JetBrains Mono</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                {t.alerts.fontSize} ({alertStyle.fontSize}px)
              </label>
              <input
                type="range"
                min={12}
                max={22}
                value={alertStyle.fontSize}
                onChange={(e) => updateAlertStyle({ fontSize: Number(e.target.value) })}
                className="mt-2 w-full accent-[#7C3AED]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">{t.alerts.direction}</label>
              <select
                value={alertStyle.direction}
                onChange={(e) =>
                  updateAlertStyle({
                    direction: e.target.value as AlertStyleConfig['direction'],
                  })
                }
                className="w-full rounded-lg border border-white/10 bg-[#09090F] px-3 py-2 text-xs text-white"
              >
                <option value="auto">Auto</option>
                <option value="rtl">RTL (العربية)</option>
                <option value="ltr">LTR (English)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Comments Stream & Quick Test Sender */}
        <div className="flex flex-col rounded-xl border border-white/8 bg-[#11111B] p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <MessageCircle className="h-4 w-4 text-[#00D4FF]" />
              {t.alerts.liveChat}
            </h2>
            <span className="font-mono-num text-xs text-slate-400">{liveComments.length}</span>
          </div>

          <div className="min-h-[280px] flex-1 space-y-2 overflow-y-auto rounded-lg border border-white/6 bg-[#09090F] p-3">
            {liveComments.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-500">
                {language === 'ar'
                  ? 'لا توجد تعليقات بعد. أرسل تعليقاً تجريبياً أدناه لمعاينته.'
                  : 'No comments yet. Send a test comment below to preview styling.'}
              </p>
            ) : (
              liveComments.map((c) => (
                <div
                  key={c.id}
                  dir={alertStyle.direction === 'auto' ? (language === 'ar' ? 'rtl' : 'ltr') : alertStyle.direction}
                  className="flex items-start gap-2.5 rounded-lg border px-3 py-2"
                  style={{
                    backgroundColor: alertStyle.backgroundColor,
                    borderColor: `${alertStyle.accentColor}44`,
                    color: alertStyle.textColor,
                    fontSize: `${alertStyle.fontSize}px`,
                  }}
                >
                  <UserAvatar src={c.user.avatar} name={c.user.nickname} sizeClass="h-7 w-7 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold" style={{ color: alertStyle.accentColor }}>
                      {c.user.nickname}
                    </p>
                    <p className="mt-0.5 break-words leading-snug">{c.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendTestComment} className="mt-3 flex gap-2">
            <input
              type="text"
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              placeholder={
                language === 'ar' ? 'اكتب تعليقاً تجريبياً (يدعم RTL)...' : 'Type a test comment...'
              }
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#09090F] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#7C3AED]"
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#7C3AED] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#6D28D9]"
            >
              <Send className="h-3.5 w-3.5" />
              {language === 'ar' ? 'إرسال' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
