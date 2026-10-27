import { db } from "@/lib/db";
import { getSemesterAktif } from "@/lib/services/semester";
import { actionSnapshotArsip } from "@/server/actions/backup";

export default async function BackupArsipPage() {
  const [semester, backupLogs, arsipCount] = await Promise.all([
    getSemesterAktif(),
    db.backupLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { semester: { include: { tahunAjaran: true } } },
    }),
    db.arsipNilai.count(),
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <i className="fa-solid fa-box-archive mr-1" />
            Cadangan & Snapshot Historis
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Backup & Arsip Nilai Akademik
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Simpan nilai akhir seluruh siswa ke tabel <strong>Arsip Historis (ArsipNilai)</strong> yang dibekukan secara permanen. Data arsip tetap abadi dan tidak akan berubah meskipun data siswa atau rombel diperbarui di tahun ajaran berikutnya.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold font-mono">
            {arsipCount} Nilai Terarsip
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Snapshot Panel (5 Cols) */}
        <div className="lg:col-span-5 glass-light-panel rounded-3xl p-6 border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-lg">
              <i className="fa-solid fa-floppy-disk" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                Snapshot Arsip Semester
              </h3>
              <p className="text-[11px] text-slate-500">
                Semester Aktif: {semester ? `${semester.tahunAjaran?.nama ?? "2026/2027"} — ${semester.tipe}` : "Belum Ada"}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Menyalin seluruh rekap Nilai Akhir (termasuk Capaian Tertinggi dan Terendah) siswa ke lembar arsip permanen sekolah.
          </p>

          <form action={actionSnapshotArsip}>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl btn-soft-emerald text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <i className="fa-solid fa-camera-retro" />
              <span>Jalankan Snapshot Arsip Sekarang</span>
            </button>
          </form>

          <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 text-[11px] text-slate-600 space-y-1">
            <p className="font-bold text-blue-800 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-info" />
              <span>Integritas Arsip Nilai</span>
            </p>
            <p>
              Tabel ArsipNilai menyimpan data secara denormalisasi teks lengkap (Nama Siswa, NISN, Rombel, Nama Mapel, Guru). Jika siswa naik kelas atau lulus, nilai semester ini tetap tersimpan utuh.
            </p>
          </div>
        </div>

        {/* Riwayat Backup Log (7 Cols) */}
        <div className="lg:col-span-7 glass-light-panel rounded-3xl p-6 border border-slate-200/80">
          <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-blue-600" />
            <span>Riwayat Aktivitas Backup & Arsip</span>
          </h3>

          {backupLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              <i className="fa-solid fa-box-archive text-3xl text-slate-300 mb-2 block" />
              <p className="font-semibold text-slate-600">Belum ada aktivitas snapshot arsip.</p>
              <p>Klik tombol di samping untuk membuat arsip nilai semester pertama Anda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3.5">Waktu</th>
                    <th className="py-3 px-3">Jenis</th>
                    <th className="py-3 px-3">Semester</th>
                    <th className="py-3 px-3 text-center">Jumlah Nilai</th>
                    <th className="py-3 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backupLogs.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3.5 font-mono text-slate-500">
                        {new Date(b.createdAt).toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">{b.jenis}</td>
                      <td className="py-3 px-3">
                        {b.semester
                          ? `${b.semester.tahunAjaran?.nama ?? "2026/2027"} (${b.semester.tipe})`
                          : "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-blue-700">
                        {b.jumlahBaris} Baris
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                          {b.status}
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
    </div>
  );
}
