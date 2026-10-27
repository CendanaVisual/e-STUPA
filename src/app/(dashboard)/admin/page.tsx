import Link from "next/link";
import { db } from "@/lib/db";
import { getSemesterAktif } from "@/lib/services/semester";

export default async function AdminDashboard() {
  const [semester, siswaCount, gtkCount, guruCount, rombelCount, importLogs, recentUsers] =
    await Promise.all([
      getSemesterAktif(),
      db.siswa.count({ where: { isAktif: true } }),
      db.gtk.count({ where: { isAktif: true } }),
      db.user.count({ where: { role: "GURU" } }),
      db.rombel.count(),
      db.importLog.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
      db.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { gtk: true },
      }),
    ]);

  const stats = [
    {
      label: "Total Peserta Didik",
      value: siswaCount,
      sub: "Siswa Aktif Terdaftar",
      icon: "fa-solid fa-user-graduate",
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50 border-blue-200/80",
      pill: "Dapodik",
      pillColor: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      label: "Pendidik & Tendik (GTK)",
      value: gtkCount,
      sub: "Guru Terdata di Sistem",
      icon: "fa-solid fa-chalkboard-user",
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50 border-emerald-200/80",
      pill: "Guru & Staf",
      pillColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      label: "Rombongan Belajar",
      value: rombelCount,
      sub: "Kelas Semester Aktif",
      icon: "fa-solid fa-layer-group",
      iconColor: "text-teal-600",
      bgColor: "bg-teal-50 border-teal-200/80",
      pill: "Rombel",
      pillColor: "bg-teal-50 text-teal-700 border-teal-200",
    },
    {
      label: "Akun Pengguna Guru",
      value: guruCount,
      sub: "Akun Guru Terverifikasi",
      icon: "fa-solid fa-users-gear",
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50 border-purple-200/80",
      pill: "RBAC Aktif",
      pillColor: "bg-purple-50 text-purple-700 border-purple-200",
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="glass-light-panel rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-blue-200/60 shadow-sm relative overflow-hidden bg-gradient-to-r from-blue-50/70 via-white to-sky-50/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/70 border border-blue-200 text-blue-800 text-xs font-bold mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Pusat Kendali Superadmin</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            Selamat Datang di Portal <span className="text-stupa-gradient">STUPA</span>
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Sistem Terpadu Untuk Penilaian Akademik 1 Sekolah. Kelola data master Dapodik, akun guru,
            pembagian kelas, dan ekspor lembar nilai resmi E-Rapor secara otomatis.
          </p>
        </div>

        {/* Semester Active Badge Card */}
        <div className="p-4 rounded-2xl bg-white/95 border border-slate-200 shadow-xs flex flex-col items-start gap-1 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Status Semester Akademik
          </span>
          <p className="text-sm font-extrabold text-blue-700">
            {semester ? `${semester.tahunAjaran?.nama ?? "2026/2027"} — ${semester.tipe}` : "Belum Disetel"}
          </p>
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold mt-1">
            Status: {semester?.status ?? "DRAFT"}
          </span>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass-light-card rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">{s.label}</p>
                <h3 className="text-3xl font-extrabold text-slate-800 font-mono mt-1">
                  {s.value}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5">{s.sub}</p>
              </div>
              <div
                className={`w-12 h-12 rounded-2xl ${s.bgColor} border flex items-center justify-center ${s.iconColor} text-xl shadow-xs`}
              >
                <i className={s.icon} />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${s.pillColor}`}>
                {s.pill}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Terhubung</span>
            </div>
          </div>
        ))}
      </div>

      {/* QUICK ACTIONS SHORTCUTS */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80">
        <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-bolt text-amber-500" />
          <span>Aksi Cepat Pengelolaan Sistem</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Link
            href="/admin/impor"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-file-import text-base" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition">
                Impor Data Dapodik
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Unggah file Excel Siswa/GTK/Rombel</p>
            </div>
          </Link>

          <Link
            href="/admin/users"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-user-plus text-base" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition">
                Kelola Akun Guru
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Buat dan atur hak akses pendidik</p>
            </div>
          </Link>

          <Link
            href="/admin/pembelajaran"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-chalkboard text-base" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-teal-700 transition">
                Atur Pembelajaran
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Plotting Guru × Mapel × Rombel</p>
            </div>
          </Link>

          <Link
            href="/admin/backup"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-shield-halved text-base" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition">
                Backup & Kunci Nilai
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Snapshot arsip nilai akhir semester</p>
            </div>
          </Link>

          <Link
            href="/admin/presensi"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-clipboard-user text-base" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-sky-700 transition">
                Presensi Siswa
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Daftar hadir harian & rekap kelas</p>
            </div>
          </Link>

          <Link
            href="/admin/leger"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-list-check text-base" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition">
                Leger Nilai Lengkap
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Matriks nilai seluruh mapel & ranking</p>
            </div>
          </Link>

          <Link
            href="/admin/statistik"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-chart-line text-base" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition">
                Analisis Capaian
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Statistik predikat & ketuntasan KKTP</p>
            </div>
          </Link>

          <Link
            href="/admin/kalender"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-calendar-days text-base" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition">
                Kalender Akademik
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Jadwal kegiatan & ujian sekolah</p>
            </div>
          </Link>
        </div>
      </div>

      {/* TWO COLUMN SUMMARY: USERS & IMPORT ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Users */}
        <div className="lg:col-span-6 glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-users text-blue-600" />
                <span>Pengguna Terbaru</span>
              </h3>
              <Link href="/admin/users" className="text-xs font-bold text-blue-600 hover:underline">
                Lihat Semua &rarr;
              </Link>
            </div>

            {recentUsers.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Belum ada akun guru terdaftar.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {recentUsers.map((u) => (
                  <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-xs font-bold">
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{u.gtk?.nama || u.username}</p>
                        <p className="text-[11px] text-slate-400 font-mono">@{u.username}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.role === "SUPERADMIN"
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Import Logs */}
        <div className="lg:col-span-6 glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-teal-600" />
                <span>Riwayat Impor Dapodik</span>
              </h3>
              <Link href="/admin/impor" className="text-xs font-bold text-blue-600 hover:underline">
                Mulai Impor &rarr;
              </Link>
            </div>

            {importLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <i className="fa-solid fa-file-excel text-3xl text-slate-300 mb-2 block" />
                <p className="font-semibold text-slate-600">Belum ada berkas Dapodik diunggah.</p>
                <p className="text-slate-400 mt-0.5">
                  Unggah file Excel Siswa atau GTK untuk memulai pengisian data master.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {importLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">{log.namaFile}</p>
                      <p className="text-[11px] text-slate-400">
                        {log.jenis} • +{log.ditambah} data baru, ~{log.diperbarui} diperbarui
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === "BERHASIL"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
