"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";

export async function actionSnapshotArsip(): Promise<void> {
  const session = await requireRole("SUPERADMIN");
  const semester = await getSemesterAktif();

  if (!semester) return;

  // Ambil seluruh nilai rapor pada semester aktif
  const nilaiRapors = await db.nilaiRapor.findMany({
    where: { pembelajaran: { semesterId: semester.id } },
    include: {
      siswa: true,
      pembelajaran: {
        include: {
          mapel: true,
          gtk: true,
          rombel: true,
        },
      },
    },
  });

  if (nilaiRapors.length === 0) return;

  let count = 0;
  for (const nr of nilaiRapors) {
    await db.arsipNilai.upsert({
      where: {
        semesterId_nisn_kodeMapel: {
          semesterId: semester.id,
          nisn: nr.siswa.nisn,
          kodeMapel: nr.pembelajaran.mapel.kode,
        },
      },
      update: {
        nilaiAkhir: nr.nilaiAkhir,
        rataHarian: nr.rataHarian,
        nilaiUts: nr.nilaiUts,
        nilaiUas: nr.nilaiUas,
        capaianTertinggi: nr.capaianTertinggi,
        capaianTerendah: nr.capaianTerendah,
      },
      create: {
        semesterId: semester.id,
        tahunAjaran: semester.tahunAjaran.nama,
        tipeSemester: semester.tipe,
        nisn: nr.siswa.nisn,
        namaSiswa: nr.siswa.nama,
        namaRombel: nr.pembelajaran.rombel.nama,
        tingkat: nr.pembelajaran.rombel.tingkat,
        kodeMapel: nr.pembelajaran.mapel.kode,
        namaMapel: nr.pembelajaran.mapel.nama,
        namaGuru: nr.pembelajaran.gtk.nama,
        nuptkGuru: nr.pembelajaran.gtk.nuptk,
        rataHarian: nr.rataHarian,
        nilaiUts: nr.nilaiUts,
        nilaiUas: nr.nilaiUas,
        nilaiAkhir: nr.nilaiAkhir,
        capaianTertinggi: nr.capaianTertinggi,
        capaianTerendah: nr.capaianTerendah,
      },
    });
    count++;
  }

  await db.backupLog.create({
    data: {
      jenis: "SNAPSHOT_ARSIP",
      semesterId: semester.id,
      status: "BERHASIL",
      jumlahBaris: count,
      catatan: `Snapshot ${count} nilai akhir semester ${semester.tahunAjaran.nama} ${semester.tipe}`,
      createdById: session.userId,
    },
  });

  revalidatePath("/admin/backup");
}
