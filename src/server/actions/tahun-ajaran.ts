"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import {
  aktifkanSemester,
  kunciSemester,
  bukaKunciSemester,
  salinRombel,
} from "@/lib/services/semester";

export type TahunAjaranActionResult = {
  success: boolean;
  message: string;
};

function revalidateAllAcademicPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/guru", "layout");
  revalidatePath("/admin/tahun-ajaran");
  revalidatePath("/admin/master/rombel");
  revalidatePath("/admin/pembelajaran");
  revalidatePath("/admin/tujuan-pembelajaran");
  revalidatePath("/guru/tujuan-pembelajaran");
  revalidatePath("/guru/kelas");
}

/**
 * Mengaktifkan semester (dan opsional menyalin rombel, pengampu & TP dari semester aktif sebelumnya jika kosong)
 */
export async function aktifkanSemesterAction(
  semesterId: string,
  opsiSalinStruktur: boolean = false,
): Promise<TahunAjaranActionResult> {
  try {
    await requireRole("SUPERADMIN");
    if (!semesterId) {
      return { success: false, message: "ID Semester tidak valid." };
    }

    const prevAktif = await db.semester.findFirst({
      where: { isAktif: true },
      select: { id: true, tipe: true, tahunAjaran: { select: { nama: true } } },
    });

    const baru = await aktifkanSemester(semesterId);

    let infoTambahan = "";
    if (opsiSalinStruktur && prevAktif && prevAktif.id !== semesterId) {
      const hasilSalin = await salinRombel(prevAktif.id, semesterId);
      if (hasilSalin.rombelCount > 0 || hasilSalin.tpCount > 0) {
        infoTambahan = ` (Struktur ${hasilSalin.rombelCount} Rombel & ${hasilSalin.tpCount} TP turut disalin dari Semester ${prevAktif.tipe} ${prevAktif.tahunAjaran.nama}).`;
      }
    }

    revalidateAllAcademicPaths();

    return {
      success: true,
      message: `Semester ${baru.tipe} Tahun Pelajaran ${baru.tahunAjaran.nama} (${baru.kode}) berhasil diaktifkan!${infoTambahan}`,
    };
  } catch (err: unknown) {
    console.error("[aktifkanSemesterAction Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat mengaktifkan semester.",
    };
  }
}

/**
 * Kunci (Freeze) nilai pada semester tertentu
 */
export async function kunciSemesterAction(
  semesterId: string,
): Promise<TahunAjaranActionResult> {
  try {
    await requireRole("SUPERADMIN");
    if (!semesterId) {
      return { success: false, message: "ID Semester tidak valid." };
    }

    const updated = await kunciSemester(semesterId);
    revalidateAllAcademicPaths();

    return {
      success: true,
      message: `Semester ${updated.tipe} (${updated.kode}) berhasil dikunci (freeze). Nilai kini bersifat Read-Only.`,
    };
  } catch (err: unknown) {
    console.error("[kunciSemesterAction Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Gagal mengunci nilai semester.",
    };
  }
}

/**
 * Buka kembali kunci (Unfreeze) nilai pada semester tertentu
 */
export async function bukaKunciSemesterAction(
  semesterId: string,
): Promise<TahunAjaranActionResult> {
  try {
    await requireRole("SUPERADMIN");
    if (!semesterId) {
      return { success: false, message: "ID Semester tidak valid." };
    }

    const updated = await bukaKunciSemester(semesterId);
    revalidateAllAcademicPaths();

    return {
      success: true,
      message: `Kunci nilai pada Semester ${updated.tipe} (${updated.kode}) berhasil dibuka kembali!`,
    };
  } catch (err: unknown) {
    console.error("[bukaKunciSemesterAction Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Gagal membuka kunci semester.",
    };
  }
}

/**
 * Salin struktur Rombel, Anggota Rombel, Pembelajaran & Tujuan Pembelajaran antar semester
 */
export async function salinStrukturSemesterAction(
  dariSemesterId: string,
  keSemesterId: string,
): Promise<TahunAjaranActionResult> {
  try {
    await requireRole("SUPERADMIN");
    if (!dariSemesterId || !keSemesterId || dariSemesterId === keSemesterId) {
      return {
        success: false,
        message: "Pilih semester sumber dan tujuan yang berbeda.",
      };
    }

    const hasil = await salinRombel(dariSemesterId, keSemesterId);
    revalidateAllAcademicPaths();

    return {
      success: true,
      message: `Berhasil menyalin ${hasil.rombelCount} Rombel/Pembelajaran dan ${hasil.tpCount} Tujuan Pembelajaran ke semester tujuan!`,
    };
  } catch (err: unknown) {
    console.error("[salinStrukturSemesterAction Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "Gagal menyalin struktur rombel antar semester.",
    };
  }
}

/**
 * Tambah Tahun Ajaran baru beserta Semester Ganjil & Genap
 */
export async function tambahTahunAjaranAction(payload: {
  nama: string;
  tahunMulai: number;
}): Promise<TahunAjaranActionResult> {
  try {
    await requireRole("SUPERADMIN");
    const nama = String(payload.nama || "").trim();
    const tahunMulai = Number(payload.tahunMulai);

    if (!nama || !/^\d{4}\/\d{4}$/.test(nama)) {
      return {
        success: false,
        message: 'Format Tahun Ajaran harus berupa "YYYY/YYYY", misalnya 2027/2028.',
      };
    }

    if (!tahunMulai || isNaN(tahunMulai) || tahunMulai < 2000 || tahunMulai > 2100) {
      return {
        success: false,
        message: "Tahun mulai tidak valid (masukkan angka 4 digit, mis. 2027).",
      };
    }

    const existing = await db.tahunAjaran.findUnique({ where: { nama } });
    if (existing) {
      return {
        success: false,
        message: `Tahun Ajaran ${nama} sudah terdaftar di dalam sistem.`,
      };
    }

    const ta = await db.tahunAjaran.create({
      data: { nama, tahunMulai, isAktif: false },
    });

    await db.semester.upsert({
      where: { kode: `${tahunMulai}1` },
      update: { tahunAjaranId: ta.id },
      create: {
        tahunAjaranId: ta.id,
        tipe: "GANJIL",
        kode: `${tahunMulai}1`,
        status: "DRAFT",
        isAktif: false,
      },
    });

    await db.semester.upsert({
      where: { kode: `${tahunMulai}2` },
      update: { tahunAjaranId: ta.id },
      create: {
        tahunAjaranId: ta.id,
        tipe: "GENAP",
        kode: `${tahunMulai}2`,
        status: "DRAFT",
        isAktif: false,
      },
    });

    revalidateAllAcademicPaths();

    return {
      success: true,
      message: `Tahun Pelajaran ${nama} (Semester Ganjil & Genap) berhasil ditambahkan!`,
    };
  } catch (err: unknown) {
    console.error("[tambahTahunAjaranAction Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "Gagal menambahkan Tahun Ajaran baru.",
    };
  }
}

/**
 * Hapus Tahun Ajaran nonaktif yang belum memiliki arsip nilai
 */
export async function hapusTahunAjaranAction(
  tahunAjaranId: string,
): Promise<TahunAjaranActionResult> {
  try {
    await requireRole("SUPERADMIN");
    const ta = await db.tahunAjaran.findUnique({
      where: { id: tahunAjaranId },
      include: {
        semester: {
          include: {
            _count: { select: { arsipNilai: true, rombel: true } },
          },
        },
      },
    });

    if (!ta) {
      return { success: false, message: "Tahun Ajaran tidak ditemukan." };
    }

    if (ta.isAktif || ta.semester.some((s) => s.isAktif)) {
      return {
        success: false,
        message:
          "Tidak dapat menghapus Tahun Pelajaran yang sedang berjalan/aktif.",
      };
    }

    if (ta.semester.some((s) => s._count.arsipNilai > 0)) {
      return {
        success: false,
        message:
          "Tahun Pelajaran ini memiliki Arsip Nilai permanen dan tidak dapat dihapus.",
      };
    }

    await db.$transaction(async (tx) => {
      await tx.semester.deleteMany({ where: { tahunAjaranId: ta.id } });
      await tx.tahunAjaran.delete({ where: { id: ta.id } });
    });

    revalidateAllAcademicPaths();

    return {
      success: true,
      message: `Tahun Pelajaran ${ta.nama} berhasil dihapus.`,
    };
  } catch (err: unknown) {
    console.error("[hapusTahunAjaranAction Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Gagal menghapus Tahun Ajaran.",
    };
  }
}

// Legacy FormAction wrappers (safe fallback, tidak melempar unhandled error)
export async function actionAktifkanSemester(input: FormData | string): Promise<void> {
  const semesterId = typeof input === "string" ? input : String(input.get("semesterId") || "");
  if (!semesterId) return;
  await aktifkanSemesterAction(semesterId, false);
}

export async function actionKunciSemester(input: FormData | string): Promise<void> {
  const semesterId = typeof input === "string" ? input : String(input.get("semesterId") || "");
  if (!semesterId) return;
  await kunciSemesterAction(semesterId);
}

export async function actionTambahTahunAjaran(formData: FormData): Promise<void> {
  const nama = String(formData.get("nama") || "").trim();
  const tahunMulai = parseInt(String(formData.get("tahunMulai") || "2027")) || 2027;
  if (!nama) return;
  await tambahTahunAjaranAction({ nama, tahunMulai });
}
