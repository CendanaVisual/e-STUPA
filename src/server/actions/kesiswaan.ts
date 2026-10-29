"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function tambahPrestasi(formData: FormData): Promise<void> {
  await requireAuth();

  const siswaId = formData.get("siswaId") as string;
  const namaPrestasi = (formData.get("namaPrestasi") as string)?.trim();
  const kategori = (formData.get("kategori") as string) || "Akademik";
  const bidang = (formData.get("bidang") as string)?.trim() || null;
  const tingkat = (formData.get("tingkat") as string) || "Sekolah";
  const peringkat = (formData.get("peringkat") as string)?.trim();
  const penyelenggara = (formData.get("penyelenggara") as string)?.trim() || null;
  const tanggalStr = formData.get("tanggal") as string;
  const keterangan = (formData.get("keterangan") as string)?.trim() || null;
  const buktiUrl = (formData.get("buktiUrl") as string)?.trim() || null;
  const status = (formData.get("status") as string) || "terverifikasi";

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
      bidang,
      tingkat,
      peringkat,
      penyelenggara,
      tanggal: tanggalStr && !isNaN(new Date(tanggalStr).getTime()) ? new Date(tanggalStr) : null,
      keterangan,
      buktiUrl,
      status,
    },
  });

  revalidatePath("/admin/kesiswaan/prestasi");
  revalidatePath("/guru/kesiswaan/prestasi");
}

export async function setPrestasiStatus(formData: FormData): Promise<void> {
  await requireAuth();

  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (!id || !status) return;

  await db.prestasiSiswa.update({
    where: { id },
    data: { status },
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
  const permasalahan = (formData.get("permasalahan") as string)?.trim();
  const tindakLanjut = (formData.get("tindakLanjut") as string)?.trim() || null;
  const status = (formData.get("status") as string) || "Dalam Pendampingan";
  const kerahasiaan = (formData.get("kerahasiaan") as string) || "wali";
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

  let validDate = new Date(tanggalStr);
  if (isNaN(validDate.getTime())) validDate = new Date();

  await db.bimbinganKonseling.create({
    data: {
      semesterId: activeSemester.id,
      siswaId,
      kategori,
      permasalahan,
      tindakLanjut,
      status,
      kerahasiaan,
      tanggal: validDate,
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
  const rombelId = (formData.get("rombelId") as string) || null;
  const mapel = (formData.get("mapel") as string)?.trim() || null;
  const dimensiProfil = (formData.get("dimensiProfil") as string) || "Mandiri";
  const catatan = (formData.get("catatan") as string)?.trim();
  const butirSikap = (formData.get("butirSikap") as string) || "Positif";
  const tindakLanjut = (formData.get("tindakLanjut") as string)?.trim() || null;
  const tanggalStr = (formData.get("tanggal") as string) || new Date().toISOString().split("T")[0];

  if (!siswaId || !catatan) return;

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
  });

  if (!activeSemester) return;

  let validJurnalDate = new Date(tanggalStr);
  if (isNaN(validJurnalDate.getTime())) validJurnalDate = new Date();

  await db.jurnalPerkembangan.create({
    data: {
      semesterId: activeSemester.id,
      siswaId,
      rombelId,
      mapel,
      dimensiProfil,
      catatan,
      butirSikap,
      tindakLanjut,
      tanggal: validJurnalDate,
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
