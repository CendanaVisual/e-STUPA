import Link from "next/link";
import { db } from "@/lib/db";
import { getSemesterAktif } from "@/lib/services/semester";

export default async function DataRombelPage() {
  const semester = await getSemesterAktif();

  const rombels = await db.rombel.findMany({
    where: semester ? { semesterId: semester.id } : undefined,
    orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
    include: {
      waliKelas: true,
      _count: { select: { anggota: true, pembelajaran: true } },
    },
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold">
            <i className="fa-solid fa-layer-group mr-1" />
            Data Master Dapodik
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Rombongan Belajar (Rombel / Kelas)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Daftar kelas pada semester aktif (
            {semester ? `${semester.tahunAjaran?.nama ?? "2026/2027"} — ${semester.tipe}` : "Belum Aktif"}). Terintegrasi dengan wali kelas dan pembagian anggota rombel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/impor"
            className="py-2.5 px-4 rounded-xl btn-soft-primary text-xs font-bold flex items-center gap-2 shadow-xs"
          >
            <i className="fa-solid fa-file-import" />
            <span>Impor Rombel (.xlsx)</span>
          </Link>
        </div>
      </div>

      {/* Grid Rombel Cards */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-school text-teal-600" />
            <span>Daftar Rombel ({rombels.length} Kelas Terdaftar)</span>
          </h3>
        </div>

        {rombels.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <i className="fa-solid fa-users-rectangle text-4xl text-slate-300 mb-3 block" />
            <p className="font-bold text-slate-700 text-sm">Belum ada rombel pada semester ini.</p>
            <p className="text-slate-500 mt-1 max-w-md mx-auto">
              Silakan impor rombel dan anggota rombel dari file Dapodik, atau salin rombel dari semester sebelumnya.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href="/admin/impor"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-soft-primary text-xs font-bold"
              >
                <i className="fa-solid fa-cloud-arrow-up" />
                <span>Impor dari Dapodik</span>
              </Link>
              <Link
                href="/admin/tahun-ajaran"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 transition"
              >
                <i className="fa-solid fa-copy" />
                <span>Salin Rombel Semester</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rombels.map((r) => (
              <div
                key={r.id}
                className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-teal-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 font-mono font-bold text-xs">
                    Tingkat {r.tingkat}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {r.kurikulum || "Kurikulum Merdeka"}
                  </span>
                </div>

                <h4 className="text-lg font-extrabold text-slate-800">Kelas {r.nama}</h4>

                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                  <p className="flex items-center justify-between">
                    <span>Wali Kelas:</span>
                    <strong className="text-slate-700">{r.waliKelas?.nama || "Belum Ditentukan"}</strong>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Jumlah Siswa:</span>
                    <strong className="font-mono text-blue-700">{r._count.anggota} Siswa</strong>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Mata Pelajaran:</span>
                    <strong className="font-mono text-purple-700">{r._count.pembelajaran} Mapel</strong>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
