import { Redis } from '@upstash/redis';

// Vercel's Upstash integration injects KV_REST_API_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*.
export function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

let client: Redis | undefined;
let clientUrl: string | undefined;

export function getRedis(): Redis {
  const config = redisConfig();
  if (!config) throw new Error('Redis is not configured');
  if (!client || clientUrl !== config.url) {
    // Values are opaque strings; keep the SDK from turning numeric-looking strings into numbers.
    client = new Redis({ ...config, automaticDeserialization: false });
    clientUrl = config.url;
  }
  return client;
}
