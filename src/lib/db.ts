import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 * Menjaga instance tunggal baik di development maupun serverless/production
 * agar tidak menghabiskan kuota koneksi (connection pool) database Neon.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.prisma = db;
