import app from './app.js';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`PrintEase backend running on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the old backend process or run with PORT=5001 npm run dev.`);
    process.exit(1);
  }

  throw error;
});
