"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";

import {
  type Fase,
  getFaseByTingkat,
  MAPEL_GURU_KELAS_BY_FASE,
} from "@/lib/services/pembelajaran-utils";

export type ActionResponse = {
  success: boolean;
  message: string;
  data?: any;
};

/**
 * Mencari atau memastikan mata pelajaran tersedia di database
 */
async function getOrCreateMapel(spec: { kode: string; nama: string; keywords: string[] }) {
  // 1. Cari berdasarkan kode persis
  let m = await db.mapel.findUnique({ where: { kode: spec.kode } });
  if (m) return m;

  // 2. Cari berdasarkan kata kunci pada nama mapel
  const allMapels = await db.mapel.findMany();
  for (const item of allMapels) {
    if (item.kode.toUpperCase() === spec.kode.toUpperCase()) return item;
    const itemNama = item.nama.toLowerCase();
    for (const kw of spec.keywords) {
      if (itemNama.includes(kw.toLowerCase())) return item;
    }
  }

  // 3. Buat otomatis jika belum ada di database
  return await db.mapel.create({
    data: {
      kode: spec.kode,
      nama: spec.nama,
      kelompok: "Umum",
      isAktif: true,
    },
  });
}

/**
 * Sinkronisasi satu Rombel & Guru Kelas:
 * 1. Update status wali kelas rombel tersebut ke Guru Kelas ini
 * 2. Otomatis buat/perbarui seluruh pembelajaran mapel sesuai Fase
 */
export async function syncGuruKelasRombel(
  rombelId: string,
  gtkId: string,
  semesterId: string,
  options?: { kktp?: number; bobotHarian?: number; bobotUts?: number; bobotUas?: number }
) {
  const rombel = await db.rombel.findUnique({ where: { id: rombelId } });
  const gtk = await db.gtk.findUnique({ where: { id: gtkId } });
  if (!rombel || !gtk) return { count: 0, synced: false };

  // 1. Sinkronkan status penugasan wali kelas
  if (rombel.waliKelasId !== gtk.id) {
    await db.rombel.update({
      where: { id: rombel.id },
      data: { waliKelasId: gtk.id },
    });
  }

  // 2. Dapatkan pemetaan mapel sesuai Fase
  const { fase } = getFaseByTingkat(rombel.tingkat);
  const targetMapels = MAPEL_GURU_KELAS_BY_FASE[fase];

  const kktp = options?.kktp ?? 75;
  const bobotHarian = options?.bobotHarian ?? 30;
  const bobotUts = options?.bobotUts ?? 40;
  const bobotUas = options?.bobotUas ?? 30;

  let count = 0;
  for (const spec of targetMapels) {
    const mapel = await getOrCreateMapel(spec);
    await db.pembelajaran.upsert({
      where: {
        rombelId_mapelId: {
          rombelId: rombel.id,
          mapelId: mapel.id,
        },
      },
      update: {
        gtkId: gtk.id,
      },
      create: {
        semesterId,
        rombelId: rombel.id,
        mapelId: mapel.id,
        gtkId: gtk.id,
        kktp,
        bobotHarian,
        bobotUts,
        bobotUas,
      },
    });
    count++;
  }

  return { count, synced: true, fase, mapelsCount: targetMapels.length, rombelNama: rombel.nama, gtkNama: gtk.nama };
}

export type CreatePembelajaranInput = {
  semesterId?: string;
  rombelId: string;
  mapelId?: string;
  gtkId: string;
  kktp?: number;
  bobotHarian?: number;
  bobotUts?: number;
  bobotUas?: number;
  autoSyncGuruKelas?: boolean;
};

/**
 * Tambah Penugasan Mengajar (dengan dukungan logika otomatis Guru Kelas)
 */
export async function createPembelajaran(
  input: FormData | CreatePembelajaranInput
): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    let semesterId = "";
    let rombelId = "";
    let mapelId = "";
    let gtkId = "";
    let kktp = 75;
    let bobotHarian = 30;
    let bobotUts = 40;
    let bobotUas = 30;
    let autoSyncGuruKelas = true;

    if (input instanceof FormData) {
      semesterId = String(input.get("semesterId") || "").trim();
      rombelId = String(input.get("rombelId") || "").trim();
      mapelId = String(input.get("mapelId") || "").trim();
      gtkId = String(input.get("gtkId") || "").trim();
      kktp = parseInt(String(input.get("kktp") || "75"), 10) || 75;
      bobotHarian = parseInt(String(input.get("bobotHarian") || "30"), 10) || 30;
      bobotUts = parseInt(String(input.get("bobotUts") || "40"), 10) || 40;
      bobotUas = parseInt(String(input.get("bobotUas") || "30"), 10) || 30;
      autoSyncGuruKelas = input.get("autoSyncGuruKelas") !== "false";
    } else {
      semesterId = input.semesterId?.trim() || "";
      rombelId = input.rombelId?.trim() || "";
      mapelId = input.mapelId?.trim() || "";
      gtkId = input.gtkId?.trim() || "";
      kktp = input.kktp ?? 75;
      bobotHarian = input.bobotHarian ?? 30;
      bobotUts = input.bobotUts ?? 40;
      bobotUas = input.bobotUas ?? 30;
      autoSyncGuruKelas = input.autoSyncGuruKelas !== false;
    }

    if (!semesterId) {
      const activeSem = await getSemesterAktif();
      if (!activeSem) {
        return { success: false, message: "Tidak ada semester aktif saat ini." };
      }
      semesterId = activeSem.id;
    }

    if (!rombelId || !gtkId) {
      return { success: false, message: "Rombel / Kelas dan Guru Pengampu wajib dipilih." };
    }

    if (bobotHarian + bobotUts + bobotUas !== 100) {
      return {
        success: false,
        message: `Total bobot penilaian harus 100% (saat ini ${bobotHarian + bobotUts + bobotUas}%).`,
      };
    }

    const [rombel, gtk] = await Promise.all([
      db.rombel.findUnique({ where: { id: rombelId } }),
      db.gtk.findUnique({ where: { id: gtkId } }),
    ]);

    if (!rombel) return { success: false, message: "Data rombel tidak ditemukan." };
    if (!gtk) return { success: false, message: "Data guru pengampu tidak ditemukan." };

    const isGuruKelas =
      gtk.jenisPtk?.toLowerCase().trim() === "guru kelas" ||
      gtk.jenisPtk?.toLowerCase().includes("guru kelas");

    // Jika Guru Kelas dan autoSyncGuruKelas aktif
    if (isGuruKelas && autoSyncGuruKelas) {
      const syncResult = await syncGuruKelasRombel(rombelId, gtkId, semesterId, {
        kktp,
        bobotHarian,
        bobotUts,
        bobotUas,
      });

      revalidatePath("/admin/pembelajaran");
      revalidatePath("/admin/master/rombel");
      revalidatePath("/admin/master/gtk");
      revalidatePath("/guru");

      return {
        success: true,
        message: `Berhasil sinkronisasi Guru Kelas & Wali Kelas "${gtk.nama}" di Kelas ${rombel.nama}! Otomatis memetakan ${syncResult.count} mata pelajaran ${(syncResult.fase || "").replace("_", " ")}.`,
      };
    }

    // Jika bukan Guru Kelas atau memilih mapel spesifik
    if (!mapelId) {
      return { success: false, message: "Mata pelajaran wajib dipilih untuk penugasan mengajar tunggal." };
    }

    const mapel = await db.mapel.findUnique({ where: { id: mapelId } });
    if (!mapel) return { success: false, message: "Mata pelajaran tidak ditemukan." };

    const existing = await db.pembelajaran.findUnique({
      where: { rombelId_mapelId: { rombelId, mapelId } },
      include: { gtk: true },
    });

    if (existing) {
      return {
        success: false,
        message: `Mata pelajaran "${mapel.nama}" di Kelas ${rombel.nama} sudah diampu oleh ${existing.gtk.nama}. Gunakan fitur Edit jika ingin mengubah guru pengampu.`,
      };
    }

    await db.pembelajaran.create({
      data: {
        semesterId,
        rombelId,
        mapelId,
        gtkId,
        kktp,
        bobotHarian,
        bobotUts,
        bobotUas,
      },
    });

    // Jika GTK adalah Guru Kelas, pastikan status wali kelas rombel juga sinkron
    if (isGuruKelas && !rombel.waliKelasId) {
      await db.rombel.update({
        where: { id: rombel.id },
        data: { waliKelasId: gtk.id },
      });
    }

    revalidatePath("/admin/pembelajaran");
    revalidatePath("/admin/master/rombel");
    revalidatePath("/admin/master/gtk");
    revalidatePath("/guru");

    return {
      success: true,
      message: `Penugasan mengajar "${mapel.nama}" di Kelas ${rombel.nama} untuk guru ${gtk.nama} berhasil ditambahkan!`,
    };
  } catch (err: unknown) {
    console.error("[createPembelajaran Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menambahkan penugasan mengajar.",
    };
  }
}

export type UpdatePembelajaranInput = {
  id: string;
  gtkId: string;
  kktp?: number;
  bobotHarian?: number;
  bobotUts?: number;
  bobotUas?: number;
  syncWaliKelas?: boolean;
};

/**
 * Edit / Perbarui Penugasan Mengajar
 */
export async function updatePembelajaran(
  input: FormData | UpdatePembelajaranInput
): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    let id = "";
    let gtkId = "";
    let kktp = 75;
    let bobotHarian = 30;
    let bobotUts = 40;
    let bobotUas = 30;
    let syncWaliKelas = true;

    if (input instanceof FormData) {
      id = String(input.get("id") || "").trim();
      gtkId = String(input.get("gtkId") || "").trim();
      kktp = parseInt(String(input.get("kktp") || "75"), 10) || 75;
      bobotHarian = parseInt(String(input.get("bobotHarian") || "30"), 10) || 30;
      bobotUts = parseInt(String(input.get("bobotUts") || "40"), 10) || 40;
      bobotUas = parseInt(String(input.get("bobotUas") || "30"), 10) || 30;
      syncWaliKelas = input.get("syncWaliKelas") !== "false";
    } else {
      id = input.id?.trim() || "";
      gtkId = input.gtkId?.trim() || "";
      kktp = input.kktp ?? 75;
      bobotHarian = input.bobotHarian ?? 30;
      bobotUts = input.bobotUts ?? 40;
      bobotUas = input.bobotUas ?? 30;
      syncWaliKelas = input.syncWaliKelas !== false;
    }

    if (!id) return { success: false, message: "ID Pembelajaran tidak valid." };
    if (!gtkId) return { success: false, message: "Guru Pengampu wajib dipilih." };

    if (bobotHarian + bobotUts + bobotUas !== 100) {
      return {
        success: false,
        message: `Total bobot penilaian harus 100% (saat ini ${bobotHarian + bobotUts + bobotUas}%).`,
      };
    }

    const current = await db.pembelajaran.findUnique({
      where: { id },
      include: { rombel: true, mapel: true },
    });

    if (!current) {
      return { success: false, message: "Data pembelajaran tidak ditemukan." };
    }

    const newGtk = await db.gtk.findUnique({ where: { id: gtkId } });
    if (!newGtk) {
      return { success: false, message: "Data guru pengampu tidak ditemukan." };
    }

    await db.pembelajaran.update({
      where: { id },
      data: {
        gtkId,
        kktp,
        bobotHarian,
        bobotUts,
        bobotUas,
      },
    });

    // Jika guru baru adalah Guru Kelas & syncWaliKelas diaktifkan, sinkronkan status wali kelas
    const isGuruKelas =
      newGtk.jenisPtk?.toLowerCase().trim() === "guru kelas" ||
      newGtk.jenisPtk?.toLowerCase().includes("guru kelas");

    if (isGuruKelas && syncWaliKelas && current.rombel.waliKelasId !== newGtk.id) {
      await db.rombel.update({
        where: { id: current.rombelId },
        data: { waliKelasId: newGtk.id },
      });
    }

    revalidatePath("/admin/pembelajaran");
    revalidatePath("/admin/master/rombel");
    revalidatePath("/admin/master/gtk");
    revalidatePath("/guru");

    return {
      success: true,
      message: `Penugasan mengajar "${current.mapel.nama}" Kelas ${current.rombel.nama} berhasil diperbarui (Pengampu: ${newGtk.nama})!`,
    };
  } catch (err: unknown) {
    console.error("[updatePembelajaran Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memperbarui penugasan mengajar.",
    };
  }
}

/**
 * Hapus Penugasan Mengajar
 */
export async function deletePembelajaran(id: string): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    if (!id) return { success: false, message: "ID Pembelajaran tidak valid." };

    const current = await db.pembelajaran.findUnique({
      where: { id },
      include: { rombel: true, mapel: true, gtk: true },
    });

    if (!current) {
      return { success: false, message: "Data pembelajaran tidak ditemukan." };
    }

    await db.pembelajaran.delete({
      where: { id },
    });

    revalidatePath("/admin/pembelajaran");
    revalidatePath("/admin/master/rombel");
    revalidatePath("/admin/master/gtk");
    revalidatePath("/guru");

    return {
      success: true,
      message: `Penugasan mengajar "${current.mapel.nama}" Kelas ${current.rombel.nama} (${current.gtk.nama}) berhasil dihapus dari database.`,
    };
  } catch (err: unknown) {
    console.error("[deletePembelajaran Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menghapus penugasan mengajar.",
    };
  }
}

/**
 * Sinkronisasi Seluruh Guru Kelas & Wali Kelas pada Semester Aktif
 * Memetakan seluruh Rombel yang memiliki Wali Kelas bertipe "Guru Kelas"
 * ke mata pelajaran Fase A, B, atau C.
 */
export async function syncAllGuruKelasPembelajaran(): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    const semesterAktif = await getSemesterAktif();
    if (!semesterAktif) {
      return { success: false, message: "Tidak ada semester aktif saat ini." };
    }

    // Ambil seluruh rombel dengan wali kelas
    const rombels = await db.rombel.findMany({
      where: { semesterId: semesterAktif.id },
      include: { waliKelas: true },
    });

    let totalSyncedPembelajaran = 0;
    let totalSyncedRombel = 0;

    for (const r of rombels) {
      if (r.waliKelas) {
        const isGuruKelas =
          r.waliKelas.jenisPtk?.toLowerCase().trim() === "guru kelas" ||
          r.waliKelas.jenisPtk?.toLowerCase().includes("guru kelas");

        if (isGuruKelas) {
          const res = await syncGuruKelasRombel(r.id, r.waliKelas.id, semesterAktif.id);
          if (res.synced) {
            totalSyncedPembelajaran += res.count;
            totalSyncedRombel++;
          }
        }
      }
    }

    revalidatePath("/admin/pembelajaran");
    revalidatePath("/admin/master/rombel");
    revalidatePath("/admin/master/gtk");
    revalidatePath("/guru");

    return {
      success: true,
      message: `Berhasil menyinkronkan ${totalSyncedPembelajaran} mata pelajaran untuk ${totalSyncedRombel} Guru Kelas / Wali Kelas sesuai kurikulum Fase A, B, & C!`,
      data: { totalPembelajaran: totalSyncedPembelajaran, totalRombel: totalSyncedRombel },
    };
  } catch (err: unknown) {
    console.error("[syncAllGuruKelasPembelajaran Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal melakukan sinkronisasi Guru Kelas.",
    };
  }
}
