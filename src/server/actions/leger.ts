"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";
import {
  hitungNilaiAkhirLengkap,
  buildDeskripsiCapaianTp,
  resolveTpDeskripsiText,
  type TpScoreEntry,
} from "@/lib/grading/calc";

export type ActionResponse = {
  success: boolean;
  message: string;
  data?: unknown;
};

const SPECIAL_MAPEL_META: Record<
  string,
  {
    codes: string[];
    nameKeywords: string[];
    defaultKode: string;
    defaultNama: string;
    kelompok: string;
    urutan: number;
  }
> = {
  BB: {
    codes: ["BB", "MULOK", "BALI", "BD"],
    nameKeywords: ["Bahasa Bali", "Muatan Lokal", "Mulok"],
    defaultKode: "BB",
    defaultNama: "Muatan Lokal (Bahasa Bali)",
    kelompok: "Muatan Lokal",
    urutan: 9,
  },
  MULOK: {
    codes: ["BB", "MULOK", "BALI", "BD"],
    nameKeywords: ["Bahasa Bali", "Muatan Lokal", "Mulok"],
    defaultKode: "BB",
    defaultNama: "Muatan Lokal (Bahasa Bali)",
    kelompok: "Muatan Lokal",
    urutan: 9,
  },
  PJOK: {
    codes: ["PJOK", "PENJAS"],
    nameKeywords: ["Jasmani", "PJOK", "Olahraga"],
    defaultKode: "PJOK",
    defaultNama: "Pendidikan Jasmani, Olahraga, dan Kesehatan",
    kelompok: "Umum",
    urutan: 6,
  },
  PAH: {
    codes: ["PAH"],
    nameKeywords: ["Agama Hindu"],
    defaultKode: "PAH",
    defaultNama: "Pendidikan Agama Hindu dan Budi Pekerti",
    kelompok: "Umum",
    urutan: 1,
  },
  PAI: {
    codes: ["PAI"],
    nameKeywords: ["Agama Islam"],
    defaultKode: "PAI",
    defaultNama: "Pendidikan Agama Islam dan Budi Pekerti",
    kelompok: "Umum",
    urutan: 1,
  },
  PAK: {
    codes: ["PAK"],
    nameKeywords: ["Agama Kristen"],
    defaultKode: "PAK",
    defaultNama: "Pendidikan Agama Kristen dan Budi Pekerti",
    kelompok: "Umum",
    urutan: 1,
  },
  PAKAT: {
    codes: ["PAKAT", "PAKTL"],
    nameKeywords: ["Agama Katolik"],
    defaultKode: "PAKAT",
    defaultNama: "Pendidikan Agama Katolik dan Budi Pekerti",
    kelompok: "Umum",
    urutan: 1,
  },
  PABUD: {
    codes: ["PABUD"],
    nameKeywords: ["Agama Buddha", "Agama Budha"],
    defaultKode: "PABUD",
    defaultNama: "Pendidikan Agama Buddha dan Budi Pekerti",
    kelompok: "Umum",
    urutan: 1,
  },
  PAB: {
    codes: ["PAB"],
    nameKeywords: ["Pendidikan Agama dan Budi Pekerti"],
    defaultKode: "PAB",
    defaultNama: "Pendidikan Agama dan Budi Pekerti",
    kelompok: "Umum",
    urutan: 1,
  },
};

async function resolveOrEnsureMapel(rawTargetKode: string) {
  const norm = rawTargetKode.trim().toUpperCase();
  const meta = SPECIAL_MAPEL_META[norm];

  if (meta) {
    const existing = await db.mapel.findFirst({
      where: {
        OR: [
          ...meta.codes.map((c) => ({ kode: { equals: c, mode: "insensitive" as const } })),
          ...meta.nameKeywords.map((kw) => ({ nama: { contains: kw, mode: "insensitive" as const } })),
        ],
      },
      orderBy: { urutan: "asc" },
    });

    if (existing) return existing;

    return db.mapel.create({
      data: {
        kode: meta.defaultKode,
        nama: meta.defaultNama,
        kelompok: meta.kelompok,
        urutan: meta.urutan,
        isAktif: true,
      },
    });
  }

  return db.mapel.findFirst({
    where: {
      kode: { equals: norm, mode: "insensitive" },
    },
  });
}

/**
 * Tarik Nilai Khusus:
 * Menarik & mensinkronisasi nilai untuk mapel Mulok Bahasa Bali (BB / MULOK), PJOK,
 * dan 5 pilihan Pendidikan Agama (PAH, PAI, PAK, PAKAT, PABUD, PAB).
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

    // Cari mapel secara fleksibel (mendukung kode BB maupun MULOK untuk Bahasa Bali)
    const mapel = await resolveOrEnsureMapel(targetMapelKode);

    if (!mapel) {
      return {
        success: false,
        message: `Mata pelajaran dengan kode ${targetMapelKode} tidak ditemukan di database.`,
      };
    }

    // Periksa apakah pembelajaran untuk rombel & mapel ini sudah ada
    let pembelajaran = rombel.pembelajaran.find((p) => p.mapelId === mapel.id);

    if (!pembelajaran) {
      // Prioritas 1: Guru yang sudah mengampu mapel yang sama di rombel lain pada semester aktif
      const existingSameMapel = await db.pembelajaran.findFirst({
        where: {
          semesterId: semester.id,
          mapelId: mapel.id,
        },
        select: { gtkId: true },
      });

      // Prioritas 2: Guru Mapel aktif
      const guruMapelGtk = !existingSameMapel
        ? await db.gtk.findFirst({
            where: {
              isAktif: true,
              jenisPtk: { contains: "Mapel", mode: "insensitive" },
            },
          })
        : null;

      const fallbackGtkId =
        existingSameMapel?.gtkId ||
        guruMapelGtk?.id ||
        rombel.waliKelasId ||
        (await db.gtk.findFirst({ select: { id: true } }))?.id;

      if (!fallbackGtkId) {
        return { success: false, message: "Tidak ada data guru untuk ditugaskan ke mapel ini." };
      }

      pembelajaran = await db.pembelajaran.create({
        data: {
          semesterId: semester.id,
          rombelId: rombel.id,
          mapelId: mapel.id,
          gtkId: fallbackGtkId,
          kktp: 75,
          bobotHarian: 50,
          bobotUts: 25,
          bobotUas: 25,
        },
        include: { mapel: true },
      });
    }

    // Ambil penilaian & daftar TP untuk sinkronisasi nilai dan deskripsi capaian
    const [penilaians, masterTps] = await Promise.all([
      db.penilaian.findMany({
        where: { pembelajaranId: pembelajaran.id },
        include: { nilai: true },
        orderBy: [{ kategori: "asc" }, { urutan: "asc" }],
      }),
      db.tujuanPembelajaran.findMany({
        where: {
          semesterId: semester.id,
          tingkat: rombel.tingkat,
          mapelId: mapel.id,
        },
        orderBy: [{ urutan: "asc" }, { kodeTp: "asc" }],
      }),
    ]);

    const kktp = pembelajaran.kktp ?? 75;
    let syncedCount = 0;

    for (const agg of rombel.anggota) {
      const harianScores: (number | null)[] = [];
      const slmScores: (number | null)[] = [];
      const utsScores: (number | null)[] = [];
      const uasScores: (number | null)[] = [];
      const tpEntries: TpScoreEntry[] = [];

      for (const pen of penilaians) {
        const n = pen.nilai.find((item) => item.siswaId === agg.siswaId);
        const val = n && n.nilai !== null ? Number(n.nilai) : null;
        if (val === null) continue;

        if (pen.kategori === "HARIAN") {
          harianScores.push(val);
          tpEntries.push({
            kode: pen.nama,
            deskripsi: resolveTpDeskripsiText(pen, masterTps),
            nilai: val,
          });
        } else if (pen.kategori === "SLM") {
          slmScores.push(val);
        } else if (pen.kategori === "UTS") {
          utsScores.push(val);
        } else if (pen.kategori === "UAS") {
          uasScores.push(val);
        }
      }

      const calc = hitungNilaiAkhirLengkap(
        {
          harian: harianScores,
          slm: slmScores,
          uts: utsScores,
          uas: uasScores,
        },
        {
          bobotHarian: pembelajaran.bobotHarian,
          bobotUts: pembelajaran.bobotUts,
          bobotUas: pembelajaran.bobotUas,
        }
      );

      if (calc.nilaiAkhir !== null) {
        const existingRapor = await db.nilaiRapor.findUnique({
          where: {
            pembelajaranId_siswaId: {
              pembelajaranId: pembelajaran.id,
              siswaId: agg.siswaId,
            },
          },
        });
        const finalNilaiAkhir =
          existingRapor?.isOverride && existingRapor.nilaiAkhir !== null
            ? Math.round(Number(existingRapor.nilaiAkhir))
            : Math.round(calc.nilaiAkhir);
        const desc = buildDeskripsiCapaianTp(tpEntries, kktp);
        await db.nilaiRapor.upsert({
          where: {
            pembelajaranId_siswaId: {
              pembelajaranId: pembelajaran.id,
              siswaId: agg.siswaId,
            },
          },
          update: {
            rataHarian: calc.rataHarian,
            rataSlm: calc.rataSlm,
            nilaiUts: calc.nilaiUts,
            nilaiUas: calc.nilaiUas,
            nilaiAkhir: finalNilaiAkhir,
            ...(desc.capaianTertinggi ? { capaianTertinggi: desc.capaianTertinggi } : {}),
            ...(desc.capaianTerendah ? { capaianTerendah: desc.capaianTerendah } : {}),
          },
          create: {
            pembelajaranId: pembelajaran.id,
            siswaId: agg.siswaId,
            rataHarian: calc.rataHarian,
            rataSlm: calc.rataSlm,
            nilaiUts: calc.nilaiUts,
            nilaiUas: calc.nilaiUas,
            nilaiAkhir: finalNilaiAkhir,
            capaianTertinggi: desc.capaianTertinggi,
            capaianTerendah: desc.capaianTerendah,
          },
        });
        syncedCount++;
      } else {
        const existingRapor = await db.nilaiRapor.findUnique({
          where: {
            pembelajaranId_siswaId: {
              pembelajaranId: pembelajaran.id,
              siswaId: agg.siswaId,
            },
          },
        });
        if (existingRapor?.nilaiAkhir !== null && existingRapor?.nilaiAkhir !== undefined) {
          syncedCount++;
        }
      }
    }

    revalidatePath("/admin/leger");
    revalidatePath("/guru/leger");

    return {
      success: true,
      message:
        syncedCount > 0
          ? `Berhasil menarik ${syncedCount} data nilai mata pelajaran "${mapel.nama}" (${mapel.kode}) untuk Kelas ${rombel.nama}!`
          : `Mata pelajaran "${mapel.nama}" (${mapel.kode}) berhasil ditautkan ke Leger Kelas ${rombel.nama} (belum ada nilai siswa yang diinput oleh guru pengampu).`,
    };
  } catch (err: unknown) {
    console.error("[tarikNilaiKhusus Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menarik nilai mata pelajaran khusus.",
    };
  }
}
