import Link from "next/link";
import { db } from "@/lib/db";

export default async function DataSiswaPage() {
  const [siswaList, totalCount] = await Promise.all([
    db.siswa.findMany({
      take: 50,
      orderBy: { nama: "asc" },
      include: {
        anggotaRombel: {
          include: { rombel: true },
          take: 1,
        },
      },
    }),
    db.siswa.count(),
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <i className="fa-solid fa-user-graduate mr-1" />
            Data Master Dapodik
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Data Peserta Didik (Siswa)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Data siswa terpusat berbasis NISN. Diperbarui secara massal melalui impor file Dapodik lokal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/impor"
            className="py-2.5 px-4 rounded-xl btn-soft-primary text-xs font-bold flex items-center gap-2 shadow-xs"
          >
            <i className="fa-solid fa-file-import" />
            <span>Impor Siswa (.xlsx)</span>
          </Link>
        </div>
      </div>

      {/* Tabel Data Siswa */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-list-check text-blue-600" />
            <span>Daftar Siswa ({totalCount} Siswa Terdaftar)</span>
          </h3>
        </div>

        {siswaList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <i className="fa-solid fa-user-graduate text-4xl text-slate-300 mb-3 block" />
            <p className="font-bold text-slate-700 text-sm">Belum ada data siswa.</p>
            <p className="text-slate-500 mt-1 max-w-md mx-auto">
              Silakan unduh data siswa dari Dapodik lokal sekolah Anda, lalu unggah melalui menu Impor Dapodik.
            </p>
            <Link
              href="/admin/impor"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-soft-primary text-xs font-bold"
            >
              <i className="fa-solid fa-cloud-arrow-up" />
              <span>Unggah Data Siswa Sekarang</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5 w-12 text-center">No</th>
                  <th className="py-3 px-3">NISN</th>
                  <th className="py-3 px-3">NIS</th>
                  <th className="py-3 px-3.5">Nama Peserta Didik</th>
                  <th className="py-3 px-3 text-center">L/P</th>
                  <th className="py-3 px-3">Rombel / Kelas</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaList.map((s, idx) => {
                  const rombelSaatIni = s.anggotaRombel[0]?.rombel?.nama || "-";
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3.5 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-700">{s.nisn}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{s.nis || "-"}</td>
                      <td className="py-3 px-3.5 font-bold text-slate-800">{s.nama}</td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-600">
                        {s.jenisKelamin}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700">{rombelSaatIni}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            s.status === "AKTIF"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
