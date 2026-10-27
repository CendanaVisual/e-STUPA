import { db } from "@/lib/db";

export default async function AdminLegerPage({
  searchParams,
}: {
  searchParams: Promise<{ rombelId?: string }>;
}) {
  const { rombelId: rawRombelId } = await searchParams;

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const rombelList = activeSemester
    ? await db.rombel.findMany({
        where: { semesterId: activeSemester.id },
        orderBy: { nama: "asc" },
      })
    : [];

  const selectedRombelId = rawRombelId || rombelList[0]?.id || "";

  const selectedRombel = selectedRombelId
    ? await db.rombel.findUnique({
        where: { id: selectedRombelId },
        include: {
          waliKelas: true,
          anggota: {
            include: { siswa: true },
            orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
          },
          pembelajaran: {
            include: { mapel: true },
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
        })
      : [];

  // Map: `siswaId_pembelajaranId` -> nilaiAkhir
  const nilaiMap = new Map<string, number>();
  nilaiRaporList.forEach((nr) => {
    if (nr.nilaiAkhir !== null) {
      nilaiMap.set(`${nr.siswaId}_${nr.pembelajaranId}`, Number(nr.nilaiAkhir));
    }
  });

  // Hitung total dan rata-rata per siswa
  const siswaStats = (selectedRombel?.anggota || []).map((agg) => {
    let total = 0;
    let count = 0;
    (selectedRombel?.pembelajaran || []).forEach((p) => {
      const val = nilaiMap.get(`${agg.siswaId}_${p.id}`);
      if (val !== undefined) {
        total += val;
        count++;
      }
    });
    const avg = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
    return {
      siswa: agg.siswa,
      noAbsen: agg.noAbsen,
      total,
      avg,
    };
  });

  // Urutkan untuk ranking
  const sortedStats = [...siswaStats].sort((a, b) => b.avg - a.avg);
  const rankMap = new Map<string, number>();
  sortedStats.forEach((s, idx) => {
    rankMap.set(s.siswa.id, idx + 1);
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] tracking-wider uppercase">
              Buku Nilai
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">
              T.A. {activeSemester?.tahunAjaran.nama ?? "2026/2027"} ({activeSemester?.tipe ?? "GANJIL"})
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Leger Nilai Rapor Siswa
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Matriks rekapitulasi nilai akhir seluruh mata pelajaran per rombel kelas beserta peringkat.
          </p>
        </div>
      </div>

      {/* FILTER ROMBEL */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <form method="GET" className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700">Pilih Rombongan Belajar:</label>
          <select
            name="rombelId"
            defaultValue={selectedRombelId}
            className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
          >
            {rombelList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama} (Tingkat {r.tingkat})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
          >
            Buka Leger
          </button>
        </form>

        {selectedRombel && (
          <div className="text-xs text-slate-600 font-medium">
            Wali Kelas: <span className="font-bold text-slate-800">{selectedRombel.waliKelas?.nama || "-"}</span> •{" "}
            <span>{selectedRombel.anggota.length} Siswa</span> •{" "}
            <span>{selectedRombel.pembelajaran.length} Mapel</span>
          </div>
        )}
      </div>

      {/* TABEL LEGER MATRIKS */}
      {selectedRombel ? (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-800">
              Leger Capaian Kelas {selectedRombel.nama}
            </h2>
            <span className="text-[11px] font-mono text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              Kurikulum Merdeka
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                  <th className="py-3 px-3 w-10 text-center border-r border-slate-200">No</th>
                  <th className="py-3 px-3 w-28 border-r border-slate-200">NISN</th>
                  <th className="py-3 px-3 min-w-[160px] border-r border-slate-200 sticky left-0 bg-slate-50/90">
                    Nama Siswa
                  </th>
                  {selectedRombel.pembelajaran.map((p) => (
                    <th key={p.id} className="py-3 px-2 text-center border-r border-slate-200" title={p.mapel.nama}>
                      <span className="block">{p.mapel.kode}</span>
                      <span className="text-[8px] font-mono text-slate-400">KKTP {p.kktp || 75}</span>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center border-r border-slate-200 bg-blue-50/50 text-blue-800">
                    Total
                  </th>
                  <th className="py-3 px-3 text-center border-r border-slate-200 bg-blue-50/50 text-blue-800">
                    Rata²
                  </th>
                  <th className="py-3 px-3 text-center bg-amber-50/60 text-amber-800">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedRombel.anggota.map((agg, idx) => {
                  const stat = siswaStats.find((s) => s.siswa.id === agg.siswaId);
                  const rank = rankMap.get(agg.siswaId) || "-";

                  return (
                    <tr key={agg.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400 border-r border-slate-100">
                        {agg.noAbsen ?? idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 border-r border-slate-100">
                        {agg.siswa.nisn}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-100 sticky left-0 bg-white">
                        {agg.siswa.nama}
                      </td>
                      {selectedRombel.pembelajaran.map((p) => {
                        const score = nilaiMap.get(`${agg.siswaId}_${p.id}`);
                        const kktp = p.kktp || 75;
                        const isTuntas = score !== undefined && score >= kktp;

                        return (
                          <td
                            key={p.id}
                            className={`py-2.5 px-2 text-center font-mono font-bold border-r border-slate-100 ${
                              score === undefined
                                ? "text-slate-300"
                                : isTuntas
                                ? "text-slate-700"
                                : "text-rose-600 bg-rose-50/30"
                            }`}
                          >
                            {score !== undefined ? score : "–"}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-100 bg-blue-50/20">
                        {stat?.total || 0}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-extrabold text-blue-700 border-r border-slate-100 bg-blue-50/30">
                        {stat?.avg || 0}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-extrabold text-amber-700 bg-amber-50/30">
                        #{rank}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-12 text-center border border-slate-200/90 shadow-sm text-slate-400">
          <p className="text-xs font-bold text-slate-600">Pilih rombel untuk melihat leger nilai.</p>
        </div>
      )}
    </div>
  );
}
