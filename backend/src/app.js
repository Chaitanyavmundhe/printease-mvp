import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import centreRoutes from './routes/centreRoutes.js';
import printerRoutes from './routes/printerRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { errorMiddleware, notFound } from './middleware/errorMiddleware.js';

dotenv.config();

const app = express();

const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) return true;

  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      return ['localhost', '127.0.0.1'].includes(url.hostname);
    } catch (error) {
      return false;
    }
  }

  return false;
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
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
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/printers', printerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/uploads', uploadRoutes);

app.use(notFound);
app.use(errorMiddleware);

export default app;
