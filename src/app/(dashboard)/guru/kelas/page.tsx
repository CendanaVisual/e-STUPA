import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getPembelajaranGuru } from "@/lib/auth/rbac";

export default async function GuruKelasPage() {
  const session = await requireRole("GURU");
  const list = session.gtkId ? await getPembelajaranGuru(session.gtkId) : [];

  return (
    <div className="space-y-6">
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <i className="fa-solid fa-chalkboard-user mr-1" />
            Penugasan Akademik Guru
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Kelas & Mata Pelajaran Saya
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Daftar kelas dan mata pelajaran yang Anda ampu pada semester aktif. Klik salah satu kelas untuk menginput atau mengubah nilai.
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="glass-light-panel rounded-3xl p-12 text-center text-xs text-slate-400 border border-slate-200/80">
          <i className="fa-solid fa-chalkboard text-4xl text-slate-300 mb-3 block" />
          <p className="font-bold text-slate-700 text-sm">Belum ada penugasan mengajar.</p>
          <p className="text-slate-500 mt-1">
            Akun Anda belum di-plotting ke rombel pada semester aktif. Silakan hubungi Superadmin sekolah.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/guru/nilai/${p.id}`}
              className="glass-light-card rounded-2xl p-5 border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all group block"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs font-mono">
                  Kelas {p.rombel.nama}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Tingkat {p.rombel.tingkat}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-800 group-hover:text-blue-700 transition">
                {p.mapel.nama}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Kode: {p.mapel.kode}</p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-blue-600 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Input / Lihat Nilai</span>
                  <i className="fa-solid fa-arrow-right text-[11px]" />
                </span>
                <span className="text-slate-400 text-[11px]">KKTP: {p.kktp || 75}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
