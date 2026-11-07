"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tarikNilaiKhusus } from "@/server/actions/leger";

export interface LegerSiswaItem {
  id: string;
  nisn: string;
  nama: string;
  jenisKelamin: string;
  noAbsen: number | null;
}

export interface LegerPembelajaranItem {
  id: string;
  kktp: number | null;
  gtkNama?: string | null;
  mapel: {
    id: string;
    kode: string;
    nama: string;
    kelompok: string | null;
  };
}

export interface LegerRombelData {
  id: string;
  nama: string;
  tingkat: number;
  waliKelas?: {
    id: string;
    nama: string;
    nip: string | null;
  } | null;
  anggota: Array<{
    id: string;
    noAbsen: number | null;
    siswa: LegerSiswaItem;
  }>;
  pembelajaran: LegerPembelajaranItem[];
}

interface LegerClientProps {
  rombelList: Array<{ id: string; nama: string; tingkat: number }>;
  selectedRombelId: string;
  selectedRombel: LegerRombelData | null;
  nilaiMap: Record<string, number>; // key: `${siswaId}_${pembelajaranId}` -> score
  deskripsiMap?: Record<string, string>; // key: `${siswaId}_${pembelajaranId}` -> deskripsi TP
  isGuruMapel?: boolean;
  guruPembelajaranIds?: string[];
  initialPembelajaranId?: string;
  activeSemester: {
    id: string;
    tipe: string;
    tahunAjaran?: { nama: string };
  } | null;
  basePath: string; // "/admin/leger" | "/guru/leger"
}

export default function LegerClient({
  rombelList,
  selectedRombelId,
  selectedRombel,
  nilaiMap,
  deskripsiMap = {},
  isGuruMapel = false,
  guruPembelajaranIds = [],
  initialPembelajaranId,
  activeSemester,
  basePath,
}: LegerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentRombelId, setCurrentRombelId] = useState(selectedRombelId);
  const [selectedAgamaKode] = useState<string>("PAH");
  const [targetTarikMapel, setTargetTarikMapel] = useState<string>("BB");
  const [showTarikModal, setShowTarikModal] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const agamaOptions = [
    { kode: "PAH", nama: "Pendidikan Agama Hindu dan Budi Pekerti (PAH)" },
    { kode: "PAI", nama: "Pendidikan Agama Islam dan Budi Pekerti (PAI)" },
    { kode: "PAK", nama: "Pendidikan Agama Kristen dan Budi Pekerti (PAK)" },
    { kode: "PAKAT", nama: "Pendidikan Agama Katolik dan Budi Pekerti (PAKAT)" },
    { kode: "PABUD", nama: "Pendidikan Agama Buddha dan Budi Pekerti (PABUD)" },
    { kode: "PAB", nama: "Pendidikan Agama dan Budi Pekerti Umum (PAB)" },
  ];

  // Susun urutan kolom mapel sesuai spesifikasi:
  // 1. Pendidikan Agama (kiri PP)
  // 2. PP (Pendidikan Pancasila)
  // 3. BIND (Bahasa Indonesia)
  // 4. MTK (Matematika)
  // 5. IPAS (Ilmu Pengetahuan Alam dan Sosial)
  // 6. PJOK (kiri SB)
  // 7. SB (Seni dan Budaya)
  // 8. BING (Bahasa Inggris)
  // 9. MULOK / BB (kanan BING)
  const mapelOrderKeys = ["AGAMA", "PP", "BIND", "MTK", "IPAS", "PJOK", "SB", "BING", "MULOK"];

  const getMapelCategoryKey = (kode: string, nama: string = "") => {
    const k = kode.toUpperCase().trim();
    const nm = nama.toLowerCase();
    if (
      k.startsWith("PA") ||
      k === "PAB" ||
      k === "PAH" ||
      k === "PAI" ||
      k === "PAK" ||
      k === "PAKAT" ||
      k === "PABUD" ||
      nm.includes("agama")
    ) {
      return "AGAMA";
    }
    if (k === "PP") return "PP";
    if (k === "BIND") return "BIND";
    if (k === "MTK") return "MTK";
    if (k === "IPAS") return "IPAS";
    if (k === "PJOK" || nm.includes("jasmani")) return "PJOK";
    if (k === "SB") return "SB";
    if (k === "BING") return "BING";
    if (k === "MULOK" || k === "BB" || nm.includes("bahasa bali") || nm.includes("muatan lokal")) {
      return "MULOK";
    }
    return "OTHER";
  };

  const sortedPembelajaran = selectedRombel
    ? [...selectedRombel.pembelajaran].sort((a, b) => {
        const keyA = getMapelCategoryKey(a.mapel.kode, a.mapel.nama);
        const keyB = getMapelCategoryKey(b.mapel.kode, b.mapel.nama);
        const idxA = mapelOrderKeys.indexOf(keyA);
        const idxB = mapelOrderKeys.indexOf(keyB);
        const posA = idxA !== -1 ? idxA : 99;
        const posB = idxB !== -1 ? idxB : 99;
        if (posA !== posB) return posA - posB;
        return a.mapel.nama.localeCompare(b.mapel.nama);
      })
    : [];

  // Daftar mapel khusus milik Guru Mapel pada rombel terpilih
  const guruMapelOptions = isGuruMapel
    ? guruPembelajaranIds.length > 0
      ? sortedPembelajaran.filter((p) => guruPembelajaranIds.includes(p.id))
      : sortedPembelajaran
    : [];

  const [selectedGuruPembelajaranId, setSelectedGuruPembelajaranId] = useState<string>(
    initialPembelajaranId || guruMapelOptions[0]?.id || ""
  );

  const activeGuruPembelajaran =
    guruMapelOptions.find((p) => p.id === selectedGuruPembelajaranId) ||
    guruMapelOptions[0] ||
    null;

  // Hitung total dan rata-rata per siswa (Mode Leger Lengkap / Guru Kelas / Admin)
  const siswaStats = (selectedRombel?.anggota || []).map((agg) => {
    let total = 0;
    let count = 0;
    sortedPembelajaran.forEach((p) => {
      const val = nilaiMap[`${agg.siswa.id}_${p.id}`];
      if (val !== undefined && val !== null) {
        total += val;
        count++;
      }
    });
    const avg = count > 0 ? Math.round((total / count) * 10) / 10 : null;
    return {
      siswaId: agg.siswa.id,
      total: count > 0 ? Math.round(total * 10) / 10 : null,
      avg,
      count,
    };
  });

  // Ranking Mode Leger Lengkap (hanya siswa yang sudah memiliki nilai)
  const gradedMatrixStats = siswaStats
    .filter((s): s is { siswaId: string; total: number; avg: number; count: number } => s.avg !== null)
    .sort((a, b) => b.avg - a.avg);
  const rankMap = new Map<string, number>();
  gradedMatrixStats.forEach((s, idx) => {
    if (idx > 0 && s.avg === gradedMatrixStats[idx - 1].avg) {
      rankMap.set(s.siswaId, rankMap.get(gradedMatrixStats[idx - 1].siswaId) ?? idx + 1);
    } else {
      rankMap.set(s.siswaId, idx + 1);
    }
  });

  // Ranking Mode Guru Mapel (berdasarkan Nilai Akhir mata pelajaran yang diampu)
  const mapelRankMap = new Map<string, number>();
  if (isGuruMapel && activeGuruPembelajaran && selectedRombel) {
    const scoredList = selectedRombel.anggota
      .map((agg) => ({
        siswaId: agg.siswa.id,
        score: nilaiMap[`${agg.siswa.id}_${activeGuruPembelajaran.id}`],
      }))
      .filter((item): item is { siswaId: string; score: number } => item.score !== undefined)
      .sort((a, b) => b.score - a.score);

    scoredList.forEach((item, idx) => {
      if (idx > 0 && item.score === scoredList[idx - 1].score) {
        mapelRankMap.set(
          item.siswaId,
          mapelRankMap.get(scoredList[idx - 1].siswaId) ?? idx + 1
        );
      } else {
        mapelRankMap.set(item.siswaId, idx + 1);
      }
    });
  }

  // Handler Pilih Rombel
  const handleRombelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setCurrentRombelId(newId);
    router.push(`${basePath}?rombelId=${newId}`);
  };

  // Handler Tarik Nilai Khusus
  const handleExecuteTarikNilai = () => {
    if (!selectedRombel) return;
    startTransition(async () => {
      const res = await tarikNilaiKhusus(selectedRombel.id, targetTarikMapel);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setShowTarikModal(false);
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const excelExportHref = selectedRombel
    ? isGuruMapel && activeGuruPembelajaran
      ? `/api/admin/leger/excel?rombelId=${selectedRombel.id}&mode=mapel&pembelajaranId=${activeGuruPembelajaran.id}`
      : `/api/admin/leger/excel?rombelId=${selectedRombel.id}&agamaKode=${selectedAgamaKode}`
    : "#";

  const pdfExportHref = selectedRombel
    ? isGuruMapel && activeGuruPembelajaran
      ? `/api/admin/leger/pdf?rombelId=${selectedRombel.id}&mode=mapel&pembelajaranId=${activeGuruPembelajaran.id}`
      : `/api/admin/leger/pdf?rombelId=${selectedRombel.id}&agamaKode=${selectedAgamaKode}`
    : "#";

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-xs transition animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <i
              className={`fa-solid ${
                feedback.type === "success"
                  ? "fa-circle-check text-emerald-600"
                  : "fa-triangle-exclamation text-rose-600"
              } text-base shrink-0`}
            />
            <span className="text-xs font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] tracking-wider uppercase">
              {isGuruMapel ? "Leger Guru Mata Pelajaran" : "Buku Leger Nilai Rapor"}
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium font-mono">
              T.A. {activeSemester?.tahunAjaran?.nama ?? "2026/2027"} ({activeSemester?.tipe ?? "GANJIL"})
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            {isGuruMapel ? "Leger Nilai Kelas (Guru Mapel)" : "Leger Nilai Lengkap & Kelas"}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {isGuruMapel ? (
              <>
                Rekapitulasi nilai akhir mata pelajaran yang diampu beserta peringkat dan deskripsi
                ketercapaian Tujuan Pembelajaran (TP).
              </>
            ) : (
              <>
                Matriks rekapitulasi nilai akhir seluruh mata pelajaran per rombel kelas beserta
                peringkat. Tata letak kertas dioptimalkan untuk <b>F4 Landscape</b>.
              </>
            )}
          </p>
        </div>

        {/* ACTION BUTTONS (DOWNLOAD EXCEL / PDF & TARIK NILAI) */}
        {selectedRombel && (
          <div className="flex flex-wrap items-center gap-2">
            {!isGuruMapel && (
              <button
                type="button"
                onClick={() => setShowTarikModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer active:scale-95"
                title="Tarik Nilai Mulok (BB), PJOK, atau Pendidikan Agama"
              >
                <i className="fa-solid fa-bolt-lightning text-xs" />
                <span>Tarik Nilai Mapel Khusus</span>
              </button>
            )}

            <a
              href={excelExportHref}
              className="px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer active:scale-95"
              title="Unduh Leger format Excel (Kertas F4 Landscape Presisi)"
            >
              <i className="fa-solid fa-file-excel text-xs" />
              <span>Unduh Excel (F4)</span>
            </a>

            <a
              href={pdfExportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer active:scale-95"
              title="Cetak / Simpan ke PDF (Kertas F4 Landscape Presisi)"
            >
              <i className="fa-solid fa-file-pdf text-xs" />
              <span>Unduh PDF (F4)</span>
            </a>
          </div>
        )}
      </div>

      {/* FILTER ROMBEL & MAPEL INFO */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-700">Rombongan Belajar:</label>
          <select
            value={currentRombelId}
            onChange={handleRombelChange}
            className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
          >
            {rombelList.map((r) => (
              <option key={r.id} value={r.id}>
                Kelas {r.nama} (Tingkat {r.tingkat})
              </option>
            ))}
          </select>

          {isGuruMapel && guruMapelOptions.length > 1 && (
            <>
              <label className="text-xs font-bold text-slate-700 ml-1">Mata Pelajaran:</label>
              <select
                value={activeGuruPembelajaran?.id || ""}
                onChange={(e) => setSelectedGuruPembelajaranId(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
              >
                {guruMapelOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.mapel.nama} ({p.mapel.kode})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {selectedRombel && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
            {isGuruMapel && activeGuruPembelajaran ? (
              <>
                <span>
                  Mata Pelajaran:{" "}
                  <strong className="text-blue-700">
                    {activeGuruPembelajaran.mapel.nama} ({activeGuruPembelajaran.mapel.kode})
                  </strong>
                </span>
                <span>•</span>
                <span>
                  KKTP: <strong className="text-slate-800">{activeGuruPembelajaran.kktp || 75}</strong>
                </span>
                <span>•</span>
                <span>
                  Jumlah Siswa: <strong className="text-slate-800">{selectedRombel.anggota.length}</strong>
                </span>
              </>
            ) : (
              <>
                <span>
                  Wali Kelas:{" "}
                  <strong className="text-slate-800">{selectedRombel.waliKelas?.nama || "-"}</strong>
                </span>
                <span>•</span>
                <span>
                  Jumlah Siswa: <strong className="text-slate-800">{selectedRombel.anggota.length}</strong>
                </span>
                <span>•</span>
                <span>
                  Mata Pelajaran: <strong className="text-slate-800">{sortedPembelajaran.length}</strong>
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* TABEL LEGER */}
      {selectedRombel ? (
        isGuruMapel ? (
          /* =================================================================
             MODE KHUSUS GURU MAPEL:
             No | NISN | Nama Peserta Didik | L/P | Nilai (Nilai Akhir) | Rank | Deskripsi
             ================================================================= */
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-book-open-reader text-blue-600" />
                  <span>
                    Leger Nilai Kelas {selectedRombel.nama} •{" "}
                    {activeGuruPembelajaran
                      ? `${activeGuruPembelajaran.mapel.nama} (${activeGuruPembelajaran.mapel.kode})`
                      : "Belum Ada Mapel Diampu"}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Susunan Leger Guru Mapel: Nilai Akhir Rapor, Peringkat Kelas, serta Deskripsi TP
                  Tercapai &amp; TP Perlu Bimbingan.
                </p>
              </div>
              <span className="text-[11px] font-mono text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 self-start sm:self-auto">
                KKTP {activeGuruPembelajaran?.kktp || 75} • F4 Landscape
              </span>
            </div>

            {!activeGuruPembelajaran ? (
              <div className="p-12 text-center text-xs text-slate-500">
                Belum ada mata pelajaran yang ditugaskan kepada Anda pada rombel ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0f172a] text-white text-[10px] uppercase tracking-wider font-extrabold">
                      <th className="py-3.5 px-3 w-12 text-center border-r border-slate-700">No</th>
                      <th className="py-3.5 px-3 w-28 text-center border-r border-slate-700">NISN</th>
                      <th className="py-3.5 px-3 min-w-[200px] border-r border-slate-700 sticky left-0 bg-[#0f172a] z-10">
                        Nama Peserta Didik
                      </th>
                      <th className="py-3.5 px-2.5 w-14 text-center border-r border-slate-700">L/P</th>
                      <th className="py-3.5 px-3 w-28 text-center border-r border-slate-700 bg-blue-900 text-white font-mono">
                        <span className="block">Nilai</span>
                        <span className="text-[8px] font-normal text-blue-200 normal-case">
                          (Nilai Akhir)
                        </span>
                      </th>
                      <th className="py-3.5 px-3 w-20 text-center border-r border-slate-700 bg-amber-900 text-white font-mono">
                        Rank
                      </th>
                      <th className="py-3.5 px-4 min-w-[340px] text-left bg-slate-900 text-white">
                        <span className="block">Deskripsi</span>
                        <span className="text-[8px] font-normal text-slate-300 normal-case">
                          (TP Tercapai &amp; TP Perlu Bimbingan)
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {selectedRombel.anggota.map((agg, idx) => {
                      const key = `${agg.siswa.id}_${activeGuruPembelajaran.id}`;
                      const score = nilaiMap[key];
                      const kktp = activeGuruPembelajaran.kktp || 75;
                      const isTuntas = score !== undefined && score >= kktp;
                      const rank = mapelRankMap.get(agg.siswa.id);
                      const deskripsi = deskripsiMap[key];

                      return (
                        <tr key={agg.id} className="hover:bg-slate-50/80 transition align-top">
                          <td className="py-3 px-3 text-center font-bold text-slate-400 border-r border-slate-100">
                            {agg.noAbsen ?? idx + 1}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-500 border-r border-slate-100">
                            {agg.siswa.nisn}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800 border-r border-slate-100 sticky left-0 bg-white z-0">
                            {agg.siswa.nama}
                          </td>
                          <td className="py-3 px-2.5 text-center text-slate-600 border-r border-slate-100">
                            {agg.siswa.jenisKelamin}
                          </td>
                          <td
                            className={`py-3 px-3 text-center font-mono font-extrabold border-r border-slate-100 ${
                              score === undefined
                                ? "text-slate-300 bg-slate-50/30"
                                : isTuntas
                                ? "text-blue-700 bg-blue-50/30"
                                : "text-rose-600 bg-rose-50/40"
                            }`}
                          >
                            {score !== undefined ? score : "–"}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-black text-amber-700 bg-amber-50/40 border-r border-slate-100">
                            {rank !== undefined ? `#${rank}` : "–"}
                          </td>
                          <td className="py-3 px-4 text-xs leading-relaxed text-slate-700">
                            {deskripsi ? (
                              <span>{deskripsi}</span>
                            ) : (
                              <span className="text-slate-300 italic">
                                Belum ada deskripsi capaian (nilai belum diinput)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* =================================================================
             MODE LEGER LENGKAP (SUPERADMIN & GURU KELAS / WALI KELAS)
             ================================================================= */
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-table-list text-blue-600" />
                  <span>Leger Capaian Hasil Belajar • Kelas {selectedRombel.nama}</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Urutan mapel: Agama (kiri PP) → PP → BIND → MTK → IPAS → PJOK (kiri SB) → SB → BING
                  → Mulok BB (kanan BING).
                </p>
              </div>
              <span className="text-[11px] font-mono text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 self-start sm:self-auto">
                Kurikulum Merdeka • F4 Landscape
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0f172a] text-white text-[10px] uppercase tracking-wider font-extrabold">
                    <th className="py-3 px-3 w-10 text-center border-r border-slate-700">No</th>
                    <th className="py-3 px-3 w-28 text-center border-r border-slate-700">NISN</th>
                    <th className="py-3 px-3 min-w-[170px] border-r border-slate-700 sticky left-0 bg-[#0f172a] z-10">
                      Nama Peserta Didik
                    </th>
                    <th className="py-3 px-2 w-12 text-center border-r border-slate-700">L/P</th>

                    {/* DAFTAR MATA PELAJARAN DALAM URUTAN RESMI */}
                    {sortedPembelajaran.map((p) => {
                      const catKey = getMapelCategoryKey(p.mapel.kode, p.mapel.nama);
                      const isAgama = catKey === "AGAMA";
                      const isPjok = catKey === "PJOK";
                      const isMulok = catKey === "MULOK";

                      return (
                        <th
                          key={p.id}
                          className={`py-3 px-2.5 text-center border-r border-slate-700 ${
                            isAgama
                              ? "bg-emerald-950/80 text-emerald-300"
                              : isPjok
                              ? "bg-amber-950/80 text-amber-300"
                              : isMulok
                              ? "bg-purple-950/80 text-purple-300"
                              : ""
                          }`}
                          title={p.mapel.nama}
                        >
                          <span className="block font-black font-mono text-[11px]">
                            {p.mapel.kode}
                          </span>
                          <span className="text-[8px] font-mono text-slate-300 block">
                            KKTP {p.kktp || 75}
                          </span>
                        </th>
                      );
                    })}

                    <th className="py-3 px-3 text-center border-r border-slate-700 bg-blue-900 text-white font-mono">
                      Total
                    </th>
                    <th className="py-3 px-3 text-center border-r border-slate-700 bg-blue-900 text-white font-mono">
                      Rata²
                    </th>
                    <th className="py-3 px-3 text-center bg-amber-900 text-white font-mono">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {selectedRombel.anggota.map((agg, idx) => {
                    const stat = siswaStats.find((s) => s.siswaId === agg.siswa.id);
                    const rank = rankMap.get(agg.siswa.id);

                    return (
                      <tr key={agg.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400 border-r border-slate-100">
                          {agg.noAbsen ?? idx + 1}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500 border-r border-slate-100">
                          {agg.siswa.nisn}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-100 sticky left-0 bg-white z-0">
                          {agg.siswa.nama}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-600 border-r border-slate-100">
                          {agg.siswa.jenisKelamin}
                        </td>

                        {/* NILAI PER MATA PELAJARAN */}
                        {sortedPembelajaran.map((p) => {
                          const score = nilaiMap[`${agg.siswa.id}_${p.id}`];
                          const kktp = p.kktp || 75;
                          const isTuntas = score !== undefined && score >= kktp;

                          return (
                            <td
                              key={p.id}
                              className={`py-2.5 px-2 text-center font-mono font-bold border-r border-slate-100 ${
                                score === undefined
                                  ? "text-slate-300"
                                  : isTuntas
                                  ? "text-slate-700"
                                  : "text-rose-600 bg-rose-50/40"
                              }`}
                            >
                              {score !== undefined ? score : "–"}
                            </td>
                          );
                        })}

                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-100 bg-blue-50/25">
                          {stat?.total !== null && stat?.total !== undefined ? stat.total : "–"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-blue-700 border-r border-slate-100 bg-blue-50/40">
                          {stat?.avg !== null && stat?.avg !== undefined ? stat.avg : "–"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-amber-700 bg-amber-50/40">
                          {rank !== undefined ? `#${rank}` : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-12 text-center border border-slate-200/90 shadow-xs text-slate-400">
          <p className="text-xs font-bold text-slate-600">
            Pilih rombongan belajar untuk melihat leger nilai.
          </p>
        </div>
      )}

      {/* MODAL TARIK NILAI KHUSUS */}
      {showTarikModal && selectedRombel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-bolt-lightning" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Tarik Nilai Mapel Khusus</h3>
                  <p className="text-[11px] text-slate-400">Kelas {selectedRombel.nama}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTarikModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="space-y-3.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                Pilih mata pelajaran khusus yang ingin ditarik nilainya dari guru pengampu (Muatan
                Lokal Bahasa Bali kode <b>BB</b>, PJOK, atau Pendidikan Agama).
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mata Pelajaran yang Ditarik:
                </label>
                <select
                  value={targetTarikMapel}
                  onChange={(e) => setTargetTarikMapel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer shadow-xs"
                >
                  <optgroup label="Mata Pelajaran Khusus & Muatan Lokal">
                    <option value="BB">Muatan Lokal - Bahasa Bali (BB)</option>
                    <option value="PJOK">Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)</option>
                  </optgroup>
                  <optgroup label="Pendidikan Agama (5 Pilihan Mapel)">
                    {agamaOptions.map((a) => (
                      <option key={a.kode} value={a.kode}>
                        {a.nama}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-info text-amber-600" />
                  <span>Posisi Kolom Leger:</span>
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[10px] text-amber-800">
                  <li>
                    Pendidikan Agama diletakkan di <b>kiri mapel PP</b>
                  </li>
                  <li>
                    PJOK diletakkan di <b>kiri mapel SB</b>
                  </li>
                  <li>
                    Mulok Bahasa Bali (BB) diletakkan di <b>kanan mapel BING</b>
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTarikModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTarikNilai}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <i className={`fa-solid ${isPending ? "fa-spinner fa-spin" : "fa-bolt-lightning"}`} />
                  <span>Tarik Nilai Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
