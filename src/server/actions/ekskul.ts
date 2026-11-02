"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type EkskulInput = {
  id?: string;
  nama: string;
  kategori?: string | null;
  pembina?: string | null;
  hari?: string | null;
  jam?: string | null;
  deskripsi?: string | null;
  lokasi?: string | null;
  kuota?: number | null;
  isAktif?: boolean;
};

export async function tambahEkskul(
  input: FormData | EkskulInput
): Promise<void> {
  await requireAuth();

  let nama = "";
  let kategori = "Kesenian";
  let pembina: string | null = null;
  let hari: string | null = null;
  let jam: string | null = null;
  let deskripsi: string | null = null;
  let lokasi: string | null = null;
  let kuota: number | null = null;
  let isAktif = true;

  if (input instanceof FormData) {
    nama = String(input.get("nama") || "").trim();
    kategori = String(input.get("kategori") || "Kesenian").trim();
    pembina = String(input.get("pembina") || "").trim() || null;
    hari = String(input.get("hari") || "").trim() || null;
    jam = String(input.get("jam") || "").trim() || null;
    deskripsi = String(input.get("deskripsi") || "").trim() || null;
    lokasi = String(input.get("lokasi") || "").trim() || null;
    const rawKuota = input.get("kuota") as string;
    kuota = rawKuota && !isNaN(parseInt(rawKuota)) ? parseInt(rawKuota) : null;
    isAktif = input.get("isAktif") !== "false";
  } else {
    nama = String(input.nama || "").trim();
    kategori = input.kategori?.trim() || "Kesenian";
    pembina = input.pembina?.trim() || null;
    hari = input.hari?.trim() || null;
    jam = input.jam?.trim() || null;
    deskripsi = input.deskripsi?.trim() || null;
    lokasi = input.lokasi?.trim() || null;
    kuota = input.kuota ?? null;
    isAktif = input.isAktif !== false;
  }

  if (!nama) throw new Error("Nama kegiatan ekstrakurikuler wajib diisi.");

  const existing = await db.ekstrakurikuler.findUnique({ where: { nama } });
  if (existing) {
    throw new Error(`Ekstrakurikuler "${nama}" sudah terdaftar.`);
  }

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
      isAktif,
    },
  });

  revalidatePath("/admin/master/ekskul");
  revalidatePath("/admin/ekskul");
  revalidatePath("/guru/ekskul");
}

export async function editEkskul(
  input: FormData | EkskulInput
): Promise<void> {
  await requireAuth();

  let id = "";
  let nama = "";
  let kategori = "Kesenian";
  let pembina: string | null = null;
  let hari: string | null = null;
  let jam: string | null = null;
  let deskripsi: string | null = null;
  let lokasi: string | null = null;
  let kuota: number | null = null;
  let isAktif = true;

  if (input instanceof FormData) {
    id = String(input.get("id") || "").trim();
    nama = String(input.get("nama") || "").trim();
    kategori = String(input.get("kategori") || "Kesenian").trim();
    pembina = String(input.get("pembina") || "").trim() || null;
    hari = String(input.get("hari") || "").trim() || null;
    jam = String(input.get("jam") || "").trim() || null;
    deskripsi = String(input.get("deskripsi") || "").trim() || null;
    lokasi = String(input.get("lokasi") || "").trim() || null;
    const rawKuota = input.get("kuota") as string;
    kuota = rawKuota && !isNaN(parseInt(rawKuota)) ? parseInt(rawKuota) : null;
    isAktif = input.get("isAktif") !== "false";
  } else {
    id = String(input.id || "").trim();
    nama = String(input.nama || "").trim();
    kategori = input.kategori?.trim() || "Kesenian";
    pembina = input.pembina?.trim() || null;
    hari = input.hari?.trim() || null;
    jam = input.jam?.trim() || null;
    deskripsi = input.deskripsi?.trim() || null;
    lokasi = input.lokasi?.trim() || null;
    kuota = input.kuota ?? null;
    isAktif = input.isAktif !== false;
  }

  if (!id || !nama) {
    throw new Error("ID dan nama kegiatan ekstrakurikuler wajib diisi.");
  }

  const current = await db.ekstrakurikuler.findUnique({ where: { id } });
  if (!current) {
    throw new Error("Data ekstrakurikuler tidak ditemukan.");
  }

  // Cek duplikasi nama jika nama diubah
  if (nama.toLowerCase() !== current.nama.toLowerCase()) {
    const duplicate = await db.ekstrakurikuler.findUnique({ where: { nama } });
    if (duplicate && duplicate.id !== id) {
      throw new Error(`Ekstrakurikuler dengan nama "${nama}" sudah ada.`);
    }
  }

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

export async function hapusEkskul(
  input: FormData | { id: string } | string
): Promise<void> {
  await requireAuth();

  let id = "";
  if (typeof input === "string") {
    id = input.trim();
  } else if (input instanceof FormData) {
    id = String(input.get("id") || "").trim();
  } else {
    id = String(input.id || "").trim();
  }

  if (!id) throw new Error("ID ekstrakurikuler tidak valid.");

  const current = await db.ekstrakurikuler.findUnique({
    where: { id },
    include: {
      _count: { select: { nilaiEkskul: true } },
    },
  });

  if (!current) {
    throw new Error("Data ekstrakurikuler tidak ditemukan atau sudah dihapus.");
  }

  // Hapus nilai ekskul terkait dan hapus ekskul
  await db.$transaction(async (tx) => {
    await tx.nilaiEkskul.deleteMany({ where: { ekskulId: id } });
    await tx.ekstrakurikuler.delete({ where: { id } });
  });

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
