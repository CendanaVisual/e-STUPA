import { db } from "@/lib/db";
import LegerClient from "@/components/leger/leger-client";

export default async function AdminLegerPage(props: {
  searchParams?: Promise<{ rombelId?: string }>;
}) {
  const sp = props?.searchParams ? await props.searchParams : {};
  const rawRombelId = sp?.rombelId;

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const rombelList = activeSemester
    ? await db.rombel.findMany({
        where: { semesterId: activeSemester.id },
        select: { id: true, nama: true, tingkat: true },
        orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
      })
    : [];

  const selectedRombelId = rawRombelId || (rombelList.length > 0 ? rombelList[0]?.id : "");

  const selectedRombel = selectedRombelId
    ? await db.rombel.findUnique({
        where: { id: selectedRombelId },
        include: {
          waliKelas: {
            select: { id: true, nama: true, nip: true },
          },
          anggota: {
            include: {
              siswa: {
                select: { id: true, nisn: true, nama: true, jenisKelamin: true },
              },
            },
            orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
          },
          pembelajaran: {
            include: {
              mapel: {
                select: { id: true, kode: true, nama: true, kelompok: true },
              },
            },
            orderBy: { mapel: { urutan: "asc" } },
          },
        },
      })
    : null;

  // Ambil semua NilaiRapor untuk pembelajaran di rombel ini
  const pembelajaranIds = selectedRombel?.pembelajaran.map((p) => p.id) || [];
  const nilaiRaporList =
    pembelajaranIds.length > 0
      ? await db.nilaiRapor.findMany({
          where: { pembelajaranId: { in: pembelajaranIds } },
          select: {
            siswaId: true,
            pembelajaranId: true,
            nilaiAkhir: true,
          },
        })
      : [];

  const nilaiMap: Record<string, number> = {};
  nilaiRaporList.forEach((nr) => {
    if (nr.nilaiAkhir !== null) {
      nilaiMap[`${nr.siswaId}_${nr.pembelajaranId}`] = Number(nr.nilaiAkhir);
    }
  });

  const serializedRombel = selectedRombel
    ? {
        id: selectedRombel.id,
        nama: selectedRombel.nama,
        tingkat: selectedRombel.tingkat,
        waliKelas: selectedRombel.waliKelas
          ? {
              id: selectedRombel.waliKelas.id,
              nama: selectedRombel.waliKelas.nama,
              nip: selectedRombel.waliKelas.nip,
            }
          : null,
        anggota: selectedRombel.anggota.map((agg) => ({
          id: agg.id,
          noAbsen: agg.noAbsen,
          siswa: {
            id: agg.siswa.id,
            nisn: agg.siswa.nisn,
            nama: agg.siswa.nama,
            jenisKelamin: agg.siswa.jenisKelamin,
            noAbsen: agg.noAbsen,
          },
        })),
        pembelajaran: selectedRombel.pembelajaran.map((p) => ({
          id: p.id,
          kktp: p.kktp,
          mapel: {
            id: p.mapel.id,
            kode: p.mapel.kode,
            nama: p.mapel.nama,
            kelompok: p.mapel.kelompok,
          },
        })),
      }
    : null;

  return (
    <LegerClient
      rombelList={rombelList}
      selectedRombelId={selectedRombelId}
      selectedRombel={serializedRombel}
      nilaiMap={nilaiMap}
      activeSemester={
        activeSemester
          ? {
              id: activeSemester.id,
              tipe: activeSemester.tipe,
              tahunAjaran: { nama: activeSemester.tahunAjaran.nama },
            }
          : null
      }
      basePath="/admin/leger"
    />
  );
}
