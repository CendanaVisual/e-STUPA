import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getFaseByTingkat } from "@/lib/grading/calc";

export default async function GuruEksporPage() {
  const session = await requireRole("GURU");

  const list = session.gtkId
    ? await db.pembelajaran.findMany({
        where: { gtkId: session.gtkId, semester: { isAktif: true } },
        include: {
          mapel: true,
          rombel: {
            include: {
              _count: { select: { anggota: true } },
            },
          },
          penilaian: {
            include: {
              _count: { select: { nilai: true } },
            },
          },
          nilaiRapor: {
            where: { nilaiAkhir: { not: null } },
            select: { siswaId: true },
          },
        },
        orderBy: [{ rombel: { tingkat: "asc" } }, { rombel: { nama: "asc" } }],
      })
    : [];

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    select: { id: true },
  });

  const tpCountsRaw =
    activeSemester && list.length > 0
      ? await db.tujuanPembelajaran.groupBy({
          by: ["tingkat", "mapelId"],
          where: { semesterId: activeSemester.id },
          _count: { _all: true },
        })
      : [];

  const tpCountMap = new Map<string, number>();
  tpCountsRaw.forEach((row) => {
    tpCountMap.set(`${row.tingkat}_${row.mapelId}`, row._count._all);
  });

  return (
    <div className="space-y-6">
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <i className="fa-solid fa-file-export mr-1" />
            Format Ekspor Realtime E-Rapor Kurikulum Merdeka
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Ekspor Daftar Nilai E-Rapor
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            Unduh berkas Excel (.xlsx) 4 sheet sesuai data aktual kelas dan tingkat Anda (Format
            Ekspor E-Rapor dengan penanda TP Tertinggi <b>&quot;T&quot;</b> &amp; Terendah{" "}
            <b>&quot;R&quot;</b>, Olah Nilai Rinci, Pengaturan TP &amp; Bobot otomatis dari menu
            Tujuan Pembelajaran, serta Statistik Analisis). Sel yang belum diinput nilainya akan
            dibiarkan kosong tanpa angka otomatis.
          </p>
        </div>
      </div>

      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80">
        <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-download text-emerald-600" />
          <span>Unduh Berkas E-Rapor Realtime per Kelas</span>
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
                  <th className="py-3.5 px-4">Kelas / Fase</th>
                  <th className="py-3.5 px-4">Mata Pelajaran</th>
                  <th className="py-3.5 px-4 text-center">Pemetaan TP &amp; Kolom</th>
                  <th className="py-3.5 px-4 text-center">Status Data Realtime</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((p) => {
                  const totalSiswa = p.rombel._count.anggota;
                  const terisiCount = p.nilaiRapor.length;
                  const masterTpCount = tpCountMap.get(`${p.rombel.tingkat}_${p.mapelId}`) ?? 0;
                  const kolomCount = p.penilaian.length;
                  const fase = getFaseByTingkat(p.rombel.tingkat);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 block">
                          Kelas {p.rombel.nama}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Tingkat {p.rombel.tingkat} • {fase} • {totalSiswa} Siswa
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-blue-700 block">{p.mapel.nama}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Kode: {p.mapel.kode} • KKTP {p.kktp ?? 75}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-wrap items-center justify-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px] font-bold">
                            {masterTpCount} TP Terdaftar
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold">
                            {kolomCount} Kolom Asesmen
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {terisiCount === 0 ? (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                            Belum Ada Nilai (Kosong)
                          </span>
                        ) : terisiCount >= totalSiswa && totalSiswa > 0 ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            Lengkap ({terisiCount}/{totalSiswa} Siswa)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            Terisi {terisiCount}/{totalSiswa} Siswa
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/guru/nilai/${p.id}`}
                            className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                            <span>Input Nilai</span>
                          </Link>
                          <a
                            href={`/api/guru/ekspor/${p.id}`}
                            className="py-2 px-4 rounded-xl btn-soft-emerald text-xs font-bold inline-flex items-center gap-2 shadow-xs"
                          >
                            <i className="fa-solid fa-cloud-arrow-down" />
                            <span>Unduh Format E-Rapor</span>
                          </a>
                        </div>
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
