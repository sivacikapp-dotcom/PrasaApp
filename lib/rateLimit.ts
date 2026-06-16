import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _warnedMissingRedis = false;

function makeRateLimiter(requests: number, window: `${number} s` | `${number} m`) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!_warnedMissingRedis) {
      console.warn(
        "[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN nie sú nastavené — rate limiting je vypnutý. " +
        "Nastavte ich v .env.local aby boli API endpointy chránené."
      );
      _warnedMissingRedis = true;
    }
    return null;
  }
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
  });
}

// Lazy singletons — created once on first import per serverless instance
export const transcribeLimiter  = makeRateLimiter(10, "1 m");  // 10 prepisov/min/user
export const notifyLimiter      = makeRateLimiter(20, "1 m");  // 20 emailov/min/user
export const pushNotifyLimiter  = makeRateLimiter(30, "1 m");  // 30 push správ/min/user

/**
 * @param failClosed - ak true, odmietne požiadavku keď Redis nie je nakonfigurovaný.
 *                     Vhodné pre drahé operácie (napr. OpenAI API volania).
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  uid: string,
  failClosed = false
): Promise<boolean> {
  if (!limiter) return !failClosed;
  const { success } = await limiter.limit(uid);
  return success;
}
