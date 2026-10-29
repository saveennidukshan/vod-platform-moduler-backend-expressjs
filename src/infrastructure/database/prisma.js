import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const hasDatabase = Boolean(process.env.DATABASE_URL);

export const prisma = hasDatabase ? new PrismaClient() : null;
export { hasDatabase };

export const disconnectDatabase = async () => {
  if (prisma) await prisma.$disconnect();
};
