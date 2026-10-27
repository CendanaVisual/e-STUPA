import { db } from "@/lib/db";
import {
  actionAktifkanSemester,
  actionKunciSemester,
  actionTambahTahunAjaran,
} from "@/server/actions/tahun-ajaran";

export default async function TahunAjaranPage() {
  const tahunAjarans = await db.tahunAjaran.findMany({
    orderBy: { tahunMulai: "desc" },
    include: {
      semester: {
        orderBy: { tipe: "asc" },
        include: { _count: { select: { rombel: true, pembelajaran: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <i className="fa-solid fa-calendar-days mr-1" />
            Parameter Akademik & Multi-Tenancy
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Tahun Ajaran & Siklus Semester
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Sistem pengolahan nilai berbasis semester. Di akhir semester, Superadmin dapat melakukan{" "}
            <strong>Kunci / Freeze</strong> untuk mencegah perubahan nilai, dan membuka semester baru tanpa
            menghapus data master siswa atau guru.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah Tahun Ajaran Baru (4 Cols) */}
        <div className="lg:col-span-4 glass-light-panel rounded-3xl p-6 border border-slate-200/80 h-fit">
          <h3 className="text-base font-extrabold text-slate-800 mb-2 flex items-center gap-2">
            <i className="fa-solid fa-plus text-blue-600" />
            <span>Tambah Tahun Ajaran Baru</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Secara otomatis membuat lembaran Semester Ganjil dan Genap.
          </p>

          <form action={actionTambahTahunAjaran} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Format Tahun Ajaran *
              </label>
              <input
                type="text"
                name="nama"
                required
                placeholder="mis. 2027/2028"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Mulai (Angka) *</label>
              <input
                type="number"
                name="tahunMulai"
                required
                defaultValue={2027}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl btn-soft-primary text-xs font-bold flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              <i className="fa-solid fa-calendar-plus" />
              <span>Buat Tahun Ajaran</span>
            </button>
          </form>
        </div>

        {/* Daftar Tahun Ajaran & Semester (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {tahunAjarans.map((ta) => (
            <div
              key={ta.id}
              className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs">
                    <i className="fa-solid fa-calendar" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      Tahun Pelajaran {ta.nama}
                    </h3>
                  </div>
                </div>

                {ta.isAktif ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px] inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Tahun Pelajaran Berjalan</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px]">
                    Nonaktif
                  </span>
                )}
              </div>

              {/* Semester Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {ta.semester.map((sem) => (
                  <div
                    key={sem.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      sem.isAktif
                        ? "bg-gradient-to-br from-blue-50/90 to-sky-50/60 border-blue-300 shadow-sm"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-slate-800">
                        Semester {sem.tipe}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          sem.status === "AKTIF"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : sem.status === "DIKUNCI"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {sem.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-1 mb-4">
                      <p>
                        Kode Semester: <strong className="font-mono text-slate-700">{sem.kode}</strong>
                      </p>
                      <p>
                        Total Rombel: <strong className="font-mono text-blue-700">{sem._count.rombel} Kelas</strong>
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100/80">
                      {!sem.isAktif && (
                        <form action={actionAktifkanSemester} className="w-full">
                          <input type="hidden" name="semesterId" value={sem.id} />
                          <button
                            type="submit"
                            className="w-full py-1.5 rounded-xl btn-soft-primary text-[11px] font-bold cursor-pointer"
                          >
                            Aktifkan Semester Ini
                          </button>
                        </form>
                      )}

                      {sem.isAktif && sem.status === "AKTIF" && (
                        <form action={actionKunciSemester} className="w-full">
                          <input type="hidden" name="semesterId" value={sem.id} />
                          <button
                            type="submit"
                            className="w-full py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <i className="fa-solid fa-lock" />
                            <span>Kunci (Freeze) Nilai</span>
                          </button>
                        </form>
                      )}

                      {sem.status === "DIKUNCI" && (
                        <span className="w-full py-1.5 text-center text-[11px] font-semibold text-rose-600 bg-rose-50/60 rounded-xl border border-rose-200">
                          <i className="fa-solid fa-lock mr-1" />
                          Nilai Telah Dibekukan (Read-Only)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
