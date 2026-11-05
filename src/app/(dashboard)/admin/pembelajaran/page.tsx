import { db } from "@/lib/db";
import { getSemesterAktif } from "@/lib/services/semester";
import PembelajaranClient from "./pembelajaran-client";

export default async function PembelajaranPage() {
  const semester = await getSemesterAktif();

  const [pembelajarans, rombels, mapels, gtks] = await Promise.all([
    db.pembelajaran.findMany({
      where: semester ? { semesterId: semester.id } : undefined,
      include: {
        rombel: {
          include: {
            waliKelas: {
              select: {
                id: true,
                nama: true,
                jenisPtk: true,
              },
            },
          },
        },
        mapel: {
          select: {
            id: true,
            kode: true,
            nama: true,
            kelompok: true,
          },
        },
        gtk: {
          select: {
            id: true,
            nama: true,
            nuptk: true,
            nip: true,
            jenisPtk: true,
          },
        },
        _count: { select: { nilaiRapor: true } },
      },
      orderBy: [{ rombel: { tingkat: "asc" } }, { rombel: { nama: "asc" } }, { mapel: { urutan: "asc" } }],
    }),
    db.rombel.findMany({
      where: semester ? { semesterId: semester.id } : undefined,
      include: {
        waliKelas: {
          select: {
            id: true,
            nama: true,
            jenisPtk: true,
          },
        },
      },
      orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
    }),
    db.mapel.findMany({
      where: { isAktif: true },
      select: {
        id: true,
        kode: true,
        nama: true,
        kelompok: true,
      },
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
    }),
    db.gtk.findMany({
      where: { isAktif: true },
      select: {
        id: true,
        nama: true,
        nuptk: true,
        nip: true,
        jenisPtk: true,
      },
      orderBy: [{ nama: "asc" }],
    }),
  ]);

  // Serialisasi data agar kompatibel penuh dengan Client Component
  const serializedPembelajarans = pembelajarans.map((p) => ({
    id: p.id,
    semesterId: p.semesterId,
    rombelId: p.rombelId,
    mapelId: p.mapelId,
    gtkId: p.gtkId,
    kktp: p.kktp,
    bobotHarian: p.bobotHarian,
    bobotUts: p.bobotUts,
    bobotUas: p.bobotUas,
    isFinal: p.isFinal,
    rombel: {
      id: p.rombel.id,
      nama: p.rombel.nama,
      tingkat: p.rombel.tingkat,
      kurikulum: p.rombel.kurikulum,
      waliKelasId: p.rombel.waliKelasId,
      waliKelas: p.rombel.waliKelas
        ? {
            id: p.rombel.waliKelas.id,
            nama: p.rombel.waliKelas.nama,
            jenisPtk: p.rombel.waliKelas.jenisPtk,
          }
        : null,
    },
    mapel: {
      id: p.mapel.id,
      kode: p.mapel.kode,
      nama: p.mapel.nama,
      kelompok: p.mapel.kelompok,
    },
    gtk: {
      id: p.gtk.id,
      nama: p.gtk.nama,
      nuptk: p.gtk.nuptk,
      nip: p.gtk.nip,
      jenisPtk: p.gtk.jenisPtk,
    },
    _count: {
      nilaiRapor: p._count.nilaiRapor,
    },
  }));

  const serializedRombels = rombels.map((r) => ({
    id: r.id,
    nama: r.nama,
    tingkat: r.tingkat,
    kurikulum: r.kurikulum,
    waliKelasId: r.waliKelasId,
    waliKelas: r.waliKelas
      ? {
          id: r.waliKelas.id,
          nama: r.waliKelas.nama,
          jenisPtk: r.waliKelas.jenisPtk,
        }
      : null,
  }));

  return (
    <PembelajaranClient
      initialPembelajarans={serializedPembelajarans}
      rombels={serializedRombels}
      mapels={mapels}
      gtks={gtks}
      semesterAktif={
        semester
          ? {
              id: semester.id,
              tahunAjaran: { nama: semester.tahunAjaran.nama },
              tipe: semester.tipe,
            }
          : null
      }
    />
  );
}
