"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export async function updateProfilSekolah(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");

  const npsn = String(formData.get("npsn") || "").trim();
  const nama = String(formData.get("nama") || "").trim();
  const bentukPendidikan = String(formData.get("bentukPendidikan") || "").trim();
  const alamat = String(formData.get("alamat") || "").trim();
  const namaKepsek = String(formData.get("namaKepsek") || "").trim();
  const nipKepsek = String(formData.get("nipKepsek") || "").trim();
  const telepon = String(formData.get("telepon") || "").trim();
  const email = String(formData.get("email") || "").trim();

  if (!npsn || !nama) return;

  const existing = await db.sekolah.findFirst();

  if (existing) {
    await db.sekolah.update({
      where: { id: existing.id },
      data: {
        npsn,
        nama,
        bentukPendidikan,
        alamat,
        namaKepsek,
        nipKepsek,
        telepon,
        email,
      },
    });
  } else {
    await db.sekolah.create({
      data: {
        npsn,
        nama,
        bentukPendidikan,
        alamat,
        namaKepsek,
        nipKepsek,
        telepon,
        email,
      },
    });
  }

  revalidatePath("/admin/master/sekolah");
}
