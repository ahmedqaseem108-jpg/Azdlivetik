import { createRequire } from 'node:module';
import type { ConnectionState, CreatorInfo, LiveEventPayload, TikTokUser } from '../../src/shared/types.ts';
import {
  TikLiveApiError,
  tikLiveApiClient,
  validateTikTokUsername,
} from './tikLiveApiClient.ts';

const require = createRequire(import.meta.url);
// Load official tiklive-live CommonJS library
const { TikLiveClient } = require('tiklive-live') as {
  TikLiveClient: new (
    username: string,
    options: { apiKey: string; apiBase?: string }
  ) => TikLiveClientInstance;
};

interface TikLiveClientInstance {
  username: string;
  sessionId: string | null;
  roomId: string | null;
  isLive: boolean;
  isConnected: boolean;
  stopped: boolean;
  connect(): Promise<void>;
  disconnect(reason?: string): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): this;
  removeAllListeners(): this;
}

interface RawTikLiveUser {
  userId?: string | null;
  uniqueId?: string | null;
  nickname?: string | null;
  avatar?: string | null;
}

function normalizeUser(u?: RawTikLiveUser | null): TikTokUser {
  const uniqueId = u?.uniqueId || 'tiktok_viewer';
  return {
    userId: u?.userId ? String(u.userId) : uniqueId,
    uniqueId,
    nickname: u?.nickname || uniqueId,
    avatar: u?.avatar || null,
  };
}

export interface ConnectionCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onLiveEvent: (event: Omit<LiveEventPayload, 'id' | 'timestamp'>) => void;
}

// Global cross-room registry to prevent opening duplicate concurrent sessions for the same creator
const globalActiveByUsername = new Map<string, TikTokConnectionService>();

/**
 * Manages real TikLiveClient connections for an overlay room.
 * - Validates username against OpenAPI ^[A-Za-z0-9._-]{2,30}$
 * - Prevents duplicate sessions for the same username (even across tabs/overlay rooms!)
 * - Manages session open (POST), automatic renewal, and clean close (DELETE)
 * - Refreshes GET /v1/live/{username} periodically (respecting 30s cache) for fresh metadata
 * - Handles exact OpenAPI 401/404/429/502/503 and TikTok IP block errors cleanly
 */
export class TikTokConnectionService {
  private client: TikLiveClientInstance | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private metadataRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private manualDisconnect = false;
  private connectingLock = false;
  private callbacks: ConnectionCallbacks;

  public state: ConnectionState = {
    status: 'disconnected',
    username: '',
    sessionId: null,
    plan: null,
    creator: null,
    errorCode: null,
    errorMessage: null,
    lastEventAt: null,
    apiKeyConfigured: tikLiveApiClient.isConfigured(),
    reconnecting: false,
  };

  constructor(callbacks: ConnectionCallbacks) {
    this.callbacks = callbacks;
  }

  private updateState(patch: Partial<ConnectionState>): void {
    this.state = {
      ...this.state,
      ...patch,
      apiKeyConfigured: tikLiveApiClient.isConfigured(),
    };
    this.callbacks.onStateChange(this.state);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.metadataRefreshTimer) {
      clearInterval(this.metadataRefreshTimer);
      this.metadataRefreshTimer = null;
    }
  }

  private startMetadataRefresh(username: string): void {
    if (this.metadataRefreshTimer) clearInterval(this.metadataRefreshTimer);
    // Respect TikLive's 30s cache window (poll every 35s while active)
    this.metadataRefreshTimer = setInterval(async () => {
      if (this.manualDisconnect || !this.client || this.client.stopped) return;
      try {
        const info = await tikLiveApiClient.getLiveInfo(username);
        this.updateState({
          creator: {
            ...info,
            // Prefer live WS viewerCount if actively connected and higher/fresher
            viewerCount:
              this.state.status === 'connected' && (this.state.creator?.viewerCount || 0) > 0
                ? this.state.creator!.viewerCount
                : info.viewerCount,
          },
        });
      } catch {
        // Non-fatal metadata refresh failure (e.g. 503 busy_try_again) — keep live WS running
      }
    }, 35000);
  }

  async connect(rawUsername: string): Promise<ConnectionState> {
    let username: string;
    try {
      username = validateTikTokUsername(rawUsername).toLowerCase();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid username';
      this.updateState({
        status: 'error',
        errorCode: 'malformed_username',
        errorMessage: msg,
        reconnecting: false,
      });
      throw err;
    }

    if (!tikLiveApiClient.isConfigured()) {
      const msg =
        'TIKLIVE_API_KEY is missing in server environment variables. Configure it in Secrets to connect to live TikTok streams.';
      this.updateState({
        status: 'error',
        username,
        errorCode: 'missing_api_key',
        errorMessage: msg,
        reconnecting: false,
      });
      throw new TikLiveApiError(msg, 401, 'missing_api_key');
    }

    // Prevent duplicate concurrent sessions for the same username in this room
    if (
      this.client &&
      !this.client.stopped &&
      this.state.username === username &&
      (this.state.status === 'connected' ||
        this.state.status === 'connecting' ||
        this.state.status === 'waiting_live')
    ) {
      return this.state;
    }

    // Prevent duplicate concurrent sessions for the SAME username across other overlay rooms!
    const existingOwner = globalActiveByUsername.get(username);
    if (existingOwner && existingOwner !== this) {
      await existingOwner.disconnect();
    }

    if (this.connectingLock) {
      throw new TikLiveApiError(
        'A connection attempt is already in progress.',
        409,
        'connection_in_progress'
      );
    }

    this.connectingLock = true;
    this.manualDisconnect = false;
    this.clearTimers();

    try {
      // Cleanly close any previous creator session in this room before opening a new one
      if (this.client) {
        await this.disconnectInternal('switching_creator');
      }

      this.updateState({
        status: 'connecting',
        username,
        errorCode: null,
        errorMessage: null,
        reconnecting: false,
      });

      // Step 1: Query GET /v1/live/{username} (OpenAPI 3.1.0 Room metadata)
      let creatorInfo: CreatorInfo | null = null;
      try {
        creatorInfo = await tikLiveApiClient.getLiveInfo(username);
        this.updateState({ creator: creatorInfo });
      } catch (infoErr) {
        if (infoErr instanceof TikLiveApiError) {
          // Stop immediately on auth, malformed username, or quota/concurrency limits
          if ([400, 401, 403, 404, 429].includes(infoErr.status)) {
            this.updateState({
              status: 'error',
              errorCode: infoErr.code,
              errorMessage: infoErr.message,
              reconnecting: false,
            });
            throw infoErr;
          }
        }
        // For transient 502 / 503 busy_try_again, still proceed to open TikLive session
        creatorInfo = {
          username,
          nickname: username,
          avatar: null,
          title: '',
          roomId: null,
          isLive: false,
          viewerCount: 0,
        };
        this.updateState({ creator: creatorInfo });
      }

      // Step 2: Instantiate official tiklive-live client (opens POST /v1/live/{username}/session & auto-renews)
      const client = new TikLiveClient(username, {
        apiKey: tikLiveApiClient.apiKey,
        apiBase: tikLiveApiClient.apiBase,
      });
      this.client = client;
      globalActiveByUsername.set(username, this);
      this.attachClientListeners(client, username);

      await client.connect();
      this.reconnectAttempts = 0;
      this.startMetadataRefresh(username);

      return this.state;
    } catch (err) {
      const apiErr = err as { status?: number; code?: string; data?: { error?: string; message?: string }; message?: string };
      const code =
        apiErr.code ||
        apiErr.data?.error ||
        (apiErr.status === 429
          ? 'rate_limited'
          : apiErr.status === 401
            ? 'invalid_api_key'
            : 'connect_failed');
      const msg = apiErr.data?.message || apiErr.message || 'Failed to connect to TikLive API';

      // Detach listeners BEFORE disconnecting so 'end' cannot overwrite error state or loop reconnect
      if (this.client) {
        const failed = this.client;
        this.client = null;
        failed.removeAllListeners();
        try {
          await failed.disconnect('connect_failed');
        } catch {
          // ignore
        }
      }
      if (globalActiveByUsername.get(username) === this) {
        globalActiveByUsername.delete(username);
      }

      this.updateState({
        status: 'error',
        sessionId: null,
        errorCode: code,
        errorMessage: msg,
        reconnecting: false,
      });
      throw new TikLiveApiError(msg, apiErr.status || 400, code);
    } finally {
      this.connectingLock = false;
    }
  }

  private attachClientListeners(client: TikLiveClientInstance, username: string): void {
    const emitEvent = (ev: Omit<LiveEventPayload, 'id' | 'timestamp'>) => {
      this.state.lastEventAt = Date.now();
      this.callbacks.onLiveEvent(ev);
    };

    client.on('ready', (payload: unknown) => {
      const p = (payload || {}) as { plan?: string; sessionId?: string };
      this.updateState({
        sessionId: p.sessionId || null,
        plan: p.plan || null,
        status: this.state.status === 'connected' ? 'connected' : 'waiting_live',
      });
    });

    client.on('live', (payload: unknown) => {
      const p = (payload || {}) as { isLive?: boolean };
      if (this.state.creator) {
        this.updateState({
          creator: { ...this.state.creator, isLive: Boolean(p.isLive) },
          status: p.isLive ? this.state.status : 'waiting_live',
        });
      }
    });

    client.on('connected', (payload: unknown) => {
      const p = (payload || {}) as { roomId?: string };
      this.reconnectAttempts = 0;
      this.updateState({
        status: 'connected',
        errorCode: null,
        errorMessage: null,
        reconnecting: false,
        creator: this.state.creator
          ? {
              ...this.state.creator,
              isLive: true,
              roomId: p.roomId || this.state.creator.roomId,
            }
          : {
              username,
              nickname: username,
              avatar: null,
              title: '',
              roomId: p.roomId || null,
              isLive: true,
              viewerCount: 0,
            },
      });
    });

    client.on('disconnected', () => {
      if (this.manualDisconnect) return;
      this.updateState({
        status: 'waiting_live',
        reconnecting: true,
      });
    });

    client.on('streamEnd', () => {
      this.updateState({
        status: 'waiting_live',
        creator: this.state.creator ? { ...this.state.creator, isLive: false } : null,
      });
    });

    client.on('error', (err: unknown) => {
      const rawMsg = err instanceof Error ? err.message : String(err);
      let code = 'stream_error';
      let friendlyMsg = rawMsg;

      if (rawMsg.includes('tiktok_blocked')) {
        code = 'tiktok_blocked';
        friendlyMsg =
          'TikTok rejected the direct WebSocket connection from this server IP (HTTP 403). Per TikLive API architecture, tiklive-live opens the TikTok WebSocket from the host machine IP.';
      } else if (rawMsg.includes('tiktok_ws_unavailable')) {
        code = 'tiktok_ws_unavailable';
        friendlyMsg = 'TikTok LIVE WebSocket endpoints are temporarily unreachable. Retrying automatically...';
      } else if (rawMsg.includes('tiktok_unreachable')) {
        code = 'tiktok_unreachable';
        friendlyMsg = `Unable to reach TikTok room lookup (${rawMsg}). Retrying automatically...`;
      }

      this.updateState({
        errorCode: code,
        errorMessage: friendlyMsg,
      });
    });

    client.on('end', (payload: unknown) => {
      const p = (payload || {}) as { reason?: string };
      if (globalActiveByUsername.get(username) === this) {
        globalActiveByUsername.delete(username);
      }
      if (this.manualDisconnect) {
        this.updateState({
          status: 'disconnected',
          sessionId: null,
          reconnecting: false,
        });
        return;
      }

      const reason = p.reason || 'connection_ended';
      const isFatal =
        /invalid|unauthorized|quota|plan|concurrent|401|403|404|429|revoked/i.test(reason);
      if (isFatal) {
        this.clearTimers();
        this.updateState({
          status: 'error',
          sessionId: null,
          errorCode: reason,
          errorMessage: reason,
          reconnecting: false,
        });
        return;
      }

      this.scheduleReconnect(username);
    });

    // ---- ALL REAL NATIVE tiklive-live EVENTS ----

    client.on('gift', (e: unknown) => {
      const g = (e || {}) as {
        user?: RawTikLiveUser;
        giftId?: number | null;
        giftName?: string | null;
        diamondCount?: number;
        image?: string | null;
        repeatCount?: number;
        repeatEnd?: boolean;
        giftType?: number;
      };
      emitEvent({
        type: 'gift',
        source: 'live',
        user: normalizeUser(g.user),
        giftId: g.giftId ?? null,
        giftName: g.giftName ?? null,
        diamondCount: Number(g.diamondCount || 0),
        giftImage: g.image ?? null,
        repeatCount: Number(g.repeatCount || 1),
        repeatEnd: Boolean(g.repeatEnd),
        giftType: Number(g.giftType || 0),
      });
    });

    client.on('chat', (e: unknown) => {
      const c = (e || {}) as { user?: RawTikLiveUser; message?: string };
      emitEvent({
        type: 'chat',
        source: 'live',
        user: normalizeUser(c.user),
        message: c.message || '',
      });
    });

    client.on('like', (e: unknown) => {
      const l = (e || {}) as { user?: RawTikLiveUser; count?: number; totalCount?: number };
      emitEvent({
        type: 'like',
        source: 'live',
        user: normalizeUser(l.user),
        likeCount: Number(l.count || 1),
        totalLikes: Number(l.totalCount || 0),
      });
    });

    client.on('follow', (e: unknown) => {
      const f = (e || {}) as { user?: RawTikLiveUser };
      emitEvent({
        type: 'follow',
        source: 'live',
        user: normalizeUser(f.user),
      });
    });

    client.on('share', (e: unknown) => {
      const s = (e || {}) as { user?: RawTikLiveUser };
      emitEvent({
        type: 'share',
        source: 'live',
        user: normalizeUser(s.user),
      });
    });

    client.on('member', (e: unknown) => {
      const m = (e || {}) as { user?: RawTikLiveUser };
      emitEvent({
        type: 'member',
        source: 'live',
        user: normalizeUser(m.user),
      });
    });

    client.on('subscribe', (e: unknown) => {
      const s = (e || {}) as { user?: RawTikLiveUser };
      emitEvent({
        type: 'subscribe',
        source: 'live',
        user: normalizeUser(s.user),
      });
    });

    client.on('viewers', (e: unknown) => {
      const v = (e || {}) as { count?: number };
      const count = Number(v.count || 0);
      if (this.state.creator && this.state.creator.viewerCount !== count) {
        this.updateState({
          creator: { ...this.state.creator, viewerCount: count },
        });
      }
      emitEvent({
        type: 'viewers',
        source: 'live',
        user: { userId: 'system', uniqueId: 'system', nickname: 'System', avatar: null },
        viewerCount: count,
      });
    });

    client.on('question', (e: unknown) => {
      const q = (e || {}) as { user?: RawTikLiveUser; text?: string };
      emitEvent({
        type: 'question',
        source: 'live',
        user: normalizeUser(q.user),
        message: q.text || '',
      });
    });

    client.on('emote', (e: unknown) => {
      const em = (e || {}) as {
        user?: RawTikLiveUser;
        emoteId?: string | null;
        image?: string | null;
      };
      emitEvent({
        type: 'emote',
        source: 'live',
        user: normalizeUser(em.user),
        giftImage: em.image || null,
        message: em.emoteId || 'emote',
      });
    });
  }

  private scheduleReconnect(username: string): void {
    if (this.manualDisconnect || this.reconnectAttempts >= 5) {
      this.clearTimers();
      this.updateState({
        status: 'disconnected',
        reconnecting: false,
      });
      return;
    }

    this.reconnectAttempts += 1;
    const delayMs = Math.min(30000, 4000 * this.reconnectAttempts);
    this.updateState({
      status: 'waiting_live',
      reconnecting: true,
    });

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.manualDisconnect) {
        this.connect(username).catch(() => {
          // State already updated with error details
        });
      }
    }, delayMs);
  }

  private async disconnectInternal(reason: string): Promise<void> {
    this.clearTimers();
    const prevUsername = this.state.username;
    if (prevUsername && globalActiveByUsername.get(prevUsername) === this) {
      globalActiveByUsername.delete(prevUsername);
    }

    if (this.client) {
      const active = this.client;
      this.client = null;
      active.removeAllListeners();
      try {
        await active.disconnect(reason);
      } catch {
        // Fallback: explicitly call DELETE /v1/live/{username}/session if sessionId exists
        if (prevUsername && active.sessionId) {
          await tikLiveApiClient.closeSession(prevUsername, active.sessionId).catch(() => {});
        }
      }
    }
  }

  async disconnect(): Promise<ConnectionState> {
    this.manualDisconnect = true;
    await this.disconnectInternal('user_disconnect');
    this.updateState({
      status: 'disconnected',
      sessionId: null,
      reconnecting: false,
      errorCode: null,
      errorMessage: null,
    });
    return this.state;
  }
}
