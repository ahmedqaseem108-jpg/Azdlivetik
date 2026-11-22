import fs from 'node:fs';
import path from 'node:path';
import type { WebSocket } from 'ws';
import {
  DEFAULT_ALERT_STYLE,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_GIFT_MAPPINGS,
  DEFAULT_OVERLAY_LAYOUT,
} from '../../src/shared/giftCatalog.ts';
import type {
  AlertStyleConfig,
  AudioSettings,
  EffectTemplate,
  GiftEffectConfig,
  LiveEventPayload,
  OverlayLayoutConfig,
  OverlayRoomSnapshot,
} from '../../src/shared/types.ts';
import { EventProcessingEngine } from './eventProcessingEngine.ts';
import { TikTokConnectionService } from './tiktokConnectionService.ts';

interface ClientSocketMeta {
  ws: WebSocket;
  role: 'control' | 'overlay';
}

interface PersistedRoomConfig {
  giftMappings: GiftEffectConfig[];
  alertStyle: AlertStyleConfig;
  overlayLayout: OverlayLayoutConfig;
  audioSettings: AudioSettings;
  templates: EffectTemplate[];
}

export class OverlayRoom {
  public readonly overlayId: string;
  public readonly eventEngine: EventProcessingEngine;
  public readonly connectionService: TikTokConnectionService;
  public giftMappings: GiftEffectConfig[];
  public alertStyle: AlertStyleConfig;
  public overlayLayout: OverlayLayoutConfig;
  public audioSettings: AudioSettings;
  public templates: EffectTemplate[];
  private clients = new Set<ClientSocketMeta>();
  private onPersist: () => void;

  constructor(overlayId: string, saved: PersistedRoomConfig | undefined, onPersist: () => void) {
    this.overlayId = overlayId;
    this.onPersist = onPersist;

    this.giftMappings = saved?.giftMappings?.length
      ? saved.giftMappings
      : structuredClone(DEFAULT_GIFT_MAPPINGS);
    this.alertStyle = saved?.alertStyle
      ? { ...DEFAULT_ALERT_STYLE, ...saved.alertStyle }
      : { ...DEFAULT_ALERT_STYLE };
    this.overlayLayout = saved?.overlayLayout
      ? { ...DEFAULT_OVERLAY_LAYOUT, ...saved.overlayLayout }
      : { ...DEFAULT_OVERLAY_LAYOUT };
    this.audioSettings = saved?.audioSettings
      ? { ...DEFAULT_AUDIO_SETTINGS, ...saved.audioSettings }
      : { ...DEFAULT_AUDIO_SETTINGS };
    this.templates = saved?.templates || [];

    this.eventEngine = new EventProcessingEngine();
    this.connectionService = new TikTokConnectionService({
      onStateChange: (connection) => {
        if (connection.status === 'connected' && !this.eventEngine.liveStats.connectedAt) {
          this.eventEngine.liveStats.connectedAt = Date.now();
        }
        if (connection.status === 'disconnected') {
          this.eventEngine.liveStats.connectedAt = null;
        }
        this.broadcast({ type: 'connection:update', connection, liveStats: this.eventEngine.liveStats });
      },
      onLiveEvent: (rawEvent) => {
        this.ingestEvent(rawEvent);
      },
    });
  }

  addClient(ws: WebSocket, role: 'control' | 'overlay'): void {
    const meta: ClientSocketMeta = { ws, role };
    this.clients.add(meta);

    // Send full initial authoritative snapshot
    this.sendTo(ws, { type: 'room:snapshot', snapshot: this.getSnapshot() });
    this.broadcastOverlayCount();

    ws.on('close', () => {
      this.clients.delete(meta);
      this.broadcastOverlayCount();
    });
  }

  getConnectedOverlaysCount(): number {
    let count = 0;
    for (const c of this.clients) {
      if (c.role === 'overlay' && c.ws.readyState === 1) count += 1;
    }
    return count;
  }

  private broadcastOverlayCount(): void {
    this.broadcast({
      type: 'overlays:count',
      connectedOverlaysCount: this.getConnectedOverlaysCount(),
    });
  }

  ingestEvent(rawEvent: Omit<LiveEventPayload, 'id' | 'timestamp'>): LiveEventPayload[] {
    const emitted = this.eventEngine.processEvent(rawEvent);
    this.broadcast({
      type: 'events:batch',
      events: emitted,
      liveStats: this.eventEngine.liveStats,
      testStats: this.eventEngine.testStats,
      liveSupporters: this.eventEngine.getRankedSupporters('live', 20),
      testSupporters: this.eventEngine.getRankedSupporters('test', 20),
      discoveredGifts: this.eventEngine.getDiscoveredGiftsList(),
    });
    return emitted;
  }

  updateConfig(patch: Partial<PersistedRoomConfig>): void {
    if (patch.giftMappings) this.giftMappings = patch.giftMappings;
    if (patch.alertStyle) this.alertStyle = { ...this.alertStyle, ...patch.alertStyle };
    if (patch.overlayLayout) this.overlayLayout = { ...this.overlayLayout, ...patch.overlayLayout };
    if (patch.audioSettings) this.audioSettings = { ...this.audioSettings, ...patch.audioSettings };
    if (patch.templates) this.templates = patch.templates;

    this.onPersist();
    this.broadcast({
      type: 'config:update',
      giftMappings: this.giftMappings,
      alertStyle: this.alertStyle,
      overlayLayout: this.overlayLayout,
      audioSettings: this.audioSettings,
      templates: this.templates,
    });
  }

  resetTestSession(): void {
    this.eventEngine.resetTestSession();
    this.broadcast({ type: 'room:snapshot', snapshot: this.getSnapshot() });
  }

  resetLiveSession(): void {
    this.eventEngine.resetLiveSession();
    this.broadcast({ type: 'room:snapshot', snapshot: this.getSnapshot() });
  }

  toPersisted(): PersistedRoomConfig {
    return {
      giftMappings: this.giftMappings,
      alertStyle: this.alertStyle,
      overlayLayout: this.overlayLayout,
      audioSettings: this.audioSettings,
      templates: this.templates,
    };
  }

  getSnapshot(): OverlayRoomSnapshot {
    return {
      overlayId: this.overlayId,
      connection: this.connectionService.state,
      liveStats: this.eventEngine.liveStats,
      testStats: this.eventEngine.testStats,
      liveSupporters: this.eventEngine.getRankedSupporters('live', 20),
      testSupporters: this.eventEngine.getRankedSupporters('test', 20),
      recentEvents: this.eventEngine.recentEvents.slice(0, 60),
      giftMappings: this.giftMappings,
      alertStyle: this.alertStyle,
      overlayLayout: this.overlayLayout,
      audioSettings: this.audioSettings,
      templates: this.templates,
      connectedOverlaysCount: this.getConnectedOverlaysCount(),
      discoveredGifts: this.eventEngine.getDiscoveredGiftsList(),
    };
  }

  private sendTo(ws: WebSocket, payload: unknown): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }

  broadcast(payload: unknown): void {
    const encoded = JSON.stringify(payload);
    for (const c of this.clients) {
      if (c.ws.readyState === 1) {
        c.ws.send(encoded);
      }
    }
  }
}

class OverlayHubService {
  private rooms = new Map<string, OverlayRoom>();
  private persistedMap = new Map<string, PersistedRoomConfig>();
  private storeFile = path.resolve(process.cwd(), 'data', 'overlay-state.json');
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadPersistedState();
  }

  private loadPersistedState(): void {
    try {
      if (fs.existsSync(this.storeFile)) {
        const raw = fs.readFileSync(this.storeFile, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, PersistedRoomConfig>;
        for (const [k, v] of Object.entries(parsed)) {
          this.persistedMap.set(k, v);
        }
      }
    } catch {
      // Safe fallback to in-memory defaults
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      try {
        const dir = path.dirname(this.storeFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const out: Record<string, PersistedRoomConfig> = {};
        for (const [id, room] of this.rooms.entries()) {
          out[id] = room.toPersisted();
        }
        for (const [id, cfg] of this.persistedMap.entries()) {
          if (!out[id]) out[id] = cfg;
        }
        fs.writeFileSync(this.storeFile, JSON.stringify(out, null, 2), 'utf8');
      } catch {
        // Ignore read-only filesystem errors gracefully
      }
    }, 400);
  }

  getOrCreateRoom(rawId: string): OverlayRoom {
    const cleanId = (rawId || 'main-studio').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'main-studio';
    let room = this.rooms.get(cleanId);
    if (!room) {
      room = new OverlayRoom(cleanId, this.persistedMap.get(cleanId), () => this.schedulePersist());
      this.rooms.set(cleanId, room);
    }
    return room;
  }

  async shutdownAll(): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    for (const room of this.rooms.values()) {
      tasks.push(room.connectionService.disconnect().catch(() => {}));
    }
    await Promise.all(tasks);
  }
}

export const overlayHubService = new OverlayHubService();
