"use server";

import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { assertPembelajaranAccess } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";
import {
  hitungNilaiAkhirLengkap,
  buildDeskripsiCapaianTp,
  resolveTpDeskripsiText,
  type TpScoreEntry,
} from "@/lib/grading/calc";

export type KategoriPenilaianInput = "HARIAN" | "SLM" | "UTS" | "UAS";

export type PenilaianActionResult = {
  success: boolean;
  message: string;
};

async function recalculateNilaiRaporPembelajaran(
  pembelajaranId: string,
  resetOverrideSiswaIds?: Set<string>
) {
  const pembelajaran = await db.pembelajaran.findUnique({
    where: { id: pembelajaranId },
    include: {
      rombel: { include: { anggota: true } },
      penilaian: {
        include: { nilai: true },
        orderBy: [{ kategori: "asc" }, { urutan: "asc" }],
      },
      nilaiRapor: true,
    },
  });

  if (!pembelajaran) return;

  const existingRaporMap = new Map(
    pembelajaran.nilaiRapor.map((nr) => [nr.siswaId, nr])
  );

  const masterTps = await db.tujuanPembelajaran.findMany({
    where: {
      semesterId: pembelajaran.semesterId,
      tingkat: pembelajaran.rombel.tingkat,
      mapelId: pembelajaran.mapelId,
    },
    orderBy: [{ urutan: "asc" }, { kodeTp: "asc" }],
  });

  const kktp = pembelajaran.kktp ?? 75;

  for (const agg of pembelajaran.rombel.anggota) {
    const harianScores: (number | null)[] = [];
    const slmScores: (number | null)[] = [];
    const utsScores: (number | null)[] = [];
    const uasScores: (number | null)[] = [];
    const tpEntries: TpScoreEntry[] = [];

    for (const pen of pembelajaran.penilaian) {
      const nv = pen.nilai.find((item) => item.siswaId === agg.siswaId);
      const val = nv && nv.nilai !== null ? Number(nv.nilai) : null;
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

    const existingRapor = existingRaporMap.get(agg.siswaId);
    const shouldKeepOverride =
      Boolean(existingRapor?.isOverride) &&
      existingRapor?.nilaiAkhir !== null &&
      existingRapor?.nilaiAkhir !== undefined &&
      !resetOverrideSiswaIds?.has(agg.siswaId);

    const finalNilaiAkhir: number | null = shouldKeepOverride
      ? Math.round(Number(existingRapor!.nilaiAkhir))
      : calc.nilaiAkhir !== null
      ? Math.round(calc.nilaiAkhir)
      : null;

    if (finalNilaiAkhir !== null) {
      const desc = buildDeskripsiCapaianTp(tpEntries, kktp);
      await db.nilaiRapor.upsert({
        where: {
          pembelajaranId_siswaId: {
            pembelajaranId,
            siswaId: agg.siswaId,
          },
        },
        update: {
          rataHarian: calc.rataHarian,
          rataSlm: calc.rataSlm,
          nilaiUts: calc.nilaiUts,
          nilaiUas: calc.nilaiUas,
          nilaiAkhir: finalNilaiAkhir,
          isOverride: shouldKeepOverride,
          ...(tpEntries.length > 0
            ? {
                capaianTertinggi: desc.capaianTertinggi,
                capaianTerendah: desc.capaianTerendah,
              }
            : {}),
        },
        create: {
          pembelajaranId,
          siswaId: agg.siswaId,
          rataHarian: calc.rataHarian,
          rataSlm: calc.rataSlm,
          nilaiUts: calc.nilaiUts,
          nilaiUas: calc.nilaiUas,
          nilaiAkhir: finalNilaiAkhir,
          isOverride: shouldKeepOverride,
          capaianTertinggi: desc.capaianTertinggi,
          capaianTerendah: desc.capaianTerendah,
        },
      });
    } else {
      await db.nilaiRapor.deleteMany({
        where: {
          pembelajaranId,
          siswaId: agg.siswaId,
        },
      });
    }
  }
}

export async function simpanNilaiBatchAction(
  pembelajaranId: string,
  entries: Record<string, string>
): Promise<PenilaianActionResult> {
  try {
    const session = await requireAuth();
    if (!pembelajaranId) {
      return { success: false, message: "ID pembelajaran tidak valid." };
    }

    await assertPembelajaranAccess(session, pembelajaranId, { write: true });

    const pembelajaran = await db.pembelajaran.findUnique({
      where: { id: pembelajaranId },
      include: {
        rombel: { include: { anggota: true } },
        penilaian: { include: { nilai: true } },
      },
    });

    if (!pembelajaran) {
      return { success: false, message: "Data pembelajaran tidak ditemukan." };
    }

    const changedSiswaIds = new Set<string>();

    for (const pen of pembelajaran.penilaian) {
      const existingNilaiBySiswa = new Map(
        pen.nilai.map((n) => [n.siswaId, n.nilai !== null ? Number(n.nilai) : null])
      );

      for (const agg of pembelajaran.rombel.anggota) {
        const key = `${pen.id}_${agg.siswaId}`;
        if (!(key in entries)) continue;

        const raw = entries[key]?.trim() ?? "";
        const prevVal = existingNilaiBySiswa.get(agg.siswaId) ?? null;

        if (raw === "") {
          if (prevVal !== null) {
            changedSiswaIds.add(agg.siswaId);
          }
          await db.nilai.deleteMany({
            where: {
              penilaianId: pen.id,
              siswaId: agg.siswaId,
            },
          });
        } else {
          const numVal = parseFloat(raw);
          if (!Number.isNaN(numVal) && numVal >= 0 && numVal <= 100) {
            if (prevVal === null || Math.abs(prevVal - numVal) > 0.0001) {
              changedSiswaIds.add(agg.siswaId);
            }
            await db.nilai.upsert({
              where: {
                penilaianId_siswaId: {
                  penilaianId: pen.id,
                  siswaId: agg.siswaId,
                },
              },
              update: {
                nilai: numVal,
                updatedById: session.userId,
              },
              create: {
                penilaianId: pen.id,
                siswaId: agg.siswaId,
                nilai: numVal,
                updatedById: session.userId,
              },
            });
          }
        }
      }
    }

    await recalculateNilaiRaporPembelajaran(pembelajaranId, changedSiswaIds);

    revalidatePath(`/guru/nilai/${pembelajaranId}`);
    revalidatePath(`/admin/leger`);
    revalidatePath(`/guru/leger`);
    revalidatePath(`/guru/ekspor`);

    return {
      success: true,
      message: "Seluruh nilai siswa berhasil disimpan ke database dan nilai akhir telah diperbarui.",
    };
  } catch (err: unknown) {
    console.error("[simpanNilaiBatchAction Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menyimpan nilai ke server.",
    };
  }
}

export async function tambahKolomPenilaianAction(
  pembelajaranId: string,
  kategori: KategoriPenilaianInput,
  nama: string,
  tujuanPembelajaran?: string | null
): Promise<PenilaianActionResult> {
  try {
    const session = await requireAuth();
    const cleanNama = nama.trim();
    if (!pembelajaranId || !kategori || !cleanNama) {
      return { success: false, message: "Kategori dan nama kolom asesmen wajib diisi." };
    }

    await assertPembelajaranAccess(session, pembelajaranId, { write: true });

    const last = await db.penilaian.findFirst({
      where: { pembelajaranId, kategori },
      orderBy: { urutan: "desc" },
    });
    const nextUrutan = (last?.urutan || 0) + 1;

    await db.penilaian.create({
      data: {
        pembelajaranId,
        kategori,
        urutan: nextUrutan,
        nama: cleanNama,
        tujuanPembelajaran: tujuanPembelajaran?.trim() || null,
      },
    });

    revalidatePath(`/guru/nilai/${pembelajaranId}`);
    revalidatePath(`/guru/ekspor`);

    return {
      success: true,
      message: `Kolom asesmen "${cleanNama}" berhasil ditambahkan.`,
    };
  } catch (err: unknown) {
    console.error("[tambahKolomPenilaianAction Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menambahkan kolom asesmen.",
    };
  }
}

export async function hapusKolomPenilaianAction(
  pembelajaranId: string,
  penilaianId: string
): Promise<PenilaianActionResult> {
  try {
    const session = await requireAuth();
    await assertPembelajaranAccess(session, pembelajaranId, { write: true });

    await db.penilaian.delete({
      where: { id: penilaianId },
    });

    await recalculateNilaiRaporPembelajaran(pembelajaranId);

    revalidatePath(`/guru/nilai/${pembelajaranId}`);
    revalidatePath(`/admin/leger`);
    revalidatePath(`/guru/leger`);
    revalidatePath(`/guru/ekspor`);

    return {
      success: true,
      message: "Kolom asesmen berhasil dihapus.",
    };
  } catch (err: unknown) {
    console.error("[hapusKolomPenilaianAction Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menghapus kolom asesmen.",
    };
  }
}

export async function generateDefaultPenilaianAction(
  pembelajaranId: string
): Promise<PenilaianActionResult> {
  try {
    const session = await requireAuth();
    if (!pembelajaranId) {
      return { success: false, message: "ID pembelajaran tidak valid." };
    }

    await assertPembelajaranAccess(session, pembelajaranId, { write: true });

    const count = await db.penilaian.count({ where: { pembelajaranId } });
    if (count > 0) {
      return { success: false, message: "Kolom penilaian sudah tersedia." };
    }

    const p = await db.pembelajaran.findUnique({
      where: { id: pembelajaranId },
      include: { rombel: { select: { tingkat: true } } },
    });

    const mappedTps = p
      ? await db.tujuanPembelajaran.findMany({
          where: {
            semesterId: p.semesterId,
            tingkat: p.rombel.tingkat,
            mapelId: p.mapelId,
          },
          orderBy: [{ urutan: "asc" }, { kodeTp: "asc" }],
        })
      : [];

    if (mappedTps.length > 0) {
      await db.penilaian.createMany({
        data: [
          ...mappedTps.map((tp, idx) => ({
            pembelajaranId,
            kategori: "HARIAN" as const,
            urutan: idx + 1,
            nama: tp.kodeTp,
            tujuanPembelajaran: tp.tujuanPembelajaran,
          })),
          { pembelajaranId, kategori: "SLM" as const, urutan: 1, nama: "SLM 1" },
          { pembelajaranId, kategori: "UTS" as const, urutan: 1, nama: "STS" },
          { pembelajaranId, kategori: "UAS" as const, urutan: 1, nama: "SAS" },
        ],
      });
    } else {
      await db.penilaian.createMany({
        data: [
          {
            pembelajaranId,
            kategori: "HARIAN",
            urutan: 1,
            nama: "TP 1",
            tujuanPembelajaran: "Formatif TP 1",
          },
          {
            pembelajaranId,
            kategori: "HARIAN",
            urutan: 2,
            nama: "TP 2",
            tujuanPembelajaran: "Formatif TP 2",
          },
          { pembelajaranId, kategori: "SLM", urutan: 1, nama: "SLM 1" },
          { pembelajaranId, kategori: "UTS", urutan: 1, nama: "STS" },
          { pembelajaranId, kategori: "UAS", urutan: 1, nama: "SAS" },
        ],
      });
    }

    revalidatePath(`/guru/nilai/${pembelajaranId}`);
    return {
      success: true,
      message: "Kolom penilaian standar (TP, SLM, STS, SAS) berhasil dibuat.",
    };
  } catch (err: unknown) {
    console.error("[generateDefaultPenilaianAction Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal membuat kolom standar.",
    };
  }
}

// Form-compatible wrappers
export async function simpanNilaiBatch(formData: FormData): Promise<void> {
  const pembelajaranId = formData.get("pembelajaranId") as string;
  if (!pembelajaranId) return;
  const entries: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("nilai_") && typeof v === "string") {
      entries[k.slice(6)] = v;
    }
  }
  await simpanNilaiBatchAction(pembelajaranId, entries);
}

export async function tambahKolomPenilaian(formData: FormData): Promise<void> {
  const pembelajaranId = formData.get("pembelajaranId") as string;
  const kategori = formData.get("kategori") as KategoriPenilaianInput;
  const nama = formData.get("nama") as string;
  const tujuanPembelajaran = (formData.get("tujuanPembelajaran") as string) || null;
  if (!pembelajaranId || !kategori || !nama) return;
  await tambahKolomPenilaianAction(pembelajaranId, kategori, nama, tujuanPembelajaran);
}

export async function generateDefaultPenilaian(formData: FormData): Promise<void> {
  const pembelajaranId = formData.get("pembelajaranId") as string;
  if (!pembelajaranId) return;
  await generateDefaultPenilaianAction(pembelajaranId);
}

/**
 * Edit mandiri KKTP & Bobot Asesmen oleh Guru Pengampu (Wali Kelas maupun Guru Mapel).
 * Tersinkronisasi langsung ke database & Dashboard Superadmin, serta menghitung ulang NilaiRapor.
 */
export async function updateKktpDanBobotAction(
  pembelajaranId: string,
  config: {
    kktp: number;
    bobotHarian: number;
    bobotUts: number;
    bobotUas: number;
  }
): Promise<PenilaianActionResult> {
  try {
    const session = await requireAuth();
    if (!pembelajaranId) {
      return { success: false, message: "ID pembelajaran tidak valid." };
    }

    await assertPembelajaranAccess(session, pembelajaranId, { write: true });

    const kktp = Math.round(Number(config.kktp));
    const bobotHarian = Math.round(Number(config.bobotHarian));
    const bobotUts = Math.round(Number(config.bobotUts));
    const bobotUas = Math.round(Number(config.bobotUas));

    if (Number.isNaN(kktp) || kktp < 0 || kktp > 100) {
      return { success: false, message: "Nilai KKTP harus berupa angka antara 0 sampai 100." };
    }

    if (
      Number.isNaN(bobotHarian) ||
      Number.isNaN(bobotUts) ||
      Number.isNaN(bobotUas) ||
      bobotHarian < 0 ||
      bobotUts < 0 ||
      bobotUas < 0 ||
      bobotHarian > 100 ||
      bobotUts > 100 ||
      bobotUas > 100
    ) {
      return { success: false, message: "Setiap komponen bobot harus bernilai antara 0% sampai 100%." };
    }

    const totalBobot = bobotHarian + bobotUts + bobotUas;
    if (totalBobot !== 100) {
      return {
        success: false,
        message: `Total Bobot Asesmen wajib tepat 100% (saat ini ${totalBobot}%).`,
      };
    }

    await db.pembelajaran.update({
      where: { id: pembelajaranId },
      data: {
        kktp,
        bobotHarian,
        bobotUts,
        bobotUas,
      },
    });

    await recalculateNilaiRaporPembelajaran(pembelajaranId);

    revalidatePath(`/guru/nilai/${pembelajaranId}`);
    revalidatePath("/guru/kelas");
    revalidatePath("/guru");
    revalidatePath("/guru/leger");
    revalidatePath("/guru/ekspor");
    revalidatePath("/admin/pembelajaran");
    revalidatePath("/admin/leger");
    revalidatePath("/admin/statistik");

    return {
      success: true,
      message: `KKTP (${kktp}) dan Bobot Asesmen (${bobotHarian}% / ${bobotUts}% / ${bobotUas}%) berhasil diperbarui & disinkronkan ke Superadmin.`,
    };
  } catch (err: unknown) {
    console.error("[updateKktpDanBobotAction Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memperbarui KKTP & Bobot Asesmen.",
    };
  }
}

export type TransferNilaiTargetType = "TP" | "SLM" | "STS" | "SAS" | "NILAI_AKHIR";

export type TransferNilaiKonversiPayload = {
  pembelajaranId: string;
  targetType: TransferNilaiTargetType;
  penilaianId?: string | null;
  kodeTp?: string | null;
  tujuanPembelajaranText?: string | null;
  namaKolom?: string | null;
  scores: Record<string, number>; // key: siswaId -> nilai konversi
};

export type TransferNilaiKonversiResult = {
  success: boolean;
  message: string;
  penilaianId?: string;
  kolomNama?: string;
  transferredCount?: number;
  targetType?: TransferNilaiTargetType;
  nilaiAkhirMap?: Record<string, number>;
};

export type TarikNilaiAkhirResult = {
  success: boolean;
  message: string;
  scores?: Record<string, number>;
  pulledCount?: number;
};

/**
 * Menarik data Nilai Akhir (bilangan bulat) dari kelas & mata pelajaran yang diampu
 * untuk langsung ditempatkan pada Kolom Nilai (Nilai Dasar) di menu Konversi Nilai.
 */
export async function tarikNilaiAkhirPembelajaranAction(
  pembelajaranId: string
): Promise<TarikNilaiAkhirResult> {
  try {
    const session = await requireAuth();
    if (!pembelajaranId) {
      return { success: false, message: "Pilih Mata Pelajaran terlebih dahulu." };
    }

    await assertPembelajaranAccess(session, pembelajaranId);

    const pembelajaran = await db.pembelajaran.findUnique({
      where: { id: pembelajaranId },
      include: {
        mapel: true,
        rombel: { include: { anggota: true } },
        penilaian: {
          include: { nilai: true },
          orderBy: [{ kategori: "asc" }, { urutan: "asc" }],
        },
        nilaiRapor: true,
      },
    });

    if (!pembelajaran) {
      return { success: false, message: "Data pembelajaran mata pelajaran tidak ditemukan." };
    }

    const raporBySiswa = new Map(
      pembelajaran.nilaiRapor.map((nr) => [nr.siswaId, nr])
    );

    const scores: Record<string, number> = {};
    let pulledCount = 0;

    for (const agg of pembelajaran.rombel.anggota) {
      const nr = raporBySiswa.get(agg.siswaId);

      // Hitung juga dari komponen penilaian jika ada
      const harianScores: (number | null)[] = [];
      const slmScores: (number | null)[] = [];
      const utsScores: (number | null)[] = [];
      const uasScores: (number | null)[] = [];

      for (const pen of pembelajaran.penilaian) {
        const nv = pen.nilai.find((item) => item.siswaId === agg.siswaId);
        const val = nv && nv.nilai !== null ? Number(nv.nilai) : null;
        if (val === null) continue;
        if (pen.kategori === "HARIAN") harianScores.push(val);
        else if (pen.kategori === "SLM") slmScores.push(val);
        else if (pen.kategori === "UTS") utsScores.push(val);
        else if (pen.kategori === "UAS") uasScores.push(val);
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

      let nilaiAkhirBulat: number | null = null;
      if (nr?.isOverride && nr.nilaiAkhir !== null && nr.nilaiAkhir !== undefined) {
        nilaiAkhirBulat = Math.round(Number(nr.nilaiAkhir));
      } else if (calc.nilaiAkhir !== null) {
        nilaiAkhirBulat = Math.round(calc.nilaiAkhir);
      } else if (nr?.nilaiAkhir !== null && nr?.nilaiAkhir !== undefined) {
        nilaiAkhirBulat = Math.round(Number(nr.nilaiAkhir));
      }

      if (nilaiAkhirBulat !== null) {
        scores[agg.siswaId] = nilaiAkhirBulat;
        pulledCount++;
      }
    }

    if (pulledCount === 0) {
      return {
        success: false,
        message: `Belum ada data Nilai Akhir pada mata pelajaran ${pembelajaran.mapel.kode} (${pembelajaran.mapel.nama}) di Kelas ${pembelajaran.rombel.nama}.`,
      };
    }

    return {
      success: true,
      message: `Berhasil menarik ${pulledCount} Nilai Akhir dari mata pelajaran ${pembelajaran.mapel.kode} (${pembelajaran.mapel.nama}) — Kelas ${pembelajaran.rombel.nama} ke Kolom Nilai Dasar & langsung dikonversi!`,
      scores,
      pulledCount,
    };
  } catch (err: unknown) {
    console.error("[tarikNilaiAkhirPembelajaranAction Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menarik Nilai Akhir.",
    };
  }
}

/**
 * Mentransfer hasil Nilai Konversi ke kolom Penilaian (TP, SLM, STS, SAS)
 * atau langsung ke Nilai Akhir pada Mata Pelajaran (Pembelajaran) yang dipilih.
 */
export async function transferNilaiKonversiAction(
  payload: TransferNilaiKonversiPayload
): Promise<TransferNilaiKonversiResult> {
  try {
    const session = await requireAuth();
    const { pembelajaranId, targetType, scores } = payload;

    if (!pembelajaranId) {
      return { success: false, message: "Pilih Mata Pelajaran tujuan terlebih dahulu." };
    }

    if (!targetType || !["TP", "SLM", "STS", "SAS", "NILAI_AKHIR"].includes(targetType)) {
      return {
        success: false,
        message: "Target kolom penilaian (TP/SLM/STS/SAS/Nilai Akhir) tidak valid.",
      };
    }

    const scoreEntries = Object.entries(scores || {}).filter(
      ([siswaId, val]) =>
        Boolean(siswaId) &&
        typeof val === "number" &&
        !Number.isNaN(val) &&
        Number.isFinite(val)
    );

    if (scoreEntries.length === 0) {
      return {
        success: false,
        message: "Belum ada data Nilai Konversi siswa yang valid untuk ditransfer.",
      };
    }

    // Validasi rentang nilai konversi (0..100) agar sesuai standar E-Rapor
    for (const [, val] of scoreEntries) {
      if (val < 0 || val > 100) {
        return {
          success: false,
          message: `Nilai konversi (${val}) berada di luar rentang standar penilaian (0–100). Pastikan Nilai Tertinggi & Terendah Diinginkan berada pada rentang 0–100.`,
        };
      }
    }

    await assertPembelajaranAccess(session, pembelajaranId, { write: true });

    const pembelajaran = await db.pembelajaran.findUnique({
      where: { id: pembelajaranId },
      include: {
        mapel: true,
        rombel: { include: { anggota: true } },
        penilaian: {
          include: { nilai: true },
          orderBy: { urutan: "asc" },
        },
        nilaiRapor: true,
      },
    });

    if (!pembelajaran) {
      return { success: false, message: "Data pembelajaran mata pelajaran tidak ditemukan." };
    }

    const allowedSiswaIds = new Set(pembelajaran.rombel.anggota.map((a) => a.siswaId));

    // =========================================================================
    // CABANG 1: TRANSFER LANGSUNG KE NILAI AKHIR (BILANGAN BULAT)
    // =========================================================================
    if (targetType === "NILAI_AKHIR") {
      const masterTps = await db.tujuanPembelajaran.findMany({
        where: {
          semesterId: pembelajaran.semesterId,
          tingkat: pembelajaran.rombel.tingkat,
          mapelId: pembelajaran.mapelId,
        },
        orderBy: [{ urutan: "asc" }, { kodeTp: "asc" }],
      });

      const kktp = pembelajaran.kktp ?? 75;
      let transferredCount = 0;
      const nilaiAkhirMap: Record<string, number> = {};

      for (const [siswaId, rawVal] of scoreEntries) {
        if (!allowedSiswaIds.has(siswaId)) continue;
        // Nilai Akhir selalu bilangan bulat
        const cleanNilaiAkhir = Math.round(rawVal);
        nilaiAkhirMap[siswaId] = cleanNilaiAkhir;

        // Pertahankan rata-rata komponen & deskripsi TP jika ada
        const harianScores: (number | null)[] = [];
        const slmScores: (number | null)[] = [];
        const utsScores: (number | null)[] = [];
        const uasScores: (number | null)[] = [];
        const tpEntries: TpScoreEntry[] = [];

        for (const pen of pembelajaran.penilaian) {
          const nv = pen.nilai.find((item) => item.siswaId === siswaId);
          const val = nv && nv.nilai !== null ? Number(nv.nilai) : null;
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

        const desc = buildDeskripsiCapaianTp(tpEntries, kktp);

        await db.nilaiRapor.upsert({
          where: {
            pembelajaranId_siswaId: {
              pembelajaranId,
              siswaId,
            },
          },
          update: {
            rataHarian: calc.rataHarian,
            rataSlm: calc.rataSlm,
            nilaiUts: calc.nilaiUts,
            nilaiUas: calc.nilaiUas,
            nilaiAkhir: cleanNilaiAkhir,
            isOverride: true,
            ...(tpEntries.length > 0
              ? {
                  capaianTertinggi: desc.capaianTertinggi,
                  capaianTerendah: desc.capaianTerendah,
                }
              : {}),
          },
          create: {
            pembelajaranId,
            siswaId,
            rataHarian: calc.rataHarian,
            rataSlm: calc.rataSlm,
            nilaiUts: calc.nilaiUts,
            nilaiUas: calc.nilaiUas,
            nilaiAkhir: cleanNilaiAkhir,
            isOverride: true,
            capaianTertinggi: desc.capaianTertinggi,
            capaianTerendah: desc.capaianTerendah,
          },
        });
        transferredCount++;
      }

      revalidatePath("/guru/konversi-nilai");
      revalidatePath(`/guru/nilai/${pembelajaranId}`);
      revalidatePath("/guru/kelas");
      revalidatePath("/guru/leger");
      revalidatePath("/guru/ekspor");
      revalidatePath("/admin/leger");
      revalidatePath("/admin/statistik");

      return {
        success: true,
        message: `Berhasil mentransfer ${transferredCount} Nilai Konversi langsung ke Nilai Akhir mata pelajaran ${pembelajaran.mapel.kode} (${pembelajaran.mapel.nama}) pada Kelas ${pembelajaran.rombel.nama}!`,
        kolomNama: "Nilai Akhir",
        transferredCount,
        targetType: "NILAI_AKHIR",
        nilaiAkhirMap,
      };
    }

    // =========================================================================
    // CABANG 2: TRANSFER KE KOLOM KOMPONEN (TP / SLM / STS / SAS)
    // =========================================================================
    const kategoriMap: Record<"TP" | "SLM" | "STS" | "SAS", KategoriPenilaianInput> = {
      TP: "HARIAN",
      SLM: "SLM",
      STS: "UTS",
      SAS: "UAS",
    };
    const targetKategori = kategoriMap[targetType];

    // Cari atau buat kolom Penilaian tujuan
    let targetPenilaian = payload.penilaianId
      ? pembelajaran.penilaian.find((p) => p.id === payload.penilaianId) ?? null
      : null;

    if (!targetPenilaian) {
      const desiredName = (
        payload.kodeTp ||
        payload.namaKolom ||
        (targetType === "STS" ? "STS" : targetType === "SAS" ? "SAS" : targetType === "SLM" ? "SLM 1" : "TP 1")
      ).trim();

      if (targetType === "STS" || targetType === "SAS") {
        targetPenilaian =
          pembelajaran.penilaian.find(
            (p) =>
              p.kategori === targetKategori &&
              p.nama.trim().toLowerCase() === desiredName.toLowerCase()
          ) ??
          pembelajaran.penilaian.find((p) => p.kategori === targetKategori) ??
          null;
      } else {
        targetPenilaian =
          pembelajaran.penilaian.find(
            (p) =>
              p.kategori === targetKategori &&
              p.nama.trim().toLowerCase() === desiredName.toLowerCase()
          ) ?? null;
      }

      if (!targetPenilaian) {
        const lastSameKat = await db.penilaian.findFirst({
          where: { pembelajaranId, kategori: targetKategori },
          orderBy: { urutan: "desc" },
        });
        const nextUrutan = (lastSameKat?.urutan || 0) + 1;

        const created = await db.penilaian.create({
          data: {
            pembelajaranId,
            kategori: targetKategori,
            urutan: nextUrutan,
            nama: desiredName,
            tujuanPembelajaran:
              targetType === "TP" ? payload.tujuanPembelajaranText?.trim() || null : null,
          },
          include: { nilai: true },
        });
        targetPenilaian = created;
      } else if (
        targetType === "TP" &&
        payload.tujuanPembelajaranText?.trim() &&
        !targetPenilaian.tujuanPembelajaran
      ) {
        const updated = await db.penilaian.update({
          where: { id: targetPenilaian.id },
          data: { tujuanPembelajaran: payload.tujuanPembelajaranText.trim() },
          include: { nilai: true },
        });
        targetPenilaian = updated;
      }
    }

    let transferredCount = 0;
    const resetOverrideSiswaIds = new Set<string>();

    for (const [siswaId, rawVal] of scoreEntries) {
      if (!allowedSiswaIds.has(siswaId)) continue;
      const cleanVal = Math.round(rawVal * 100) / 100;
      resetOverrideSiswaIds.add(siswaId);

      await db.nilai.upsert({
        where: {
          penilaianId_siswaId: {
            penilaianId: targetPenilaian.id,
            siswaId,
          },
        },
        update: {
          nilai: cleanVal,
          updatedById: session.userId,
        },
        create: {
          penilaianId: targetPenilaian.id,
          siswaId,
          nilai: cleanVal,
          updatedById: session.userId,
        },
      });
      transferredCount++;
    }

    await recalculateNilaiRaporPembelajaran(pembelajaranId, resetOverrideSiswaIds);

    revalidatePath("/guru/konversi-nilai");
    revalidatePath(`/guru/nilai/${pembelajaranId}`);
    revalidatePath("/guru/kelas");
    revalidatePath("/guru/leger");
    revalidatePath("/guru/ekspor");
    revalidatePath("/admin/leger");
    revalidatePath("/admin/statistik");

    return {
      success: true,
      message: `Berhasil mentransfer ${transferredCount} Nilai Konversi ke ${pembelajaran.mapel.kode} (${pembelajaran.mapel.nama}) — Kolom "${targetPenilaian.nama}" pada Kelas ${pembelajaran.rombel.nama}!`,
      penilaianId: targetPenilaian.id,
      kolomNama: targetPenilaian.nama,
      transferredCount,
      targetType,
    };
  } catch (err: unknown) {
    console.error("[transferNilaiKonversiAction Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Gagal mentransfer nilai konversi ke daftar nilai.",
    };
  }
}

export type ImporLembarPenilaianResult = {
  success: boolean;
  message: string;
  updatedScores?: Record<string, string>;
  importedStudentsCount?: number;
  importedCellsCount?: number;
  columnsCount?: number;
};

function extractCellString(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val).trim();
  if (typeof val === "object") {
    if ("result" in val && val.result !== undefined && val.result !== null) {
      return String(val.result).trim();
    }
    if ("richText" in val && Array.isArray(val.richText)) {
      return val.richText
        .map((rt) => rt.text || "")
        .join("")
        .trim();
    }
    if ("text" in val && typeof val.text === "string") {
      return val.text.trim();
    }
  }
  return "";
}

function extractCellNumber(val: ExcelJS.CellValue): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === "object" && "result" in val) {
    const res = val.result;
    if (typeof res === "number" && Number.isFinite(res)) return res;
    if (typeof res === "string") {
      const cleaned = res.trim().replace(",", ".");
      if (!cleaned) return null;
      const num = parseFloat(cleaned);
      return Number.isFinite(num) ? num : null;
    }
    return null;
  }
  const str = extractCellString(val).replace(",", ".");
  if (!str || str === "-" || str === "–") return null;
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeColCodeForImport(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s._-]+/g, "");
}

/**
 * Mengimpor berkas Excel (.xlsx) Lembar Penilaian Siswa.
 * Logika otomatis:
 * 1. Menyusun (membuat/menyesuaikan urutan) kolom penilaian (TP, SLM, STS, SAS) beserta deskripsi TP.
 * 2. Mengisi dan menempatkan seluruh nilai siswa ke lembar penilaian siswa di database & web.
 * 3. Menghitung ulang Rata TP, Rata SLM, Nilai Akhir (Bilangan Bulat), dan Status.
 */
export async function imporLembarPenilaianSiswaAction(
  formData: FormData
): Promise<ImporLembarPenilaianResult> {
  try {
    const session = await requireAuth();
    const pembelajaranId = String(formData.get("pembelajaranId") ?? "").trim();
    const file = formData.get("file");

    if (!pembelajaranId) {
      return { success: false, message: "ID pembelajaran tidak valid." };
    }
    if (!file || !(file instanceof File)) {
      return {
        success: false,
        message: "Pilih berkas Excel (.xlsx) lembar penilaian siswa terlebih dahulu.",
      };
    }

    await assertPembelajaranAccess(session, pembelajaranId, { write: true });

    const pembelajaran = await db.pembelajaran.findUnique({
      where: { id: pembelajaranId },
      include: {
        mapel: true,
        rombel: {
          include: {
            anggota: {
              include: { siswa: true },
              orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
            },
          },
        },
        penilaian: {
          orderBy: [{ urutan: "asc" }],
        },
      },
    });

    if (!pembelajaran) {
      return { success: false, message: "Data pembelajaran tidak ditemukan." };
    }

    const masterTps = await db.tujuanPembelajaran.findMany({
      where: {
        semesterId: pembelajaran.semesterId,
        tingkat: pembelajaran.rombel.tingkat,
        mapelId: pembelajaran.mapelId,
      },
      orderBy: [{ urutan: "asc" }, { kodeTp: "asc" }],
    });

    const tpDescByNormCode = new Map<string, string>();
    for (const m of masterTps) {
      if (m.kodeTp && m.tujuanPembelajaran) {
        tpDescByNormCode.set(
          normalizeColCodeForImport(m.kodeTp),
          m.tujuanPembelajaran.trim()
        );
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    if (wb.worksheets.length === 0) {
      return {
        success: false,
        message: "Berkas Excel kosong atau tidak memiliki lembar kerja (worksheet).",
      };
    }

    // Baca juga sheet Daftar_Tujuan_Pembelajaran atau Pengaturan_TP_Bobot jika ada di dalam file
    const wsTpRef =
      wb.getWorksheet("Daftar_Tujuan_Pembelajaran") ||
      wb.getWorksheet("Pengaturan_TP_Bobot");
    if (wsTpRef) {
      wsTpRef.eachRow((row) => {
        for (let c = 1; c <= Math.min(row.cellCount, 8); c++) {
          const codeCandidate = extractCellString(row.getCell(c).value);
          const descCandidate = extractCellString(row.getCell(c + 1).value);
          if (
            codeCandidate &&
            descCandidate &&
            /^TP[\s._-]?\d+/i.test(codeCandidate) &&
            descCandidate.length >= 5 &&
            descCandidate.toLowerCase() !== "tujuan pembelajaran"
          ) {
            tpDescByNormCode.set(
              normalizeColCodeForImport(codeCandidate),
              descCandidate
            );
          }
        }
      });
    }

    // Pilih worksheet utama Lembar Penilaian Siswa
    const ws =
      wb.getWorksheet("Lembar_Penilaian_Siswa") ||
      wb.getWorksheet("Olah_Nilai_Rinci") ||
      wb.worksheets[0];

    if (!ws) {
      return {
        success: false,
        message: "Lembar kerja penilaian tidak ditemukan di dalam berkas Excel.",
      };
    }

    // Cari baris header tabel yang memuat kolom NISN dan Nama Siswa / Nama Peserta Didik
    let headerRow1Idx = -1;
    let nisnColIdx = -1;
    let namaColIdx = -1;

    for (let r = 1; r <= Math.min(ws.rowCount, 25); r++) {
      const row = ws.getRow(r);
      let foundNisn = -1;
      let foundNama = -1;

      for (let c = 1; c <= Math.min(row.cellCount, 30); c++) {
        const txt = extractCellString(row.getCell(c).value).toLowerCase();
        if (txt === "nisn") foundNisn = c;
        if (
          txt === "nama siswa" ||
          txt === "nama peserta didik" ||
          txt === "nama murid"
        ) {
          foundNama = c;
        }
      }

      if (foundNisn !== -1 && foundNama !== -1) {
        headerRow1Idx = r;
        nisnColIdx = foundNisn;
        namaColIdx = foundNama;
        break;
      }
    }

    if (headerRow1Idx === -1) {
      return {
        success: false,
        message:
          "Format header tabel tidak dikenali. Pastikan terdapat kolom 'NISN' dan 'Nama Siswa' (gunakan Template Lembar Penilaian Siswa).",
      };
    }

    // Periksa apakah terdapat sub-header pada baris tepat di bawah headerRow1Idx (2-row header)
    const row1 = ws.getRow(headerRow1Idx);
    const row2 = ws.getRow(headerRow1Idx + 1);
    const row2NisnTxt = extractCellString(row2.getCell(nisnColIdx).value).toLowerCase();
    const row2NamaTxt = extractCellString(row2.getCell(namaColIdx).value).toLowerCase();

    // Merupakan 2-row header apabila sel NISN/Nama pada baris kedua di-merge (sama dengan baris pertama atau kosong)
    // dan bukan berisi NISN angka siswa
    const isTwoRowHeader =
      (row2NisnTxt === "" || row2NisnTxt === "nisn") &&
      (row2NamaTxt === "" ||
        row2NamaTxt === "nama siswa" ||
        row2NamaTxt === "nama peserta didik");

    const dataStartRowIdx = isTwoRowHeader ? headerRow1Idx + 2 : headerRow1Idx + 1;
    const maxColIdx = Math.max(row1.cellCount, isTwoRowHeader ? row2.cellCount : 0);

    // Daftar label kolom non-input (identitas atau hasil kalkulasi otomatis) yang harus dilewati
    const IGNORED_COL_LABELS = new Set([
      "no",
      "id peserta didik (pd_id)",
      "id peserta didik",
      "pd_id",
      "nis",
      "nisn",
      "nama siswa",
      "nama peserta didik",
      "nama murid",
      "l/p",
      "jk",
      "jenis kelamin",
      "rata tp",
      "rata-rata tp",
      "rata slm",
      "rata-rata slm",
      "rata sts",
      "rata-rata sts",
      "rata sas",
      "rata-rata sas",
      "nilai akhir",
      "nilai akhir (rapor)",
      "nilai akhir e-rapor",
      "predikat",
      "status",
      "status kktp",
      "status nilai",
      "tp tertinggi (t)",
      "tp terendah (r)",
      "deskripsi capaian",
      "deskripsi capaian kompetensi",
      "identifikasi & deskripsi capaian tp",
    ]);

    interface ParsedAssessmentCol {
      colNumber: number;
      kategori: KategoriPenilaianInput;
      nama: string;
    }

    const parsedCols: ParsedAssessmentCol[] = [];
    let lastCarriedTopGroup = "";

    for (let c = namaColIdx + 1; c <= maxColIdx; c++) {
      const rawTop = extractCellString(row1.getCell(c).value);
      if (rawTop) {
        lastCarriedTopGroup = rawTop;
      }
      const topGroup = rawTop || lastCarriedTopGroup;
      const subName = isTwoRowHeader
        ? extractCellString(row2.getCell(c).value)
        : "";

      const effectiveName = (subName || rawTop).trim();
      if (!effectiveName) continue;

      const lowerEffective = effectiveName.toLowerCase();
      const lowerTop = topGroup.toLowerCase();

      if (IGNORED_COL_LABELS.has(lowerEffective)) {
        continue;
      }

      // Berhenti atau lewati jika sudah masuk ke grup Nilai Akhir / Deskripsi
      if (
        lowerTop.includes("nilai akhir") ||
        lowerTop.includes("identifikasi & deskripsi") ||
        lowerEffective.startsWith("rata ") ||
        lowerEffective.startsWith("rata-rata")
      ) {
        continue;
      }

      // Klasifikasikan kategori kolom: HARIAN (TP), SLM, UTS (STS), atau UAS (SAS)
      let kategori: KategoriPenilaianInput = "HARIAN";
      if (
        /^slm\b/i.test(effectiveName) ||
        lowerTop === "slm" ||
        lowerTop.includes("sumatif lingkup materi") ||
        lowerTop.includes("(slm)")
      ) {
        kategori = "SLM";
      } else if (
        /^sts\b/i.test(effectiveName) ||
        /^uts\b/i.test(effectiveName) ||
        lowerTop === "sts" ||
        lowerTop.includes("tengah semester") ||
        lowerTop.includes("(sts)")
      ) {
        kategori = "UTS";
      } else if (
        /^sas\b/i.test(effectiveName) ||
        /^uas\b/i.test(effectiveName) ||
        lowerTop === "sas" ||
        lowerTop.includes("akhir semester") ||
        lowerTop.includes("(sas)")
      ) {
        kategori = "UAS";
      } else {
        kategori = "HARIAN";
      }

      parsedCols.push({
        colNumber: c,
        kategori,
        nama: effectiveName,
      });
    }

    if (parsedCols.length === 0) {
      return {
        success: false,
        message:
          "Tidak ditemukan kolom penilaian (TP, SLM, STS, atau SAS) pada berkas Excel yang diunggah.",
      };
    }

    // 1. SUSUN & SINKRONKAN KOLOM PENILAIAN DI DATABASE (db.penilaian)
    const existingPenilaian = [...pembelajaran.penilaian];
    const usedPenilaianIds = new Set<string>();
    const urutanCounter: Record<KategoriPenilaianInput, number> = {
      HARIAN: 0,
      SLM: 0,
      UTS: 0,
      UAS: 0,
    };

    const resolvedCols: Array<{
      colNumber: number;
      penilaianId: string;
      kategori: KategoriPenilaianInput;
      nama: string;
    }> = [];

    for (const pc of parsedCols) {
      urutanCounter[pc.kategori] += 1;
      const desiredUrutan = urutanCounter[pc.kategori];
      const normName = normalizeColCodeForImport(pc.nama);
      const matchedTpDesc =
        pc.kategori === "HARIAN" ? (tpDescByNormCode.get(normName) ?? null) : null;

      // Cari kolom penilaian yang cocok pada kategori yang sama (atau khusus UTS/UAS ambil yang ada)
      let matched =
        existingPenilaian.find(
          (ep) =>
            !usedPenilaianIds.has(ep.id) &&
            ep.kategori === pc.kategori &&
            normalizeColCodeForImport(ep.nama) === normName
        ) ?? null;

      if (!matched && (pc.kategori === "UTS" || pc.kategori === "UAS")) {
        matched =
          existingPenilaian.find(
            (ep) => !usedPenilaianIds.has(ep.id) && ep.kategori === pc.kategori
          ) ?? null;
      }

      if (matched) {
        usedPenilaianIds.add(matched.id);
        await db.penilaian.update({
          where: { id: matched.id },
          data: {
            nama: pc.nama,
            urutan: desiredUrutan,
            ...(matchedTpDesc && !matched.tujuanPembelajaran
              ? { tujuanPembelajaran: matchedTpDesc }
              : {}),
          },
        });
        resolvedCols.push({
          colNumber: pc.colNumber,
          penilaianId: matched.id,
          kategori: pc.kategori,
          nama: pc.nama,
        });
      } else {
        const created = await db.penilaian.create({
          data: {
            pembelajaranId,
            kategori: pc.kategori,
            urutan: desiredUrutan,
            nama: pc.nama,
            tujuanPembelajaran: matchedTpDesc,
          },
        });
        usedPenilaianIds.add(created.id);
        existingPenilaian.push(created);
        resolvedCols.push({
          colNumber: pc.colNumber,
          penilaianId: created.id,
          kategori: pc.kategori,
          nama: pc.nama,
        });
      }
    }

    // 2. PETAKAN SISWA PADA ROMBEL KELAS INI (BERDASARKAN NISN & NAMA SISWA)
    const siswaByNisn = new Map<string, string>();
    const siswaByNama = new Map<string, string>();

    for (const agg of pembelajaran.rombel.anggota) {
      if (agg.siswa.nisn) {
        siswaByNisn.set(agg.siswa.nisn.trim(), agg.siswaId);
      }
      if (agg.siswa.nama) {
        siswaByNama.set(agg.siswa.nama.trim().toLowerCase(), agg.siswaId);
      }
    }

    // 3. ISI DAN TEMPATKAN DATA NILAI KE LEMBAR PENILAIAN SISWA
    let importedStudentsCount = 0;
    let importedCellsCount = 0;
    const resetOverrideSiswaIds = new Set<string>();

    const FOOTER_STOP_PREFIXES = [
      "rata-rata kelas",
      "nilai tertinggi",
      "nilai terendah",
      "mengetahui",
      "kepala sekolah",
      "guru pengampu",
    ];

    for (let r = dataStartRowIdx; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const firstColTxt = extractCellString(row.getCell(1).value).toLowerCase();
      const rawNisn = extractCellString(row.getCell(nisnColIdx).value);
      const rawNama = extractCellString(row.getCell(namaColIdx).value);

      if (
        FOOTER_STOP_PREFIXES.some(
          (prefix) =>
            firstColTxt.startsWith(prefix) ||
            rawNama.toLowerCase().startsWith(prefix)
        )
      ) {
        break;
      }

      if (!rawNisn && !rawNama) continue;

      const cleanNisn = rawNisn.replace(/\s+/g, "");
      const matchedSiswaId =
        (cleanNisn ? siswaByNisn.get(cleanNisn) : undefined) ??
        (rawNama ? siswaByNama.get(rawNama.trim().toLowerCase()) : undefined);

      if (!matchedSiswaId) continue;

      let studentHasChange = false;

      for (const rc of resolvedCols) {
        const cellVal = row.getCell(rc.colNumber).value;
        const numVal = extractCellNumber(cellVal);

        if (numVal !== null && numVal >= 0 && numVal <= 100) {
          const cleanVal = Math.round(numVal * 100) / 100;
          await db.nilai.upsert({
            where: {
              penilaianId_siswaId: {
                penilaianId: rc.penilaianId,
                siswaId: matchedSiswaId,
              },
            },
            update: {
              nilai: cleanVal,
              updatedById: session.userId,
            },
            create: {
              penilaianId: rc.penilaianId,
              siswaId: matchedSiswaId,
              nilai: cleanVal,
              updatedById: session.userId,
            },
          });
          importedCellsCount++;
          studentHasChange = true;
        } else if (extractCellString(cellVal) === "") {
          // Kosongkan sel jika di file Excel memang dikosongkan
          await db.nilai.deleteMany({
            where: {
              penilaianId: rc.penilaianId,
              siswaId: matchedSiswaId,
            },
          });
          studentHasChange = true;
        }
      }

      if (studentHasChange) {
        importedStudentsCount++;
        resetOverrideSiswaIds.add(matchedSiswaId);
      }
    }

    if (importedStudentsCount === 0) {
      return {
        success: false,
        message:
          "Tidak ada baris siswa yang cocok dengan daftar siswa pada kelas ini. Pastikan NISN atau Nama Siswa sesuai.",
      };
    }

    await recalculateNilaiRaporPembelajaran(pembelajaranId, resetOverrideSiswaIds);

    // Ambil seluruh nilai terbaru untuk dikembalikan langsung ke state Lembar Penilaian Siswa di web
    const allPenilaianAfter = await db.penilaian.findMany({
      where: { pembelajaranId },
      select: { id: true },
    });
    const allNilaiAfter =
      allPenilaianAfter.length > 0
        ? await db.nilai.findMany({
            where: {
              penilaianId: { in: allPenilaianAfter.map((p) => p.id) },
            },
          })
        : [];

    const updatedScores: Record<string, string> = {};
    allNilaiAfter.forEach((n) => {
      if (n.nilai !== null) {
        updatedScores[`${n.penilaianId}_${n.siswaId}`] = String(Number(n.nilai));
      }
    });

    revalidatePath(`/guru/nilai/${pembelajaranId}`);
    revalidatePath("/guru/kelas");
    revalidatePath("/guru/konversi-nilai");
    revalidatePath("/guru/leger");
    revalidatePath("/guru/ekspor");
    revalidatePath("/admin/leger");
    revalidatePath("/admin/statistik");

    return {
      success: true,
      message: `Impor Lembar Penilaian Siswa berhasil! ${resolvedCols.length} kolom asesmen (TP, SLM, STS, SAS) telah disusun dan ${importedCellsCount} nilai dari ${importedStudentsCount} siswa telah ditempatkan ke Lembar Penilaian Siswa.`,
      updatedScores,
      importedStudentsCount,
      importedCellsCount,
      columnsCount: resolvedCols.length,
    };
  } catch (err: unknown) {
    console.error("[imporLembarPenilaianSiswaAction Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "Gagal mengimpor berkas Lembar Penilaian Siswa.",
    };
  }
}

