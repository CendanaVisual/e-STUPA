import { db } from "@/lib/db";
import { simpanNilaiEkskul } from "@/server/actions/ekskul";

export default async function GuruNilaiEkskulPage({
  searchParams,
}: {
  searchParams: Promise<{ ekskulId?: string }>;
}) {
  const { ekskulId: rawEkskulId } = await searchParams;

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const ekskulList = await db.ekstrakurikuler.findMany({
    orderBy: { nama: "asc" },
  });

  const selectedEkskulId = rawEkskulId || ekskulList[0]?.id || "";

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

  const nilaiList =
    activeSemester && selectedEkskulId
      ? await db.nilaiEkskul.findMany({
          where: {
            semesterId: activeSemester.id,
            ekskulId: selectedEkskulId,
          },
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
          orderBy: { siswa: { nama: "asc" } },
        })
      : [];

  const selectedEkskul = ekskulList.find((e) => e.id === selectedEkskulId);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-bold text-[10px] tracking-wider uppercase">
              Ekstrakurikuler
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">Asesmen Pengembangan Diri</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Input Nilai Ekstrakurikuler Siswa
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Beri penilaian predikat dan narasi capaian pada kegiatan ekstrakurikuler yang dibina.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-ranking-star" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Form Nilai Ekskul</h2>
              <p className="text-[11px] text-slate-400 font-medium">Predikat & deskripsi rapor</p>
            </div>
          </div>

          <form action={simpanNilaiEkskul} className="space-y-3.5">
            <input type="hidden" name="ekskulId" value={selectedEkskulId} />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Siswa</label>
              <select
                name="siswaId"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="">-- Pilih Siswa --</option>
                {allSiswa.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.anggotaRombel[0]?.rombel.nama || "-"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Predikat</label>
              <select
                name="predikat"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="Sangat Baik">Sangat Baik (A)</option>
                <option value="Baik">Baik (B)</option>
                <option value="Cukup">Cukup (C)</option>
                <option value="Kurang">Kurang (D)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Catatan / Deskripsi Rapor</label>
              <textarea
                name="keterangan"
                rows={3}
                placeholder="Aktif mengikuti kegiatan dan menunjukkan perkembangan keterampilan yang sangat baik..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-purple-500/15 transition cursor-pointer"
            >
              Simpan Nilai
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">
                {selectedEkskul ? `Nilai Ekskul: ${selectedEkskul.nama}` : "Pilih Ekstrakurikuler"}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Total {nilaiList.length} siswa telah dinilai</p>
            </div>

            <form method="GET" className="flex items-center gap-2">
              <select
                name="ekskulId"
                defaultValue={selectedEkskulId}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
              >
                {ekskulList.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nama}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                Pilih
              </button>
            </form>
          </div>

          {nilaiList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <i className="fa-solid fa-clipboard-question text-3xl text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Belum ada siswa yang dinilai pada kegiatan ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                    <th className="py-2.5 px-3">Siswa</th>
                    <th className="py-2.5 px-3">Kelas</th>
                    <th className="py-2.5 px-3 text-center">Predikat</th>
                    <th className="py-2.5 px-3">Deskripsi Capaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {nilaiList.map((n) => (
                    <tr key={n.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-bold text-slate-800">{n.siswa.nama}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-600">
                        {n.siswa.anggotaRombel[0]?.rombel.nama || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            n.predikat === "Sangat Baik"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : n.predikat === "Baik"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {n.predikat}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{n.keterangan || "-"}</td>
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
