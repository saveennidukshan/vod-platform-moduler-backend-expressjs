import app from './app.js';
import { disconnectDatabase } from './infrastructure/database/prisma.js';

const port = Number(process.env.APP_PORT || process.env.APP_Port || 3000);
const server = app.listen(port, () => {
  console.log(`Server up and running on port ${port}`);
});

let isShuttingDown = false;
const shutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}; shutting down gracefully.`);
  server.close((error) => {
    if (error) {
      console.error('Graceful shutdown failed.', error);
      process.exitCode = 1;
    }
    disconnectDatabase()
      .catch((disconnectError) => {
        console.error('Database shutdown failed.', disconnectError);
        process.exitCode = 1;
      })
      .finally(() => process.exit());
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
