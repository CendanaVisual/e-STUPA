import { db } from "@/lib/db";
import { createMapel } from "@/server/actions/mapel";

export default async function DataMapelPage() {
  const mapels = await db.mapel.findMany({
    orderBy: [{ kelompok: "asc" }, { urutan: "asc" }, { nama: "asc" }],
    include: { _count: { select: { pembelajaran: true } } },
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <i className="fa-solid fa-book-bookmark mr-1" />
            Data Master Kurikulum
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Mata Pelajaran (Mapel)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Daftar mata pelajaran beserta kode resmi yang disinkronkan dengan E-Rapor Kemendikbud.
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold font-mono">
          {mapels.length} Mata Pelajaran Terdaftar
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah Mapel (4 Cols) */}
        <div className="lg:col-span-4 glass-light-panel rounded-3xl p-6 border border-slate-200/80 h-fit">
          <h3 className="text-base font-extrabold text-slate-800 mb-3 flex items-center gap-2">
            <i className="fa-solid fa-plus text-blue-600" />
            <span>Tambah Mapel Baru</span>
          </h3>

          <form action={createMapel} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kode Mapel (Singkat) *</label>
              <input
                type="text"
                name="kode"
                required
                placeholder="mis. MTK, INF, PAI"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Mata Pelajaran *</label>
              <input
                type="text"
                name="nama"
                required
                placeholder="mis. Matematika Umum"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kode Mapel E-Rapor (Opsional)</label>
              <input
                type="text"
                name="kodeErapor"
                placeholder="mis. MAPEL-MTK-10"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kelompok</label>
                <select
                  name="kelompok"
                  defaultValue="Umum"
                  className="w-full px-2.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Umum">Umum</option>
                  <option value="Pilihan">Pilihan</option>
                  <option value="Muatan Lokal">Muatan Lokal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Urut</label>
                <input
                  type="number"
                  name="urutan"
                  defaultValue={mapels.length + 1}
                  min={1}
                  className="w-full px-2.5 py-2 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl btn-soft-primary text-xs font-bold flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              <i className="fa-solid fa-plus" />
              <span>Simpan Mata Pelajaran</span>
            </button>
          </form>
        </div>

        {/* Tabel Mata Pelajaran (8 Cols) */}
        <div className="lg:col-span-8 glass-light-panel rounded-3xl p-6 border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-book-open text-blue-600" />
              <span>Daftar Mata Pelajaran</span>
            </h3>
          </div>

          {mapels.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              <i className="fa-solid fa-book-bookmark text-3xl text-slate-300 mb-2 block" />
              <p className="font-semibold text-slate-600">Belum ada mata pelajaran.</p>
              <p>Gunakan formulir di samping untuk menambahkan mata pelajaran pertama.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3.5 w-14 text-center">Kode</th>
                    <th className="py-3 px-3">Nama Mata Pelajaran</th>
                    <th className="py-3 px-3">Kode E-Rapor</th>
                    <th className="py-3 px-3">Kelompok</th>
                    <th className="py-3 px-3 text-center">Kelas Mengampu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mapels.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3.5 text-center font-mono font-bold text-blue-700">
                        {m.kode}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{m.nama}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{m.kodeErapor || "-"}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {m.kelompok || "Umum"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-purple-700 font-bold">
                        {m._count.pembelajaran} Kelas
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
