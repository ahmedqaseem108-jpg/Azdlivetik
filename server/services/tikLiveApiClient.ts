import type {
  CreatorInfo,
  RateLimitMeta,
  TikLivePlansInfo,
  TikLiveUsageData,
  TikLiveUsageInfo,
} from '../../src/shared/types.ts';

const DEFAULT_API_BASE = 'https://api.tiklive.eu';
// Exact OpenAPI 3.1.0 username pattern: ^[A-Za-z0-9._-]{2,30}$
export const TIKTOK_USERNAME_REGEX = /^[A-Za-z0-9._-]{2,30}$/;

export function normalizeTikTokUsername(raw: string): string {
  let clean = String(raw || '').trim();
  // Support pasting full TikTok URLs like https://www.tiktok.com/@username/live
  const urlMatch = clean.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i);
  if (urlMatch?.[1]) {
    clean = urlMatch[1];
  }
  clean = clean.replace(/^@+/, '').split(/[/?#\s]/)[0].trim();
  return clean;
}

export function validateTikTokUsername(raw: string): string {
  const username = normalizeTikTokUsername(raw);
  if (!TIKTOK_USERNAME_REGEX.test(username)) {
    throw new TikLiveApiError(
      'Invalid TikTok username format. Must be 2–30 characters using letters, numbers, dots, underscores, or hyphens.',
      400,
      'malformed_username'
    );
  }
  return username;
}

export class TikLiveApiError extends Error {
  status: number;
  retryAfterSec?: number;
  code: string;

  constructor(message: string, status: number, code = 'tiklive_api_error', retryAfterSec?: number) {
    super(message);
    this.name = 'TikLiveApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

interface JsonResponse<T> {
  status: number;
  data: T;
  rateLimit: RateLimitMeta;
}

export interface SessionOpenResponse {
  sessionId: string;
  renewEvery?: number;
  plan?: string;
  connection?: Record<string, unknown>;
  [key: string]: unknown;
}

export class TikLiveApiClient {
  // Short per-second rate-limit cooldown ONLY when API specifically returns error="rate_limited" (10 req/s)
  private burstCooldownUntil = 0;

  get apiKey(): string {
    return (process.env.TIKLIVE_API_KEY || '').trim();
  }

  get apiBase(): string {
    return (process.env.TIKLIVE_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey !== 'YOUR_TIKLIVE_API_KEY');
  }

  private extractRateLimit(headers: Headers): RateLimitMeta {
    const parseNum = (v: string | null) => {
      if (!v) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return {
      limit: parseNum(headers.get('x-ratelimit-limit')),
      remaining: parseNum(headers.get('x-ratelimit-remaining')),
      reset: parseNum(headers.get('x-ratelimit-reset')),
      cache: headers.get('x-cache') || undefined,
    };
  }

  private async requestJson<T>(
    path: string,
    options: { method?: string; requireAuth?: boolean; body?: unknown; bypassCooldown?: boolean } = {}
  ): Promise<JsonResponse<T>> {
    const { method = 'GET', requireAuth = true, body, bypassCooldown = false } = options;

    if (!bypassCooldown && Date.now() < this.burstCooldownUntil) {
      const waitMs = this.burstCooldownUntil - Date.now();
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 1500)));
    }

    if (requireAuth && !this.isConfigured()) {
      throw new TikLiveApiError(
        'TIKLIVE_API_KEY is not configured in server environment variables.',
        401,
        'missing_api_key'
      );
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'LiveEffectsPro/1.2',
    };
    if (this.isConfigured()) {
      headers['X-API-Key'] = this.apiKey;
    }

    let serializedBody: string | undefined;
    if (body !== undefined) {
      serializedBody = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(serializedBody));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);

    try {
      const res = await fetch(`${this.apiBase}${path}`, {
        method,
        headers,
        body: serializedBody,
        signal: controller.signal,
      });

      const rateLimit = this.extractRateLimit(res.headers);
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        parsed = { raw: text };
      }

      if (!res.ok) {
        const apiErrorCode =
          typeof parsed.error === 'string' && parsed.error ? parsed.error : `http_${res.status}`;
        const apiMessage =
          typeof parsed.message === 'string' && parsed.message ? parsed.message : '';

        // Exact OpenAPI 3.1.0 error handling
        if (res.status === 401) {
          throw new TikLiveApiError(
            apiMessage || 'Invalid or missing TikLive API key (401).',
            401,
            apiErrorCode
          );
        }

        if (res.status === 404) {
          throw new TikLiveApiError(
            apiMessage || 'Malformed or unknown TikTok username (404).',
            404,
            apiErrorCode === 'http_404' ? 'malformed_username' : apiErrorCode
          );
        }

        if (res.status === 429) {
          const retryHeader = res.headers.get('retry-after');
          const retrySec = retryHeader ? Math.max(1, parseInt(retryHeader, 10) || 2) : 2;
          if (apiErrorCode === 'rate_limited') {
            this.burstCooldownUntil = Date.now() + retrySec * 1000;
            throw new TikLiveApiError(
              apiMessage || `Rate limited (10 req/s). Retry in ${retrySec}s.`,
              429,
              'rate_limited',
              retrySec
            );
          }
          if (apiErrorCode === 'concurrent_live_limit_reached') {
            throw new TikLiveApiError(
              apiMessage ||
                'Concurrent LIVE session limit reached for your TikLive plan. Disconnect an active session or wait ~90s for stale slots to clear.',
              429,
              'concurrent_live_limit_reached'
            );
          }
          if (apiErrorCode === 'daily_quota_exceeded') {
            throw new TikLiveApiError(
              apiMessage || 'Daily TikLive API request quota exceeded.',
              429,
              'daily_quota_exceeded'
            );
          }
          throw new TikLiveApiError(
            apiMessage || `TikLive API quota/rate limit reached (${apiErrorCode}).`,
            429,
            apiErrorCode,
            retrySec
          );
        }

        if (res.status === 502) {
          throw new TikLiveApiError(
            apiMessage || 'TikTok upstream is temporarily unavailable (502). Please retry shortly.',
            502,
            apiErrorCode === 'http_502' ? 'tiktok_upstream_unavailable' : apiErrorCode
          );
        }

        if (res.status === 503) {
          throw new TikLiveApiError(
            apiMessage || 'TikLive lookup queue is busy (busy_try_again). Please retry in a few seconds.',
            503,
            apiErrorCode === 'http_503' ? 'busy_try_again' : apiErrorCode
          );
        }

        throw new TikLiveApiError(
          apiMessage || apiErrorCode || `TikLive API HTTP ${res.status}`,
          res.status,
          apiErrorCode
        );
      }

      return { status: res.status, data: parsed as T, rateLimit };
    } catch (err) {
      if (err instanceof TikLiveApiError) throw err;
      const msg = err instanceof Error ? err.message : 'Network error';
      throw new TikLiveApiError(`TikLive API unreachable: ${msg}`, 502, 'network_error');
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * GET /v1/live/{username} — Public LIVE room information (cached 30s per creator)
   */
  async getLiveInfo(rawUsername: string): Promise<CreatorInfo> {
    const username = validateTikTokUsername(rawUsername);

    const { data, rateLimit } = await this.requestJson<Record<string, unknown>>(
      `/v1/live/${encodeURIComponent(username)}`,
      { method: 'GET', requireAuth: true }
    );

    const hashtagsRaw = Array.isArray(data.hashtags) ? data.hashtags : [];
    const hashtags = hashtagsRaw
      .map((h) => (typeof h === 'string' ? h : (h as { title?: string })?.title || ''))
      .filter(Boolean);

    return {
      username: typeof data.username === 'string' ? data.username : username,
      roomId: data.roomId ? String(data.roomId) : null,
      isLive: Boolean(data.isLive),
      ownerId: data.ownerId ? String(data.ownerId) : null,
      nickname: typeof data.nickname === 'string' && data.nickname ? data.nickname : username,
      avatar: typeof data.avatar === 'string' && data.avatar ? data.avatar : null,
      title: typeof data.title === 'string' ? data.title : '',
      gameTag: typeof data.gameTag === 'string' ? data.gameTag : null,
      viewerCount: typeof data.viewerCount === 'number' ? data.viewerCount : 0,
      cover: typeof data.cover === 'string' ? data.cover : null,
      hashtags,
      rateLimit,
    };
  }

  /**
   * POST /v1/live/{username}/session — Open (omit sessionId -> 201) or renew (pass sessionId -> 200)
   */
  async openOrRenewSession(
    rawUsername: string,
    sessionId?: string
  ): Promise<{ status: number; data: SessionOpenResponse }> {
    const username = validateTikTokUsername(rawUsername);
    const body = sessionId ? { sessionId } : {};
    const res = await this.requestJson<SessionOpenResponse>(
      `/v1/live/${encodeURIComponent(username)}/session`,
      { method: 'POST', requireAuth: true, body }
    );
    return { status: res.status, data: res.data };
  }

  /**
   * DELETE /v1/live/{username}/session — Close live session and free the concurrent slot
   */
  async closeSession(rawUsername: string, sessionId: string): Promise<void> {
    const username = validateTikTokUsername(rawUsername);
    if (!sessionId) return;
    await this.requestJson<Record<string, unknown>>(
      `/v1/live/${encodeURIComponent(username)}/session`,
      {
        method: 'DELETE',
        requireAuth: true,
        body: { sessionId },
        bypassCooldown: true,
      }
    );
  }

  /**
   * GET /v1/usage — Today's API usage and daily quota
   */
  async getUsage(): Promise<TikLiveUsageInfo> {
    if (!this.isConfigured()) {
      return {
        available: false,
        configured: false,
        errorCode: 'missing_api_key',
        error: 'TIKLIVE_API_KEY is not configured in server environment variables.',
      };
    }
    try {
      const { data } = await this.requestJson<TikLiveUsageData>('/v1/usage', {
        method: 'GET',
        requireAuth: true,
      });
      return { available: true, configured: true, data };
    } catch (err) {
      return {
        available: false,
        configured: true,
        errorCode: err instanceof TikLiveApiError ? err.code : 'unknown_error',
        error: err instanceof Error ? err.message : 'Failed to fetch usage',
      };
    }
  }

  /**
   * GET /v1/plans — Public plan limits and prices (no auth required)
   */
  async getPlans(): Promise<TikLivePlansInfo> {
    try {
      const { data } = await this.requestJson<TikLivePlansInfo['data']>('/v1/plans', {
        method: 'GET',
        requireAuth: false,
      });
      return { available: true, data };
    } catch (err) {
      return {
        available: false,
        error: err instanceof Error ? err.message : 'Failed to fetch plans',
      };
    }
  }
}

export const tikLiveApiClient = new TikLiveApiClient();
