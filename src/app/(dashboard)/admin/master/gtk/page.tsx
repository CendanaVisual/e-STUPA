import Link from "next/link";
import { db } from "@/lib/db";

export default async function DataGtkPage() {
  const [gtkList, totalCount] = await Promise.all([
    db.gtk.findMany({
      orderBy: { nama: "asc" },
      include: { user: true },
    }),
    db.gtk.count(),
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <i className="fa-solid fa-chalkboard-user mr-1" />
            Data Master Dapodik
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Data Guru & Tenaga Kependidikan (GTK)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Data pendidik terdaftar dari Dapodik lokal. Digunakan sebagai acuan penugasan mengajar dan pembuatan akun guru.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/impor"
            className="py-2.5 px-4 rounded-xl btn-soft-emerald text-xs font-bold flex items-center gap-2 shadow-xs"
          >
            <i className="fa-solid fa-file-import" />
            <span>Impor GTK (.xlsx)</span>
          </Link>
        </div>
      </div>

      {/* Tabel Data GTK */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-id-card-clip text-emerald-600" />
            <span>Daftar GTK ({totalCount} Guru / Tenaga Pendidik)</span>
          </h3>
        </div>

        {gtkList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <i className="fa-solid fa-chalkboard-user text-4xl text-slate-300 mb-3 block" />
            <p className="font-bold text-slate-700 text-sm">Belum ada data GTK.</p>
            <p className="text-slate-500 mt-1 max-w-md mx-auto">
              Silakan unduh daftar GTK dari aplikasi Dapodik sekolah Anda, lalu unggah melalui menu Impor Dapodik.
            </p>
            <Link
              href="/admin/impor"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-soft-emerald text-xs font-bold"
            >
              <i className="fa-solid fa-cloud-arrow-up" />
              <span>Unggah Data GTK Sekarang</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5 w-12 text-center">No</th>
                  <th className="py-3 px-3">Nama Lengkap & Gelar</th>
                  <th className="py-3 px-3">NUPTK</th>
                  <th className="py-3 px-3">NIP</th>
                  <th className="py-3 px-3">Jenis PTK</th>
                  <th className="py-3 px-3">Status Kepegawaian</th>
                  <th className="py-3 px-3 text-center">Akun Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gtkList.map((g, idx) => (
                  <tr key={g.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3.5 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-bold text-slate-800">{g.nama}</td>
                    <td className="py-3 px-3 font-mono font-semibold text-blue-700">
                      {g.nuptk || "-"}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">{g.nip || "-"}</td>
                    <td className="py-3 px-3 font-medium text-slate-700">{g.jenisPtk || "Guru Mapel"}</td>
                    <td className="py-3 px-3 font-medium text-slate-600">{g.statusKepegawaian || "PNS / PPPK"}</td>
                    <td className="py-3 px-3 text-center">
                      {g.user ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                          @{g.user.username}
                        </span>
                      ) : (
                        <Link
                          href="/admin/users"
                          className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 font-bold text-[10px] text-slate-500 transition"
                        >
                          + Buat Akun
                        </Link>
                      )}
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
