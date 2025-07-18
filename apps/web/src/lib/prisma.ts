// Export Prisma client from the shared-kernel
import { PrismaClient as SharedKernelPrismaClient } from '../../../../node_modules/.prisma/shared-kernel';

export const PrismaClient = SharedKernelPrismaClient;

// Create a singleton instance
const globalForPrisma = globalThis as unknown as {
  prisma: SharedKernelPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new SharedKernelPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
