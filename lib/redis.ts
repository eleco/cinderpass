import { Redis } from '@upstash/redis';

// Accepts KV_REST_API_* or Upstash's own UPSTASH_REDIS_REST_* names.
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
