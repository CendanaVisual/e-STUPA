"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";

export type ActionResponse = {
  success: boolean;
  message: string;
  data?: any;
};

/**
 * Tarik Nilai Khusus:
 * Menarik & mensinkronisasi nilai untuk mapel Mulok (BB), PJOK, dan 5 pilihan Pendidikan Agama
 * (PAH, PAI, PAK, PAKAT, PABUD, PAB).
 */
export async function tarikNilaiKhusus(
  rombelId: string,
  targetMapelKode: string
): Promise<ActionResponse> {
  try {
    await requireAuth();

    if (!rombelId || !targetMapelKode) {
      return { success: false, message: "Rombel dan mata pelajaran wajib dipilih." };
    }

    const [rombel, semester] = await Promise.all([
      db.rombel.findUnique({
        where: { id: rombelId },
        include: {
          anggota: { include: { siswa: true } },
          pembelajaran: { include: { mapel: true } },
        },
      }),
      getSemesterAktif(),
    ]);

    if (!rombel || !semester) {
      return { success: false, message: "Data rombel atau semester aktif tidak ditemukan." };
    }

    // Cari mapel berdasarkan kode
    const mapel = await db.mapel.findUnique({
      where: { kode: targetMapelKode },
    });

    if (!mapel) {
      return {
        success: false,
        message: `Mata pelajaran dengan kode ${targetMapelKode} tidak ditemukan di database.`,
      };
    }

    // Periksa apakah pembelajaran untuk rombel & mapel ini sudah ada
    let pembelajaran = rombel.pembelajaran.find((p) => p.mapelId === mapel.id);

    if (!pembelajaran) {
      // Cari guru pengampu yang cocok (misalnya guru mapel agama/pjok atau wali kelas)
      const potentialGtk = await db.gtk.findFirst({
        where: {
          OR: [
            { jenisPtk: { contains: mapel.kelompok || "Mapel", mode: "insensitive" } },
            { id: rombel.waliKelasId || undefined },
          ],
        },
      });

      const fallbackGtk = potentialGtk || (await db.gtk.findFirst());
      if (!fallbackGtk) {
        return { success: false, message: "Tidak ada data guru untuk ditugaskan ke mapel ini." };
      }

      pembelajaran = await db.pembelajaran.create({
        data: {
          semesterId: semester.id,
          rombelId: rombel.id,
          mapelId: mapel.id,
          gtkId: fallbackGtk.id,
          kktp: 75,
          bobotHarian: 30,
          bobotUts: 40,
          bobotUas: 30,
        },
        include: { mapel: true },
      });
    }

    // Sinkronkan nilai akhir:
    // Cek apakah ada penilaian di pembelajaran ini
    const penilaians = await db.penilaian.findMany({
      where: { pembelajaranId: pembelajaran.id },
      include: { nilai: true },
    });

    let syncedCount = 0;

    for (const agg of rombel.anggota) {
      // Hitung nilai siswa dari penilaian jika ada
      let totalNilai = 0;
      let countNilai = 0;

      penilaians.forEach((pen) => {
        const n = pen.nilai.find((item) => item.siswaId === agg.siswaId);
        if (n && n.nilai !== null) {
          totalNilai += Number(n.nilai);
          countNilai++;
        }
      });

      const existingRapor = await db.nilaiRapor.findUnique({
        where: {
          pembelajaranId_siswaId: {
            pembelajaranId: pembelajaran.id,
            siswaId: agg.siswaId,
          },
        },
      });

      // Jika ada penilaian nyata, gunakan rata-ratanya; jika belum ada nilai rapor dan belum ada penilaian, biarkan atau pertahankan nilai
      if (countNilai > 0) {
        const kalkulasi = Math.round((totalNilai / countNilai) * 10) / 10;
        await db.nilaiRapor.upsert({
          where: {
            pembelajaranId_siswaId: {
              pembelajaranId: pembelajaran.id,
              siswaId: agg.siswaId,
            },
          },
          update: {
            nilaiAkhir: kalkulasi,
            rataHarian: kalkulasi,
          },
          create: {
            pembelajaranId: pembelajaran.id,
            siswaId: agg.siswaId,
            nilaiAkhir: kalkulasi,
            rataHarian: kalkulasi,
          },
        });
        syncedCount++;
      } else if (existingRapor) {
        syncedCount++;
      }
    }

    revalidatePath("/admin/leger");
    revalidatePath("/guru/leger");

    return {
      success: true,
      message: `Berhasil menarik nilai mata pelajaran "${mapel.nama}" (${mapel.kode}) untuk Kelas ${rombel.nama}!`,
    };
  } catch (err: unknown) {
    console.error("[tarikNilaiKhusus Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menarik nilai mata pelajaran khusus.",
    };
  }
}
