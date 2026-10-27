"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function simpanPresensiHarian(formData: FormData): Promise<void> {
  await requireAuth();

  const rombelId = formData.get("rombelId") as string;
  const tanggalStr = formData.get("tanggal") as string;
  const siswaId = formData.get("siswaId") as string;
  const status = formData.get("status") as "HADIR" | "SAKIT" | "IZIN" | "ALPA";
  const keterangan = (formData.get("keterangan") as string) || null;

  if (!rombelId || !tanggalStr || !siswaId || !status) {
    return;
  }

  const rombel = await db.rombel.findUnique({
    where: { id: rombelId },
    select: { semesterId: true },
  });

  if (!rombel) return;

  let tanggal = new Date(tanggalStr);
  if (isNaN(tanggal.getTime())) {
    tanggal = new Date();
  }

  await db.presensi.upsert({
    where: {
      semesterId_siswaId_tanggal: {
        semesterId: rombel.semesterId,
        siswaId,
        tanggal,
      },
    },
    update: {
      status,
      keterangan,
    },
    create: {
      semesterId: rombel.semesterId,
      rombelId,
      siswaId,
      tanggal,
      status,
      keterangan,
    },
  });

  revalidatePath("/admin/presensi");
  revalidatePath("/guru/presensi");
}

export async function simpanPresensiKelasBatch(formData: FormData): Promise<void> {
  await requireAuth();

  const rombelId = formData.get("rombelId") as string;
  const tanggalStr = formData.get("tanggal") as string;

  if (!rombelId || !tanggalStr) return;

  const rombel = await db.rombel.findUnique({
    where: { id: rombelId },
    select: { semesterId: true },
  });

  if (!rombel) return;

  let tanggal = new Date(tanggalStr);
  if (isNaN(tanggal.getTime())) {
    tanggal = new Date();
  }

  // Ambil semua entri form untuk siswa
  const entries = Array.from(formData.entries());
  for (const [key, value] of entries) {
    if (key.startsWith("status_")) {
      const siswaId = key.replace("status_", "");
      const status = value as "HADIR" | "SAKIT" | "IZIN" | "ALPA";
      const ket = (formData.get(`ket_${siswaId}`) as string) || null;

      await db.presensi.upsert({
        where: {
          semesterId_siswaId_tanggal: {
            semesterId: rombel.semesterId,
            siswaId,
            tanggal,
          },
        },
        update: {
          status,
          keterangan: ket,
        },
        create: {
          semesterId: rombel.semesterId,
          rombelId,
          siswaId,
          tanggal,
          status,
          keterangan: ket,
        },
      });
    }
  }

  revalidatePath("/admin/presensi");
  revalidatePath("/guru/presensi");
}
