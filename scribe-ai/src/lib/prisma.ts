import { PrismaClient } from '../src/generated/prisma/client';

// Driver Adapter for Postgres
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
