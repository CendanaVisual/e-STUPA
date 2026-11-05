"use client";

import React, { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { simpanPresensiKelasBatch } from "@/server/actions/presensi";

export interface SiswaAnggota {
  id: string;
  noAbsen: number | null;
  siswaId: string;
  siswa: {
    id: string;
    nisn: string;
    nama: string;
    jenisKelamin: string;
  };
}

export interface SelectedRombelData {
  id: string;
  nama: string;
  tingkat: number;
  waliKelas?: {
    id: string;
    nama: string;
    nip: string | null;
  } | null;
  anggota: SiswaAnggota[];
}

export interface PresensiItem {
  siswaId: string;
  status: "HADIR" | "SAKIT" | "IZIN" | "ALPA";
  keterangan: string | null;
}

export interface RekapPresensiItem {
  siswaId: string;
  status: "HADIR" | "SAKIT" | "IZIN" | "ALPA";
  tanggal: string | Date;
}

interface PresensiClientProps {
  rombelList: Array<{ id: string; nama: string; tingkat: number }>;
  selectedRombelId: string;
  selectedDateStr: string;
  selectedDateFormatted: string;
  selectedRombel: SelectedRombelData | null;
  initialPresensiList: PresensiItem[];
  rekapPresensiList: RekapPresensiItem[];
  activeSemester: {
    id: string;
    tipe: string;
    tahunAjaran?: { nama: string };
  } | null;
  basePath: string; // "/admin/presensi" | "/guru/presensi"
  guruNama?: string | null;
}

export default function PresensiClient({
  rombelList,
  selectedRombelId,
  selectedDateStr,
  selectedDateFormatted,
  selectedRombel,
  initialPresensiList,
  rekapPresensiList,
  activeSemester,
  basePath,
  guruNama,
}: PresensiClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // Modal Rekap State
  const [showRekapModal, setShowRekapModal] = useState(false);

  // Date & Rombel Filter State
  const [currentDate, setCurrentDate] = useState(selectedDateStr);
  const [currentRombelId, setCurrentRombelId] = useState(selectedRombelId);

  // Status Kehadiran State per Siswa (Reactive Client-side State)
  const [statuses, setStatuses] = useState<Record<string, "HADIR" | "SAKIT" | "IZIN" | "ALPA">>(() => {
    const map: Record<string, "HADIR" | "SAKIT" | "IZIN" | "ALPA"> = {};
    if (selectedRombel) {
      const presensiMap = new Map(initialPresensiList.map((p) => [p.siswaId, p.status]));
      selectedRombel.anggota.forEach((agg) => {
        map[agg.siswaId] = presensiMap.get(agg.siswaId) || "HADIR";
      });
    }
    return map;
  });

  // Keterangan State per Siswa
  const [keterangans, setKeterangans] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (selectedRombel) {
      const presensiMap = new Map(initialPresensiList.map((p) => [p.siswaId, p.keterangan || ""]));
      selectedRombel.anggota.forEach((agg) => {
        map[agg.siswaId] = presensiMap.get(agg.siswaId) || "";
      });
    }
    return map;
  });

  // Update status function
  const handleStatusChange = (siswaId: string, newStatus: "HADIR" | "SAKIT" | "IZIN" | "ALPA") => {
    setStatuses((prev) => ({
      ...prev,
      [siswaId]: newStatus,
    }));
  };

  // Mark all present helper
  const handleMarkAllHadir = () => {
    if (!selectedRombel) return;
    const next: Record<string, "HADIR" | "SAKIT" | "IZIN" | "ALPA"> = {};
    selectedRombel.anggota.forEach((agg) => {
      next[agg.siswaId] = "HADIR";
    });
    setStatuses(next);
  };

  // Live Summary Counts
  const totalSiswa = selectedRombel?.anggota.length || 0;
  const { countH, countS, countI, countA } = useMemo(() => {
    let h = 0;
    let s = 0;
    let i = 0;
    let a = 0;
    if (selectedRombel) {
      selectedRombel.anggota.forEach((agg) => {
        const st = statuses[agg.siswaId] || "HADIR";
        if (st === "HADIR") h++;
        else if (st === "SAKIT") s++;
        else if (st === "IZIN") i++;
        else if (st === "ALPA") a++;
      });
    }
    return { countH: h, countS: s, countI: i, countA: a };
  }, [selectedRombel, statuses]);

  const persenHadir = totalSiswa > 0 ? Math.round((countH / totalSiswa) * 100) : 0;

  // Refresh Halaman Action (Requirement 1: Perbaiki tombol refresh)
  const handleRefresh = () => {
    setIsRefreshing(true);
    startTransition(() => {
      router.refresh();
      setTimeout(() => setIsRefreshing(false), 600);
    });
  };

  // Filter Form Submit
  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`${basePath}?rombelId=${currentRombelId}&date=${currentDate}`);
  };

  // Form Simpan Presensi Submit
  const handleSavePresensi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRombel) return;

    const formData = new FormData();
    formData.set("rombelId", selectedRombel.id);
    formData.set("tanggal", currentDate);

    selectedRombel.anggota.forEach((agg) => {
      formData.set(`status_${agg.siswaId}`, statuses[agg.siswaId] || "HADIR");
      formData.set(`ket_${agg.siswaId}`, keterangans[agg.siswaId] || "");
    });

    startTransition(async () => {
      try {
        await simpanPresensiKelasBatch(formData);
        setFeedback({
          type: "success",
          message: `Absensi Kelas ${selectedRombel.nama} tanggal ${currentDate} berhasil disimpan ke database!`,
        });
        router.refresh();
      } catch (err: unknown) {
        setFeedback({
          type: "error",
          message: err instanceof Error ? err.message : "Gagal menyimpan data absensi.",
        });
      }
    });
  };

  // Rekap Stats Calculation
  const rekapData = useMemo(() => {
    if (!selectedRombel) return [];

    const statsMap = new Map<string, { hadir: number; sakit: number; izin: number; alpa: number }>();
    selectedRombel.anggota.forEach((agg) => {
      statsMap.set(agg.siswaId, { hadir: 0, sakit: 0, izin: 0, alpa: 0 });
    });

    rekapPresensiList.forEach((p) => {
      const stats = statsMap.get(p.siswaId);
      if (stats) {
        if (p.status === "HADIR") stats.hadir++;
        else if (p.status === "SAKIT") stats.sakit++;
        else if (p.status === "IZIN") stats.izin++;
        else if (p.status === "ALPA") stats.alpa++;
      }
    });

    return selectedRombel.anggota.map((agg, idx) => {
      const st = statsMap.get(agg.siswaId) || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
      const totalHari = st.hadir + st.sakit + st.izin + st.alpa;
      const persen = totalHari > 0 ? Math.round((st.hadir / totalHari) * 100) : 100;
      return {
        no: agg.noAbsen || idx + 1,
        siswaId: agg.siswaId,
        nisn: agg.siswa.nisn,
        nama: agg.siswa.nama,
        jenisKelamin: agg.siswa.jenisKelamin,
        hadir: st.hadir,
        sakit: st.sakit,
        izin: st.izin,
        alpa: st.alpa,
        totalHari,
        persen,
      };
    });
  }, [selectedRombel, rekapPresensiList]);

  const { totalRekapHadir, totalRekapSakit, totalRekapIzin, totalRekapAlpa, totalRekapHari, persenRataRataRekap } =
    useMemo(() => {
      let h = 0,
        s = 0,
        i = 0,
        a = 0;
      rekapData.forEach((item) => {
        h += item.hadir;
        s += item.sakit;
        i += item.izin;
        a += item.alpa;
      });
      const totalSemua = h + s + i + a;
      const persen = totalSemua > 0 ? Math.round((h / totalSemua) * 100) : 100;
      return {
        totalRekapHadir: h,
        totalRekapSakit: s,
        totalRekapIzin: i,
        totalRekapAlpa: a,
        totalRekapHari: totalSemua,
        persenRataRataRekap: persen,
      };
    }, [rekapData]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
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
                feedback.type === "success" ? "fa-circle-check text-emerald-600" : "fa-triangle-exclamation text-rose-600"
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

      {/* TOP HEADER (Requirement 1: Hilangkan tombol logout, perbaiki refresh) */}
      {/* (Requirement 3: Tombol Rekap Absensi Siswa di sebelah kiri refresh) */}
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#00bcd4] tracking-tight">
            Absensi Siswa
          </h1>
          {guruNama && (
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Guru: <span className="font-bold text-slate-600">{guruNama}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* TOMBOL ACTION REKAP ABSENSI SISWA (DI SEBELAH KIRI REFRESH) */}
          <button
            type="button"
            onClick={() => setShowRekapModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer active:scale-95"
            title="Lihat Rekapitulasi Kehadiran Keseluruhan"
          >
            <i className="fa-solid fa-chart-pie text-xs" />
            <span>Rekap Absensi Siswa</span>
          </button>

          {/* TOMBOL REFRESH HALAMAN (DIPERBAIKI) */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isPending}
            className="p-2.5 rounded-xl text-slate-600 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 transition cursor-pointer disabled:opacity-50"
            title="Muat Ulang / Refresh Data"
          >
            <i className={`fa-solid fa-rotate-right text-xs ${isRefreshing ? "fa-spin text-cyan-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* MAIN CARD: INPUT ABSENSI */}
      <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 bg-white">
        {/* DARK NAVY HEADER */}
        <div className="bg-[#0f172a] text-white px-5 py-3.5 font-black text-sm flex items-center justify-between tracking-wide">
          <span>Input Absensi Harian</span>
          <span className="text-xs font-semibold text-slate-400">
            {selectedDateFormatted}
          </span>
        </div>

        {/* CARD BODY */}
        <div className="p-5 md:p-6 space-y-4">
          {/* FILTER ROW */}
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 shadow-xs"
              />
            </div>

            <div className="min-w-[200px] flex-1 sm:flex-initial">
              <select
                value={currentRombelId}
                onChange={(e) => setCurrentRombelId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 shadow-xs cursor-pointer"
              >
                <option value="">-- Pilih Kelas --</option>
                {rombelList.map((r) => (
                  <option key={r.id} value={r.id}>
                    Kelas {r.nama} (Tingkat {r.tingkat})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#00bcd4] hover:bg-[#00acc1] text-white font-black text-xs shadow-md shadow-cyan-500/20 flex items-center gap-2 transition cursor-pointer active:scale-95"
            >
              <i className="fa-solid fa-magnifying-glass text-xs" />
              <span>Tampilkan</span>
            </button>

            {selectedRombel && totalSiswa > 0 && (
              <button
                type="button"
                onClick={handleMarkAllHadir}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ml-auto active:scale-95"
                title="Tandai semua siswa berstatus Hadir"
              >
                <i className="fa-solid fa-check-double text-xs" />
                <span>Semua Hadir</span>
              </button>
            )}
          </form>

          {/* LEGEND BADGES & LIVE REALTIME COUNTS */}
          <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
            <span className="px-3 py-1 rounded-lg text-xs font-black bg-[#10b981] text-white shadow-xs">
              H=Hadir
            </span>
            <span className="px-3 py-1 rounded-lg text-xs font-black bg-[#f59e0b] text-white shadow-xs">
              S=Sakit
            </span>
            <span className="px-3 py-1 rounded-lg text-xs font-black bg-[#00bcd4] text-white shadow-xs">
              I=Izin
            </span>
            <span className="px-3 py-1 rounded-lg text-xs font-black bg-[#e11d48] text-white shadow-xs">
              A=Alfa
            </span>

            {totalSiswa > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-bold text-slate-500 pt-1 sm:pt-0">
                <span>
                  Total: <strong className="text-slate-800">{totalSiswa} Siswa</strong>
                </span>
                <span>•</span>
                <span>
                  Hadir: <strong className="text-emerald-600">{countH}</strong> ({persenHadir}%)
                </span>
                <span>•</span>
                <span>
                  Sakit: <strong className="text-amber-600">{countS}</strong>
                </span>
                <span>•</span>
                <span>
                  Izin: <strong className="text-cyan-600">{countI}</strong>
                </span>
                <span>•</span>
                <span>
                  Alfa: <strong className="text-rose-600">{countA}</strong>
                </span>
              </div>
            )}
          </div>

          {/* CONTENT SECTION */}
          {!selectedRombel ? (
            <div className="py-16 text-center text-slate-400 font-bold space-y-1">
              <i className="fa-solid fa-users-viewfinder text-3xl text-slate-300 mb-2 block" />
              <p>Pilih kelas dan klik tombol &quot;Tampilkan&quot; untuk menginput atau melihat absensi.</p>
            </div>
          ) : totalSiswa === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-slate-100">
              Belum ada siswa yang terdaftar di Kelas {selectedRombel.nama}.
            </div>
          ) : (
            <form onSubmit={handleSavePresensi} className="space-y-4 pt-2">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-3.5 text-center w-12">No</th>
                      <th className="py-3 px-3.5 w-32">NISN</th>
                      <th className="py-3 px-3.5">Nama Siswa</th>
                      <th className="py-3 px-3.5 text-center w-64">Status Kehadiran</th>
                      <th className="py-3 px-3.5 w-64">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRombel.anggota.map((agg, idx) => {
                      const currentStatus = statuses[agg.siswaId] || "HADIR";
                      const currentKet = keterangans[agg.siswaId] ?? "";

                      return (
                        <tr key={agg.siswaId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                            {agg.noAbsen || idx + 1}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-500">{agg.siswa.nisn}</td>
                          <td className="py-3 px-3.5 font-bold text-slate-800">{agg.siswa.nama}</td>

                          {/* TOMBOL STATUS KEHADIRAN (Requirement 2: Warna langsung berubah sesuai masing-masing icon saat diklik) */}
                          <td className="py-3 px-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
                              {/* TOMBOL H (HADIR) -> EMERALD */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(agg.siswaId, "HADIR")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition select-none ${
                                  currentStatus === "HADIR"
                                    ? "bg-[#10b981] text-white shadow-xs"
                                    : "text-slate-600 hover:bg-slate-200/80"
                                }`}
                              >
                                H
                              </button>

                              {/* TOMBOL S (SAKIT) -> AMBER */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(agg.siswaId, "SAKIT")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition select-none ${
                                  currentStatus === "SAKIT"
                                    ? "bg-[#f59e0b] text-white shadow-xs"
                                    : "text-slate-600 hover:bg-slate-200/80"
                                }`}
                              >
                                S
                              </button>

                              {/* TOMBOL I (IZIN) -> CYAN */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(agg.siswaId, "IZIN")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition select-none ${
                                  currentStatus === "IZIN"
                                    ? "bg-[#00bcd4] text-white shadow-xs"
                                    : "text-slate-600 hover:bg-slate-200/80"
                                }`}
                              >
                                I
                              </button>

                              {/* TOMBOL A (ALFA) -> ROSE */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(agg.siswaId, "ALPA")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition select-none ${
                                  currentStatus === "ALPA"
                                    ? "bg-[#e11d48] text-white shadow-xs"
                                    : "text-slate-600 hover:bg-slate-200/80"
                                }`}
                              >
                                A
                              </button>
                            </div>
                          </td>

                          {/* KETERANGAN */}
                          <td className="py-3 px-3.5">
                            <input
                              type="text"
                              value={currentKet}
                              onChange={(e) =>
                                setKeterangans((prev) => ({
                                  ...prev,
                                  [agg.siswaId]: e.target.value,
                                }))
                              }
                              placeholder="Keterangan sakit/izin..."
                              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:bg-white"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-400 font-medium italic">
                  Klik tombol H, S, I, atau A untuk mengubah status kehadiran siswa secara langsung.
                </span>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-[#00bcd4] hover:bg-[#00acc1] text-white font-black text-xs shadow-md shadow-cyan-500/25 flex items-center gap-2 transition cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <i className={`fa-solid ${isPending ? "fa-spinner fa-spin" : "fa-floppy-disk"} text-xs`} />
                  <span>Simpan Absensi Kelas</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* MODAL REKAPITULASI ABSENSI SISWA (Requirement 3 & 4) */}
      {showRekapModal && selectedRombel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-lg font-bold">
                  <i className="fa-solid fa-chart-pie" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    Rekapitulasi Presensi Siswa • Kelas {selectedRombel.nama}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tahun Ajaran {activeSemester?.tahunAjaran?.nama || "2026/2027"} • Semester{" "}
                    {activeSemester?.tipe || "Ganjil"} • Wali Kelas:{" "}
                    {selectedRombel.waliKelas?.nama || "Belum Ditentukan"}
                  </p>
                </div>
              </div>

              {/* ACTION DOWNLOAD REKAP (Requirement 4: Pilihan download PDF / Excel) */}
              <div className="flex items-center gap-2">
                {/* DOWNLOAD EXCEL */}
                <a
                  href={`/api/presensi/rekap/excel?rombelId=${selectedRombel.id}`}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                  title="Unduh format spreadsheet .xlsx"
                >
                  <i className="fa-solid fa-file-excel" />
                  <span>Unduh Excel</span>
                </a>

                {/* DOWNLOAD / CETAK PDF */}
                <a
                  href={`/api/presensi/rekap/pdf?rombelId=${selectedRombel.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                  title="Buka Lembar Cetak / Simpan ke PDF"
                >
                  <i className="fa-solid fa-file-pdf" />
                  <span>Unduh PDF</span>
                </a>

                {/* CLOSE MODAL BUTTON */}
                <button
                  type="button"
                  onClick={() => setShowRekapModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer ml-1"
                >
                  <i className="fa-solid fa-xmark text-base" />
                </button>
              </div>
            </div>

            {/* Modal Body with Scroll */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Siswa</span>
                  <p className="text-lg font-black text-slate-800 font-mono mt-0.5">{totalSiswa}</p>
                </div>
                <div className="bg-emerald-50/60 rounded-2xl p-3 border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Total Hadir</span>
                  <p className="text-lg font-black text-emerald-800 font-mono mt-0.5">{totalRekapHadir}</p>
                </div>
                <div className="bg-amber-50/60 rounded-2xl p-3 border border-amber-200/80">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Total Sakit</span>
                  <p className="text-lg font-black text-amber-800 font-mono mt-0.5">{totalRekapSakit}</p>
                </div>
                <div className="bg-cyan-50/60 rounded-2xl p-3 border border-cyan-200/80">
                  <span className="text-[10px] font-bold text-cyan-700 uppercase">Total Izin</span>
                  <p className="text-lg font-black text-cyan-800 font-mono mt-0.5">{totalRekapIzin}</p>
                </div>
                <div className="bg-rose-50/60 rounded-2xl p-3 border border-rose-200/80 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Total Alfa</span>
                  <p className="text-lg font-black text-rose-800 font-mono mt-0.5">{totalRekapAlpa}</p>
                </div>
              </div>

              {/* Table Rekapitulasi */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-wider">
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3 w-28">NISN</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3 text-center w-12">L/P</th>
                      <th className="py-2.5 px-3 text-center w-16">Hadir</th>
                      <th className="py-2.5 px-3 text-center w-16">Sakit</th>
                      <th className="py-2.5 px-3 text-center w-16">Izin</th>
                      <th className="py-2.5 px-3 text-center w-16">Alfa</th>
                      <th className="py-2.5 px-3 text-center w-20">Total Hari</th>
                      <th className="py-2.5 px-3 text-center w-24">% Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rekapData.map((row) => (
                      <tr key={row.siswaId} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{row.no}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{row.nisn}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{row.nama}</td>
                        <td className="py-2.5 px-3 text-center">{row.jenisKelamin}</td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono text-emerald-600">
                          {row.hadir}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono text-amber-600">
                          {row.sakit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono text-cyan-600">
                          {row.izin}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono text-rose-600">
                          {row.alpa}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-700">
                          {row.totalHari}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                              row.persen >= 90
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : row.persen >= 75
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {row.persen}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/90 font-black text-slate-800 border-t-2 border-slate-300">
                      <td colSpan={4} className="py-2.5 px-3 text-center">
                        TOTAL KELAS
                      </td>
                      <td className="py-2.5 px-3 text-center text-emerald-700 font-mono">
                        {totalRekapHadir}
                      </td>
                      <td className="py-2.5 px-3 text-center text-amber-700 font-mono">
                        {totalRekapSakit}
                      </td>
                      <td className="py-2.5 px-3 text-center text-cyan-700 font-mono">
                        {totalRekapIzin}
                      </td>
                      <td className="py-2.5 px-3 text-center text-rose-700 font-mono">
                        {totalRekapAlpa}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">{totalRekapHari}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-emerald-800">
                        {persenRataRataRekap}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
              <span className="text-xs text-slate-400">
                Data rekapitulasi dihitung berdasarkan seluruh hari kehadiran aktif semester ini.
              </span>
              <button
                type="button"
                onClick={() => setShowRekapModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
