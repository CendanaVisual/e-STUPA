"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export type UpdateSekolahResponse = {
  success: boolean;
  message: string;
};

export async function updateProfilSekolah(
  input:
    | FormData
    | {
        npsn: string;
        nama: string;
        bentukPendidikan?: string;
        alamat?: string;
        desaKelurahan?: string;
        kecamatan?: string;
        kabupatenKota?: string;
        provinsi?: string;
        kodePos?: string;
        telepon?: string;
        email?: string;
        website?: string;
        namaKepsek?: string;
        nipKepsek?: string;
        capTtdKepsekUrl?: string | null;
      }
): Promise<UpdateSekolahResponse> {
  try {
    await requireRole("SUPERADMIN");

    let npsn = "";
    let nama = "";
    let bentukPendidikan = "SD";
    let alamat = "";
    let desaKelurahan = "";
    let kecamatan = "";
    let kabupatenKota = "";
    let provinsi = "";
    let kodePos = "";
    let telepon = "";
    let email = "";
    let website = "";
    let namaKepsek = "";
    let nipKepsek = "";
    let capTtdKepsekUrl: string | null | undefined = undefined;

    if (input instanceof FormData) {
      npsn = String(input.get("npsn") || "").trim();
      nama = String(input.get("nama") || "").trim();
      bentukPendidikan = String(input.get("bentukPendidikan") || "SD").trim();
      alamat = String(input.get("alamat") || "").trim();
      desaKelurahan = String(input.get("desaKelurahan") || "").trim();
      kecamatan = String(input.get("kecamatan") || "").trim();
      kabupatenKota = String(input.get("kabupatenKota") || "").trim();
      provinsi = String(input.get("provinsi") || "").trim();
      kodePos = String(input.get("kodePos") || "").trim();
      telepon = String(input.get("telepon") || "").trim();
      email = String(input.get("email") || "").trim();
      website = String(input.get("website") || "").trim();
      namaKepsek = String(input.get("namaKepsek") || "").trim();
      nipKepsek = String(input.get("nipKepsek") || "").trim();
      if (input.has("capTtdKepsekUrl")) {
        const rawCap = String(input.get("capTtdKepsekUrl") || "").trim();
        capTtdKepsekUrl = rawCap || null;
      }
    } else {
      npsn = String(input.npsn || "").trim();
      nama = String(input.nama || "").trim();
      bentukPendidikan = String(input.bentukPendidikan || "SD").trim();
      alamat = String(input.alamat || "").trim();
      desaKelurahan = String(input.desaKelurahan || "").trim();
      kecamatan = String(input.kecamatan || "").trim();
      kabupatenKota = String(input.kabupatenKota || "").trim();
      provinsi = String(input.provinsi || "").trim();
      kodePos = String(input.kodePos || "").trim();
      telepon = String(input.telepon || "").trim();
      email = String(input.email || "").trim();
      website = String(input.website || "").trim();
      namaKepsek = String(input.namaKepsek || "").trim();
      nipKepsek = String(input.nipKepsek || "").trim();
      capTtdKepsekUrl = input.capTtdKepsekUrl;
    }

    if (!npsn) {
      return { success: false, message: "NPSN wajib diisi (8 digit)." };
    }
    if (!nama) {
      return { success: false, message: "Nama resmi sekolah wajib diisi." };
    }

    const payload = {
      npsn,
      nama,
      bentukPendidikan: bentukPendidikan || null,
      alamat: alamat || null,
      desaKelurahan: desaKelurahan || null,
      kecamatan: kecamatan || null,
      kabupatenKota: kabupatenKota || null,
      provinsi: provinsi || null,
      kodePos: kodePos || null,
      telepon: telepon || null,
      email: email || null,
      website: website || null,
      namaKepsek: namaKepsek || null,
      nipKepsek: nipKepsek || null,
      ...(capTtdKepsekUrl !== undefined ? { capTtdKepsekUrl } : {}),
    };

    // Ambil data sekolah yang sudah ada
    const existing = await db.sekolah.findFirst();

    if (existing) {
      // Jika NPSN diubah, pastikan tidak ada baris sekolah lain yang memakai NPSN yang sama
      if (existing.npsn !== npsn) {
        await db.sekolah.deleteMany({
          where: {
            npsn,
            id: { not: existing.id },
          },
        });
      }

      await db.sekolah.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      // Jika belum ada sekolah, bersihkan duplikat NPSN jika ada lalu buat baru
      await db.sekolah.deleteMany({ where: { npsn } });
      await db.sekolah.create({
        data: payload,
      });
    }

    revalidatePath("/admin/master/sekolah");
    revalidatePath("/admin");
    revalidatePath("/admin/leger");
    revalidatePath("/guru/leger");
    revalidatePath("/guru/ekspor");
    return { success: true, message: "Profil sekolah berhasil disimpan ke database!" };
  } catch (err: unknown) {
    console.error("[updateProfilSekolah Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menyimpan data profil sekolah.",
    };
  }
}

/**
 * Simpan cepat berkas CAP Sekolah & TTD Kepala Sekolah (PNG Transparan)
 */
export async function updateCapTtdKepsekAction(
  capTtdKepsekUrl: string | null
): Promise<UpdateSekolahResponse> {
  try {
    await requireRole("SUPERADMIN");

    const existing = await db.sekolah.findFirst();
    if (existing) {
      await db.sekolah.update({
        where: { id: existing.id },
        data: { capTtdKepsekUrl },
      });
    } else {
      await db.sekolah.create({
        data: {
          npsn: "50103069",
          nama: "SD Negeri 7 Pedungan",
          bentukPendidikan: "SD",
          capTtdKepsekUrl,
        },
      });
    }

    revalidatePath("/admin/master/sekolah");
    revalidatePath("/admin");
    revalidatePath("/admin/leger");
    revalidatePath("/guru/leger");
    revalidatePath("/guru/ekspor");

    return {
      success: true,
      message: capTtdKepsekUrl
        ? "Berkas CAP Sekolah & TTD KEPSEK berhasil dikonversi ke latar transparan dan disimpan!"
        : "Berkas CAP Sekolah & TTD KEPSEK berhasil dihapus.",
    };
  } catch (err: unknown) {
    console.error("[updateCapTtdKepsekAction Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menyimpan CAP Sekolah & TTD KEPSEK.",
    };
  }
}
