"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function tambahEkskul(formData: FormData): Promise<void> {
  await requireAuth();

  const nama = formData.get("nama") as string;
  const kategori = (formData.get("kategori") as string) || "Kesenian";
  const pembina = (formData.get("pembina") as string) || null;
  const hari = (formData.get("hari") as string) || null;
  const jam = (formData.get("jam") as string) || null;

  if (!nama) return;

  await db.ekstrakurikuler.create({
    data: {
      nama,
      kategori,
      pembina,
      hari,
      jam,
      isAktif: true,
    },
  });

  revalidatePath("/admin/master/ekskul");
  revalidatePath("/admin/ekskul");
  revalidatePath("/guru/ekskul");
}

export async function hapusEkskul(formData: FormData): Promise<void> {
  await requireAuth();
  const id = formData.get("id") as string;
  if (!id) return;

  await db.ekstrakurikuler.delete({ where: { id } });
  revalidatePath("/admin/master/ekskul");
  revalidatePath("/admin/ekskul");
}

export async function simpanNilaiEkskul(formData: FormData): Promise<void> {
  await requireAuth();

  const ekskulId = formData.get("ekskulId") as string;
  const siswaId = formData.get("siswaId") as string;
  const predikat = (formData.get("predikat") as string) || "Baik";
  const keterangan = (formData.get("keterangan") as string) || null;

  if (!ekskulId || !siswaId) return;

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
  });

  if (!activeSemester) return;

  await db.nilaiEkskul.upsert({
    where: {
      semesterId_ekskulId_siswaId: {
        semesterId: activeSemester.id,
        ekskulId,
        siswaId,
      },
    },
    update: {
      predikat,
      keterangan,
    },
    create: {
      semesterId: activeSemester.id,
      ekskulId,
      siswaId,
      predikat,
      keterangan,
    },
  });

  revalidatePath("/admin/ekskul");
  revalidatePath("/guru/ekskul");
}

export async function hapusNilaiEkskul(formData: FormData): Promise<void> {
  await requireAuth();
  const id = formData.get("id") as string;
  if (!id) return;

  await db.nilaiEkskul.delete({ where: { id } });
  revalidatePath("/admin/ekskul");
  revalidatePath("/guru/ekskul");
}
