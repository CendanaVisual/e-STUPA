import { db } from "@/lib/db";
import TahunAjaranClient, { type TahunAjaranItem } from "./tahun-ajaran-client";

export default async function TahunAjaranPage() {
  const tahunAjarans = await db.tahunAjaran.findMany({
    orderBy: { tahunMulai: "desc" },
    include: {
      semester: {
        orderBy: { tipe: "asc" },
        include: {
          _count: {
            select: {
              rombel: true,
              pembelajaran: true,
              tujuanPembelajaran: true,
              arsipNilai: true,
            },
          },
        },
      },
    },
  });

  const serialized: TahunAjaranItem[] = tahunAjarans.map((ta) => ({
    id: ta.id,
    nama: ta.nama,
    tahunMulai: ta.tahunMulai,
    isAktif: ta.isAktif,
    semester: ta.semester.map((sem) => ({
      id: sem.id,
      tipe: sem.tipe,
      kode: sem.kode,
      status: sem.status,
      isAktif: sem.isAktif,
      dikunciPada: sem.dikunciPada ? sem.dikunciPada.toISOString() : null,
      counts: {
        rombel: sem._count.rombel,
        pembelajaran: sem._count.pembelajaran,
        tujuanPembelajaran: sem._count.tujuanPembelajaran,
        arsipNilai: sem._count.arsipNilai,
      },
    })),
  }));

  return <TahunAjaranClient initialTahunAjarans={serialized} />;
}
