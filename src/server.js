import app from './app.js';
import { disconnectDatabase } from './infrastructure/database/prisma.js';

const port = Number(process.env.APP_PORT || process.env.APP_Port || 3000);
const server = app.listen(port, () => {
  console.log(`Server up and running on port ${port}`);
});

const shutdown = (signal) => {
  console.log(`Received ${signal}; shutting down gracefully.`);
  server.close((error) => {
    if (error) {
      console.error('Graceful shutdown failed.', error);
      process.exitCode = 1;
    }
    disconnectDatabase().finally(() => process.exit());
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
