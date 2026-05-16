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

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://printhubdesi.vercel.app'
].filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error('[CORS BLOCKED]', {
      origin,
      allowedOrigins
    });

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

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

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', {
    message: err.message,
    stack: err.stack,
    route: req.originalUrl,
    method: req.method
  });

  res.status(err.status || err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    route: req.originalUrl
  });
});

export default app;
