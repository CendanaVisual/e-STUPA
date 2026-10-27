"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { aktifkanSemester, kunciSemester, salinRombel } from "@/lib/services/semester";

export async function actionAktifkanSemester(input: FormData | string): Promise<void> {
  await requireRole("SUPERADMIN");
  const semesterId = typeof input === "string" ? input : String(input.get("semesterId") || "");
  if (!semesterId) return;
  await aktifkanSemester(semesterId);
  revalidatePath("/admin/tahun-ajaran");
  revalidatePath("/admin");
}

export async function actionKunciSemester(input: FormData | string): Promise<void> {
  await requireRole("SUPERADMIN");
  const semesterId = typeof input === "string" ? input : String(input.get("semesterId") || "");
  if (!semesterId) return;
  await kunciSemester(semesterId);
  revalidatePath("/admin/tahun-ajaran");
  revalidatePath("/admin");
}

export async function actionSalinRombel(dariSemesterId: string, keSemesterId: string): Promise<void> {
  await requireRole("SUPERADMIN");
  await salinRombel(dariSemesterId, keSemesterId);
  revalidatePath("/admin/tahun-ajaran");
  revalidatePath("/admin/master/rombel");
}

export async function actionTambahTahunAjaran(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");
  const nama = String(formData.get("nama") || "").trim(); // mis. "2027/2028"
  const tahunMulai = parseInt(String(formData.get("tahunMulai") || "2027")) || 2027;

  if (!nama) return;

  const ta = await db.tahunAjaran.upsert({
    where: { nama },
    update: {},
    create: { nama, tahunMulai, isAktif: false },
  });

  await db.semester.upsert({
    where: { kode: `${tahunMulai}1` },
    update: {},
    create: {
      tahunAjaranId: ta.id,
      tipe: "GANJIL",
      kode: `${tahunMulai}1`,
      status: "DRAFT",
    },
  });

  await db.semester.upsert({
    where: { kode: `${tahunMulai}2` },
    update: {},
    create: {
      tahunAjaranId: ta.id,
      tipe: "GENAP",
      kode: `${tahunMulai}2`,
      status: "DRAFT",
    },
  });

  revalidatePath("/admin/tahun-ajaran");
}
