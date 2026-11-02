import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";
import {
  RombelClient,
  type RombelRow,
  type AvailableGtk,
} from "./rombel-client";

export default async function DataRombelPage() {
  await requireRole("SUPERADMIN");

  let semester: any = null;
  let rawRombels: any[] = [];
  let rawGtks: any[] = [];

  try {
    semester = await getSemesterAktif();

    [rawRombels, rawGtks] = await Promise.all([
      db.rombel.findMany({
        where: semester ? { semesterId: semester.id } : undefined,
        orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
        include: {
          waliKelas: {
            select: {
              id: true,
              nama: true,
              nip: true,
              nuptk: true,
              jenisKelamin: true,
            },
          },
          _count: {
            select: {
              anggota: true,
              pembelajaran: true,
            },
          },
        },
      }),
      db.gtk.findMany({
        where: { isAktif: true },
        orderBy: { nama: "asc" },
        select: {
          id: true,
          nama: true,
          nip: true,
          nuptk: true,
          jenisPtk: true,
        },
      }),
    ]);
  } catch (err) {
    console.error("[DataRombelPage] Database read error, using defensive fallback:", err);
  }

  const rombels: RombelRow[] = (rawRombels || []).map((r) => ({
    id: r.id,
    nama: r.nama,
    tingkat: r.tingkat,
    kurikulum: r.kurikulum,
    waliKelasId: r.waliKelasId,
    waliKelas: r.waliKelas
      ? {
          id: r.waliKelas.id,
          nama: r.waliKelas.nama,
          nip: r.waliKelas.nip,
          nuptk: r.waliKelas.nuptk,
          jenisKelamin: r.waliKelas.jenisKelamin as "L" | "P" | null,
        }
      : null,
    _count: {
      anggota: r._count?.anggota || 0,
      pembelajaran: r._count?.pembelajaran || 0,
    },
  }));

  const availableGtks: AvailableGtk[] = (rawGtks || []).map((g) => ({
    id: g.id,
    nama: g.nama,
    nip: g.nip,
    nuptk: g.nuptk,
    jenisPtk: g.jenisPtk,
  }));

  const semesterNama = semester
    ? `${semester.tahunAjaran?.nama ?? "T.A. 2026/2027"} — Semester ${semester.tipe}`
    : "Semester Ganjil 2026/2027";

  return (
    <RombelClient
      initialRombels={rombels}
      availableGtks={availableGtks}
      semesterNama={semesterNama}
      tahunAjaranNama={semester?.tahunAjaran?.nama || "2026/2027"}
    />
  );
}
