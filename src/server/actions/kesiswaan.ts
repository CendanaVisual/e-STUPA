"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function tambahPrestasi(formData: FormData): Promise<void> {
  await requireAuth();

  const siswaId = formData.get("siswaId") as string;
  const namaPrestasi = formData.get("namaPrestasi") as string;
  const kategori = (formData.get("kategori") as string) || "Akademik";
  const tingkat = (formData.get("tingkat") as string) || "Sekolah";
  const peringkat = formData.get("peringkat") as string;
  const penyelenggara = (formData.get("penyelenggara") as string) || null;
  const tanggalStr = formData.get("tanggal") as string;
  const keterangan = (formData.get("keterangan") as string) || null;

  if (!siswaId || !namaPrestasi || !peringkat) return;

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
  });

  if (!activeSemester) return;

  await db.prestasiSiswa.create({
    data: {
      semesterId: activeSemester.id,
      siswaId,
      namaPrestasi,
      kategori,
      tingkat,
      peringkat,
      penyelenggara,
      tanggal: tanggalStr ? new Date(tanggalStr) : null,
      keterangan,
    },
  });

  revalidatePath("/admin/kesiswaan/prestasi");
  revalidatePath("/guru/kesiswaan/prestasi");
}

export async function hapusPrestasi(formData: FormData): Promise<void> {
  await requireAuth();
  const id = formData.get("id") as string;
  if (!id) return;

  await db.prestasiSiswa.delete({ where: { id } });
  revalidatePath("/admin/kesiswaan/prestasi");
  revalidatePath("/guru/kesiswaan/prestasi");
}

export async function tambahBk(formData: FormData): Promise<void> {
  const session = await requireAuth();

  const siswaId = formData.get("siswaId") as string;
  const kategori = (formData.get("kategori") as string) || "Belajar";
  const permasalahan = formData.get("permasalahan") as string;
  const tindakLanjut = (formData.get("tindakLanjut") as string) || null;
  const status = (formData.get("status") as string) || "Dalam Penanganan";
  const tanggalStr = (formData.get("tanggal") as string) || new Date().toISOString().split("T")[0];

  if (!siswaId || !permasalahan) return;

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
  });

  if (!activeSemester) return;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { gtkId: true },
  });

  await db.bimbinganKonseling.create({
    data: {
      semesterId: activeSemester.id,
      siswaId,
      kategori,
      permasalahan,
      tindakLanjut,
      status,
      tanggal: new Date(tanggalStr),
      guruBkId: user?.gtkId || null,
    },
  });

  revalidatePath("/admin/kesiswaan/bk");
  revalidatePath("/guru/kesiswaan/bk");
}

export async function updateStatusBk(formData: FormData): Promise<void> {
  await requireAuth();
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (!id || !status) return;

  await db.bimbinganKonseling.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/admin/kesiswaan/bk");
  revalidatePath("/guru/kesiswaan/bk");
}

export async function hapusBk(formData: FormData): Promise<void> {
  await requireAuth();
  const id = formData.get("id") as string;
  if (!id) return;

  await db.bimbinganKonseling.delete({ where: { id } });
  revalidatePath("/admin/kesiswaan/bk");
  revalidatePath("/guru/kesiswaan/bk");
}

export async function tambahJurnal(formData: FormData): Promise<void> {
  await requireAuth();

  const siswaId = formData.get("siswaId") as string;
  const dimensiProfil = formData.get("dimensiProfil") as string;
  const catatan = formData.get("catatan") as string;
  const butirSikap = (formData.get("butirSikap") as string) || "Positif";
  const tindakLanjut = (formData.get("tindakLanjut") as string) || null;
  const tanggalStr = (formData.get("tanggal") as string) || new Date().toISOString().split("T")[0];

  if (!siswaId || !dimensiProfil || !catatan) return;

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
  });

  if (!activeSemester) return;

  await db.jurnalPerkembangan.create({
    data: {
      semesterId: activeSemester.id,
      siswaId,
      dimensiProfil,
      catatan,
      butirSikap,
      tindakLanjut,
      tanggal: new Date(tanggalStr),
    },
  });

  revalidatePath("/admin/kesiswaan/jurnal");
  revalidatePath("/guru/kesiswaan/jurnal");
}

export async function hapusJurnal(formData: FormData): Promise<void> {
  await requireAuth();
  const id = formData.get("id") as string;
  if (!id) return;

  await db.jurnalPerkembangan.delete({ where: { id } });
  revalidatePath("/admin/kesiswaan/jurnal");
  revalidatePath("/guru/kesiswaan/jurnal");
}
