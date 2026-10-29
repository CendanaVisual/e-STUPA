"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function tambahEkskul(formData: FormData): Promise<void> {
  await requireAuth();

  const nama = (formData.get("nama") as string)?.trim();
  const kategori = (formData.get("kategori") as string) || "Kesenian";
  const pembina = (formData.get("pembina") as string)?.trim() || null;
  const hari = (formData.get("hari") as string)?.trim() || null;
  const jam = (formData.get("jam") as string)?.trim() || null;
  const deskripsi = (formData.get("deskripsi") as string)?.trim() || null;
  const lokasi = (formData.get("lokasi") as string)?.trim() || null;
  const rawKuota = formData.get("kuota") as string;
  const kuota = rawKuota && !isNaN(parseInt(rawKuota)) ? parseInt(rawKuota) : null;

  if (!nama) return;

  await db.ekstrakurikuler.create({
    data: {
      nama,
      kategori,
      pembina,
      hari,
      jam,
      deskripsi,
      lokasi,
      kuota,
      isAktif: true,
    },
  });

  revalidatePath("/admin/master/ekskul");
  revalidatePath("/admin/ekskul");
  revalidatePath("/guru/ekskul");
}

export async function editEkskul(formData: FormData): Promise<void> {
  await requireAuth();

  const id = formData.get("id") as string;
  const nama = (formData.get("nama") as string)?.trim();
  const kategori = (formData.get("kategori") as string) || "Kesenian";
  const pembina = (formData.get("pembina") as string)?.trim() || null;
  const hari = (formData.get("hari") as string)?.trim() || null;
  const jam = (formData.get("jam") as string)?.trim() || null;
  const deskripsi = (formData.get("deskripsi") as string)?.trim() || null;
  const lokasi = (formData.get("lokasi") as string)?.trim() || null;
  const rawKuota = formData.get("kuota") as string;
  const kuota = rawKuota && !isNaN(parseInt(rawKuota)) ? parseInt(rawKuota) : null;
  const isAktif = formData.get("isAktif") !== "false";

  if (!id || !nama) return;

  await db.ekstrakurikuler.update({
    where: { id },
    data: {
      nama,
      kategori,
      pembina,
      hari,
      jam,
      deskripsi,
      lokasi,
      kuota,
      isAktif,
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
  revalidatePath("/guru/ekskul");
}

export async function tambahPesertaEkskul(formData: FormData): Promise<void> {
  await requireAuth();

  const ekskulId = formData.get("ekskulId") as string;
  const siswaId = formData.get("siswaId") as string;
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
    update: {},
    create: {
      semesterId: activeSemester.id,
      ekskulId,
      siswaId,
      predikat: "Baik",
      keterangan: "Aktif mengikuti kegiatan ekstrakurikuler.",
    },
  });

  revalidatePath("/admin/master/ekskul");
  revalidatePath("/admin/ekskul");
  revalidatePath("/guru/ekskul");
}

export async function hapusPesertaEkskul(formData: FormData): Promise<void> {
  await requireAuth();

  const id = formData.get("id") as string;
  if (!id) return;

  await db.nilaiEkskul.delete({ where: { id } });
  revalidatePath("/admin/master/ekskul");
  revalidatePath("/admin/ekskul");
  revalidatePath("/guru/ekskul");
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
  revalidatePath("/admin/master/ekskul");
  revalidatePath("/guru/ekskul");
}

export async function hapusNilaiEkskul(formData: FormData): Promise<void> {
  await requireAuth();
  const id = formData.get("id") as string;
  if (!id) return;

  await db.nilaiEkskul.delete({ where: { id } });
  revalidatePath("/admin/ekskul");
  revalidatePath("/admin/master/ekskul");
  revalidatePath("/guru/ekskul");
}
