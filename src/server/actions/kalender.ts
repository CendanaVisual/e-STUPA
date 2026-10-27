"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function tambahKegiatanKalender(formData: FormData): Promise<void> {
  await requireAuth();

  const judulKegiatan = formData.get("judulKegiatan") as string;
  const kategori = (formData.get("kategori") as string) || "Akademik";
  const tanggalMulaiStr = formData.get("tanggalMulai") as string;
  const tanggalSelesaiStr = formData.get("tanggalSelesai") as string;
  const keterangan = (formData.get("keterangan") as string) || null;

  if (!judulKegiatan || !tanggalMulaiStr) return;

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
  });

  if (!activeSemester) return;

  await db.kalenderAkademik.create({
    data: {
      semesterId: activeSemester.id,
      judulKegiatan,
      kategori,
      tanggalMulai: new Date(tanggalMulaiStr),
      tanggalSelesai: tanggalSelesaiStr ? new Date(tanggalSelesaiStr) : null,
      keterangan,
    },
  });

  revalidatePath("/admin/kalender");
  revalidatePath("/guru/kalender");
}

export async function hapusKegiatanKalender(formData: FormData): Promise<void> {
  await requireAuth();
  const id = formData.get("id") as string;
  if (!id) return;

  await db.kalenderAkademik.delete({ where: { id } });
  revalidatePath("/admin/kalender");
  revalidatePath("/guru/kalender");
}
