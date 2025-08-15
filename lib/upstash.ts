import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    })
  : undefined;

export const commentRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(5, "60 s"),
      analytics: false
    })
  : undefined;

export async function limitOrThrow(key: string) {
  if (!commentRateLimit) return;
  const res = await commentRateLimit.limit(key);
  if (!res.success) {
    const err: any = new Error("Too many requests");
    err.status = 429;
    throw err;
  }
}
