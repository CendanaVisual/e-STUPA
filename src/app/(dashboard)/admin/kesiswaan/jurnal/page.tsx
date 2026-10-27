import { db } from "@/lib/db";
import { tambahJurnal, hapusJurnal } from "@/server/actions/kesiswaan";
import { safeFormatDate } from "@/lib/date";

export default async function AdminJurnalPage() {
  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const jurnalList = activeSemester
    ? await db.jurnalPerkembangan.findMany({
        where: { semesterId: activeSemester.id },
        include: {
          siswa: {
            include: {
              anggotaRombel: {
                where: { semesterId: activeSemester.id },
                include: { rombel: true },
              },
            },
          },
        },
        orderBy: { tanggal: "desc" },
      })
    : [];

  const allSiswa = activeSemester
    ? await db.siswa.findMany({
        where: {
          status: "AKTIF",
          anggotaRombel: { some: { semesterId: activeSemester.id } },
        },
        include: {
          anggotaRombel: {
            where: { semesterId: activeSemester.id },
            include: { rombel: true },
          },
        },
        orderBy: { nama: "asc" },
      })
    : [];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 font-bold text-[10px] tracking-wider uppercase">
              Kesiswaan & Karakter
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">Profil Pelajar Pancasila</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Jurnal Perkembangan Sikap Siswa
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Observasi anekdot sikap dan internalisasi 6 dimensi Profil Pelajar Pancasila.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORM INPUT JURNAL */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-book-journal-whills" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Catat Observasi Sikap</h2>
              <p className="text-[11px] text-slate-400 font-medium">Anekdot sikap & karakter</p>
            </div>
          </div>

          <form action={tambahJurnal} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Siswa</label>
              <select
                name="siswaId"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">-- Pilih Siswa --</option>
                {allSiswa.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.anggotaRombel[0]?.rombel?.nama ?? "-"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dimensi Profil Pancasila</label>
              <select
                name="dimensiProfil"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="Beriman & Bertakwa">Beriman & Bertakwa kpd Tuhan YME</option>
                <option value="Berkebinekaan Global">Berkebinekaan Global</option>
                <option value="Gotong Royong">Bergotong Royong</option>
                <option value="Mandiri">Mandiri</option>
                <option value="Bernalar Kritis">Bernalar Kritis</option>
                <option value="Kreatif">Kreatif</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Butir Sikap</label>
                <select
                  name="butirSikap"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="Positif">Positif / Teladan (+)</option>
                  <option value="Perlu Pembinaan">Perlu Pembinaan (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  name="tanggal"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Kejadian / Perilaku</label>
              <textarea
                name="catatan"
                required
                rows={3}
                placeholder="Uraikan peristiwa atau tindakan nyata yang diobservasi..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tindak Lanjut / Apresiasi</label>
              <textarea
                name="tindakLanjut"
                rows={2}
                placeholder="Pemberian pujian / bimbingan lanjutan..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold shadow-md shadow-teal-500/15 transition cursor-pointer"
            >
              Simpan ke Jurnal
            </button>
          </form>
        </div>

        {/* DAFTAR JURNAL */}
        <div className="lg:col-span-2 bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Catatan Jurnal Semester Ini</h2>
              <p className="text-[11px] text-slate-400 font-medium">Total {jurnalList.length} observasi tercatat</p>
            </div>
          </div>

          {jurnalList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <i className="fa-solid fa-book-journal-whills text-3xl text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Belum ada catatan jurnal perkembangan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jurnalList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition bg-slate-50/50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">{item.siswa.nama}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({item.siswa.anggotaRombel[0]?.rombel?.nama ?? "-"})
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                        {item.dimensiProfil}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          item.butirSikap === "Positif"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {item.butirSikap || "Positif"}
                      </span>

                      <form action={hapusJurnal} className="inline">
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          title="Hapus"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </form>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-100">
                    {item.catatan}
                  </p>

                  {item.tindakLanjut && (
                    <p className="text-[11px] text-slate-500 italic pl-1">
                      <span className="font-semibold text-slate-600">Tindak Lanjut:</span> {item.tindakLanjut}
                    </p>
                  )}

                  <div className="text-[10px] text-slate-400 pt-1">
                    Tanggal:{" "}
                    {safeFormatDate(item.tanggal, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
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
