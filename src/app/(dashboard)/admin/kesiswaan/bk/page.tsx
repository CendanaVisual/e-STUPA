import { db } from "@/lib/db";
import { tambahBk, updateStatusBk, hapusBk } from "@/server/actions/kesiswaan";
import { safeFormatDate } from "@/lib/date";

export default async function AdminBkPage() {
  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const bkList = activeSemester
    ? await db.bimbinganKonseling.findMany({
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
          guruBk: true,
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
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[10px] tracking-wider uppercase">
              Kesiswaan
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">Layanan Bimbingan</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Bimbingan & Konseling (BK)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Pencatatan pembinaan, penanganan masalah belajar, perilaku, dan tindak lanjut pendampingan siswa.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORM INPUT BK */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-hand-holding-heart" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Catat Layanan Konseling</h2>
              <p className="text-[11px] text-slate-400 font-medium">Bimbingan & pembinaan siswa</p>
            </div>
          </div>

          <form action={tambahBk} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Siswa</label>
              <select
                name="siswaId"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="">-- Pilih Siswa --</option>
                {allSiswa.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.anggotaRombel[0]?.rombel?.nama ?? "-"})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bidang Layanan</label>
                <select
                  name="kategori"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="Belajar">Belajar / Akademik</option>
                  <option value="Perilaku">Perilaku / Kedisiplinan</option>
                  <option value="Pribadi">Pribadi</option>
                  <option value="Sosial">Sosial / Teman Sebaya</option>
                  <option value="Karier">Karier / Minat Bakat</option>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Kasus / Gejala Permasalahan</label>
              <textarea
                name="permasalahan"
                required
                rows={3}
                placeholder="Uraikan keluhan, masalah perilaku, atau kendala belajar siswa..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rencana Tindak Lanjut</label>
              <textarea
                name="tindakLanjut"
                rows={2}
                placeholder="Konseling berkala, pemanggilan orang tua, remedial, dll..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status Penanganan</label>
              <select
                name="status"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
              >
                <option value="Dalam Penanganan">Dalam Penanganan</option>
                <option value="Selesai">Selesai</option>
                <option value="Dirujuk">Dirujuk (Alih Tangan Kasus)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white text-xs font-bold shadow-md shadow-rose-500/15 transition cursor-pointer"
            >
              Simpan Catatan BK
            </button>
          </form>
        </div>

        {/* DAFTAR CATATAN BK */}
        <div className="lg:col-span-2 bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Catatan Konseling Semester Ini</h2>
              <p className="text-[11px] text-slate-400 font-medium">Total {bkList.length} kasus/bimbingan</p>
            </div>
          </div>

          {bkList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <i className="fa-solid fa-hand-holding-heart text-3xl text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Belum ada catatan bimbingan konseling.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bkList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition bg-slate-50/50 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">{item.siswa.nama}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({item.siswa.anggotaRombel[0]?.rombel?.nama ?? "-"})
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        {item.kategori}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <form action={updateStatusBk} className="inline-flex items-center gap-1">
                        <input type="hidden" name="id" value={item.id} />
                        <select
                          name="status"
                          defaultValue={item.status}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
                            item.status === "Selesai"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : item.status === "Dirujuk"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          <option value="Dalam Penanganan">Dalam Penanganan</option>
                          <option value="Selesai">Selesai</option>
                          <option value="Dirujuk">Dirujuk</option>
                        </select>
                        <button
                          type="submit"
                          title="Simpan Perubahan Status"
                          className="px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 transition cursor-pointer"
                        >
                          Simpan
                        </button>
                      </form>

                      <form action={hapusBk} className="inline">
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
                    {item.permasalahan}
                  </p>

                  {item.tindakLanjut && (
                    <p className="text-[11px] text-slate-500 italic pl-1">
                      <span className="font-semibold text-slate-600">Tindak Lanjut:</span> {item.tindakLanjut}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>
                      Tanggal:{" "}
                      {safeFormatDate(item.tanggal, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span>Petugas: {item.guruBk?.nama || "Guru BK"}</span>
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
