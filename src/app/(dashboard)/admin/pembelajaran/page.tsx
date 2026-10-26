import Link from "next/link";
import { db } from "@/lib/db";
import { getSemesterAktif } from "@/lib/services/semester";
import { createPembelajaran } from "@/server/actions/pembelajaran";

export default async function PembelajaranPage() {
  const semester = await getSemesterAktif();

  const [pembelajarans, rombels, mapels, gtks] = await Promise.all([
    db.pembelajaran.findMany({
      where: semester ? { semesterId: semester.id } : undefined,
      include: {
        rombel: true,
        mapel: true,
        gtk: true,
        _count: { select: { nilaiRapor: true } },
      },
      orderBy: [{ rombel: { tingkat: "asc" } }, { rombel: { nama: "asc" } }],
    }),
    db.rombel.findMany({
      where: semester ? { semesterId: semester.id } : undefined,
      orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
    }),
    db.mapel.findMany({ orderBy: { nama: "asc" } }),
    db.gtk.findMany({ orderBy: { nama: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold">
            <i className="fa-solid fa-chalkboard mr-1" />
            Plotting & Penugasan Mengajar
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Pembelajaran & Guru Pengampu
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Penugasan mengajar Guru × Mata Pelajaran × Rombel pada semester aktif. Ini menentukan kelas apa saja yang dapat diakses oleh guru saat login.
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold font-mono">
          {pembelajarans.length} Pembelajaran Terjadwal
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah Pembelajaran (4 Cols) */}
        <div className="lg:col-span-4 glass-light-panel rounded-3xl p-6 border border-slate-200/80 h-fit">
          <h3 className="text-base font-extrabold text-slate-800 mb-3 flex items-center gap-2">
            <i className="fa-solid fa-plus text-teal-600" />
            <span>Tambah Penugasan Mengajar</span>
          </h3>

          {!semester ? (
            <p className="text-xs text-rose-600">
              Aktifkan semester terlebih dahulu melalui menu Tahun Ajaran & Semester.
            </p>
          ) : (
            <form action={createPembelajaran} className="space-y-3.5">
              <input type="hidden" name="semesterId" value={semester.id} />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rombel / Kelas *</label>
                <select
                  name="rombelId"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">-- Pilih Rombel --</option>
                  {rombels.map((r) => (
                    <option key={r.id} value={r.id}>
                      Kelas {r.nama} (Tingkat {r.tingkat})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mata Pelajaran *</label>
                <select
                  name="mapelId"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">-- Pilih Mapel --</option>
                  {mapels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama} ({m.kode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Guru Pengampu (GTK) *</label>
                <select
                  name="gtkId"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">-- Pilih Guru --</option>
                  {gtks.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama} ({g.nuptk || "No NUPTK"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Batas KKTP / KKM</label>
                <input
                  type="number"
                  name="kktp"
                  defaultValue={75}
                  min={50}
                  max={95}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bobot Penilaian: Harian / UTS / UAS (%)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    name="bobotHarian"
                    defaultValue={30}
                    className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono font-bold"
                  />
                  <input
                    type="number"
                    name="bobotUts"
                    defaultValue={40}
                    className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono font-bold"
                  />
                  <input
                    type="number"
                    name="bobotUas"
                    defaultValue={30}
                    className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono font-bold"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Total harus 100% (30 + 40 + 30)</p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl btn-soft-primary text-xs font-bold flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                <i className="fa-solid fa-plus" />
                <span>Simpan Penugasan</span>
              </button>
            </form>
          )}
        </div>

        {/* Tabel Pembelajaran (8 Cols) */}
        <div className="lg:col-span-8 glass-light-panel rounded-3xl p-6 border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-list-check text-teal-600" />
              <span>Daftar Pembelajaran Semester Aktif</span>
            </h3>
          </div>

          {pembelajarans.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <i className="fa-solid fa-chalkboard text-4xl text-slate-300 mb-3 block" />
              <p className="font-bold text-slate-700 text-sm">Belum ada pembelajaran aktif.</p>
              <p className="text-slate-500 mt-1 max-w-md mx-auto">
                Silakan tambahkan penugasan mengajar di samping atau impor pembelajaran dari Dapodik.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Kelas</th>
                    <th className="py-3 px-3">Mata Pelajaran</th>
                    <th className="py-3 px-3">Guru Pengampu</th>
                    <th className="py-3 px-3 text-center">Bobot Nilai</th>
                    <th className="py-3 px-3 text-right">E-Rapor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pembelajarans.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-bold text-slate-800">Kelas {p.rombel.nama}</td>
                      <td className="py-3 px-3 font-semibold text-blue-700">{p.mapel.nama}</td>
                      <td className="py-3 px-3 font-medium text-slate-700">{p.gtk.nama}</td>
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-600">
                        {p.bobotHarian}% / {p.bobotUts}% / {p.bobotUas}%
                      </td>
                      <td className="py-3 px-3 text-right">
                        <a
                          href={`/api/guru/ekspor/${p.id}`}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-[11px] transition inline-flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-file-excel" />
                          <span>Unduh .xlsx</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
