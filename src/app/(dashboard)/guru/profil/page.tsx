import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSemesterAktif } from "@/lib/services/semester";
import {
  ProfilPendidikClient,
  type ProfilPendidikData,
} from "./profil-pendidik-client";

export default async function ProfilPendidikPage() {
  const session = await requireRole("GURU");
  const semesterAktif = await getSemesterAktif();

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      gtk: {
        include: {
          waliKelas: semesterAktif
            ? {
                where: { semesterId: semesterAktif.id },
                select: { id: true, nama: true, tingkat: true },
              }
            : { select: { id: true, nama: true, tingkat: true } },
          pembelajaran: semesterAktif
            ? {
                where: { semesterId: semesterAktif.id },
                include: {
                  mapel: { select: { id: true, nama: true, kode: true } },
                  rombel: { select: { id: true, nama: true, tingkat: true } },
                },
              }
            : {
                include: {
                  mapel: { select: { id: true, nama: true, kode: true } },
                  rombel: { select: { id: true, nama: true, tingkat: true } },
                },
              },
        },
      },
    },
  });

  const gtk = user?.gtk;
  const formattedTglLahir = gtk?.tanggalLahir
    ? new Date(gtk.tanggalLahir).toISOString().slice(0, 10)
    : "";

  const initialProfil: ProfilPendidikData = {
    gtkId: gtk?.id ?? null,
    username: user?.username ?? session.username,
    nama: gtk?.nama ?? session.nama ?? "",
    nip: gtk?.nip ?? "",
    nuptk: gtk?.nuptk ?? "",
    nik: gtk?.nik ?? "",
    jenisKelamin: (gtk?.jenisKelamin as "L" | "P" | null) ?? "L",
    tempatLahir: gtk?.tempatLahir ?? "",
    tanggalLahir: formattedTglLahir,
    jenisPtk: gtk?.jenisPtk ?? "Guru Mapel",
    statusKepegawaian: gtk?.statusKepegawaian ?? "PNS / PPPK",
    email: gtk?.email ?? "",
    noHp: gtk?.noHp ?? "",
    fotoUrl: gtk?.fotoUrl ?? null,
    ttdUrl: gtk?.ttdUrl ?? null,
    waliKelas: (gtk?.waliKelas ?? []).map((w) => ({
      id: w.id,
      nama: w.nama,
      tingkat: w.tingkat,
    })),
    pembelajaran: (gtk?.pembelajaran ?? []).map((p) => ({
      id: p.id,
      mapelNama: p.mapel.nama,
      mapelKode: p.mapel.kode,
      rombelNama: p.rombel.nama,
      tingkat: p.rombel.tingkat,
    })),
  };

  const semesterLabel = semesterAktif
    ? `${semesterAktif.tahunAjaran?.nama ?? "2026/2027"} • Semester ${semesterAktif.tipe}`
    : "Semester Aktif";

  return (
    <ProfilPendidikClient
      initialData={initialProfil}
      semesterLabel={semesterLabel}
    />
  );
}
