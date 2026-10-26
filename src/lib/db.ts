import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 * Mencegah pembuatan koneksi berulang saat hot-reload di development
 * (penting untuk Neon yang membatasi jumlah koneksi).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
