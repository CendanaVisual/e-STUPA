import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import LegerClient from "@/components/leger/leger-client";
import {
  buildDeskripsiCapaianTp,
  resolveTpDeskripsiText,
  type TpScoreEntry,
} from "@/lib/grading/calc";

export default async function GuruLegerPage(props: {
  searchParams?: Promise<{ rombelId?: string; pembelajaranId?: string }>;
}) {
  const session = await requireRole("GURU");
  const sp = props?.searchParams ? await props.searchParams : {};
  const rawRombelId = sp?.rombelId;
  const rawPembelajaranId = sp?.pembelajaranId;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { gtk: true },
  });

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const normJenisPtk = user?.gtk?.jenisPtk?.toLowerCase().trim() || "";
  const isGuruKelasPtk = normJenisPtk.includes("guru kelas");
  const isGuruMapelPtk =
    normJenisPtk.includes("mapel") ||
    normJenisPtk.includes("bidang studi") ||
    (Boolean(normJenisPtk) && !isGuruKelasPtk);

  const rombelList =
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
    const allRombels = await db.rombel.findMany({
      where: { semesterId: activeSemester.id },
      select: { id: true, nama: true, tingkat: true },
      orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
    });
    rombelList.push(...allRombels);
  }

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
              gtk: {
                select: { id: true, nama: true, nip: true },
              },
              mapel: {
                select: { id: true, kode: true, nama: true, kelompok: true },
              },
            },
            orderBy: { mapel: { urutan: "asc" } },
          },
        },
      })
    : null;

  // Tentukan apakah guru yang login tampil sebagai Guru Mapel pada rombel ini:
  // Berlaku jika jenisPtk adalah Guru Mapel, ATAU bukan Guru Kelas dan bukan Wali Kelas rombel ini.
  const isWaliRombelIni = Boolean(
    user?.gtkId && selectedRombel?.waliKelas?.id === user.gtkId
  );
  const isGuruMapel = isGuruMapelPtk || (!isGuruKelasPtk && !isWaliRombelIni && Boolean(user?.gtkId));

  const guruPembelajaranIds = selectedRombel
    ? selectedRombel.pembelajaran
        .filter((p) => p.gtkId === user?.gtkId)
        .map((p) => p.id)
    : [];

  const pembelajaranIds = selectedRombel?.pembelajaran.map((p) => p.id) || [];

  const [nilaiRaporList, penilaianList, masterTpsAll] =
    pembelajaranIds.length > 0 && selectedRombel
      ? await Promise.all([
          db.nilaiRapor.findMany({
            where: { pembelajaranId: { in: pembelajaranIds } },
            select: {
              siswaId: true,
              pembelajaranId: true,
              nilaiAkhir: true,
              capaianTertinggi: true,
              capaianTerendah: true,
            },
          }),
          isGuruMapel
            ? db.penilaian.findMany({
                where: {
                  pembelajaranId: {
                    in: guruPembelajaranIds.length > 0 ? guruPembelajaranIds : pembelajaranIds,
                  },
                  kategori: "HARIAN",
                },
                include: { nilai: true },
                orderBy: { urutan: "asc" },
              })
            : Promise.resolve([]),
          isGuruMapel && activeSemester
            ? db.tujuanPembelajaran.findMany({
                where: {
                  semesterId: activeSemester.id,
                  tingkat: selectedRombel.tingkat,
                },
                orderBy: [{ urutan: "asc" }, { kodeTp: "asc" }],
              })
            : Promise.resolve([]),
        ])
      : [[], [], []];

  const nilaiMap: Record<string, number> = {};
  const deskripsiMap: Record<string, string> = {};

  nilaiRaporList.forEach((nr) => {
    const key = `${nr.siswaId}_${nr.pembelajaranId}`;
    if (nr.nilaiAkhir !== null) {
      nilaiMap[key] = Math.round(Number(nr.nilaiAkhir));
    }
    const combinedSaved = [nr.capaianTertinggi, nr.capaianTerendah]
      .filter((s): s is string => Boolean(s && s.trim()))
      .join(" ");
    if (combinedSaved) {
      deskripsiMap[key] = combinedSaved;
    }
  });

  // Lengkapi deskripsiMap otomatis dari nilai TP jika belum tersimpan di NilaiRapor
  if (isGuruMapel && selectedRombel) {
    const targetPembelajarans =
      guruPembelajaranIds.length > 0
        ? selectedRombel.pembelajaran.filter((p) => guruPembelajaranIds.includes(p.id))
        : selectedRombel.pembelajaran;

    for (const p of targetPembelajarans) {
      const kktp = p.kktp ?? 75;
      const pCols = penilaianList.filter((col) => col.pembelajaranId === p.id);
      const pMasterTps = masterTpsAll.filter((tp) => tp.mapelId === p.mapel.id);

      for (const agg of selectedRombel.anggota) {
        const key = `${agg.siswa.id}_${p.id}`;
        if (deskripsiMap[key]) continue;

        const tpEntries: TpScoreEntry[] = [];
        for (const col of pCols) {
          const n = col.nilai.find((item) => item.siswaId === agg.siswa.id);
          if (n && n.nilai !== null) {
            tpEntries.push({
              kode: col.nama,
              deskripsi: resolveTpDeskripsiText(col, pMasterTps),
              nilai: Number(n.nilai),
            });
          }
        }

        if (tpEntries.length > 0) {
          const built = buildDeskripsiCapaianTp(tpEntries, kktp);
          if (built.deskripsiGabungan) {
            deskripsiMap[key] = built.deskripsiGabungan;
          }
        } else if (nilaiMap[key] !== undefined && pMasterTps.length > 0) {
          // Jika baru ada Nilai Akhir dan sudah ada pemetaan TP, beri deskripsi berbasis TP pertama
          const score = nilaiMap[key];
          const firstTp = pMasterTps[0];
          const cleanText = firstTp.tujuanPembelajaran.trim().replace(/\.+$/, "");
          deskripsiMap[key] =
            score >= kktp
              ? `Menunjukkan penguasaan yang baik dalam ${cleanText}.`
              : `Perlu bimbingan lebih lanjut dalam ${cleanText}.`;
        }
      }
    }
  }

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
          gtkNama: p.gtk?.nama || null,
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
      deskripsiMap={deskripsiMap}
      isGuruMapel={isGuruMapel}
      guruPembelajaranIds={guruPembelajaranIds}
      initialPembelajaranId={rawPembelajaranId}
      activeSemester={
        activeSemester
          ? {
              id: activeSemester.id,
              tipe: activeSemester.tipe,
              tahunAjaran: { nama: activeSemester.tahunAjaran.nama },
            }
          : null
      }
      basePath="/guru/leger"
    />
  );
}
