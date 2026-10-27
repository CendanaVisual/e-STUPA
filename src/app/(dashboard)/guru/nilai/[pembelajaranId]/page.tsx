import { requireRole } from "@/lib/auth/session";
import { assertPembelajaranAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import {
  simpanNilaiBatch,
  tambahKolomPenilaian,
  generateDefaultPenilaian,
} from "@/server/actions/penilaian";

export default async function InputNilaiPage({
  params,
}: {
  params: Promise<{ pembelajaranId: string }>;
}) {
  const { pembelajaranId } = await params;
  const session = await requireRole("GURU");
  try {
    await assertPembelajaranAccess(session, pembelajaranId);
  } catch {
    notFound();
  }

  const p = await db.pembelajaran.findUnique({
    where: { id: pembelajaranId },
    include: {
      mapel: true,
      semester: { include: { tahunAjaran: true } },
      penilaian: { orderBy: [{ kategori: "asc" }, { urutan: "asc" }] },
      rombel: {
        include: {
          anggota: {
            include: { siswa: true },
            orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
          },
        },
      },
      nilaiRapor: true,
    },
  });

  if (!p) {
    notFound();
  }

  const penilaianList = p.penilaian;

  const allNilai = await db.nilai.findMany({
    where: { penilaianId: { in: penilaianList.map((k) => k.id) } },
  });

  const nilaiMap = new Map<string, number>();
  allNilai.forEach((n) => {
    if (n.nilai !== null) {
      nilaiMap.set(`${n.penilaianId}_${n.siswaId}`, Number(n.nilai));
    }
  });

  const nilaiRaporMap = new Map(p.nilaiRapor.map((nr) => [nr.siswaId, nr]));

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] tracking-wider uppercase">
              Penilaian Akademik
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {p.semester.tahunAjaran.nama} {p.semester.tipe}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {p.mapel.nama} — {p.rombel.nama}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Bobot Asesmen: Formatif {p.bobotHarian}% • STS {p.bobotUts}% • SAS {p.bobotUas}% • KKTP {p.kktp ?? 75}
            {p.semester.status !== "AKTIF" && " • 🔒 Semester dikunci (read-only)"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`/api/guru/ekspor/${p.id}`}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-file-excel text-sm" />
            <span>Unduh Format E-Rapor (4 Sheet)</span>
          </a>
        </div>
      </div>

      {/* FORM TAMBAH KOLOM TP BARU */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <form action={tambahKolomPenilaian} className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <input type="hidden" name="pembelajaranId" value={p.id} />
          <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <i className="fa-solid fa-plus-circle text-blue-600" />
            Tambah Kolom Asesmen:
          </span>
          <select
            name="kategori"
            className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700"
          >
            <option value="HARIAN">Formatif / TP</option>
            <option value="UTS">STS (Tengah Semester)</option>
            <option value="UAS">SAS (Akhir Semester)</option>
          </select>
          <input
            type="text"
            name="nama"
            required
            placeholder="Nama kolom, mis. TP 3"
            className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition cursor-pointer"
          >
            Tambah Kolom
          </button>
        </form>

        {penilaianList.length === 0 && (
          <form action={generateDefaultPenilaian}>
            <input type="hidden" name="pembelajaranId" value={p.id} />
            <button
              type="submit"
              className="py-1.5 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-xs" />
              <span>Buat Kolom Standar (TP 1, TP 2, STS, SAS)</span>
            </button>
          </form>
        )}

        <div className="text-xs text-slate-500 font-medium">
          Total: <span className="font-bold text-slate-800">{p.rombel.anggota.length} Siswa</span> •{" "}
          <span className="font-bold text-slate-800">{penilaianList.length} Kolom Penilaian</span>
        </div>
      </div>

      {/* GRID INPUT NILAI INTERAKTIF */}
      <form action={simpanNilaiBatch} className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <input type="hidden" name="pembelajaranId" value={p.id} />

        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">Lembar Penilaian Siswa</h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Ketik nilai (0–100) langsung pada sel, lalu klik tombol simpan untuk mengalkulasi nilai akhir rapor secara otomatis.
            </p>
          </div>
          <button
            type="submit"
            className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white text-xs font-bold shadow-md shadow-blue-500/15 transition cursor-pointer"
          >
            Simpan Seluruh Nilai
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                <th className="py-3 px-3 w-10 text-center border-r border-slate-200">No</th>
                <th className="py-3 px-3 w-28 border-r border-slate-200">NISN</th>
                <th className="py-3 px-3 min-w-[170px] border-r border-slate-200 sticky left-0 bg-slate-50/90">
                  Nama Siswa
                </th>
                {penilaianList.map((k) => (
                  <th key={k.id} className="py-3 px-2 text-center border-r border-slate-200 min-w-[75px]" title={k.tujuanPembelajaran || k.nama}>
                    <span className="block font-bold">{k.nama}</span>
                    <span className="text-[8px] font-mono text-slate-400 block">{k.kategori}</span>
                  </th>
                ))}
                <th className="py-3 px-3 text-center border-r border-slate-200 bg-blue-50/50 text-blue-800">
                  Rata TP
                </th>
                <th className="py-3 px-3 text-center border-r border-slate-200 bg-blue-50/50 text-blue-800">
                  Nilai Akhir
                </th>
                <th className="py-3 px-3 text-center bg-teal-50/50 text-teal-800">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {p.rombel.anggota.map((agg, idx) => {
                const nr = nilaiRaporMap.get(agg.siswaId);
                const na = nr?.nilaiAkhir !== null && nr?.nilaiAkhir !== undefined ? Number(nr.nilaiAkhir) : null;
                const kktp = p.kktp ?? 75;
                const isTuntas = na !== null && na >= kktp;

                return (
                  <tr key={agg.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-400 border-r border-slate-100">
                      {agg.noAbsen ?? idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 border-r border-slate-100">
                      {agg.siswa.nisn}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-100 sticky left-0 bg-white">
                      {agg.siswa.nama}
                    </td>
                    {penilaianList.map((k) => {
                      const curVal = nilaiMap.get(`${k.id}_${agg.siswaId}`);
                      return (
                        <td key={k.id} className="p-1 border-r border-slate-100 text-center">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            name={`nilai_${k.id}_${agg.siswaId}`}
                            defaultValue={curVal !== undefined ? curVal : ""}
                            className="w-14 text-center py-1 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs font-bold text-slate-800"
                          />
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-100 bg-blue-50/20">
                      {nr?.rataHarian !== null && nr?.rataHarian !== undefined ? Number(nr.rataHarian) : "–"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-extrabold text-blue-700 border-r border-slate-100 bg-blue-50/30">
                      {na !== null ? na : "–"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {na !== null ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            isTuntas
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isTuntas ? "Tuntas" : "Remedial"}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
