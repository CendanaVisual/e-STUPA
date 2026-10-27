import { db } from "@/lib/db";
import { tambahKegiatanKalender, hapusKegiatanKalender } from "@/server/actions/kalender";
import { safeFormatDate, safeMonthShort, safeDayNumber } from "@/lib/date";

export default async function AdminKalenderPage() {
  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const kegiatan = activeSemester
    ? await db.kalenderAkademik.findMany({
        where: { semesterId: activeSemester.id },
        orderBy: { tanggalMulai: "asc" },
      })
    : [];

  const kategoriColors: Record<string, { bg: string; text: string; border: string }> = {
    Akademik: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    Ujian: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    Libur: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    "Kegiatan Sekolah": { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
    Rapat: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] tracking-wider uppercase">
              Kalender Akademik
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">
              T.A. {activeSemester?.tahunAjaran?.nama ?? "2026/2027"} {activeSemester?.tipe ?? "GANJIL"}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Agenda & Kalender Pendidikan
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Jadwal kegiatan akademik, periode PTS, PAS/PAT, libur semester, dan agenda penting sekolah.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORM TAMBAH AGENDA */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-calendar-plus" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Tambah Agenda Baru</h2>
              <p className="text-[11px] text-slate-400 font-medium">Catat jadwal kegiatan sekolah</p>
            </div>
          </div>

          <form action={tambahKegiatanKalender} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Judul Kegiatan</label>
              <input
                type="text"
                name="judulKegiatan"
                required
                placeholder="Contoh: Asesmen Sumatif Akhir Semester"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  name="tanggalMulai"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Selesai</label>
                <input
                  type="date"
                  name="tanggalSelesai"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Agenda</label>
              <select
                name="kategori"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Akademik">Akademik</option>
                <option value="Ujian">Ujian / Asesmen</option>
                <option value="Libur">Libur Semester / Nasional</option>
                <option value="Kegiatan Sekolah">Kegiatan Sekolah / P5</option>
                <option value="Rapat">Rapat Dewan Guru & Komite</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan / Catatan</label>
              <textarea
                name="keterangan"
                rows={2}
                placeholder="Rincian pelaksanaan agenda..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white text-xs font-bold shadow-md shadow-blue-500/15 transition cursor-pointer"
            >
              Simpan ke Kalender
            </button>
          </form>
        </div>

        {/* DAFTAR AGENDA */}
        <div className="lg:col-span-2 bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Daftar Agenda Semester Ini</h2>
              <p className="text-[11px] text-slate-400 font-medium">Total {kegiatan.length} agenda terjadwal</p>
            </div>
          </div>

          {kegiatan.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <i className="fa-regular fa-calendar-xmark text-3xl text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Belum ada agenda kegiatan.</p>
              <p className="text-[11px]">Gunakan formulir di sebelah kiri untuk menambahkan agenda pertama.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {kegiatan.map((item) => {
                const style = kategoriColors[item.kategori] || kategoriColors.Akademik;
                const tglMulai = safeFormatDate(item.tanggalMulai, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                const tglSelesai = item.tanggalSelesai
                  ? safeFormatDate(item.tanggalSelesai, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null;

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition bg-slate-50/50 flex items-start justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-blue-600 flex flex-col items-center justify-center shrink-0 shadow-xs">
                        <span className="text-[10px] font-bold text-slate-400 leading-none">
                          {safeMonthShort(item.tanggalMulai)}
                        </span>
                        <span className="text-sm font-extrabold leading-none mt-0.5">
                          {safeDayNumber(item.tanggalMulai)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-800">{item.judulKegiatan}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${style.bg} ${style.text} ${style.border}`}
                          >
                            {item.kategori}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {tglMulai} {tglSelesai ? `— ${tglSelesai}` : ""}
                        </p>
                        {item.keterangan && (
                          <p className="text-[11px] text-slate-400 mt-1 italic">{item.keterangan}</p>
                        )}
                      </div>
                    </div>

                    <form action={hapusKegiatanKalender}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        title="Hapus Agenda"
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      >
                        <i className="fa-solid fa-trash-can text-xs" />
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
