import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getPembelajaranGuru } from "@/lib/auth/rbac";

export default async function GuruEksporPage() {
  const session = await requireRole("GURU");
  const list = session.gtkId ? await getPembelajaranGuru(session.gtkId) : [];

  return (
    <div className="space-y-6">
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <i className="fa-solid fa-file-export mr-1" />
            Format Ekspor Resmi Kemendikbud
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Ekspor Daftar Nilai E-Rapor
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Unduh file Excel (.xlsx) dengan struktur 4 sheet resmi: Format Ekspor E-Rapor, Olah Nilai Rinci, Pengaturan TP & Bobot, dan Analisis Statistik. Berkas siap diunggah langsung ke aplikasi E-Rapor sekolah Anda.
          </p>
        </div>
      </div>

      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80">
        <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-download text-emerald-600" />
          <span>Unduh Berkas E-Rapor per Kelas</span>
        </h3>

        {list.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <i className="fa-solid fa-file-excel text-4xl text-slate-300 mb-3 block" />
            <p className="font-bold text-slate-700 text-sm">Belum ada pembelajaran yang diampu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Kelas / Rombel</th>
                  <th className="py-3.5 px-4">Mata Pelajaran</th>
                  <th className="py-3.5 px-4 text-center">Format Berkas</th>
                  <th className="py-3.5 px-4 text-right">Aksi Unduh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-800">Kelas {p.rombel.nama}</td>
                    <td className="py-3.5 px-4 font-semibold text-blue-700">{p.mapel.nama}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px] font-bold">
                        Excel 4-Sheet (.xlsx)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={`/api/guru/ekspor/${p.id}`}
                        className="py-2 px-4 rounded-xl btn-soft-emerald text-xs font-bold inline-flex items-center gap-2 shadow-xs"
                      >
                        <i className="fa-solid fa-cloud-arrow-down" />
                        <span>Unduh Format E-Rapor</span>
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
  );
}
