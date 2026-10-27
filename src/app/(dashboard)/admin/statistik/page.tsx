import { db } from "@/lib/db";

export default async function AdminStatistikPage() {
  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const allNilaiRapor = activeSemester
    ? await db.nilaiRapor.findMany({
        where: {
          pembelajaran: { semesterId: activeSemester.id },
          nilaiAkhir: { not: null },
        },
        include: {
          pembelajaran: { include: { mapel: true, rombel: true } },
          siswa: true,
        },
      })
    : [];

  const totalNilai = allNilaiRapor.length;

  let countA = 0;
  let countB = 0;
  let countC = 0;
  let countD = 0;
  let sumScore = 0;

  allNilaiRapor.forEach((nr) => {
    const val = Number(nr.nilaiAkhir ?? 0);
    sumScore += val;
    if (val >= 85) countA++;
    else if (val >= 70) countB++;
    else if (val >= 55) countC++;
    else countD++;
  });

  const avgSchool = totalNilai > 0 ? Math.round((sumScore / totalNilai) * 10) / 10 : 0;
  const persenTuntas =
    totalNilai > 0 ? Math.round(((countA + countB) / totalNilai) * 100) : 0;

  // Analisis per Mapel
  const mapelMap = new Map<string, { nama: string; total: number; count: number }>();
  allNilaiRapor.forEach((nr) => {
    const m = nr.pembelajaran?.mapel;
    if (m) {
      const cur = mapelMap.get(m.id) || { nama: m.nama, total: 0, count: 0 };
      cur.total += Number(nr.nilaiAkhir ?? 0);
      cur.count++;
      mapelMap.set(m.id, cur);
    }
  });

  const mapelAverages = Array.from(mapelMap.values())
    .map((m) => ({
      nama: m.nama,
      avg: Math.round((m.total / m.count) * 10) / 10,
      count: m.count,
    }))
    .sort((a, b) => b.avg - a.avg);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] tracking-wider uppercase">
              Analisis Capaian
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">
              T.A. {activeSemester?.tahunAjaran?.nama ?? "2026/2027"} ({activeSemester?.tipe ?? "GANJIL"})
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Statistik & Analisis Nilai Akademik
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Sebaran predikat nilai rapor, tingkat ketuntasan KKTP, dan performa mata pelajaran.
          </p>
        </div>
      </div>

      {/* 4 SUMMARY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rata-rata Sekolah</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <i className="fa-solid fa-chart-simple" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-blue-700 font-mono">{avgSchool}</div>
          <p className="text-[11px] text-slate-500">Dari {totalNilai} entri nilai akhir rapor</p>
        </div>

        <div className="p-5 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ketuntasan KKTP</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              <i className="fa-solid fa-circle-check" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-700 font-mono">{persenTuntas}%</div>
          <p className="text-[11px] text-emerald-600 font-medium">Siswa melampaui KKTP standar</p>
        </div>

        <div className="p-5 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Predikat A & B</span>
            <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs">
              <i className="fa-solid fa-award" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-teal-700 font-mono">{countA + countB}</div>
          <p className="text-[11px] text-slate-500">Predikat Sangat Baik & Baik</p>
        </div>

        <div className="p-5 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Perlu Bimbingan (C/D)</span>
            <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
              <i className="fa-solid fa-triangle-exclamation" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-rose-700 font-mono">{countC + countD}</div>
          <p className="text-[11px] text-rose-600 font-medium">Membutuhkan program remedial</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DISTRIBUSI PREDIKAT */}
        <div className="p-6 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-800">Distribusi Predikat Capaian Siswa</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Predikat A (Sangat Baik: 85 - 100)</span>
                <span className="font-mono text-emerald-700">{countA} Siswa</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${totalNilai > 0 ? (countA / totalNilai) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Predikat B (Baik: 70 - 84)</span>
                <span className="font-mono text-blue-700">{countB} Siswa</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${totalNilai > 0 ? (countB / totalNilai) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Predikat C (Cukup: 55 - 69)</span>
                <span className="font-mono text-amber-700">{countC} Siswa</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${totalNilai > 0 ? (countC / totalNilai) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Predikat D (Perlu Bimbingan: &lt; 55)</span>
                <span className="font-mono text-rose-700">{countD} Siswa</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${totalNilai > 0 ? (countD / totalNilai) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* PERFORMA MATA PELAJARAN */}
        <div className="p-6 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-800">Peringkat Rata-rata per Mata Pelajaran</h2>
          {mapelAverages.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Belum ada data nilai mata pelajaran.</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {mapelAverages.map((m, idx) => (
                <div
                  key={m.nama}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-xs text-slate-400 font-mono">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-xs text-slate-800">{m.nama}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{m.count} Nilai</span>
                    <span className="px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-mono font-extrabold text-xs">
                      {m.avg}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
