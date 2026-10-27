import { db } from "@/lib/db";
import { tambahEkskul, hapusEkskul } from "@/server/actions/ekskul";

export default async function AdminMasterEkskulPage() {
  const ekskulList = await db.ekstrakurikuler.findMany({
    orderBy: { nama: "asc" },
    include: {
      _count: { select: { nilaiEkskul: true } },
    },
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] tracking-wider uppercase">
              Data Master
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">Pengembangan Diri</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Master Data Ekstrakurikuler
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Daftar kegiatan ekstrakurikuler wajib & pilihan yang terhubung dengan laporan E-Rapor.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORM TAMBAH EKSKUL */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-medal" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Tambah Kegiatan Ekskul</h2>
              <p className="text-[11px] text-slate-400 font-medium">Buat entri ekstrakurikuler baru</p>
            </div>
          </div>

          <form action={tambahEkskul} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Ekstrakurikuler</label>
              <input
                type="text"
                name="nama"
                required
                placeholder="Contoh: Pramuka, PMR, Futsal, Tari Bali"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
              <select
                name="kategori"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="Kepanduan">Kepanduan / Pramuka</option>
                <option value="Olahraga">Olahraga & Kebugaran</option>
                <option value="Kesenian">Kesenian & Budaya</option>
                <option value="Sains">Sains & Riset</option>
                <option value="Keagamaan">Keagamaan & Rohani</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pembina / Pelatih</label>
              <input
                type="text"
                name="pembina"
                placeholder="Nama guru atau pelatih luar"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hari Latihan</label>
                <input
                  type="text"
                  name="hari"
                  placeholder="Contoh: Jumat"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jam Latihan</label>
                <input
                  type="text"
                  name="jam"
                  placeholder="15.00 - 17.00"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-purple-500/15 transition cursor-pointer"
            >
              Simpan Ekstrakurikuler
            </button>
          </form>
        </div>

        {/* DAFTAR EKSKUL */}
        <div className="lg:col-span-2 bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Daftar Ekstrakurikuler Aktif</h2>
              <p className="text-[11px] text-slate-400 font-medium">Total {ekskulList.length} ekstrakurikuler</p>
            </div>
          </div>

          {ekskulList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <i className="fa-solid fa-medal text-3xl text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Belum ada data ekstrakurikuler.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ekskulList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition bg-slate-50/50 flex items-start justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-800 truncate">{item.nama}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {item.kategori || "Umum"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Pembina: <span className="text-slate-700 font-semibold">{item.pembina || "-"}</span>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Jadwal: {item.hari || "-"} {item.jam ? `(${item.jam})` : ""}
                    </p>
                    <div className="pt-1 text-[10px] text-indigo-600 font-semibold">
                      <i className="fa-solid fa-user-group mr-1" />
                      {item._count?.nilaiEkskul ?? 0} Siswa Terdaftar
                    </div>
                  </div>

                  <form action={hapusEkskul}>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      title="Hapus"
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
