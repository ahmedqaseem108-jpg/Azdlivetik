import { create } from 'zustand';
import { audioEngine } from '../engines/audioEngine';
import {
  DEFAULT_ALERT_STYLE,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_GIFT_MAPPINGS,
  DEFAULT_OVERLAY_LAYOUT,
  resolveGiftMapping,
} from '../shared/giftCatalog';
import type {
  AlertStyleConfig,
  AudioSettings,
  ConnectionState,
  CreatorInfo,
  EffectTemplate,
  GiftEffectConfig,
  Language,
  LiveEventPayload,
  OverlayLayoutConfig,
  OverlayRoomSnapshot,
  SessionStats,
  SupporterEntry,
  TikLivePlansInfo,
  TikLiveUsageInfo,
} from '../shared/types';

export type ActiveSection =
  | 'control'
  | 'testing'
  | 'editor'
  | 'supporters'
  | 'alerts'
  | 'obs'
  | 'audioApi';

export interface ActiveEffectInstance {
  instanceId: string;
  event: LiveEventPayload;
  config: GiftEffectConfig;
  startedAt: number;
  expiresAt: number;
  streakCount: number;
}

export interface AlertToastItem {
  id: string;
  event: LiveEventPayload;
  createdAt: number;
}

function getOrCreateOverlayId(): string {
  if (typeof window === 'undefined') return 'studio-pro';
  const stored = window.localStorage.getItem('live_effects_pro_overlay_id');
  if (stored) return stored;
  const created = `live-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem('live_effects_pro_overlay_id', created);
  return created;
}

const emptyStats: SessionStats = {
  giftsCount: 0,
  supportersCount: 0,
  totalDiamonds: 0,
  totalLikes: 0,
  totalComments: 0,
  totalFollows: 0,
  eventsReceived: 0,
  viewerCount: 0,
  connectedAt: null,
};

interface LiveStoreState {
  language: Language;
  activeSection: ActiveSection;
  dataViewSource: 'live' | 'test';
  overlayId: string;
  wsConnected: boolean;
  connectedOverlaysCount: number;

  connection: ConnectionState;
  liveStats: SessionStats;
  testStats: SessionStats;
  liveSupporters: SupporterEntry[];
  testSupporters: SupporterEntry[];
  recentEvents: LiveEventPayload[];
  discoveredGifts: OverlayRoomSnapshot['discoveredGifts'];

  giftMappings: GiftEffectConfig[];
  alertStyle: AlertStyleConfig;
  overlayLayout: OverlayLayoutConfig;
  audioSettings: AudioSettings;
  templates: EffectTemplate[];

  // Effects Queue & Active Display
  activeEffects: ActiveEffectInstance[];
  effectQueue: ActiveEffectInstance[];
  activeAlerts: AlertToastItem[];
  liveComments: LiveEventPayload[];

  // API Monitor
  usageInfo: TikLiveUsageInfo | null;
  plansInfo: TikLivePlansInfo | null;
  loadingApiMeta: boolean;

  // Actions
  setLanguage: (lang: Language) => void;
  setActiveSection: (section: ActiveSection) => void;
  setDataViewSource: (source: 'live' | 'test') => void;
  regenerateOverlayId: () => string;

  initRoomSocket: (overlayId: string, role: 'control' | 'overlay') => () => void;
  connectTikTok: (username: string) => Promise<{ ok: boolean; error?: string }>;
  disconnectTikTok: () => Promise<void>;
  checkLiveStatus: (username: string) => Promise<{ ok: boolean; data?: CreatorInfo; error?: string }>;
  triggerTestEvent: (event: Omit<LiveEventPayload, 'id' | 'timestamp' | 'source'>) => Promise<void>;
  resetTestSession: () => Promise<void>;
  resetLiveSession: () => Promise<void>;

  updateGiftMappings: (mappings: GiftEffectConfig[]) => Promise<void>;
  updateAlertStyle: (patch: Partial<AlertStyleConfig>) => Promise<void>;
  updateOverlayLayout: (patch: Partial<OverlayLayoutConfig>) => Promise<void>;
  updateAudioSettings: (patch: Partial<AudioSettings>) => Promise<void>;
  saveTemplate: (name: string) => Promise<void>;
  applyTemplate: (templateId: string) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;

  enqueueLocalPreview: (event: LiveEventPayload, customConfig?: GiftEffectConfig) => void;
  pruneExpiredEffects: () => void;
  fetchApiUsageAndPlans: () => Promise<void>;
}

let activeWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
const processedEventIds = new Set<string>();

export const useLiveStore = create<LiveStoreState>((set, get) => {
  const pushConfigToServer = async (partial: {
    giftMappings?: GiftEffectConfig[];
    alertStyle?: AlertStyleConfig;
    overlayLayout?: OverlayLayoutConfig;
    audioSettings?: AudioSettings;
    templates?: EffectTemplate[];
  }) => {
    const { overlayId } = get();
    try {
      await fetch(`/api/rooms/${encodeURIComponent(overlayId)}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
    } catch {
      // Optimistic local state remains applied
    }
  };

  const handleIncomingEvents = (events: LiveEventPayload[]) => {
    const state = get();
    const nextActive = [...state.activeEffects];
    const nextQueue = [...state.effectQueue];
    const nextAlerts = [...state.activeAlerts];
    const nextComments = [...state.liveComments];
    const perfMode = state.overlayLayout.performanceMode;
    const maxConcurrent = perfMode ? 1 : 2;

    for (const ev of events) {
      // Idempotency guard against duplicate WS frames
      if (processedEventIds.has(ev.id)) continue;
      processedEventIds.add(ev.id);
      if (processedEventIds.size > 600) {
        const first = processedEventIds.values().next().value;
        if (first) processedEventIds.delete(first);
      }

      if (ev.type === 'chat' || ev.type === 'question') {
        nextComments.unshift(ev);
        if (nextComments.length > 30) nextComments.length = 30;
        if (state.alertStyle.soundOnComment) {
          audioEngine.play('alert_ping', 1);
        }
        continue;
      }

      if (ev.type === 'follow' || ev.type === 'share' || ev.type === 'subscribe' || ev.type === 'member' || ev.type === 'top10_enter') {
        const shouldShow =
          (ev.type === 'follow' && state.alertStyle.showFollowAlerts) ||
          (ev.type === 'share' && state.alertStyle.showShareAlerts) ||
          (ev.type === 'subscribe' && state.alertStyle.showSubscribeAlerts) ||
          (ev.type === 'member' && state.alertStyle.showMemberAlerts) ||
          (ev.type === 'top10_enter' && state.alertStyle.showTop10Alerts);

        if (shouldShow) {
          nextAlerts.unshift({ id: ev.id, event: ev, createdAt: Date.now() });
          if (nextAlerts.length > 6) nextAlerts.length = 6;
        }

        if (ev.type === 'top10_enter') {
          audioEngine.play('supporter_fanfare', 3);
        } else if (ev.type === 'subscribe' && state.alertStyle.soundOnSubscribe) {
          audioEngine.play('supporter_fanfare', 2);
        } else if (ev.type === 'follow' && state.alertStyle.soundOnFollow) {
          audioEngine.play('alert_ping', 1);
        }
        continue;
      }

      if (ev.type === 'like') {
        if ((ev.likeCount || 1) >= 10) {
          nextAlerts.unshift({ id: ev.id, event: ev, createdAt: Date.now() });
          if (nextAlerts.length > 6) nextAlerts.length = 6;
        }
        continue;
      }

      if (ev.type === 'gift') {
        let cfg = resolveGiftMapping(
          state.giftMappings,
          ev.giftId,
          ev.giftName,
          ev.diamondCount || 1
        );

        if (ev.forceEffect) {
          cfg = {
            ...cfg,
            primaryEffect: ev.forceEffect,
            secondaryEffects: ev.forceEffect === 'legendary' ? ['3d_gift', 'fire', 'golden_light', 'cinematic_bg'] : ['gift_card'],
            model3D: ev.force3DModel || cfg.model3D || 'crown',
            use3D: ev.forceEffect === '3d_gift' || ev.forceEffect === 'legendary' || Boolean(ev.force3DModel),
            ...(ev.forceConfig || {}),
          };
        } else if (ev.forceConfig) {
          cfg = { ...cfg, ...ev.forceConfig };
        }

        // Merge ongoing gift streak into existing active effect instead of spamming!
        const streakMatchIdx = nextActive.findIndex(
          (a) =>
            a.event.user.userId === ev.user.userId &&
            a.event.giftId === ev.giftId &&
            Date.now() - a.startedAt < a.config.durationMs
        );

        if (streakMatchIdx >= 0 && !ev.forceEffect) {
          const existing = nextActive[streakMatchIdx];
          const newCount = Math.max(existing.streakCount + (ev.streakDelta || 1), ev.repeatCount || 1);
          nextActive[streakMatchIdx] = {
            ...existing,
            event: { ...ev, repeatCount: newCount },
            streakCount: newCount,
            expiresAt: Date.now() + Math.min(cfg.durationMs, 4500),
          };
          if (state.alertStyle.soundOnGift) {
            audioEngine.play(cfg.soundId, cfg.priority);
          }
          continue;
        }

        const duration = perfMode ? Math.min(cfg.durationMs, 3800) : cfg.durationMs;
        const instance: ActiveEffectInstance = {
          instanceId: ev.id,
          event: ev,
          config: perfMode ? { ...cfg, use3D: cfg.priority >= 4 ? cfg.use3D : false } : cfg,
          startedAt: Date.now(),
          expiresAt: Date.now() + duration,
          streakCount: ev.repeatCount || 1,
        };

        // Heavy 3D/Legendary effects run solo to protect FPS; standard effects up to maxConcurrent
        const hasHeavyActive = nextActive.some((a) => a.config.priority >= 4);
        if (instance.config.priority >= 4 && !hasHeavyActive) {
          nextActive.unshift(instance);
          if (state.alertStyle.soundOnGift) audioEngine.play(cfg.soundId, cfg.priority);
        } else if (nextActive.length < maxConcurrent && !hasHeavyActive) {
          nextActive.push(instance);
          if (state.alertStyle.soundOnGift) audioEngine.play(cfg.soundId, cfg.priority);
        } else {
          // Priority insert into bounded queue
          nextQueue.push(instance);
          nextQueue.sort((a, b) => b.config.priority - a.config.priority);
          if (nextQueue.length > 20) nextQueue.length = 20;
        }
      }
    }

    set({
      activeEffects: nextActive,
      effectQueue: nextQueue,
      activeAlerts: nextAlerts,
      liveComments: nextComments,
    });
  };

  return {
    language: 'ar',
    activeSection: 'control',
    dataViewSource: 'live',
    overlayId: getOrCreateOverlayId(),
    wsConnected: false,
    connectedOverlaysCount: 0,

    connection: {
      status: 'disconnected',
      username: '',
      sessionId: null,
      plan: null,
      creator: null,
      errorMessage: null,
      lastEventAt: null,
      apiKeyConfigured: false,
      reconnecting: false,
    },
    liveStats: { ...emptyStats },
    testStats: { ...emptyStats },
    liveSupporters: [],
    testSupporters: [],
    recentEvents: [],
    discoveredGifts: [],

    giftMappings: DEFAULT_GIFT_MAPPINGS,
    alertStyle: DEFAULT_ALERT_STYLE,
    overlayLayout: DEFAULT_OVERLAY_LAYOUT,
    audioSettings: DEFAULT_AUDIO_SETTINGS,
    templates: [],

    activeEffects: [],
    effectQueue: [],
    activeAlerts: [],
    liveComments: [],

    usageInfo: null,
    plansInfo: null,
    loadingApiMeta: false,

    setLanguage: (lang) => {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      }
      set({ language: lang });
    },

    setActiveSection: (activeSection) => set({ activeSection }),
    setDataViewSource: (dataViewSource) => set({ dataViewSource }),

    regenerateOverlayId: () => {
      const nextId = `live-${Math.random().toString(36).slice(2, 10)}`;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('live_effects_pro_overlay_id', nextId);
      }
      set({ overlayId: nextId });
      return nextId;
    },

    initRoomSocket: (overlayId, role) => {
      set({ overlayId });
      let disposed = false;

      const connect = () => {
        if (disposed) return;
        if (activeWs) {
          try {
            activeWs.close();
          } catch {
            // ignore
          }
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws?overlayId=${encodeURIComponent(overlayId)}&role=${role}`;
        const ws = new WebSocket(url);
        activeWs = ws;

        ws.onopen = () => {
          set({ wsConnected: true });
          if (pingTimer) clearInterval(pingTimer);
          pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 25000);
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === 'room:snapshot' && msg.snapshot) {
              const s = msg.snapshot as OverlayRoomSnapshot;
              audioEngine.updateSettings(s.audioSettings);
              set({
                connection: s.connection,
                liveStats: s.liveStats,
                testStats: s.testStats,
                liveSupporters: s.liveSupporters,
                testSupporters: s.testSupporters,
                recentEvents: s.recentEvents,
                giftMappings: s.giftMappings,
                alertStyle: s.alertStyle,
                overlayLayout: s.overlayLayout,
                audioSettings: s.audioSettings,
                templates: s.templates,
                connectedOverlaysCount: s.connectedOverlaysCount,
                discoveredGifts: s.discoveredGifts,
              });
            } else if (msg.type === 'connection:update') {
              set({
                connection: msg.connection,
                liveStats: msg.liveStats || get().liveStats,
              });
            } else if (msg.type === 'overlays:count') {
              set({ connectedOverlaysCount: msg.connectedOverlaysCount || 0 });
            } else if (msg.type === 'config:update') {
              if (msg.audioSettings) audioEngine.updateSettings(msg.audioSettings);
              set({
                giftMappings: msg.giftMappings || get().giftMappings,
                alertStyle: msg.alertStyle || get().alertStyle,
                overlayLayout: msg.overlayLayout || get().overlayLayout,
                audioSettings: msg.audioSettings || get().audioSettings,
                templates: msg.templates || get().templates,
              });
            } else if (msg.type === 'events:batch' && Array.isArray(msg.events)) {
              const incoming = msg.events as LiveEventPayload[];
              const mergedRecent = [...incoming.filter((e) => e.type !== 'viewers'), ...get().recentEvents].slice(0, 80);
              set({
                liveStats: msg.liveStats || get().liveStats,
                testStats: msg.testStats || get().testStats,
                liveSupporters: msg.liveSupporters || get().liveSupporters,
                testSupporters: msg.testSupporters || get().testSupporters,
                discoveredGifts: msg.discoveredGifts || get().discoveredGifts,
                recentEvents: mergedRecent,
              });
              handleIncomingEvents(incoming);
            }
          } catch {
            // ignore malformed frame
          }
        };

        ws.onclose = () => {
          set({ wsConnected: false });
          if (pingTimer) clearInterval(pingTimer);
          if (!disposed) {
            reconnectTimer = setTimeout(connect, 2200);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      };

      connect();

      return () => {
        disposed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (pingTimer) clearInterval(pingTimer);
        if (activeWs) {
          try {
            activeWs.close();
          } catch {
            // ignore
          }
          activeWs = null;
        }
      };
    },

    connectTikTok: async (username) => {
      const { overlayId } = get();
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(overlayId)}/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (data.connection) set({ connection: data.connection });
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Failed to connect' };
        }
        set({ dataViewSource: 'live' });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      }
    },

    disconnectTikTok: async () => {
      const { overlayId } = get();
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(overlayId)}/disconnect`, {
          method: 'POST',
        });
        const data = await res.json();
        if (data.connection) set({ connection: data.connection });
      } catch {
        // ignore
      }
    },

    checkLiveStatus: async (username) => {
      const clean = username.trim().replace(/^@/, '');
      if (!clean) return { ok: false, error: 'Username required' };
      try {
        const res = await fetch(`/api/tiklive/live/${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Unable to check status' };
        }
        set((s) => ({
          connection: { ...s.connection, creator: data.data, username: clean },
        }));
        return { ok: true, data: data.data };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      }
    },

    triggerTestEvent: async (event) => {
      const { overlayId } = get();
      await fetch(`/api/rooms/${encodeURIComponent(overlayId)}/test-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...event, source: 'test' }),
      });
    },

    resetTestSession: async () => {
      const { overlayId } = get();
      await fetch(`/api/rooms/${encodeURIComponent(overlayId)}/reset-test`, { method: 'POST' });
    },

    resetLiveSession: async () => {
      const { overlayId } = get();
      await fetch(`/api/rooms/${encodeURIComponent(overlayId)}/reset-live`, { method: 'POST' });
    },

    updateGiftMappings: async (giftMappings) => {
      set({ giftMappings });
      await pushConfigToServer({ giftMappings });
    },

    updateAlertStyle: async (patch) => {
      const alertStyle = { ...get().alertStyle, ...patch };
      set({ alertStyle });
      await pushConfigToServer({ alertStyle });
    },

    updateOverlayLayout: async (patch) => {
      const overlayLayout = { ...get().overlayLayout, ...patch };
      set({ overlayLayout });
      await pushConfigToServer({ overlayLayout });
    },

    updateAudioSettings: async (patch) => {
      const audioSettings = { ...get().audioSettings, ...patch };
      audioEngine.updateSettings(audioSettings);
      set({ audioSettings });
      await pushConfigToServer({ audioSettings });
    },

    saveTemplate: async (name) => {
      const cleanName = name.trim();
      if (!cleanName) return;
      const state = get();
      const tpl: EffectTemplate = {
        id: `tpl_${Date.now()}`,
        name: cleanName,
        createdAt: Date.now(),
        giftMappings: structuredClone(state.giftMappings),
        alertStyle: { ...state.alertStyle },
        overlayLayout: { ...state.overlayLayout },
      };
      const templates = [tpl, ...state.templates];
      set({ templates });
      await pushConfigToServer({ templates });
    },

    applyTemplate: async (templateId) => {
      const tpl = get().templates.find((t) => t.id === templateId);
      if (!tpl) return;
      set({
        giftMappings: structuredClone(tpl.giftMappings),
        alertStyle: { ...tpl.alertStyle },
        overlayLayout: { ...tpl.overlayLayout },
      });
      await pushConfigToServer({
        giftMappings: tpl.giftMappings,
        alertStyle: tpl.alertStyle,
        overlayLayout: tpl.overlayLayout,
      });
    },

    deleteTemplate: async (templateId) => {
      const templates = get().templates.filter((t) => t.id !== templateId);
      set({ templates });
      await pushConfigToServer({ templates });
    },

    enqueueLocalPreview: (event, customConfig) => {
      const state = get();
      const cfg =
        customConfig ||
        resolveGiftMapping(state.giftMappings, event.giftId, event.giftName, event.diamondCount || 1);
      const now = Date.now();
      const instance: ActiveEffectInstance = {
        instanceId: `preview_${now}_${Math.random().toString(36).slice(2, 6)}`,
        event,
        config: cfg,
        startedAt: now,
        expiresAt: now + cfg.durationMs,
        streakCount: event.repeatCount || 1,
      };
      audioEngine.play(cfg.soundId, cfg.priority);
      set({
        activeEffects: [instance],
      });
    },

    pruneExpiredEffects: () => {
      const now = Date.now();
      const state = get();
      const remainingActive = state.activeEffects.filter((a) => a.expiresAt > now);
      const remainingAlerts = state.activeAlerts.filter((a) => now - a.createdAt < 5500);
      const nextQueue = [...state.effectQueue];
      const maxConcurrent = state.overlayLayout.performanceMode ? 1 : 2;

      let promoted = false;
      while (
        nextQueue.length > 0 &&
        remainingActive.length < maxConcurrent &&
        !remainingActive.some((a) => a.config.priority >= 4)
      ) {
        const next = nextQueue.shift()!;
        const dur = state.overlayLayout.performanceMode
          ? Math.min(next.config.durationMs, 3800)
          : next.config.durationMs;
        remainingActive.push({
          ...next,
          startedAt: now,
          expiresAt: now + dur,
        });
        if (state.alertStyle.soundOnGift) {
          audioEngine.play(next.config.soundId, next.config.priority);
        }
        promoted = true;
      }

      if (
        promoted ||
        remainingActive.length !== state.activeEffects.length ||
        remainingAlerts.length !== state.activeAlerts.length
      ) {
        set({
          activeEffects: remainingActive,
          effectQueue: nextQueue,
          activeAlerts: remainingAlerts,
        });
      }
    },

    fetchApiUsageAndPlans: async () => {
      set({ loadingApiMeta: true });
      try {
        const [usageRes, plansRes] = await Promise.all([
          fetch('/api/tiklive/usage').then((r) => r.json()),
          fetch('/api/tiklive/plans').then((r) => r.json()),
        ]);
        set({ usageInfo: usageRes, plansInfo: plansRes, loadingApiMeta: false });
      } catch {
        set({ loadingApiMeta: false });
      }
    },
  };
});
