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
 * Mengaktifkan sebuah semester dengan aman tanpa menyebabkan crash/error constraint:
 * - Semester yang sebelumnya berstatus AKTIF (belum dikunci/arsip) dikembalikan ke DRAFT & isAktif = false.
 * - Semester yang sudah DIKUNCI / ARSIP tetap menjaga statusnya namun isAktif = false.
 * - Semester tujuan diaktifkan (isAktif = true, status = AKTIF) beserta TahunAjaran induknya.
 */
export async function aktifkanSemester(semesterId: string) {
  return db.$transaction(
    async (tx) => {
      const target = await tx.semester.findUnique({
        where: { id: semesterId },
        include: { tahunAjaran: true },
      });

      if (!target) {
        throw new Error("Data semester tidak ditemukan di database.");
      }

      // 1. Ubah status semester lain yang masih AKTIF (belum dikunci/diarsip) menjadi DRAFT
      await tx.semester.updateMany({
        where: {
          id: { not: semesterId },
          status: "AKTIF",
        },
        data: {
          status: "DRAFT",
          isAktif: false,
        },
      });

      // 2. Pastikan seluruh semester lain dinonaktifkan terlebih dahulu (menjaga unique partial index semester_single_aktif)
      await tx.semester.updateMany({
        where: { isAktif: true },
        data: { isAktif: false },
      });

      // 3. Pastikan seluruh Tahun Ajaran dinonaktifkan terlebih dahulu (menjaga unique partial index tahun_ajaran_single_aktif)
      await tx.tahunAjaran.updateMany({
        where: { isAktif: true },
        data: { isAktif: false },
      });

      // 4. Aktifkan semester target
      const baru = await tx.semester.update({
        where: { id: semesterId },
        data: {
          isAktif: true,
          status: "AKTIF",
          dikunciPada: null,
        },
        include: { tahunAjaran: true },
      });

      // 5. Aktifkan Tahun Ajaran induk dari semester target
      await tx.tahunAjaran.update({
        where: { id: baru.tahunAjaranId },
        data: { isAktif: true },
      });

      return baru;
    },
    { timeout: 30_000 },
  );
}

/** Freeze: semester menjadi read-only */
export async function kunciSemester(semesterId: string) {
  return db.semester.update({
    where: { id: semesterId },
    data: { status: "DIKUNCI", dikunciPada: new Date() },
  });
}

/** Unfreeze: membuka kembali kunci nilai semester */
export async function bukaKunciSemester(semesterId: string) {
  const sem = await db.semester.findUnique({ where: { id: semesterId } });
  if (!sem) throw new Error("Data semester tidak ditemukan.");

  return db.semester.update({
    where: { id: semesterId },
    data: {
      status: sem.isAktif ? "AKTIF" : "DRAFT",
      dikunciPada: null,
    },
  });
}

/**
 * Ganjil → Genap (atau antar semester): salin rombel, anggota, pembelajaran,
 * serta Tujuan Pembelajaran (tanpa menyalin nilai) dari semester sumber ke semester tujuan.
 */
export async function salinRombel(dariSemesterId: string, keSemesterId: string) {
  return db.$transaction(
    async (tx) => {
      const [rombels, tps] = await Promise.all([
        tx.rombel.findMany({
          where: { semesterId: dariSemesterId },
          include: { anggota: true, pembelajaran: true },
        }),
        tx.tujuanPembelajaran.findMany({
          where: { semesterId: dariSemesterId },
        }),
      ]);

      for (const r of rombels) {
        const baru = await tx.rombel.upsert({
          where: { semesterId_nama: { semesterId: keSemesterId, nama: r.nama } },
          update: {
            tingkat: r.tingkat,
            kurikulum: r.kurikulum,
            waliKelasId: r.waliKelasId,
          },
          create: {
            semesterId: keSemesterId,
            nama: r.nama,
            tingkat: r.tingkat,
            kurikulum: r.kurikulum,
            waliKelasId: r.waliKelasId,
          },
        });

        if (r.anggota.length > 0) {
          await tx.anggotaRombel.createMany({
            data: r.anggota.map((a) => ({
              semesterId: keSemesterId,
              rombelId: baru.id,
              siswaId: a.siswaId,
              noAbsen: a.noAbsen,
            })),
            skipDuplicates: true,
          });
        }

        if (r.pembelajaran.length > 0) {
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
      }

      if (tps.length > 0) {
        await tx.tujuanPembelajaran.createMany({
          data: tps.map((tp) => ({
            semesterId: keSemesterId,
            tingkat: tp.tingkat,
            mapelId: tp.mapelId,
            kodeTp: tp.kodeTp,
            tujuanPembelajaran: tp.tujuanPembelajaran,
            ruangLingkupMateri: tp.ruangLingkupMateri,
            urutan: tp.urutan,
          })),
          skipDuplicates: true,
        });
      }

      return { rombelCount: rombels.length, tpCount: tps.length };
    },
    { timeout: 60_000 },
  );
}
