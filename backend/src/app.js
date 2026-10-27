import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import logger from './utils/logger.js';
import { testDatabaseConnection } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import centreRoutes from './routes/centreRoutes.js';
import printerRoutes from './routes/printerRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import hubOrderRoutes from './routes/hubOrderRoutes.js';
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
import { isAllowedPreviewOrigin } from './config/originPolicy.js';
import { MAX_UPLOAD_SIZE_BYTES } from './constants/upload.js';

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
  return isAllowedPreviewOrigin(origin);
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
      frameSrc: ["'self'"]
    }
  } : false
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (isAllowedDesktopOrigin(origin)) {
      if (process.env.NODE_ENV !== 'production') {
        logger.info('[CORS DESKTOP ALLOWED]', { origin });
      }
      return callback(null, true);
    }

    const requestOrigin = normalizeOrigin(origin);

    if (allowedOrigins.has(requestOrigin) || isAllowedVercelPreviewOrigin(requestOrigin)) {
      return callback(null, true);
    }

    logger.error('[CORS BLOCKED]', {
      origin,
      allowedOrigins: [...allowedOrigins],
      desktopAppOrigin,
      allowDesktopNullOrigin,
      note: 'Allowed origins include production Vercel, local Vite dev, trusted desktop app origin, and permitted preview URLs.'
    });

    const error = new Error('Origin is not allowed.');
    error.statusCode = 403;
    return callback(error);
  },
  credentials: true
}));
// Reject exhausted callers before parsing their JSON body. Route-specific
// limits still run after parsing/authentication with their existing keys.
app.use(globalRateLimit);
app.use('/api', (_req, res, next) => {
  // Authenticated data, capability URLs and changing payment/job state must not
  // survive in a shared browser/proxy cache or be reused across account changes.
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
morgan.token('safe-path', req => req.path);
app.use(morgan(':method :safe-path :status :response-time ms - :res[content-length]'));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'PrintEase backend is running',
    version: '1.0.0'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await testDatabaseConnection();
    res.json({
      success: true,
      message: 'Backend healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Service unavailable: Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/printers', printerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/hubs/orders', hubOrderRoutes);
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
    message: `Route not found: ${req.method} ${req.path}`
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
  logger.error('[SERVER ERROR]', {
    message: err.message,
    code: err.code,
    constraint: err.constraint,
    stack: err.stack,
    route: req.path,
    method: req.method
  });

  const databaseMessage = getDatabaseErrorMessage(err);
  const uploadMessage = err.code === 'LIMIT_FILE_SIZE'
    ? `Uploaded file is too large. Maximum size is ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB.`
    : String(err.code || '').startsWith('LIMIT_') ? 'Upload request exceeds the allowed file or field limits.' : null;
  const status = uploadMessage ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : err.status || err.statusCode || 500;

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
