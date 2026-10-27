import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { simpanPresensiKelasBatch } from "@/server/actions/presensi";

export default async function GuruPresensiPage({
  searchParams,
}: {
  searchParams: Promise<{ rombelId?: string; date?: string }>;
}) {
  const session = await requireRole("GURU");
  const { rombelId: rawRombelId, date: rawDate } = await searchParams;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { gtk: true },
  });

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  // Ambil rombel yang diajar oleh guru ini atau di mana ia menjadi wali kelas
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
          orderBy: { nama: "asc" },
        })
      : [];

  const selectedRombelId = rawRombelId || rombelList[0]?.id || "";
  const selectedDateStr = rawDate || new Date().toISOString().split("T")[0];
  const selectedDate = new Date(selectedDateStr);

  const selectedRombel = selectedRombelId
    ? await db.rombel.findUnique({
        where: { id: selectedRombelId },
        include: {
          waliKelas: true,
          anggota: {
            include: { siswa: true },
            orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
          },
        },
      })
    : null;

  const presensiHariIni = selectedRombelId
    ? await db.presensi.findMany({
        where: {
          rombelId: selectedRombelId,
          tanggal: selectedDate,
        },
      })
    : [];

  const presensiMap = new Map(presensiHariIni.map((p) => [p.siswaId, p]));

  let countH = 0;
  let countS = 0;
  let countI = 0;
  let countA = 0;
  const totalSiswa = selectedRombel?.anggota.length || 0;

  selectedRombel?.anggota.forEach((agg) => {
    const p = presensiMap.get(agg.siswaId);
    const st = p?.status || "HADIR";
    if (st === "HADIR") countH++;
    else if (st === "SAKIT") countS++;
    else if (st === "IZIN") countI++;
    else if (st === "ALPA") countA++;
  });

  const persenHadir = totalSiswa > 0 ? Math.round((countH / totalSiswa) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] tracking-wider uppercase">
              Presensi Siswa
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">
              Guru: {user?.gtk?.nama ?? user?.username}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Input Kehadiran Kelas Binaan
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Kelola kehadiran harian untuk rombongan belajar yang Anda ampu.
          </p>
        </div>
      </div>

      {/* FILTER ROMBEL & TANGGAL */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <form method="GET" className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Pilih Rombel
            </label>
            <select
              name="rombelId"
              defaultValue={selectedRombelId}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {rombelList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nama} (Tingkat {r.tingkat})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Tanggal Presensi
            </label>
            <input
              type="date"
              name="date"
              defaultValue={selectedDateStr}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <button
            type="submit"
            className="mt-5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
          >
            Tampilkan
          </button>
        </form>

        {/* STATISTIK */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Hadir</span>
            <span className="text-base font-extrabold text-emerald-700">{countH}</span>
          </div>
          <div className="px-3 py-2 rounded-2xl bg-rose-50 border border-rose-200 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">Sakit</span>
            <span className="text-base font-extrabold text-rose-700">{countS}</span>
          </div>
          <div className="px-3 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Izin</span>
            <span className="text-base font-extrabold text-amber-700">{countI}</span>
          </div>
          <div className="px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Alpa</span>
            <span className="text-base font-extrabold text-slate-700">{countA}</span>
          </div>
          <div className="px-3 py-2 rounded-2xl bg-blue-50 border border-blue-200 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Kehadiran</span>
            <span className="text-base font-extrabold text-blue-700">{persenHadir}%</span>
          </div>
        </div>
      </div>

      {selectedRombel ? (
        <form action={simpanPresensiKelasBatch} className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <input type="hidden" name="rombelId" value={selectedRombelId} />
          <input type="hidden" name="tanggal" value={selectedDateStr} />

          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">
                Presensi Kelas {selectedRombel.nama}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Total {totalSiswa} Siswa</p>
            </div>
            <button
              type="submit"
              className="py-2 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white text-xs font-bold shadow-md shadow-blue-500/15 transition cursor-pointer"
            >
              Simpan Presensi
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {selectedRombel.anggota.map((agg, idx) => {
                  const p = presensiMap.get(agg.siswaId);
                  const currentStatus = p?.status || "HADIR";

                  return (
                    <tr key={agg.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 text-center font-bold text-slate-400">
                        {agg.noAbsen ?? idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{agg.siswa.nama}</div>
                        <div className="text-[10px] text-slate-400 font-mono">NISN: {agg.siswa.nisn}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border cursor-pointer has-checked:bg-emerald-500 has-checked:text-white has-checked:border-emerald-600 transition text-[11px] font-bold text-slate-600">
                            <input
                              type="radio"
                              name={`status_${agg.siswaId}`}
                              value="HADIR"
                              defaultChecked={currentStatus === "HADIR"}
                              className="hidden"
                            />
                            <span>Hadir</span>
                          </label>
                          <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border cursor-pointer has-checked:bg-rose-500 has-checked:text-white has-checked:border-rose-600 transition text-[11px] font-bold text-slate-600">
                            <input
                              type="radio"
                              name={`status_${agg.siswaId}`}
                              value="SAKIT"
                              defaultChecked={currentStatus === "SAKIT"}
                              className="hidden"
                            />
                            <span>Sakit</span>
                          </label>
                          <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border cursor-pointer has-checked:bg-amber-500 has-checked:text-white has-checked:border-amber-600 transition text-[11px] font-bold text-slate-600">
                            <input
                              type="radio"
                              name={`status_${agg.siswaId}`}
                              value="IZIN"
                              defaultChecked={currentStatus === "IZIN"}
                              className="hidden"
                            />
                            <span>Izin</span>
                          </label>
                          <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border cursor-pointer has-checked:bg-slate-600 has-checked:text-white has-checked:border-slate-700 transition text-[11px] font-bold text-slate-600">
                            <input
                              type="radio"
                              name={`status_${agg.siswaId}`}
                              value="ALPA"
                              defaultChecked={currentStatus === "ALPA"}
                              className="hidden"
                            />
                            <span>Alpa</span>
                          </label>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          name={`ket_${agg.siswaId}`}
                          defaultValue={p?.keterangan || ""}
                          placeholder="Keterangan..."
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      ) : (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-12 text-center border border-slate-200/90 shadow-sm text-slate-400">
          <p className="text-xs font-bold text-slate-600">Anda belum ditugaskan ke rombel manapun pada semester ini.</p>
        </div>
      )}
    </div>
  );
}
