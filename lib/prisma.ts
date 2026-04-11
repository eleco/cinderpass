import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
  var prismaUrl: string | undefined;
}

const databaseUrl = process.env.DATABASE_URL;

function createPrismaClient() {
  if (databaseUrl) {
    return new PrismaClient({ datasourceUrl: databaseUrl });
  }

  return new PrismaClient();
}

export const prisma =
  global.prisma && global.prismaUrl === databaseUrl
    ? global.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
  global.prismaUrl = databaseUrl;
}
