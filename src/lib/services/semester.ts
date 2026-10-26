import "server-only";
import { db } from "@/lib/db";
import type { TipeSemester } from "@prisma/client";

/** Semester yang sedang aktif (maksimal satu) */
export async function getSemesterAktif() {
  return db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });
}

/** "2026/2027" + GANJIL → "20261" */
export function kodeSemester(tahunMulai: number, tipe: TipeSemester) {
  return `${tahunMulai}${tipe === "GANJIL" ? 1 : 2}`;
}

/**
 * Membuka semester baru tanpa menyentuh data master.
 * - Semester lama: dinonaktifkan (status tetap; harus dikunci/arsip lebih dulu)
 * - Semester baru: AKTIF. Rombel & pembelajaran diisi lewat impor Dapodik,
 *   atau disalin dari semester sebelumnya (Ganjil → Genap) via `salinRombel`.
 */
export async function aktifkanSemester(semesterId: string) {
  return db.$transaction(async (tx) => {
    const lama = await tx.semester.findFirst({ where: { isAktif: true } });
    if (lama && lama.id !== semesterId && lama.status === "AKTIF") {
      throw new Error(
        "Kunci (freeze) semester aktif saat ini sebelum membuka semester baru",
      );
    }
    await tx.semester.updateMany({ where: { isAktif: true }, data: { isAktif: false } });
    await tx.tahunAjaran.updateMany({ data: { isAktif: false } });
    const baru = await tx.semester.update({
      where: { id: semesterId },
      data: { isAktif: true, status: "AKTIF" },
    });
    await tx.tahunAjaran.update({
      where: { id: baru.tahunAjaranId },
      data: { isAktif: true },
    });
    return baru;
  });
}

/** Freeze: semester menjadi read-only */
export async function kunciSemester(semesterId: string) {
  return db.semester.update({
    where: { id: semesterId },
    data: { status: "DIKUNCI", dikunciPada: new Date() },
  });
}

/**
 * Ganjil → Genap: salin rombel, anggota, dan pembelajaran (tanpa nilai)
 * dari semester sumber ke semester tujuan.
 */
export async function salinRombel(dariSemesterId: string, keSemesterId: string) {
  return db.$transaction(
    async (tx) => {
      const rombels = await tx.rombel.findMany({
        where: { semesterId: dariSemesterId },
        include: { anggota: true, pembelajaran: true },
      });
      for (const r of rombels) {
        const baru = await tx.rombel.upsert({
          where: { semesterId_nama: { semesterId: keSemesterId, nama: r.nama } },
          update: {},
          create: {
            semesterId: keSemesterId,
            nama: r.nama,
            tingkat: r.tingkat,
            kurikulum: r.kurikulum,
            waliKelasId: r.waliKelasId,
          },
        });
        await tx.anggotaRombel.createMany({
          data: r.anggota.map((a) => ({
            semesterId: keSemesterId,
            rombelId: baru.id,
            siswaId: a.siswaId,
            noAbsen: a.noAbsen,
          })),
          skipDuplicates: true,
        });
        await tx.pembelajaran.createMany({
          data: r.pembelajaran.map((p) => ({
            semesterId: keSemesterId,
            rombelId: baru.id,
            mapelId: p.mapelId,
            gtkId: p.gtkId,
            kktp: p.kktp,
            bobotHarian: p.bobotHarian,
            bobotUts: p.bobotUts,
            bobotUas: p.bobotUas,
          })),
          skipDuplicates: true,
        });
      }
      return rombels.length;
    },
    { timeout: 60_000 },
  );
}
