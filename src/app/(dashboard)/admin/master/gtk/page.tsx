import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";
import {
  GtkClient,
  type GtkRow,
  type AvailableRombel,
  type AvailableMapel,
} from "./gtk-client";

export default async function DataGtkPage() {
  await requireRole("SUPERADMIN");

  let rawGtks: any[] = [];
  let rawRombels: any[] = [];
  let rawMapels: any[] = [];
  let semesterAktif: any = null;

  try {
    [semesterAktif, rawGtks, rawRombels, rawMapels] = await Promise.all([
      getSemesterAktif().catch(() => null),
      db.gtk.findMany({
        orderBy: { nama: "asc" },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              isActive: true,
            },
          },
          waliKelas: {
            select: {
              id: true,
              nama: true,
              tingkat: true,
            },
          },
          pembelajaran: {
            include: {
              mapel: {
                select: {
                  id: true,
                  nama: true,
                  kode: true,
                },
              },
              rombel: {
                select: {
                  id: true,
                  nama: true,
                },
              },
            },
          },
        },
      }),
      db.rombel.findMany({
        orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
        select: {
          id: true,
          nama: true,
          tingkat: true,
        },
      }),
      db.mapel.findMany({
        orderBy: { nama: "asc" },
        select: {
          id: true,
          nama: true,
          kode: true,
        },
      }),
    ]);
  } catch (err) {
    console.error("[DataGtkPage] Database read error, using defensive fallback:", err);
  }

  const gtkList: GtkRow[] = (rawGtks || []).map((g) => ({
    id: g.id,
    nama: g.nama,
    nuptk: g.nuptk,
    nip: g.nip,
    nik: g.nik,
    jenisKelamin: g.jenisKelamin as "L" | "P" | null,
    jenisPtk: g.jenisPtk,
    statusKepegawaian: g.statusKepegawaian,
    email: g.email,
    noHp: g.noHp,
    fotoUrl: g.fotoUrl || null,
    hasTtd: Boolean(g.ttdUrl),
    isAktif: g.isAktif,
    user: g.user
      ? {
          id: g.user.id,
          username: g.user.username,
          isActive: g.user.isActive,
        }
      : null,
    waliKelas: (g.waliKelas || []).map((w: any) => ({
      id: w.id,
      nama: w.nama,
      tingkat: w.tingkat,
    })),
    pembelajaran: (g.pembelajaran || []).map((p: any) => ({
      id: p.id,
      mapel: {
        id: p.mapel?.id || "",
        nama: p.mapel?.nama || "-",
        kode: p.mapel?.kode || "-",
      },
      rombel: {
        id: p.rombel?.id || "",
        nama: p.rombel?.nama || "-",
      },
    })),
  }));

  const availableRombels: AvailableRombel[] = (rawRombels || []).map((r) => ({
    id: r.id,
    nama: r.nama,
    tingkat: r.tingkat,
  }));

  const availableMapels: AvailableMapel[] = (rawMapels || []).map((m) => ({
    id: m.id,
    nama: m.nama,
    kode: m.kode,
  }));

  const semesterNama = semesterAktif
    ? `${semesterAktif.tahunAjaran?.nama || "T.A. 2026/2027"} • Semester ${semesterAktif.tipe}`
    : "Semester Ganjil 2026/2027";

  return (
    <GtkClient
      initialGtk={gtkList}
      availableRombels={availableRombels}
      availableMapels={availableMapels}
      semesterNama={semesterNama}
    />
  );
}
