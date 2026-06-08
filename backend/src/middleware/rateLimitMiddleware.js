import { pool } from '../config/db.js';

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX = 120;
const MAX_KEYS = 10000;

const memoryFallback = new Map();

function pruneFallback(now) {
  if (memoryFallback.size < MAX_KEYS) return;
  for (const [key, bucket] of memoryFallback.entries()) {
    if (bucket.resetAt <= now) {
      memoryFallback.delete(key);
    }
  }
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getBucketKey(req, keyPrefix, keyGenerator) {
  const ip = getClientIp(req);
  const generated = typeof keyGenerator === 'function' ? keyGenerator(req) : '';
  return `${keyPrefix}:${ip}:${generated || ''}`;
}

export function rateLimit({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX,
  keyPrefix = 'global',
  keyGenerator,
  message = 'Too many requests. Please wait and try again.'
} = {}) {
  return async (req, res, next) => {
    const key = getBucketKey(req, keyPrefix, keyGenerator);
    const now = new Date();
    const resetTime = new Date(now.getTime() + windowMs);

    let count = 1;
    let resetAt = resetTime.getTime();

    try {
      const result = await pool.query(
        `INSERT INTO rate_limits (key, count, reset_at)
         VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE
         SET count = CASE
                       WHEN rate_limits.reset_at <= $3 THEN 1
                       ELSE rate_limits.count + 1
                     END,
             reset_at = CASE
                          WHEN rate_limits.reset_at <= $3 THEN $2
                          ELSE rate_limits.reset_at
                        END
         RETURNING count, reset_at`,
        [key, resetTime, now]
      );
      
      count = result.rows[0].count;
      resetAt = new Date(result.rows[0].reset_at).getTime();

      if (Math.random() < 0.01) {
        pool.query('DELETE FROM rate_limits WHERE reset_at <= $1', [now]).catch(() => {});
      }
    } catch (error) {
      const ts = now.getTime();
      pruneFallback(ts);
      const existing = memoryFallback.get(key);
      const bucket = existing && existing.resetAt > ts
        ? existing
        : { count: 0, resetAt: ts + windowMs };

      bucket.count += 1;
      memoryFallback.set(key, bucket);

      count = bucket.count;
      resetAt = bucket.resetAt;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000));
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (count > max) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message
      });
    }

    return next();
  };
}

export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.GLOBAL_RATE_LIMIT_PER_MINUTE || 300),
  keyPrefix: 'global'
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_PER_15_MINUTES || 20),
  keyPrefix: 'auth',
  keyGenerator: (req) => String(req.body?.identifier || req.body?.username || req.body?.email || '').trim().toLowerCase(),
  message: 'Too many login or signup attempts. Please wait and try again.'
});

export const usernameLookupRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.USERNAME_LOOKUP_RATE_LIMIT_PER_MINUTE || 30),
  keyPrefix: 'username_lookup'
});

export const uploadRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_LIMIT_PER_10_MINUTES || 30),
  keyPrefix: 'upload',
  message: 'Too many uploads. Please wait and try again.'
});

export const agentPairingRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.AGENT_PAIRING_RATE_LIMIT_PER_10_MINUTES || 15),
  keyPrefix: 'agent_pairing',
  message: 'Too many desktop pairing attempts. Please wait and try again.'
});

export const diagnosticsRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.DESKTOP_DIAGNOSTICS_RATE_LIMIT_PER_10_MINUTES || 20),
  keyPrefix: 'desktop_diagnostics',
  message: 'Too many diagnostics submissions. Please wait and try again.'
});

export const paymentRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.PAYMENT_RATE_LIMIT_PER_10_MINUTES || 30),
  keyPrefix: 'payment',
  keyGenerator: (req) => String(req.user?.id || req.body?.orderId || '').trim(),
  message: 'Too many payment attempts. Please wait and try again.'
});

export const centreLookupRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.CENTRE_LOOKUP_RATE_LIMIT_PER_MINUTE || 30),
  keyPrefix: 'centre_lookup',
  message: 'Too many centre lookups. Please wait and try again.'
});

export const guestOrderRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: Number(process.env.GUEST_ORDER_RATE_LIMIT_PER_DAY || 10),
  keyPrefix: 'guest_order',
  message: 'Daily limit reached for guest printing. Please login or try again tomorrow.'
});
