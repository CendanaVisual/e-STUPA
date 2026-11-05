import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { safeFormatDate } from "@/lib/date";
import PresensiClient from "@/components/presensi/presensi-client";

export default async function GuruPresensiPage(props: {
  searchParams?: Promise<{ rombelId?: string; date?: string }>;
}) {
  const session = await requireRole("GURU");
  const sp = props?.searchParams ? await props.searchParams : {};
  const rawRombelId = sp?.rombelId;
  const rawDate = sp?.date;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { gtk: true },
  });

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  // Ambil rombel yang diajar oleh guru ini atau di mana ia menjadi wali kelas (atau semua rombel jika belum di-assign)
  let rombelList =
    activeSemester && user?.gtkId
      ? await db.rombel.findMany({
          where: {
            semesterId: activeSemester.id,
            OR: [
              { waliKelasId: user.gtkId },
              { pembelajaran: { some: { gtkId: user.gtkId } } },
            ],
          },
          select: { id: true, nama: true, tingkat: true },
          orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
        })
      : [];

  if (rombelList.length === 0 && activeSemester) {
    rombelList = await db.rombel.findMany({
      where: { semesterId: activeSemester.id },
      select: { id: true, nama: true, tingkat: true },
      orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
    });
  }

  const selectedRombelId = rawRombelId || (rombelList.length > 0 ? rombelList[0]?.id : "");
  const selectedDateStr = rawDate || new Date().toISOString().split("T")[0];
  let selectedDate = new Date(selectedDateStr);
  if (isNaN(selectedDate.getTime())) {
    selectedDate = new Date();
  }

  const [selectedRombel, presensiHariIni, rekapPresensi] = await Promise.all([
    selectedRombelId
      ? db.rombel.findUnique({
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
          },
        })
      : null,
    selectedRombelId
      ? db.presensi.findMany({
          where: {
            rombelId: selectedRombelId,
            tanggal: selectedDate,
          },
          select: {
            siswaId: true,
            status: true,
            keterangan: true,
          },
        })
      : [],
    selectedRombelId && activeSemester
      ? db.presensi.findMany({
          where: {
            rombelId: selectedRombelId,
            semesterId: activeSemester.id,
          },
          select: {
            siswaId: true,
            status: true,
            tanggal: true,
          },
        })
      : [],
  ]);

  const selectedDateFormatted = safeFormatDate(selectedDate, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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
          siswaId: agg.siswaId,
          siswa: {
            id: agg.siswa.id,
            nisn: agg.siswa.nisn,
            nama: agg.siswa.nama,
            jenisKelamin: agg.siswa.jenisKelamin,
          },
        })),
      }
    : null;

  return (
    <PresensiClient
      rombelList={rombelList}
      selectedRombelId={selectedRombelId}
      selectedDateStr={selectedDateStr}
      selectedDateFormatted={selectedDateFormatted}
      selectedRombel={serializedRombel}
      initialPresensiList={presensiHariIni}
      rekapPresensiList={rekapPresensi}
      activeSemester={
        activeSemester
          ? {
              id: activeSemester.id,
              tipe: activeSemester.tipe,
              tahunAjaran: { nama: activeSemester.tahunAjaran.nama },
            }
          : null
      }
      basePath="/guru/presensi"
      guruNama={user?.gtk?.nama || user?.username}
    />
  );
}
