const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX = 120;
const MAX_KEYS = 10000;

const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getBucketKey(req, keyPrefix, keyGenerator) {
  const ip = getClientIp(req);
  const generated = typeof keyGenerator === 'function' ? keyGenerator(req) : '';
  return `${keyPrefix}:${ip}:${generated || ''}`;
}

function pruneBuckets(now) {
  if (buckets.size < MAX_KEYS) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function rateLimit({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX,
  keyPrefix = 'global',
  keyGenerator,
  message = 'Too many requests. Please wait and try again.'
} = {}) {
  return (req, res, next) => {
    const now = Date.now();
    pruneBuckets(now);

    const key = getBucketKey(req, keyPrefix, keyGenerator);
    const existing = buckets.get(key);
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
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
