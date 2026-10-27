"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function simpanNilaiBatch(formData: FormData): Promise<void> {
  const session = await requireAuth();

  const pembelajaranId = formData.get("pembelajaranId") as string;
  if (!pembelajaranId) return;

  const pembelajaran = await db.pembelajaran.findUnique({
    where: { id: pembelajaranId },
    include: {
      rombel: { include: { anggota: true } },
      penilaian: true,
    },
  });

  if (!pembelajaran) return;

  // Simpan nilai per penilaian per siswa
  for (const pen of pembelajaran.penilaian) {
    for (const agg of pembelajaran.rombel.anggota) {
      const key = `nilai_${pen.id}_${agg.siswaId}`;
      const valStr = formData.get(key) as string;

      if (valStr !== null && valStr !== undefined && valStr.trim() !== "") {
        const numVal = parseFloat(valStr);
        if (!isNaN(numVal) && numVal >= 0 && numVal <= 100) {
          await db.nilai.upsert({
            where: {
              penilaianId_siswaId: {
                penilaianId: pen.id,
                siswaId: agg.siswaId,
              },
            },
            update: {
              nilai: numVal,
              updatedById: session.userId,
            },
            create: {
              penilaianId: pen.id,
              siswaId: agg.siswaId,
              nilai: numVal,
              updatedById: session.userId,
            },
          });
        }
      }
    }
  }

  // Kalkulasi otomatis nilai akhir rapor per siswa
  for (const agg of pembelajaran.rombel.anggota) {
    const nilaiList = await db.nilai.findMany({
      where: {
        siswaId: agg.siswaId,
        penilaian: { pembelajaranId },
      },
      include: { penilaian: true },
    });

    const harianList = nilaiList.filter((n) => n.penilaian.kategori === "HARIAN" && n.nilai !== null);
    const utsList = nilaiList.filter((n) => n.penilaian.kategori === "UTS" && n.nilai !== null);
    const uasList = nilaiList.filter((n) => n.penilaian.kategori === "UAS" && n.nilai !== null);

    const avgHarian =
      harianList.length > 0
        ? harianList.reduce((acc, curr) => acc + Number(curr.nilai), 0) / harianList.length
        : null;

    const valUts = utsList.length > 0 ? Number(utsList[0].nilai) : null;
    const valUas = uasList.length > 0 ? Number(uasList[0].nilai) : null;

    let na: number | null = null;
    if (avgHarian !== null || valUts !== null || valUas !== null) {
      const bH = pembelajaran.bobotHarian / 100;
      const bUts = pembelajaran.bobotUts / 100;
      const bUas = pembelajaran.bobotUas / 100;

      const partH = (avgHarian ?? 0) * bH;
      const partUts = (valUts ?? (avgHarian ?? 0)) * bUts;
      const partUas = (valUas ?? (avgHarian ?? 0)) * bUas;

      na = Math.round((partH + partUts + partUas) * 100) / 100;
    }

    if (na !== null) {
      await db.nilaiRapor.upsert({
        where: {
          pembelajaranId_siswaId: {
            pembelajaranId,
            siswaId: agg.siswaId,
          },
        },
        update: {
          rataHarian: avgHarian,
          nilaiUts: valUts,
          nilaiUas: valUas,
          nilaiAkhir: na,
        },
        create: {
          pembelajaranId,
          siswaId: agg.siswaId,
          rataHarian: avgHarian,
          nilaiUts: valUts,
          nilaiUas: valUas,
          nilaiAkhir: na,
        },
      });
    }
  }

  revalidatePath(`/guru/nilai/${pembelajaranId}`);
  revalidatePath(`/admin/leger`);
  revalidatePath(`/guru/leger`);
}

export async function tambahKolomPenilaian(formData: FormData): Promise<void> {
  await requireAuth();

  const pembelajaranId = formData.get("pembelajaranId") as string;
  const kategori = formData.get("kategori") as "HARIAN" | "UTS" | "UAS";
  const nama = formData.get("nama") as string;
  const tujuanPembelajaran = (formData.get("tujuanPembelajaran") as string) || null;

  if (!pembelajaranId || !kategori || !nama) return;

  const count = await db.penilaian.count({
    where: { pembelajaranId, kategori },
  });

  await db.penilaian.create({
    data: {
      pembelajaranId,
      kategori,
      urutan: count + 1,
      nama,
      tujuanPembelajaran,
    },
  });

  revalidatePath(`/guru/nilai/${pembelajaranId}`);
}
