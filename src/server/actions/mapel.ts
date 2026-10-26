"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export async function createMapel(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");

  const kode = String(formData.get("kode") || "").trim().toUpperCase();
  const nama = String(formData.get("nama") || "").trim();
  const kodeErapor = String(formData.get("kodeErapor") || "").trim() || null;
  const kelompok = String(formData.get("kelompok") || "Umum").trim();
  const urutan = parseInt(String(formData.get("urutan") || "1")) || 1;

  if (!kode || !nama) return;

  const existing = await db.mapel.findUnique({ where: { kode } });
  if (existing) return;

  await db.mapel.create({
    data: {
      kode,
      nama,
      kodeErapor,
      kelompok,
      urutan,
      isAktif: true,
    },
  });

  revalidatePath("/admin/master/mapel");
}
