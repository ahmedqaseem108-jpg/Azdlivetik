import crypto from 'node:crypto';
import type {
  EventSource,
  LiveEventPayload,
  LiveEventType,
  SessionStats,
  SupporterEntry,
} from '../../src/shared/types.ts';

export type EventHandlerFn = (
  event: LiveEventPayload,
  engine: EventProcessingEngine
) => LiveEventPayload[] | void;

export function createEmptyStats(): SessionStats {
  return {
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
}

/**
 * Extensible Event Processing Engine.
 * Supports registering custom handlers for any tiklive-live event type,
 * strictly isolates real LIVE stream metrics from Testing Mode metrics,
 * accurately handles gift combo streaks (giftType === 1),
 * and detects new Top 10 supporter entries in real time.
 */
export class EventProcessingEngine {
  private handlers = new Map<LiveEventType, EventHandlerFn[]>();
  public liveStats: SessionStats = createEmptyStats();
  public testStats: SessionStats = createEmptyStats();
  private liveSupportersMap = new Map<string, SupporterEntry>();
  private testSupportersMap = new Map<string, SupporterEntry>();
  private liveTop10Ids = new Set<string>();
  private testTop10Ids = new Set<string>();
  // Tracks ongoing gift combo streak counts so we only add delta points (no double counting!)
  private activeStreaks = new Map<string, { lastRepeatCount: number; updatedAt: number }>();
  public recentEvents: LiveEventPayload[] = [];
  public discoveredGifts = new Map<
    number,
    { giftId: number; giftName: string; diamondCount: number; image: string | null }
  >();

  constructor() {
    this.registerBuiltInHandlers();
  }

  registerHandler(type: LiveEventType, handler: EventHandlerFn): void {
    const existing = this.handlers.get(type) || [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  private registerBuiltInHandlers(): void {
    this.registerHandler('gift', (event) => {
      const stats = this.getStats(event.source);
      const supporters = this.getSupportersMap(event.source);
      const top10Set = event.source === 'live' ? this.liveTop10Ids : this.testTop10Ids;

      const diamondUnit = Math.max(0, Number(event.diamondCount || 0));
      const repeatCount = Math.max(1, Number(event.repeatCount || 1));
      const isStreakGift = event.giftType === 1;
      const streakKey = `${event.source}:${event.user.userId}:${event.giftId || event.giftName || 'gift'}`;

      let deltaCount = repeatCount;
      if (isStreakGift) {
        const prev = this.activeStreaks.get(streakKey);
        if (prev && repeatCount >= prev.lastRepeatCount && Date.now() - prev.updatedAt < 12000) {
          deltaCount = Math.max(0, repeatCount - prev.lastRepeatCount);
        }
        if (event.repeatEnd) {
          this.activeStreaks.delete(streakKey);
        } else {
          this.activeStreaks.set(streakKey, { lastRepeatCount: repeatCount, updatedAt: Date.now() });
        }
      }

      event.streakDelta = deltaCount;

      // Auto-discover real TikTok giftId for dynamic mapping in Editor
      if (event.giftId && event.giftId > 0) {
        this.discoveredGifts.set(event.giftId, {
          giftId: event.giftId,
          giftName: event.giftName || `Gift #${event.giftId}`,
          diamondCount: diamondUnit,
          image: event.giftImage || null,
        });
      }

      if (deltaCount > 0) {
        const addedPoints = diamondUnit * deltaCount;
        stats.giftsCount += deltaCount;
        stats.totalDiamonds += addedPoints;

        const key = event.user.userId || event.user.uniqueId;
        const existing = supporters.get(key);
        const updated: SupporterEntry = existing
          ? {
              ...existing,
              nickname: event.user.nickname || existing.nickname,
              avatar: event.user.avatar || existing.avatar,
              giftsCount: existing.giftsCount + deltaCount,
              totalPoints: existing.totalPoints + addedPoints,
              lastGiftName: event.giftName || existing.lastGiftName,
              lastGiftId: event.giftId ?? existing.lastGiftId,
              lastUpdated: event.timestamp,
            }
          : {
              userId: key,
              uniqueId: event.user.uniqueId,
              nickname: event.user.nickname || event.user.uniqueId,
              avatar: event.user.avatar,
              giftsCount: deltaCount,
              totalPoints: addedPoints,
              lastGiftName: event.giftName || 'Gift',
              lastGiftId: event.giftId ?? null,
              lastUpdated: event.timestamp,
              rank: 0,
            };

        supporters.set(key, updated);
        stats.supportersCount = supporters.size;

        // Recompute Top 10 & check if this user just broke into Top 10!
        const ranked = this.getRankedSupporters(event.source, 10);
        const nowInTop10 = ranked.find((s) => s.userId === key);
        const wasInTop10 = top10Set.has(key);

        top10Set.clear();
        for (const s of ranked) top10Set.add(s.userId);

        if (nowInTop10 && !wasInTop10) {
          return [
            {
              id: crypto.randomUUID(),
              type: 'top10_enter',
              source: event.source,
              timestamp: Date.now(),
              user: event.user,
              rank: nowInTop10.rank,
              totalPoints: nowInTop10.totalPoints,
              giftName: updated.lastGiftName,
            },
          ];
        }
      }
      return undefined;
    });

    this.registerHandler('like', (event) => {
      const stats = this.getStats(event.source);
      stats.totalLikes += Math.max(1, Number(event.likeCount || 1));
    });

    this.registerHandler('chat', (event) => {
      const stats = this.getStats(event.source);
      stats.totalComments += 1;
    });

    this.registerHandler('follow', (event) => {
      const stats = this.getStats(event.source);
      stats.totalFollows += 1;
    });

    this.registerHandler('viewers', (event) => {
      const stats = this.getStats(event.source);
      if (typeof event.viewerCount === 'number') {
        stats.viewerCount = event.viewerCount;
      }
    });
  }

  processEvent(rawEvent: Omit<LiveEventPayload, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): LiveEventPayload[] {
    const event: LiveEventPayload = {
      ...rawEvent,
      id: rawEvent.id || crypto.randomUUID(),
      timestamp: rawEvent.timestamp || Date.now(),
    };

    const stats = this.getStats(event.source);
    stats.eventsReceived += 1;

    const derived: LiveEventPayload[] = [event];
    const fns = this.handlers.get(event.type) || [];
    for (const fn of fns) {
      const extra = fn(event, this);
      if (extra && extra.length) {
        derived.push(...extra);
      }
    }

    // Keep recent event log bounded (prevent memory leaks)
    for (const ev of derived) {
      if (ev.type !== 'viewers') {
        this.recentEvents.unshift(ev);
      }
    }
    if (this.recentEvents.length > 150) {
      this.recentEvents.length = 150;
    }

    // Periodically prune stale streaks to avoid memory growth
    if (this.activeStreaks.size > 200) {
      const now = Date.now();
      for (const [k, v] of this.activeStreaks.entries()) {
        if (now - v.updatedAt > 20000) this.activeStreaks.delete(k);
      }
    }

    return derived;
  }

  getStats(source: EventSource): SessionStats {
    return source === 'live' ? this.liveStats : this.testStats;
  }

  getSupportersMap(source: EventSource): Map<string, SupporterEntry> {
    return source === 'live' ? this.liveSupportersMap : this.testSupportersMap;
  }

  getRankedSupporters(source: EventSource, limit = 25): SupporterEntry[] {
    const list = Array.from(this.getSupportersMap(source).values());
    list.sort((a, b) => b.totalPoints - a.totalPoints || b.lastUpdated - a.lastUpdated);
    return list.slice(0, limit).map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
  }

  resetLiveSession(): void {
    this.liveStats = createEmptyStats();
    this.liveSupportersMap.clear();
    this.liveTop10Ids.clear();
    this.recentEvents = this.recentEvents.filter((e) => e.source !== 'live');
  }

  resetTestSession(): void {
    this.testStats = createEmptyStats();
    this.testSupportersMap.clear();
    this.testTop10Ids.clear();
    this.recentEvents = this.recentEvents.filter((e) => e.source !== 'test');
  }

  getDiscoveredGiftsList() {
    return Array.from(this.discoveredGifts.values()).sort(
      (a, b) => b.diamondCount - a.diamondCount
    );
  }
}
