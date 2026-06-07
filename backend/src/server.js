import app from './app.js';
import { applySchema } from './db/schemaRunner.js';
import { cleanupExpiredGuestOrders } from './utils/cleanup.js';
import { runInternalCleanup } from './controllers/systemController.js';

const PORT = process.env.PORT || 5005;

console.log('[ENV CHECK]', {
  NODE_ENV: process.env.NODE_ENV,
  PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  HAS_JWT_SECRET: Boolean(process.env.JWT_SECRET),
  HAS_DATABASE_URL: Boolean(process.env.DATABASE_URL)
});

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is missing. Add it in Render Environment Variables.');
}

const hasDatabaseConfig = Boolean(
  process.env.DATABASE_URL ||
  process.env.PGHOST ||
  process.env.PGDATABASE ||
  process.env.PGUSER
);

if (!hasDatabaseConfig) {
  console.warn('[ENV WARNING] Database configuration is missing. Add DATABASE_URL or PG* values when database routes are enabled.');
}

if (hasDatabaseConfig) {
  await applySchema();
}

const server = app.listen(PORT, () => {
  console.log(`PrintEase backend running on port ${PORT}`);
  
  if (hasDatabaseConfig) {
    setInterval(cleanupExpiredGuestOrders, 60 * 60 * 1000); // Hourly
    cleanupExpiredGuestOrders(); // Run once on startup

    // Run 15-day document cleanup every 12 hours
    setInterval(runInternalCleanup, 12 * 60 * 60 * 1000); 
    runInternalCleanup(); // Run once on startup
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the old backend process or set a different PORT value.`);
    process.exit(1);
  }

  throw error;
});
