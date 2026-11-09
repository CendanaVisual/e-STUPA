"use server";

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

async function recalculateNilaiRaporPembelajaran(pembelajaranId: string) {
  const pembelajaran = await db.pembelajaran.findUnique({
    where: { id: pembelajaranId },
    include: {
      rombel: { include: { anggota: true } },
      penilaian: {
        include: { nilai: true },
        orderBy: [{ kategori: "asc" }, { urutan: "asc" }],
      },
    },
  });

  if (!pembelajaran) return;

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

    if (calc.nilaiAkhir !== null) {
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
          nilaiAkhir: calc.nilaiAkhir,
          capaianTertinggi: desc.capaianTertinggi,
          capaianTerendah: desc.capaianTerendah,
        },
        create: {
          pembelajaranId,
          siswaId: agg.siswaId,
          rataHarian: calc.rataHarian,
          rataSlm: calc.rataSlm,
          nilaiUts: calc.nilaiUts,
          nilaiUas: calc.nilaiUas,
          nilaiAkhir: calc.nilaiAkhir,
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
        penilaian: true,
      },
    });

    if (!pembelajaran) {
      return { success: false, message: "Data pembelajaran tidak ditemukan." };
    }

    for (const pen of pembelajaran.penilaian) {
      for (const agg of pembelajaran.rombel.anggota) {
        const key = `${pen.id}_${agg.siswaId}`;
        if (!(key in entries)) continue;

        const raw = entries[key]?.trim() ?? "";
        if (raw === "") {
          await db.nilai.deleteMany({
            where: {
              penilaianId: pen.id,
              siswaId: agg.siswaId,
            },
          });
        } else {
          const numVal = parseFloat(raw);
          if (!Number.isNaN(numVal) && numVal >= 0 && numVal <= 100) {
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

    await recalculateNilaiRaporPembelajaran(pembelajaranId);

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

export type TransferNilaiTargetType = "TP" | "SLM" | "STS" | "SAS";

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
};

/**
 * Mentransfer hasil Nilai Konversi ke kolom Penilaian (TP, SLM, STS, atau SAS)
 * pada Mata Pelajaran (Pembelajaran) yang dipilih serta menghitung ulang NilaiRapor.
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

    if (!targetType || !["TP", "SLM", "STS", "SAS"].includes(targetType)) {
      return { success: false, message: "Target kolom penilaian (TP/SLM/STS/SAS) tidak valid." };
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
        penilaian: { orderBy: { urutan: "asc" } },
      },
    });

    if (!pembelajaran) {
      return { success: false, message: "Data pembelajaran mata pelajaran tidak ditemukan." };
    }

    const kategoriMap: Record<TransferNilaiTargetType, KategoriPenilaianInput> = {
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
        // Gunakan kolom STS/SAS yang sudah ada, atau cari berdasarkan nama
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

        targetPenilaian = await db.penilaian.create({
          data: {
            pembelajaranId,
            kategori: targetKategori,
            urutan: nextUrutan,
            nama: desiredName,
            tujuanPembelajaran:
              targetType === "TP" ? payload.tujuanPembelajaranText?.trim() || null : null,
          },
        });
      } else if (
        targetType === "TP" &&
        payload.tujuanPembelajaranText?.trim() &&
        !targetPenilaian.tujuanPembelajaran
      ) {
        targetPenilaian = await db.penilaian.update({
          where: { id: targetPenilaian.id },
          data: { tujuanPembelajaran: payload.tujuanPembelajaranText.trim() },
        });
      }
    }

    const allowedSiswaIds = new Set(pembelajaran.rombel.anggota.map((a) => a.siswaId));
    let transferredCount = 0;

    for (const [siswaId, rawVal] of scoreEntries) {
      if (!allowedSiswaIds.has(siswaId)) continue;
      const cleanVal = Math.round(rawVal * 100) / 100;

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

    await recalculateNilaiRaporPembelajaran(pembelajaranId);

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
