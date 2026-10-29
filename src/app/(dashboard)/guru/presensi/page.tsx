import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { simpanPresensiKelasBatch } from "@/server/actions/presensi";
import Link from "next/link";
import { safeFormatDate } from "@/lib/date";

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
          orderBy: { nama: "asc" },
        })
      : [];

  if (rombelList.length === 0 && activeSemester) {
    rombelList = await db.rombel.findMany({
      where: { semesterId: activeSemester.id },
      orderBy: { nama: "asc" },
    });
  }

  const selectedRombelId = rawRombelId || (rombelList.length > 0 ? rombelList[0]?.id : "");
  const selectedDateStr = rawDate || new Date().toISOString().split("T")[0];
  let selectedDate = new Date(selectedDateStr);
  if (isNaN(selectedDate.getTime())) {
    selectedDate = new Date();
  }

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
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
      {/* TOP HEADER: ABSENSI SISWA */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#00bcd4] tracking-tight">
            Absensi Siswa
          </h1>
          <p className="text-[11px] text-slate-400 font-medium">
            Guru: {user?.gtk?.nama || user?.username}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/guru/presensi?rombelId=${selectedRombelId}&date=${selectedDateStr}`}
            className="p-2 rounded-xl text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
            title="Refresh Halaman"
          >
            <i className="fa-solid fa-rotate-right text-xs" />
          </Link>
          <form action="/api/auth/logout" method="POST" className="inline">
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-[#e11d48] hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
              <span>Logout</span>
            </button>
          </form>
        </div>
      </div>

      {/* MAIN CARD: INPUT ABSENSI */}
      <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 bg-white">
        {/* DARK NAVY HEADER */}
        <div className="bg-[#0f172a] text-white px-5 py-3.5 font-black text-sm flex items-center justify-between tracking-wide">
          <span>Input Absensi</span>
          <span className="text-xs font-semibold text-slate-400">
            {safeFormatDate(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>

        {/* CARD BODY */}
        <div className="p-5 md:p-6 space-y-4">
          {/* FILTER ROW */}
          <form method="GET" className="flex flex-wrap items-center gap-3">
            <div>
              <input
                type="date"
                name="date"
                defaultValue={selectedDateStr}
                className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div className="min-w-[200px] flex-1 sm:flex-initial">
              <select
                name="rombelId"
                defaultValue={selectedRombelId}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="">-- Pilih Kelas --</option>
                {rombelList.map((r) => (
                  <option key={r.id} value={r.id}>
                    Kelas {r.nama} (Tingkat {r.tingkat})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#00bcd4] hover:bg-[#00acc1] text-white font-black text-xs shadow-md shadow-cyan-500/20 flex items-center gap-2 transition cursor-pointer"
            >
              <i className="fa-solid fa-magnifying-glass text-xs" />
              <span>Tampilkan</span>
            </button>
          </form>

          {/* LEGEND BADGES */}
          <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
            <span className="px-3 py-1 rounded-lg text-xs font-black bg-[#10b981] text-white shadow-xs">
              H=Hadir
            </span>
            <span className="px-3 py-1 rounded-lg text-xs font-black bg-[#f59e0b] text-white shadow-xs">
              S=Sakit
            </span>
            <span className="px-3 py-1 rounded-lg text-xs font-black bg-[#00bcd4] text-white shadow-xs">
              I=Izin
            </span>
            <span className="px-3 py-1 rounded-lg text-xs font-black bg-[#e11d48] text-white shadow-xs">
              A=Alfa
            </span>

            {totalSiswa > 0 && (
              <div className="ml-auto flex items-center gap-3 text-xs font-bold text-slate-500">
                <span>Total: <strong className="text-slate-800">{totalSiswa} Siswa</strong></span>
                <span>•</span>
                <span>Hadir: <strong className="text-emerald-600">{countH}</strong> ({persenHadir}%)</span>
                <span>•</span>
                <span>Sakit: <strong className="text-amber-600">{countS}</strong></span>
                <span>•</span>
                <span>Izin: <strong className="text-cyan-600">{countI}</strong></span>
                <span>•</span>
                <span>Alfa: <strong className="text-rose-600">{countA}</strong></span>
              </div>
            )}
          </div>

          {/* CONTENT SECTION */}
          {!selectedRombel ? (
            <div className="py-16 text-center text-slate-400 font-bold space-y-1">
              <i className="fa-solid fa-users-viewfinder text-3xl text-slate-300 mb-2 block" />
              <p>Pilih kelas dan klik tombol &quot;Tampilkan&quot; untuk menginput atau melihat absensi.</p>
            </div>
          ) : totalSiswa === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-slate-100">
              Belum ada siswa yang terdaftar di Kelas {selectedRombel.nama}.
            </div>
          ) : (
            <form action={simpanPresensiKelasBatch} className="space-y-4 pt-2">
              <input type="hidden" name="rombelId" value={selectedRombel.id} />
              <input type="hidden" name="tanggal" value={selectedDateStr} />

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-3.5 text-center w-12">No</th>
                      <th className="py-3 px-3.5 w-32">NISN</th>
                      <th className="py-3 px-3.5">Nama Siswa</th>
                      <th className="py-3 px-3.5 text-center w-64">Status Kehadiran</th>
                      <th className="py-3 px-3.5 w-64">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRombel.anggota.map((agg, idx) => {
                      const p = presensiMap.get(agg.siswaId);
                      const currentStatus = p?.status || "HADIR";
                      const currentKet = p?.keterangan || "";

                      return (
                        <tr key={agg.siswaId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                            {agg.noAbsen || idx + 1}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-500">
                            {agg.siswa.nisn}
                          </td>
                          <td className="py-3 px-3.5 font-bold text-slate-800">
                            {agg.siswa.nama}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
                              <label
                                className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition ${
                                  currentStatus === "HADIR"
                                    ? "bg-[#10b981] text-white shadow-xs"
                                    : "text-slate-600 hover:bg-slate-200/80"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`status_${agg.siswaId}`}
                                  value="HADIR"
                                  defaultChecked={currentStatus === "HADIR"}
                                  className="hidden"
                                />
                                H
                              </label>

                              <label
                                className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition ${
                                  currentStatus === "SAKIT"
                                    ? "bg-[#f59e0b] text-white shadow-xs"
                                    : "text-slate-600 hover:bg-slate-200/80"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`status_${agg.siswaId}`}
                                  value="SAKIT"
                                  defaultChecked={currentStatus === "SAKIT"}
                                  className="hidden"
                                />
                                S
                              </label>

                              <label
                                className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition ${
                                  currentStatus === "IZIN"
                                    ? "bg-[#00bcd4] text-white shadow-xs"
                                    : "text-slate-600 hover:bg-slate-200/80"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`status_${agg.siswaId}`}
                                  value="IZIN"
                                  defaultChecked={currentStatus === "IZIN"}
                                  className="hidden"
                                />
                                I
                              </label>

                              <label
                                className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition ${
                                  currentStatus === "ALPA"
                                    ? "bg-[#e11d48] text-white shadow-xs"
                                    : "text-slate-600 hover:bg-slate-200/80"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`status_${agg.siswaId}`}
                                  value="ALPA"
                                  defaultChecked={currentStatus === "ALPA"}
                                  className="hidden"
                                />
                                A
                              </label>
                            </div>
                          </td>
                          <td className="py-3 px-3.5">
                            <input
                              type="text"
                              name={`ket_${agg.siswaId}`}
                              defaultValue={currentKet}
                              placeholder="Keterangan sakit/izin..."
                              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:bg-white"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-400 font-medium italic">
                  Klik H, S, I, atau A untuk mengubah status per siswa.
                </span>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#00bcd4] hover:bg-[#00acc1] text-white font-black text-xs shadow-md shadow-cyan-500/25 flex items-center gap-2 transition cursor-pointer"
                >
                  <i className="fa-solid fa-floppy-disk text-xs" />
                  <span>Simpan Absensi Kelas</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
