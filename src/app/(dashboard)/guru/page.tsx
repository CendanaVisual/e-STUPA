import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getPembelajaranGuru } from "@/lib/auth/rbac";
import { db } from "@/lib/db";

export default async function GuruDashboard() {
  const session = await requireRole("GURU");
  const list = session.gtkId ? await getPembelajaranGuru(session.gtkId) : [];

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const gtk = session.gtkId
    ? await db.gtk.findUnique({
        where: { id: session.gtkId },
        include: { waliKelas: { where: { semester: { isAktif: true } } } },
      })
    : null;

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="glass-light-panel rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-blue-200/60 shadow-sm relative overflow-hidden bg-gradient-to-r from-blue-50/70 via-white to-sky-50/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/70 border border-blue-200 text-blue-800 text-xs font-bold mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ruang Kerja Pendidik</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            Selamat Datang, <span className="text-blue-700">{gtk?.nama ?? session.nama}</span>
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Akses cepat pengisian nilai formatif/sumatif, rekapitulasi kehadiran murid, pembinaan kesiswaan, dan ekspor format resmi E-Rapor.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/95 border border-slate-200 shadow-xs flex flex-col items-start gap-1 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Tahun Ajaran & Semester
          </span>
          <p className="text-sm font-extrabold text-blue-700">
            {activeSemester ? `${activeSemester.tahunAjaran.nama} — ${activeSemester.tipe}` : "2026/2027"}
          </p>
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold mt-1">
            Status: {activeSemester?.status ?? "AKTIF"}
          </span>
        </div>
      </div>

      {/* QUICK SHORTCUTS (FITUR EDUGURU & STUPA) */}
      <div>
        <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3">
          Aksi & Modul Terpadu
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/guru/kelas"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-pen-to-square" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition">
              Input Nilai
            </span>
          </Link>

          <Link
            href="/guru/presensi"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-clipboard-user" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition">
              Presensi Siswa
            </span>
          </Link>

          <Link
            href="/guru/leger"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-list-check" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition">
              Leger Nilai
            </span>
          </Link>

          <Link
            href="/guru/ekskul"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md transition flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-base group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-ranking-star" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition">
              Nilai Ekskul
            </span>
          </Link>

          <Link
            href="/guru/kesiswaan/prestasi"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md transition flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-base group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-trophy" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition">
              Prestasi Murid
            </span>
          </Link>

          <Link
            href="/guru/ekspor"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-md transition flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-base group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <i className="fa-solid fa-file-excel" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-teal-700 transition">
              Ekspor E-Rapor
            </span>
          </Link>
        </div>
      </div>

      {/* DAFTAR KELAS & PEMBELAJARAN YANG DIAMPU */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">
              Mata Pelajaran & Kelas yang Anda Ampu
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Klik pada kartu mata pelajaran untuk membuka lembar pengisian nilai formatif/sumatif
            </p>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <i className="fa-solid fa-chalkboard-user text-3xl text-slate-300" />
            <p className="text-xs font-bold text-slate-600">
              Belum ada mata pelajaran yang ditugaskan kepada akun Anda pada semester aktif ini.
            </p>
            <p className="text-[11px]">
              Silakan hubungi Superadmin untuk melakukan penugasan pengampu pada menu Pembelajaran.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <Link
                key={p.id}
                href={`/guru/nilai/${p.id}`}
                className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 hover:border-blue-400 hover:bg-white hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100/70 text-blue-700 border border-blue-200">
                      Kelas {p.rombel.nama}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      KKTP {p.kktp ?? 75}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-800 group-hover:text-blue-700 transition">
                    {p.mapel.nama}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bobot: Formatif {p.bobotHarian}% • STS {p.bobotUts}% • SAS {p.bobotUas}%
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Buka Lembar Nilai &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
