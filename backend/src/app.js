import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import centreRoutes from './routes/centreRoutes.js';
import printerRoutes from './routes/printerRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import hubAgentRoutes from './routes/hubAgentRoutes.js';
import desktopRoutes from './routes/desktopRoutes.js';
import statsRoutes from './routes/stats.js';
import systemRoutes from './routes/systemRoutes.js';
import { globalRateLimit } from './middleware/rateLimitMiddleware.js';

const app = express();

app.set('trust proxy', 1);

function normalizeOrigin(origin) {
  if (!origin) return null;

  try {
    return new URL(origin).origin;
  } catch {
    return String(origin).replace(/\/+$/, '');
  }
}

const desktopAppOrigin = String(process.env.DESKTOP_APP_ORIGIN || 'app://printease').replace(/\/+$/, '');
const allowDesktopNullOrigin = process.env.ALLOW_DESKTOP_NULL_ORIGIN === 'true';

const baseAllowedOrigins = [
  process.env.FRONTEND_URL,
  'https://printhubdesi.vercel.app'
];

const localDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5175',
  'http://127.0.0.1:5175'
];

const allowedOrigins = new Set([
  ...baseAllowedOrigins,
  ...(process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCAL_ORIGINS !== 'true'
    ? []
    : localDevOrigins)
].map(normalizeOrigin).filter(Boolean));

function isAllowedVercelPreviewOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const url = new URL(origin);

    if (url.protocol !== 'https:') return false;
    if (!url.hostname.endsWith('.vercel.app')) return false;

    return (
      url.hostname.includes('printease') ||
      url.hostname.includes('printhubdesi') ||
      url.hostname.includes('printease-mvp')
    );
  } catch {
    return false;
  }
}

function isAllowedDesktopOrigin(origin) {
  if (!origin) return false;

  const requestOrigin = String(origin).replace(/\/+$/, '');

  if (requestOrigin === desktopAppOrigin) {
    return true;
  }

  // Some packaged WebView/file-like runtimes send Origin: null.
  // Keep this disabled unless the desktop app is confirmed to need it.
  return requestOrigin === 'null' && allowDesktopNullOrigin;
}

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://checkout.razorpay.com"]
    }
  } : false
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (isAllowedDesktopOrigin(origin)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CORS DESKTOP ALLOWED]', { origin });
      }
      return callback(null, true);
    }

    const requestOrigin = normalizeOrigin(origin);

    if (allowedOrigins.has(requestOrigin) || isAllowedVercelPreviewOrigin(requestOrigin)) {
      return callback(null, true);
    }

    console.error('[CORS BLOCKED]', {
      origin,
      allowedOrigins: [...allowedOrigins],
      desktopAppOrigin,
      allowDesktopNullOrigin,
      note: 'Allowed origins include production Vercel, local Vite dev, trusted desktop app origin, and PrintEase Vercel preview URLs over HTTPS.'
    });

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => {
    if (req.originalUrl === '/api/payments/razorpay/webhook') {
      req.rawBody = buf.toString('utf8');
    }
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(globalRateLimit);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'PrintEase backend is running',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend healthy',
    environment: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL || null,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/printers', printerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/hub-agents', hubAgentRoutes);
app.use('/api/desktop', desktopRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/system', systemRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

function getDatabaseErrorMessage(err) {
  if (err.code === '23505') {
    if (err.constraint?.includes('users_mobile') || err.detail?.includes('(mobile)')) {
      return 'Mobile number already registered';
    }

    if (err.constraint?.includes('centre_code') || err.detail?.includes('(centre_code)')) {
      return 'Centre code already exists';
    }
  }

  if (err.code === '23514' && err.constraint === 'users_role_check') {
    return 'Invalid role. Allowed roles are user, hub, admin';
  }

  if (err.code === '42703') {
    return `Database schema mismatch: ${err.message}`;
  }

  return null;
}

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', {
    message: err.message,
    code: err.code,
    constraint: err.constraint,
    stack: err.stack,
    route: req.originalUrl,
    method: req.method
  });

  const databaseMessage = getDatabaseErrorMessage(err);
  const uploadMessage = err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large. Maximum size is 10MB.' : null;
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.status || err.statusCode || 500;

  const isProduction = process.env.NODE_ENV === 'production';
  const genericMessage = 'An unexpected error occurred.';
  const finalMessage = isProduction && status >= 500
    ? (uploadMessage || genericMessage)
    : (databaseMessage || uploadMessage || (status >= 500 ? 'Internal server error' : err.message) || 'Internal server error');

  res.status(status).json({
    success: false,
    message: finalMessage,
    route: isProduction ? undefined : req.originalUrl
  });
});

export default app;
