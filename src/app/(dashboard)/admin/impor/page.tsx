import { db } from "@/lib/db";
import { ImportDropzone } from "./ImportDropzone";

export default async function ImporDapodikPage() {
  const logs = await db.importLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { createdBy: true },
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <i className="fa-solid fa-file-import mr-1" />
            Integrasi Dapodik (Opsi B)
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Impor Data Master Dapodik
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Unggah file hasil ekspor Dapodik lokal (.xlsx / .csv). Sistem akan otomatis melakukan{" "}
            <strong>Upsert (Update / Insert)</strong> menggunakan pengenal unik seperti NISN, NUPTK, dan ID Rombel
            agar data tidak terduplikasi.
          </p>
        </div>
      </div>

      {/* Interactive Dropzone Client Component */}
      <ImportDropzone />

      {/* Riwayat Log Impor */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80">
        <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-clock-rotate-left text-teal-600" />
          <span>Riwayat & Status Impor Berkas</span>
        </h3>

        {logs.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            <i className="fa-solid fa-file-lines text-3xl text-slate-300 mb-2 block" />
            <p className="font-semibold text-slate-600">Belum ada riwayat impor data.</p>
            <p>Silakan pilih jenis data dan unggah berkas Excel di atas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5">Waktu</th>
                  <th className="py-3 px-3">Jenis Entitas</th>
                  <th className="py-3 px-3">Nama Berkas</th>
                  <th className="py-3 px-3 text-center">Ditambah</th>
                  <th className="py-3 px-3 text-center">Diperbarui</th>
                  <th className="py-3 px-3 text-center">Gagal</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3.5 font-mono text-slate-500">
                      {new Date(l.createdAt).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                        {l.jenis}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">{l.namaFile}</td>
                    <td className="py-3 px-3 text-center font-mono text-emerald-600 font-bold">
                      +{l.ditambah}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-blue-600 font-bold">
                      ~{l.diperbarui}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-rose-600 font-bold">
                      {l.gagal}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          l.status === "BERHASIL"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : l.status === "SEBAGIAN"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {l.status}
                      </span>
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
