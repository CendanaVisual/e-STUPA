import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";
import { SiswaClient, type MuridRow, type AvailableRombel } from "./siswa-client";

export default async function DataMuridPage() {
  await requireRole("SUPERADMIN");

  const semesterAktif = await getSemesterAktif();

  const [rawSiswa, rawRombels] = await Promise.all([
    db.siswa.findMany({
      orderBy: [{ nama: "asc" }],
      include: {
        anggotaRombel: {
          where: semesterAktif ? { semesterId: semesterAktif.id } : undefined,
          include: {
            rombel: {
              select: { id: true, nama: true, tingkat: true },
            },
          },
          take: 1,
        },
      },
    }),
    semesterAktif
      ? db.rombel.findMany({
          where: { semesterId: semesterAktif.id },
          orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
          select: { id: true, nama: true, tingkat: true },
        })
      : [],
  ]);

  const siswaList: MuridRow[] = rawSiswa.map((s) => {
    const anggota = s.anggotaRombel[0];
    return {
      id: s.id,
      nisn: s.nisn,
      nis: s.nis,
      nama: s.nama,
      jenisKelamin: s.jenisKelamin,
      agama: s.agama,
      tempatLahir: s.tempatLahir,
      tanggalLahir: s.tanggalLahir
        ? s.tanggalLahir.toISOString().slice(0, 10)
        : null,
      alamat: s.alamat,
      anakKe: s.anakKe,
      tahunMasuk: s.tahunMasuk,
      namaAyah: s.namaAyah,
      pekerjaanAyah: s.pekerjaanAyah,
      namaIbu: s.namaIbu,
      pekerjaanIbu: s.pekerjaanIbu,
      namaWali: s.namaWali,
      kjp: s.kjp,
      pip: s.pip,
      bantuanLain: s.bantuanLain,
      status: s.status,
      rombel: anggota?.rombel || null,
      noUrut: anggota?.noAbsen || null,
    };
  });

  const availableRombels: AvailableRombel[] = rawRombels.map((r) => ({
    id: r.id,
    nama: r.nama,
    tingkat: r.tingkat,
  }));

  const semesterNama = semesterAktif
    ? `${semesterAktif.tahunAjaran?.nama || ""} ${semesterAktif.tipe}`
    : "Semester Aktif";

  return (
    <SiswaClient
      initialSiswa={siswaList}
      availableRombels={availableRombels}
      semesterNama={semesterNama}
    />
  );
}
