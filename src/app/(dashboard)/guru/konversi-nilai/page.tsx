import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { getSemesterAktif } from "@/lib/services/semester";
import { hitungNilaiAkhirLengkap } from "@/lib/grading/calc";
import KonversiNilaiClient, {
  type RombelKonversiOption,
} from "./konversi-nilai-client";

export default async function GuruKonversiNilaiPage(props: {
  searchParams?: Promise<{ rombelId?: string; pembelajaranId?: string }>;
}) {
  const session = await requireRole("GURU");
  const sp = props?.searchParams ? await props.searchParams : {};
  const requestedRombelId = sp?.rombelId || "";
  const requestedPembelajaranId = sp?.pembelajaranId || "";

  const [user, activeSemester] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      include: { gtk: true },
    }),
    getSemesterAktif(),
  ]);

  const gtkId = user?.gtkId || session.gtkId || null;
  const normJenisPtk = user?.gtk?.jenisPtk?.toLowerCase().trim() || "";
  const isGuruKelas = normJenisPtk.includes("guru kelas");

  // Ambil seluruh rombel yang diampu oleh Guru (baik sebagai Wali Kelas maupun Guru Mapel)
  let rombels =
    activeSemester && gtkId
      ? await db.rombel.findMany({
          where: {
            semesterId: activeSemester.id,
            OR: [
              { waliKelasId: gtkId },
              { pembelajaran: { some: { gtkId } } },
            ],
          },
          include: {
            waliKelas: { select: { id: true, nama: true } },
            anggota: {
              include: {
                siswa: {
                  select: {
                    id: true,
                    nisn: true,
                    nama: true,
                    jenisKelamin: true,
                  },
                },
              },
              orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
            },
            pembelajaran: {
              include: {
                mapel: {
                  select: {
                    id: true,
                    kode: true,
                    nama: true,
                    urutan: true,
                  },
                },
                penilaian: {
                  include: {
                    nilai: {
                      select: {
                        siswaId: true,
                        nilai: true,
                      },
                    },
                  },
                  orderBy: [{ urutan: "asc" }],
                },
                nilaiRapor: {
                  select: {
                    siswaId: true,
                    nilaiAkhir: true,
                    isOverride: true,
                  },
                },
              },
              orderBy: [{ mapel: { urutan: "asc" } }, { mapel: { nama: "asc" } }],
            },
          },
          orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
        })
      : [];

  // Fallback apabila akun guru belum diplot ke rombel tertentu namun semester aktif ada
  if (rombels.length === 0 && activeSemester) {
    rombels = await db.rombel.findMany({
      where: { semesterId: activeSemester.id },
      include: {
        waliKelas: { select: { id: true, nama: true } },
        anggota: {
          include: {
            siswa: {
              select: {
                id: true,
                nisn: true,
                nama: true,
                jenisKelamin: true,
              },
            },
          },
          orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
        },
        pembelajaran: {
          include: {
            mapel: {
              select: {
                id: true,
                kode: true,
                nama: true,
                urutan: true,
              },
            },
            penilaian: {
              include: {
                nilai: {
                  select: {
                    siswaId: true,
                    nilai: true,
                  },
                },
              },
              orderBy: [{ urutan: "asc" }],
            },
            nilaiRapor: {
              select: {
                siswaId: true,
                nilaiAkhir: true,
                isOverride: true,
              },
            },
          },
          orderBy: [{ mapel: { urutan: "asc" } }, { mapel: { nama: "asc" } }],
        },
      },
      orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
    });
  }

  // Ambil daftar Tujuan Pembelajaran (TP) pada semester aktif untuk tingkat yang relevan
  const tingkatSet = Array.from(new Set(rombels.map((r) => r.tingkat)));
  const masterTps =
    activeSemester && tingkatSet.length > 0
      ? await db.tujuanPembelajaran.findMany({
          where: {
            semesterId: activeSemester.id,
            tingkat: { in: tingkatSet },
          },
          orderBy: [{ tingkat: "asc" }, { urutan: "asc" }, { kodeTp: "asc" }],
        })
      : [];

  const rombelOptions: RombelKonversiOption[] = rombels.map((r) => {
    const isWaliKelasRombelIni = Boolean(gtkId && r.waliKelas?.id === gtkId);

    // Filter pembelajaran yang diampu oleh guru ini pada rombel tersebut
    // (Untuk Guru Mapel: mapel yang diampunya; Untuk Wali Kelas: mapel yang diampunya / wali kelasnya)
    let relevantPembelajaran = r.pembelajaran.filter(
      (p) => p.gtkId === gtkId || isWaliKelasRombelIni
    );
    if (relevantPembelajaran.length === 0) {
      relevantPembelajaran = r.pembelajaran;
    }

    return {
      id: r.id,
      nama: r.nama,
      tingkat: r.tingkat,
      waliKelasNama: r.waliKelas?.nama || "-",
      isWaliKelas: isWaliKelasRombelIni,
      siswaList: r.anggota.map((agg, idx) => ({
        siswaId: agg.siswa.id,
        noUrut: agg.noAbsen ?? idx + 1,
        nisn: agg.siswa.nisn,
        nama: agg.siswa.nama,
        jenisKelamin: agg.siswa.jenisKelamin,
      })),
      mapelList: relevantPembelajaran.map((p) => {
        // Ambil Kode TP dari menu Tujuan Pembelajaran sesuai tingkat & mapel
        const tpsFromMenu = masterTps.filter(
          (tp) => tp.tingkat === r.tingkat && tp.mapelId === p.mapel.id
        );

        const harianPenilaian = p.penilaian.filter((col) => col.kategori === "HARIAN");
        const slmPenilaian = p.penilaian.filter((col) => col.kategori === "SLM");
        const stsPenilaian = p.penilaian.find((col) => col.kategori === "UTS") ?? null;
        const sasPenilaian = p.penilaian.find((col) => col.kategori === "UAS") ?? null;

        // Susun daftar pilihan TP sesuai jumlah Kode TP di menu Tujuan Pembelajaran
        const tpOptions =
          tpsFromMenu.length > 0
            ? tpsFromMenu.map((tp) => {
                const matchedCol = harianPenilaian.find(
                  (col) => col.nama.trim().toLowerCase() === tp.kodeTp.trim().toLowerCase()
                );
                return {
                  kodeTp: tp.kodeTp,
                  deskripsi: tp.tujuanPembelajaran,
                  penilaianId: matchedCol?.id ?? null,
                };
              })
            : harianPenilaian.map((col) => ({
                kodeTp: col.nama,
                deskripsi: col.tujuanPembelajaran || `Asesmen Formatif ${col.nama}`,
                penilaianId: col.id,
              }));

        // Susun daftar pilihan SLM sesuai data SLM yang ada di daftar Nilai
        const slmOptions = slmPenilaian.map((col) => ({
          penilaianId: col.id,
          nama: col.nama,
        }));

        // Susun peta Nilai Akhir (bilangan bulat) per siswa untuk fitur "Tarik Nilai Akhir"
        const raporBySiswa = new Map(p.nilaiRapor.map((nr) => [nr.siswaId, nr]));
        const nilaiAkhirMap: Record<string, number> = {};

        for (const agg of r.anggota) {
          const sId = agg.siswa.id;
          const nr = raporBySiswa.get(sId);

          const harianVals: (number | null)[] = [];
          const slmVals: (number | null)[] = [];
          const utsVals: (number | null)[] = [];
          const uasVals: (number | null)[] = [];

          for (const col of p.penilaian) {
            const nv = col.nilai.find((item) => item.siswaId === sId);
            const val = nv && nv.nilai !== null ? Number(nv.nilai) : null;
            if (val === null) continue;
            if (col.kategori === "HARIAN") harianVals.push(val);
            else if (col.kategori === "SLM") slmVals.push(val);
            else if (col.kategori === "UTS") utsVals.push(val);
            else if (col.kategori === "UAS") uasVals.push(val);
          }

          const calc = hitungNilaiAkhirLengkap(
            {
              harian: harianVals,
              slm: slmVals,
              uts: utsVals,
              uas: uasVals,
            },
            {
              bobotHarian: p.bobotHarian,
              bobotUts: p.bobotUts,
              bobotUas: p.bobotUas,
            }
          );

          if (nr?.isOverride && nr.nilaiAkhir !== null && nr.nilaiAkhir !== undefined) {
            nilaiAkhirMap[sId] = Math.round(Number(nr.nilaiAkhir));
          } else if (calc.nilaiAkhir !== null) {
            nilaiAkhirMap[sId] = Math.round(calc.nilaiAkhir);
          } else if (nr && nr.nilaiAkhir !== null && nr.nilaiAkhir !== undefined) {
            nilaiAkhirMap[sId] = Math.round(Number(nr.nilaiAkhir));
          }
        }

        return {
          pembelajaranId: p.id,
          mapelId: p.mapel.id,
          mapelKode: p.mapel.kode,
          mapelNama: p.mapel.nama,
          kktp: p.kktp ?? 75,
          bobotHarian: p.bobotHarian,
          bobotUts: p.bobotUts,
          bobotUas: p.bobotUas,
          penilaianCols: p.penilaian.map((col) => ({
            id: col.id,
            kategori: col.kategori,
          })),
          nilaiAkhirMap,
          tpOptions,
          slmOptions,
          stsOption: stsPenilaian
            ? { penilaianId: stsPenilaian.id, nama: stsPenilaian.nama }
            : { penilaianId: null, nama: "STS" },
          sasOption: sasPenilaian
            ? { penilaianId: sasPenilaian.id, nama: sasPenilaian.nama }
            : { penilaianId: null, nama: "SAS" },
        };
      }),
    };
  });

  const semesterLabel = activeSemester
    ? `T.A. ${activeSemester.tahunAjaran.nama} (${activeSemester.tipe})`
    : "T.A. 2026/2027";

  const peranLabel = isGuruKelas
    ? "Wali Kelas / Guru Kelas"
    : user?.gtk?.jenisPtk || "Guru Mata Pelajaran";

  return (
    <KonversiNilaiClient
      rombelOptions={rombelOptions}
      initialRombelId={requestedRombelId}
      initialPembelajaranId={requestedPembelajaranId}
      semesterLabel={semesterLabel}
      semesterStatus={activeSemester?.status ?? "AKTIF"}
      guruNama={user?.gtk?.nama || session.nama || session.username}
      peranLabel={peranLabel}
    />
  );
}
