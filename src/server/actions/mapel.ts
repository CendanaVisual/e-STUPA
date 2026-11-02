"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export type ActionResponse = {
  success: boolean;
  message: string;
};

export type MapelInput = {
  id?: string;
  kode: string;
  nama: string;
  kodeErapor?: string | null;
  kelompok?: string | null;
  urutan?: number;
  isAktif?: boolean;
};

/**
 * Tambah Mata Pelajaran Baru
 */
export async function createMapel(
  input: FormData | MapelInput
): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    let kode = "";
    let nama = "";
    let kodeErapor: string | null = null;
    let kelompok = "Umum";
    let urutan = 1;
    let isAktif = true;

    if (input instanceof FormData) {
      kode = String(input.get("kode") || "").trim().toUpperCase();
      nama = String(input.get("nama") || "").trim();
      kodeErapor = String(input.get("kodeErapor") || "").trim() || null;
      kelompok = String(input.get("kelompok") || "Umum").trim();
      urutan = parseInt(String(input.get("urutan") || "1"), 10) || 1;
      isAktif = input.get("isAktif") !== "false";
    } else {
      kode = String(input.kode || "").trim().toUpperCase();
      nama = String(input.nama || "").trim();
      kodeErapor = input.kodeErapor?.trim() || null;
      kelompok = input.kelompok?.trim() || "Umum";
      urutan = input.urutan || 1;
      isAktif = input.isAktif !== false;
    }

    if (!kode || !nama) {
      return { success: false, message: "Kode mapel dan nama mata pelajaran wajib diisi." };
    }

    const existing = await db.mapel.findUnique({ where: { kode } });
    if (existing) {
      return {
        success: false,
        message: `Mata pelajaran dengan kode "${kode}" sudah terdaftar (${existing.nama}).`,
      };
    }

    await db.mapel.create({
      data: {
        kode,
        nama,
        kodeErapor,
        kelompok,
        urutan,
        isAktif,
      },
    });

    revalidatePath("/admin/master/mapel");
    revalidatePath("/admin/pembelajaran");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Mata pelajaran "${nama}" (${kode}) berhasil ditambahkan ke database!`,
    };
  } catch (err: unknown) {
    console.error("[createMapel Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menambahkan mata pelajaran.",
    };
  }
}

/**
 * Edit / Perbarui Mata Pelajaran
 */
export async function updateMapel(
  input: FormData | MapelInput
): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    let id = "";
    let kode = "";
    let nama = "";
    let kodeErapor: string | null = null;
    let kelompok = "Umum";
    let urutan = 1;
    let isAktif = true;

    if (input instanceof FormData) {
      id = String(input.get("id") || "").trim();
      kode = String(input.get("kode") || "").trim().toUpperCase();
      nama = String(input.get("nama") || "").trim();
      kodeErapor = String(input.get("kodeErapor") || "").trim() || null;
      kelompok = String(input.get("kelompok") || "Umum").trim();
      urutan = parseInt(String(input.get("urutan") || "1"), 10) || 1;
      isAktif = input.get("isAktif") !== "false";
    } else {
      id = String(input.id || "").trim();
      kode = String(input.kode || "").trim().toUpperCase();
      nama = String(input.nama || "").trim();
      kodeErapor = input.kodeErapor?.trim() || null;
      kelompok = input.kelompok?.trim() || "Umum";
      urutan = input.urutan || 1;
      isAktif = input.isAktif !== false;
    }

    if (!id) {
      return { success: false, message: "ID Mata pelajaran tidak ditemukan." };
    }

    if (!kode || !nama) {
      return { success: false, message: "Kode mapel dan nama mata pelajaran wajib diisi." };
    }

    const current = await db.mapel.findUnique({ where: { id } });
    if (!current) {
      return { success: false, message: "Data mata pelajaran tidak ditemukan." };
    }

    // Jika kode diubah, pastikan tidak bentrok dengan mapel lain
    if (kode !== current.kode) {
      const duplicate = await db.mapel.findUnique({ where: { kode } });
      if (duplicate && duplicate.id !== id) {
        return {
          success: false,
          message: `Kode mapel "${kode}" sudah digunakan oleh mata pelajaran "${duplicate.nama}".`,
        };
      }
    }

    await db.mapel.update({
      where: { id },
      data: {
        kode,
        nama,
        kodeErapor,
        kelompok,
        urutan,
        isAktif,
      },
    });

    revalidatePath("/admin/master/mapel");
    revalidatePath("/admin/pembelajaran");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Perubahan mata pelajaran "${nama}" (${kode}) berhasil disimpan!`,
    };
  } catch (err: unknown) {
    console.error("[updateMapel Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memperbarui data mata pelajaran.",
    };
  }
}

/**
 * Hapus Mata Pelajaran dari Database
 */
export async function deleteMapel(id: string): Promise<ActionResponse> {
  try {
    await requireRole("SUPERADMIN");

    const target = await db.mapel.findUnique({
      where: { id },
      include: {
        _count: {
          select: { pembelajaran: true },
        },
      },
    });

    if (!target) {
      return { success: false, message: "Data mata pelajaran tidak ditemukan atau sudah dihapus." };
    }

    await db.$transaction(async (tx) => {
      // 1. Ambil semua pembelajaran yang memakai mapel ini
      const pembelajarans = await tx.pembelajaran.findMany({
        where: { mapelId: id },
        select: { id: true },
      });
      const pIds = pembelajarans.map((p) => p.id);

      if (pIds.length > 0) {
        // Hapus penilaian yang terikat (akan cascade menghapus nilai)
        await tx.penilaian.deleteMany({ where: { pembelajaranId: { in: pIds } } });
        await tx.pembelajaran.deleteMany({ where: { id: { in: pIds } } });
      }

      // 2. Hapus mapel
      await tx.mapel.delete({ where: { id } });
    });

    revalidatePath("/admin/master/mapel");
    revalidatePath("/admin/pembelajaran");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Mata pelajaran "${target.nama}" (${target.kode}) berhasil dihapus dari database!`,
    };
  } catch (err: unknown) {
    console.error("[deleteMapel Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menghapus mata pelajaran.",
    };
  }
}
