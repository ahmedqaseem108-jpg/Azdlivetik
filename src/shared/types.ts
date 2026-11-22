export type Language = 'ar' | 'en';

export type EventSource = 'live' | 'test';

export type LiveEventType =
  | 'gift'
  | 'chat'
  | 'like'
  | 'follow'
  | 'share'
  | 'member'
  | 'subscribe'
  | 'viewers'
  | 'battle'
  | 'rank'
  | 'question'
  | 'emote'
  | 'top10_enter';

export type VisualEffectType =
  | '3d_gift'
  | 'particle_explosion'
  | 'golden_light'
  | 'lightning'
  | 'fire'
  | 'neon_glow'
  | 'energy_waves'
  | 'cinematic_bg'
  | 'flying_coins'
  | 'confetti'
  | 'fireworks'
  | '3d_floating_text'
  | 'gift_card'
  | 'avatar_entrance'
  | 'legendary';

export type ThreeDModelPreset =
  | 'rose'
  | 'tiktok_logo'
  | 'heart_crystal'
  | 'galaxy'
  | 'lion'
  | 'universe'
  | 'crown'
  | 'diamond';

export type SoundPresetId =
  | 'gift_chime'
  | 'explosion_boom'
  | 'laser_neon'
  | 'supporter_fanfare'
  | 'alert_ping'
  | 'legendary_roar'
  | 'coins_cascade'
  | 'fire_whoosh'
  | 'cosmic_drop'
  | 'none';

export type EffectPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type OverlayResolution = '1920x1080' | '1080x1920' | '1280x720';

export interface TikTokUser {
  userId: string;
  uniqueId: string;
  nickname: string;
  avatar: string | null;
}

export interface LiveEventPayload {
  id: string;
  type: LiveEventType;
  source: EventSource;
  timestamp: number;
  user: TikTokUser;
  // Gift fields (matches tiklive-live WebcastGiftMessage)
  giftId?: number | null;
  giftName?: string | null;
  diamondCount?: number;
  giftImage?: string | null;
  repeatCount?: number;
  repeatEnd?: boolean;
  giftType?: number; // 1 = streak/combo gift
  streakDelta?: number; // Newly added items in this event for accurate points
  // Chat / question fields
  message?: string;
  // Like fields
  likeCount?: number;
  totalLikes?: number;
  // Viewer count
  viewerCount?: number;
  // Top 10 entry
  rank?: number;
  totalPoints?: number;
  // Optional direct effect override (for Testing Mode individual effect preview)
  forceEffect?: VisualEffectType;
  force3DModel?: ThreeDModelPreset;
  forceConfig?: Partial<GiftEffectConfig>;
}

export interface GiftEffectConfig {
  id: string;
  giftId: number; // Real TikTok giftId (0 = default/fallback)
  giftName: string;
  giftNameAr: string;
  diamondCost: number;
  primaryEffect: VisualEffectType;
  secondaryEffects: VisualEffectType[];
  model3D?: ThreeDModelPreset;
  use3D: boolean;
  primaryColor: string;
  secondaryColor: string;
  scale: number; // 0.5 - 2.0
  durationMs: number; // 1500 - 10000
  position: EffectPosition;
  soundId: SoundPresetId | string; // Built-in preset or custom sound ID
  priority: number; // 1 = standard, 2 = rare, 3 = epic, 4 = legendary
  enabled: boolean;
}

export interface SupporterEntry {
  userId: string;
  uniqueId: string;
  nickname: string;
  avatar: string | null;
  giftsCount: number;
  totalPoints: number; // Total diamonds / points
  lastGiftName: string;
  lastGiftId: number | null;
  lastUpdated: number;
  rank: number;
}

export interface AlertStyleConfig {
  showComments: boolean;
  showFollowAlerts: boolean;
  showShareAlerts: boolean;
  showSubscribeAlerts: boolean;
  showMemberAlerts: boolean;
  showTop10Alerts: boolean;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: 'Cairo' | 'Outfit' | 'JetBrains Mono';
  fontSize: number; // px
  animationStyle: 'slide' | 'scale' | 'cinematic';
  direction: 'rtl' | 'ltr' | 'auto';
  soundOnGift: boolean;
  soundOnFollow: boolean;
  soundOnComment: boolean;
  soundOnSubscribe: boolean;
}

export interface OverlayLayoutConfig {
  resolution: OverlayResolution;
  showEffects: boolean;
  showTop3Podium: boolean;
  showTop10List: boolean;
  showComments: boolean;
  showAlerts: boolean;
  showLiveStats: boolean;
  effectsScale: number;
  effectsOffsetX: number; // -40 to 40 (%)
  effectsOffsetY: number; // -40 to 40 (%)
  podiumPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  podiumScale: number;
  commentsPosition: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  commentsScale: number;
  performanceMode: boolean;
}

export interface AudioSettings {
  masterVolume: number; // 0 - 1
  muted: boolean;
  maxConcurrentSounds: number; // 1 - 5
  preventOverlap: boolean;
}

export interface EffectTemplate {
  id: string;
  name: string;
  createdAt: number;
  giftMappings: GiftEffectConfig[];
  alertStyle: AlertStyleConfig;
  overlayLayout: OverlayLayoutConfig;
}

export interface RateLimitMeta {
  limit?: number;
  remaining?: number;
  reset?: number; // Unix seconds
  cache?: 'HIT' | 'MISS' | 'STALE' | string;
}

/** Exact OpenAPI 3.1.0 Room schema from https://api.tiklive.eu */
export interface CreatorInfo {
  username: string;
  roomId: string | null;
  isLive: boolean;
  ownerId?: string | null;
  nickname: string;
  avatar: string | null;
  title: string;
  gameTag?: string | null;
  viewerCount: number;
  cover?: string | null;
  hashtags?: string[];
  rateLimit?: RateLimitMeta;
}

export interface SessionStats {
  giftsCount: number;
  supportersCount: number;
  totalDiamonds: number;
  totalLikes: number;
  totalComments: number;
  totalFollows: number;
  eventsReceived: number;
  viewerCount: number;
  connectedAt: number | null;
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'waiting_live' | 'connected' | 'error';
  username: string;
  sessionId: string | null;
  plan: string | null;
  creator: CreatorInfo | null;
  errorCode?: string | null;
  errorMessage: string | null;
  lastEventAt: number | null;
  apiKeyConfigured: boolean;
  reconnecting: boolean;
}

export interface OverlayRoomSnapshot {
  overlayId: string;
  connection: ConnectionState;
  liveStats: SessionStats;
  testStats: SessionStats;
  liveSupporters: SupporterEntry[];
  testSupporters: SupporterEntry[];
  recentEvents: LiveEventPayload[];
  giftMappings: GiftEffectConfig[];
  alertStyle: AlertStyleConfig;
  overlayLayout: OverlayLayoutConfig;
  audioSettings: AudioSettings;
  templates: EffectTemplate[];
  connectedOverlaysCount: number;
  discoveredGifts: Array<{
    giftId: number;
    giftName: string;
    diamondCount: number;
    image: string | null;
  }>;
}

/** Exact OpenAPI 3.1.0 Usage schema */
export interface TikLiveUsageData {
  plan: string;
  planId: string;
  requestsToday: number;
  requestsLimit: number;
  resetsAt: number; // Unix seconds
}

export interface TikLiveUsageInfo {
  available: boolean;
  configured: boolean;
  data?: TikLiveUsageData;
  errorCode?: string;
  error?: string;
}

export interface TikLivePlanEntry {
  name?: string;
  priceCents?: number;
  requestsPerDay?: number;
  concurrentLives?: number;
  apiKeys?: number;
  alerts?: number;
  [key: string]: unknown;
}

export interface TikLivePlansInfo {
  available: boolean;
  data?: { plans?: Record<string, TikLivePlanEntry> } | Record<string, TikLivePlanEntry>;
  error?: string;
}
