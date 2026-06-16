import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function makeRateLimiter(requests: number, window: `${number} s` | `${number} m`) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // graceful no-op in dev without Redis
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
  });
}

// Lazy singletons — created once on first import per serverless instance
export const transcribeLimiter  = makeRateLimiter(10, "1 m");  // 10 transcriptions/min/user
export const notifyLimiter      = makeRateLimiter(20, "1 m");  // 20 emails/min/user
export const pushNotifyLimiter  = makeRateLimiter(30, "1 m");  // 30 push sends/min/user

export async function checkRateLimit(
  limiter: Ratelimit | null,
  uid: string
): Promise<boolean> {
  if (!limiter) return true; // allow if Redis not configured
  const { success } = await limiter.limit(uid);
  return success;
}
