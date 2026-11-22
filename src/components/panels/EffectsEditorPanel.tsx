import { BookmarkPlus, Check, Play, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { audioEngine } from '../../engines/audioEngine';
import { EffectsStage } from '../../engines/EffectsStage';
import { ALL_VISUAL_EFFECTS, BUILTIN_SOUNDS } from '../../shared/giftCatalog';
import { getT } from '../../shared/i18n';
import { pickRandomTestUser } from '../../shared/testPersonas';
import type {
  EffectPosition,
  GiftEffectConfig,
  ThreeDModelPreset,
  VisualEffectType,
} from '../../shared/types';
import { useLiveStore } from '../../store/useLiveStore';

const MODELS_3D: Array<{ id: ThreeDModelPreset; labelAr: string; labelEn: string }> = [
  { id: 'rose', labelAr: 'وردة كريستال 3D', labelEn: '3D Crystal Rose' },
  { id: 'tiktok_logo', labelAr: 'شعار TikTok نيون 3D', labelEn: '3D Neon TikTok Note' },
  { id: 'heart_crystal', labelAr: 'قلب ياقوتي 3D', labelEn: '3D Ruby Heart' },
  { id: 'galaxy', labelAr: 'مجرة حلزونية 3D', labelEn: '3D Spiral Galaxy' },
  { id: 'lion', labelAr: 'أسد ملكي ذهبي 3D', labelEn: '3D Royal Lion Crest' },
  { id: 'universe', labelAr: 'منظومة الكون 3D', labelEn: '3D Cosmic Universe' },
  { id: 'crown', labelAr: 'تاج ذهبي 3D', labelEn: '3D Royal Crown' },
  { id: 'diamond', labelAr: 'ماسة لامعة 3D', labelEn: '3D Cut Diamond' },
];

const POSITIONS: EffectPosition[] = [
  'center',
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

export function EffectsEditorPanel() {
  const language = useLiveStore((s) => s.language);
  const giftMappings = useLiveStore((s) => s.giftMappings);
  const discoveredGifts = useLiveStore((s) => s.discoveredGifts);
  const templates = useLiveStore((s) => s.templates);
  const updateGiftMappings = useLiveStore((s) => s.updateGiftMappings);
  const saveTemplate = useLiveStore((s) => s.saveTemplate);
  const applyTemplate = useLiveStore((s) => s.applyTemplate);
  const deleteTemplate = useLiveStore((s) => s.deleteTemplate);
  const enqueueLocalPreview = useLiveStore((s) => s.enqueueLocalPreview);

  const t = getT(language);
  const [selectedId, setSelectedId] = useState<string>(giftMappings[0]?.id || '');
  const [draft, setDraft] = useState<GiftEffectConfig>(
    giftMappings[0] || {
      id: 'custom_1',
      giftId: 5655,
      giftName: 'Rose',
      giftNameAr: 'وردة',
      diamondCost: 1,
      primaryEffect: '3d_gift',
      secondaryEffects: ['gift_card'],
      model3D: 'rose',
      use3D: true,
      primaryColor: '#7C3AED',
      secondaryColor: '#00D4FF',
      scale: 1,
      durationMs: 3500,
      position: 'center',
      soundId: 'gift_chime',
      priority: 1,
      enabled: true,
    }
  );
  const [savedToast, setSavedToast] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const customTracks = audioEngine.getCustomTracks();

  const selectMapping = (m: GiftEffectConfig) => {
    setSelectedId(m.id);
    setDraft(structuredClone(m));
  };

  const handleAddNew = (prefill?: { giftId: number; giftName: string; diamondCount: number }) => {
    const created: GiftEffectConfig = {
      id: `gift_custom_${Date.now()}`,
      giftId: prefill?.giftId || 0,
      giftName: prefill?.giftName || 'Custom Gift',
      giftNameAr: prefill?.giftName || 'هدية مخصصة',
      diamondCost: prefill?.diamondCount || 10,
      primaryEffect: 'particle_explosion',
      secondaryEffects: ['gift_card'],
      model3D: 'diamond',
      use3D: false,
      primaryColor: '#7C3AED',
      secondaryColor: '#00D4FF',
      scale: 1,
      durationMs: 3600,
      position: 'center',
      soundId: 'gift_chime',
      priority: 2,
      enabled: true,
    };
    const nextList = [created, ...giftMappings];
    updateGiftMappings(nextList);
    selectMapping(created);
  };

  const handleSave = async () => {
    const exists = giftMappings.some((m) => m.id === draft.id);
    const nextList = exists
      ? giftMappings.map((m) => (m.id === draft.id ? draft : m))
      : [draft, ...giftMappings];
    await updateGiftMappings(nextList);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1800);
  };

  const handleDelete = async (id: string) => {
    if (giftMappings.length <= 1) return;
    const nextList = giftMappings.filter((m) => m.id !== id);
    await updateGiftMappings(nextList);
    if (selectedId === id && nextList[0]) {
      selectMapping(nextList[0]);
    }
  };

  const handlePreview = () => {
    enqueueLocalPreview(
      {
        id: `prev_${Date.now()}`,
        type: 'gift',
        source: 'test',
        timestamp: Date.now(),
        user: pickRandomTestUser(0),
        giftId: draft.giftId,
        giftName: draft.giftName,
        diamondCount: draft.diamondCost,
        repeatCount: 1,
        repeatEnd: true,
        giftType: 0,
      },
      draft
    );
  };

  const toggleSecondaryEffect = (ef: VisualEffectType) => {
    const has = draft.secondaryEffects.includes(ef);
    setDraft({
      ...draft,
      secondaryEffects: has
        ? draft.secondaryEffects.filter((x) => x !== ef)
        : [...draft.secondaryEffects, ef],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">{t.editor.title}</h1>
          <p className="mt-1 text-xs text-slate-400">{t.editor.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => handleAddNew()}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#6D28D9]"
        >
          <Plus className="h-3.5 w-3.5" />
          {t.editor.addGiftMapping}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left List: Mapped Real Gift IDs + Auto-Discovered LIVE Gifts */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-white/8 bg-[#11111B] p-4">
            <h2 className="mb-3 text-xs font-bold text-slate-300">
              {language === 'ar' ? 'الهدايا المربوطة (Gift ID)' : 'Mapped TikTok Gift IDs'}
            </h2>
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto">
              {giftMappings.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMapping(m)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-start transition ${
                    selectedId === m.id
                      ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-white'
                      : 'border-white/6 bg-[#161624] text-slate-300 hover:border-white/15'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">
                      {language === 'ar' ? m.giftNameAr : m.giftName}
                    </p>
                    <p className="font-mono-num text-[11px] text-slate-400">
                      ID #{m.giftId} · {m.diamondCost.toLocaleString()} ◆
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: m.primaryColor }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Auto-Discovered Live Gifts */}
          {discoveredGifts.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-[#11111B] p-4">
              <h2 className="mb-2.5 text-xs font-bold text-[#00D4FF]">
                {t.editor.discoveredTitle}
              </h2>
              <div className="space-y-1.5">
                {discoveredGifts.slice(0, 8).map((dg) => (
                  <div
                    key={dg.giftId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-[#161624] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{dg.giftName}</p>
                      <p className="font-mono-num text-[10px] text-slate-400">
                        ID #{dg.giftId} · {dg.diamondCount} ◆
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddNew(dg)}
                      className="whitespace-nowrap rounded-md border border-[#00D4FF]/40 px-2.5 py-1 text-[11px] font-semibold text-[#00D4FF] hover:bg-[#00D4FF]/15"
                    >
                      {language === 'ar' ? 'تخصيص' : 'Map'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Template Manager */}
          <div className="rounded-xl border border-white/8 bg-[#11111B] p-4">
            <h2 className="mb-3 text-xs font-bold text-slate-300">{t.editor.templates}</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t.editor.templatePlaceholder}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#09090F] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#7C3AED]"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!templateName.trim()) return;
                  await saveTemplate(templateName);
                  setTemplateName('');
                }}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-[#171726] px-3 py-2 text-xs font-semibold text-white hover:bg-[#222238]"
              >
                <BookmarkPlus className="h-3.5 w-3.5 text-[#FFD700]" />
                {language === 'ar' ? 'حفظ' : 'Save'}
              </button>
            </div>
            {templates.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-[#161624] px-3 py-2 text-xs"
                  >
                    <span className="truncate font-semibold text-white">{tpl.name}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyTemplate(tpl.id)}
                        className="rounded-md bg-[#7C3AED]/25 px-2.5 py-1 text-[11px] font-semibold text-[#C4B5FD] hover:bg-[#7C3AED]/40"
                      >
                        {t.editor.applyTemplate}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.id)}
                        className="rounded-md p-1 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Preview Stage + Full Customization Form */}
        <div className="space-y-5 lg:col-span-8">
          <div className="overflow-hidden rounded-xl border border-white/8 bg-[#11111B]">
            <EffectsStage compact className="aspect-video w-full max-h-[340px]" />
          </div>

          <div className="rounded-xl border border-white/8 bg-[#11111B] p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  {t.editor.giftIdLabel}
                </label>
                <input
                  type="number"
                  value={draft.giftId}
                  onChange={(e) => setDraft({ ...draft, giftId: Number(e.target.value) || 0 })}
                  className="font-mono-num w-full rounded-lg border border-white/10 bg-[#09090F] px-3 py-2 text-xs text-white outline-none focus:border-[#7C3AED]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  {t.editor.giftNameLabel} (EN)
                </label>
                <input
                  type="text"
                  value={draft.giftName}
                  onChange={(e) => setDraft({ ...draft, giftName: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#09090F] px-3 py-2 text-xs text-white outline-none focus:border-[#7C3AED]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  {t.editor.giftNameLabel} (AR)
                </label>
                <input
                  type="text"
                  value={draft.giftNameAr}
                  onChange={(e) => setDraft({ ...draft, giftNameAr: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#09090F] px-3 py-2 text-xs text-white outline-none focus:border-[#7C3AED]"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  {t.editor.primaryEffect}
                </label>
                <select
                  value={draft.primaryEffect}
                  onChange={(e) =>
                    setDraft({ ...draft, primaryEffect: e.target.value as VisualEffectType })
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#09090F] px-3 py-2 text-xs text-white outline-none focus:border-[#7C3AED]"
                >
                  {ALL_VISUAL_EFFECTS.map((ef) => (
                    <option key={ef.type} value={ef.type}>
                      {language === 'ar' ? ef.labelAr : ef.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  {t.editor.model3D}
                </label>
                <select
                  value={draft.model3D || 'crown'}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      model3D: e.target.value as ThreeDModelPreset,
                      use3D: true,
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#09090F] px-3 py-2 text-xs text-white outline-none focus:border-[#7C3AED]"
                >
                  {MODELS_3D.map((m) => (
                    <option key={m.id} value={m.id}>
                      {language === 'ar' ? m.labelAr : m.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  {t.editor.sound}
                </label>
                <select
                  value={draft.soundId}
                  onChange={(e) => setDraft({ ...draft, soundId: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#09090F] px-3 py-2 text-xs text-white outline-none focus:border-[#7C3AED]"
                >
                  {BUILTIN_SOUNDS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {language === 'ar' ? s.nameAr : s.nameEn}
                    </option>
                  ))}
                  {customTracks.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      ★ {tr.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Layered Secondary Effects */}
            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold text-slate-300">
                {t.editor.secondaryEffects}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_VISUAL_EFFECTS.map((ef) => {
                  const active = draft.secondaryEffects.includes(ef.type);
                  return (
                    <button
                      key={ef.type}
                      type="button"
                      onClick={() => toggleSecondaryEffect(ef.type)}
                      className={`whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                        active
                          ? 'border-[#7C3AED] bg-[#7C3AED]/25 text-white'
                          : 'border-white/8 bg-[#161624] text-slate-400 hover:text-white'
                      }`}
                    >
                      {language === 'ar' ? ef.labelAr : ef.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Colors, Scale, Duration, Position */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div>
                <label className="mb-1.5 block text-xs text-slate-300">{t.editor.primaryColor}</label>
                <input
                  type="color"
                  value={draft.primaryColor}
                  onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                  className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-[#09090F] p-1"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-300">{t.editor.secondaryColor}</label>
                <input
                  type="color"
                  value={draft.secondaryColor}
                  onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })}
                  className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-[#09090F] p-1"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-300">
                  {t.editor.scale} ({draft.scale.toFixed(2)}x)
                </label>
                <input
                  type="range"
                  min={0.6}
                  max={1.8}
                  step={0.05}
                  value={draft.scale}
                  onChange={(e) => setDraft({ ...draft, scale: Number(e.target.value) })}
                  className="mt-2 w-full accent-[#7C3AED]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-300">
                  {t.editor.duration} ({(draft.durationMs / 1000).toFixed(1)}s)
                </label>
                <input
                  type="range"
                  min={1500}
                  max={10000}
                  step={250}
                  value={draft.durationMs}
                  onChange={(e) => setDraft({ ...draft, durationMs: Number(e.target.value) })}
                  className="mt-2 w-full accent-[#00D4FF]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-300">{t.editor.position}</label>
                <select
                  value={draft.position}
                  onChange={(e) =>
                    setDraft({ ...draft, position: e.target.value as EffectPosition })
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#09090F] px-2.5 py-2 text-xs text-white outline-none"
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={draft.use3D}
                  onChange={(e) => setDraft({ ...draft, use3D: e.target.checked })}
                  className="h-4 w-4 accent-[#7C3AED]"
                />
                {t.editor.enable3D}
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(draft.id)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-rose-500/50 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-4 py-2 text-xs font-bold text-[#00D4FF] transition hover:bg-[#00D4FF]/20"
                >
                  <Play className="h-3.5 w-3.5" />
                  {t.editor.preview}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#6D28D9]"
                >
                  {savedToast ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  {savedToast ? (language === 'ar' ? 'تم الحفظ والمزامنة' : 'Saved & Synced') : t.editor.saveChanges}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
