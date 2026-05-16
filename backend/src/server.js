import app from './app.js';
import { applySchema } from './db/schemaRunner.js';

const PORT = process.env.PORT || 5000;

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

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

if (!hasDatabaseUrl) {
  console.warn('[ENV WARNING] DATABASE_URL is missing. Add the Supabase PostgreSQL URL in Render when database routes are enabled.');
}

if (hasDatabaseUrl) {
  try {
    await applySchema();
    console.log('[DB CHECK] Schema ready');
  } catch (error) {
    console.error('[DB CHECK FAILED]', {
      message: error.message
    });
    throw error;
  }
}

const server = app.listen(PORT, () => {
  console.log(`PrintEase backend running on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the old backend process or set a different PORT value.`);
    process.exit(1);
  }

  throw error;
});
