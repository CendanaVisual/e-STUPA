"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

export async function createPembelajaran(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");

  const semesterId = String(formData.get("semesterId") || "").trim();
  const rombelId = String(formData.get("rombelId") || "").trim();
  const mapelId = String(formData.get("mapelId") || "").trim();
  const gtkId = String(formData.get("gtkId") || "").trim();
  const kktp = parseInt(String(formData.get("kktp") || "75")) || 75;
  const bobotHarian = parseInt(String(formData.get("bobotHarian") || "30")) || 30;
  const bobotUts = parseInt(String(formData.get("bobotUts") || "40")) || 40;
  const bobotUas = parseInt(String(formData.get("bobotUas") || "30")) || 30;

  if (!semesterId || !rombelId || !mapelId || !gtkId) return;

  if (bobotHarian + bobotUts + bobotUas !== 100) return;

  const existing = await db.pembelajaran.findUnique({
    where: { rombelId_mapelId: { rombelId, mapelId } },
  });
  if (existing) return;

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

  revalidatePath("/admin/pembelajaran");
}
