"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  aktifkanSemesterAction,
  kunciSemesterAction,
  bukaKunciSemesterAction,
  salinStrukturSemesterAction,
  tambahTahunAjaranAction,
  hapusTahunAjaranAction,
} from "@/server/actions/tahun-ajaran";

export interface SemesterItem {
  id: string;
  tipe: "GANJIL" | "GENAP";
  kode: string;
  status: "DRAFT" | "AKTIF" | "DIKUNCI" | "ARSIP";
  isAktif: boolean;
  dikunciPada: string | null;
  counts: {
    rombel: number;
    pembelajaran: number;
    tujuanPembelajaran: number;
    arsipNilai: number;
  };
}

export interface TahunAjaranItem {
  id: string;
  nama: string;
  tahunMulai: number;
  isAktif: boolean;
  semester: SemesterItem[];
}

interface TahunAjaranClientProps {
  initialTahunAjarans: TahunAjaranItem[];
}

export default function TahunAjaranClient({
  initialTahunAjarans,
}: TahunAjaranClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form state untuk Tambah Tahun Ajaran
  const nextYear =
    initialTahunAjarans.length > 0
      ? Math.max(...initialTahunAjarans.map((t) => t.tahunMulai)) + 1
      : 2027;

  const [tahunMulai, setTahunMulai] = useState<number>(nextYear);
  const [namaTa, setNamaTa] = useState<string>(`${nextYear}/${nextYear + 1}`);
  const [salinSaatAktifkan, setSalinSaatAktifkan] = useState<Record<string, boolean>>({});

  // Cari semester yang sedang aktif saat ini
  const currentActiveSemester = initialTahunAjarans
    .flatMap((ta) => ta.semester.map((s) => ({ ...s, taNama: ta.nama })))
    .find((s) => s.isAktif);

  const handleTahunMulaiChange = (val: string) => {
    const num = parseInt(val) || 2027;
    setTahunMulai(num);
    if (num >= 2000 && num <= 2100) {
      setNamaTa(`${num}/${num + 1}`);
    }
  };

  const handleNamaTaChange = (val: string) => {
    setNamaTa(val);
    const match = val.trim().match(/^(\d{4})\//);
    if (match) {
      setTahunMulai(parseInt(match[1]));
    }
  };

  const handleCreateTahunAjaran = (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingKey("create_ta");
    setFeedback(null);

    startTransition(async () => {
      const res = await tambahTahunAjaranAction({
        nama: namaTa,
        tahunMulai,
      });
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      setLoadingKey(null);
      if (res.success) {
        const next = tahunMulai + 1;
        setTahunMulai(next);
        setNamaTa(`${next}/${next + 1}`);
        router.refresh();
      }
    });
  };

  const handleAktifkanSemester = (sem: SemesterItem, taNama: string) => {
    const autoCopy = Boolean(salinSaatAktifkan[sem.id]);
    setLoadingKey(`aktif_${sem.id}`);
    setFeedback(null);

    startTransition(async () => {
      const res = await aktifkanSemesterAction(sem.id, autoCopy);
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      setLoadingKey(null);
      if (res.success) {
        router.refresh();
      }
    });
  };

  const handleKunciSemester = (sem: SemesterItem, taNama: string) => {
    const ok = window.confirm(
      `Kunci (Freeze) Nilai Semester ${sem.tipe} ${taNama}?\n\nSaat dikunci, guru tidak dapat mengubah nilai rapor hingga kunci dibuka kembali oleh Superadmin.`,
    );
    if (!ok) return;

    setLoadingKey(`kunci_${sem.id}`);
    setFeedback(null);

    startTransition(async () => {
      const res = await kunciSemesterAction(sem.id);
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      setLoadingKey(null);
      if (res.success) router.refresh();
    });
  };

  const handleBukaKunciSemester = (sem: SemesterItem) => {
    setLoadingKey(`bukakunci_${sem.id}`);
    setFeedback(null);

    startTransition(async () => {
      const res = await bukaKunciSemesterAction(sem.id);
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      setLoadingKey(null);
      if (res.success) router.refresh();
    });
  };

  const handleSalinStruktur = (keSemesterId: string) => {
    if (!currentActiveSemester || currentActiveSemester.id === keSemesterId) return;
    const ok = window.confirm(
      `Salin struktur Rombel, Anggota Murid, Pengampu Mapel, dan Tujuan Pembelajaran dari Semester ${currentActiveSemester.tipe} (${currentActiveSemester.taNama}) ke semester ini?`,
    );
    if (!ok) return;

    setLoadingKey(`salin_${keSemesterId}`);
    setFeedback(null);

    startTransition(async () => {
      const res = await salinStrukturSemesterAction(
        currentActiveSemester.id,
        keSemesterId,
      );
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      setLoadingKey(null);
      if (res.success) router.refresh();
    });
  };

  const handleHapusTahunAjaran = (ta: TahunAjaranItem) => {
    const ok = window.confirm(
      `Hapus Tahun Pelajaran ${ta.nama} beserta lembar semesternya? Tindakan ini tidak dapat dibatalkan.`,
    );
    if (!ok) return;

    setLoadingKey(`hapus_ta_${ta.id}`);
    setFeedback(null);

    startTransition(async () => {
      const res = await hapusTahunAjaranAction(ta.id);
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      setLoadingKey(null);
      if (res.success) router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-xs transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <i
              className={`fa-solid ${
                feedback.type === "success"
                  ? "fa-circle-check text-emerald-600"
                  : "fa-circle-exclamation text-rose-600"
              } text-base shrink-0`}
            />
            <span className="text-xs sm:text-sm font-semibold">
              {feedback.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold inline-flex items-center gap-1.5">
            <i className="fa-solid fa-calendar-days" />
            Parameter Akademik &amp; Siklus Semester
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Tahun Ajaran &amp; Siklus Semester
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Kelola perpindahan semester aktif secara instan tanpa menghapus data master murid maupun guru. Anda juga dapat mengunci (freeze) nilai di akhir semester atau menyalin struktur rombel antar semester.
          </p>
        </div>

        {currentActiveSemester && (
          <div className="px-4 py-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs">
              <i className="fa-solid fa-circle-check" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                Semester Aktif Saat Ini
              </p>
              <p className="text-xs sm:text-sm font-black text-slate-800">
                T.A. {currentActiveSemester.taNama} • {currentActiveSemester.tipe}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah Tahun Ajaran Baru (4 Cols) */}
        <div className="lg:col-span-4 glass-light-panel rounded-3xl p-6 border border-slate-200/80 h-fit space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-plus-circle text-blue-600" />
              <span>Tambah Tahun Ajaran Baru</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Otomatis menyiapkan lembar Semester Ganjil dan Semester Genap baru.
            </p>
          </div>

          <form onSubmit={handleCreateTahunAjaran} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Format Tahun Ajaran *
              </label>
              <input
                type="text"
                value={namaTa}
                onChange={(e) => handleNamaTaChange(e.target.value)}
                required
                placeholder="mis. 2027/2028"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tahun Mulai (Angka) *
              </label>
              <input
                type="number"
                value={tahunMulai}
                onChange={(e) => handleTahunMulaiChange(e.target.value)}
                required
                min={2020}
                max={2099}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            <button
              type="submit"
              disabled={isPending && loadingKey === "create_ta"}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 mt-2 cursor-pointer transition shadow-sm disabled:opacity-50"
            >
              {isPending && loadingKey === "create_ta" ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-calendar-plus" />
                  <span>Buat Tahun Ajaran</span>
                </>
              )}
            </button>
          </form>

          <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 text-[11px] text-slate-600 space-y-1">
            <p className="font-bold text-blue-800 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-info" />
              <span>Tips Perpindahan Semester</span>
            </p>
            <p>
              Saat beralih dari Semester Ganjil ke Genap, centang opsi <strong>Salin Struktur Rombel &amp; TP</strong> agar pembagian kelas, wali kelas, pengampu mapel, dan Tujuan Pembelajaran langsung tersedia di semester baru.
            </p>
          </div>
        </div>

        {/* Daftar Tahun Ajaran & Semester (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {initialTahunAjarans.map((ta) => {
            const canDeleteTa =
              !ta.isAktif &&
              ta.semester.every(
                (s) => !s.isAktif && s.counts.rombel === 0 && s.counts.arsipNilai === 0,
              );

            return (
              <div
                key={ta.id}
                className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm border ${
                        ta.isAktif
                          ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <i className="fa-solid fa-calendar" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800">
                        Tahun Pelajaran {ta.nama}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Tahun Mulai Akademik: {ta.tahunMulai}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {ta.isAktif ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Tahun Pelajaran Berjalan</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px]">
                        Nonaktif
                      </span>
                    )}

                    {canDeleteTa && (
                      <button
                        type="button"
                        onClick={() => handleHapusTahunAjaran(ta)}
                        disabled={isPending && loadingKey === `hapus_ta_${ta.id}`}
                        title="Hapus Tahun Pelajaran kosong"
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs transition cursor-pointer disabled:opacity-50"
                      >
                        <i
                          className={`fa-solid ${
                            isPending && loadingKey === `hapus_ta_${ta.id}`
                              ? "fa-spinner fa-spin"
                              : "fa-trash"
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {/* Semester Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ta.semester.map((sem) => {
                    const isEmptyTarget =
                      !sem.isAktif &&
                      sem.counts.rombel === 0 &&
                      Boolean(
                        currentActiveSemester &&
                          currentActiveSemester.counts.rombel > 0,
                      );

                    return (
                      <div
                        key={sem.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                          sem.isAktif
                            ? "bg-gradient-to-br from-blue-50/90 via-sky-50/60 to-emerald-50/40 border-blue-300 shadow-sm ring-1 ring-blue-200/60"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-800">
                                Semester {sem.tipe}
                              </span>
                              {sem.isAktif && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[9px] font-extrabold uppercase tracking-wider">
                                  Aktif
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                sem.status === "AKTIF"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : sem.status === "DIKUNCI"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {sem.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mb-3 bg-white/80 rounded-xl p-2.5 border border-slate-100">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Kode Dapodik</span>
                              <strong className="font-mono text-slate-800">{sem.kode}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Total Rombel</span>
                              <strong className="font-mono text-blue-700">
                                {sem.counts.rombel} Kelas
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Pengampu Mapel</span>
                              <strong className="font-mono text-slate-700">
                                {sem.counts.pembelajaran} Mapel
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Data TP</span>
                              <strong className="font-mono text-teal-700">
                                {sem.counts.tujuanPembelajaran} TP
                              </strong>
                            </div>
                          </div>

                          {isEmptyTarget && (
                            <label className="flex items-start gap-2 p-2.5 mb-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={Boolean(salinSaatAktifkan[sem.id])}
                                onChange={(e) =>
                                  setSalinSaatAktifkan((prev) => ({
                                    ...prev,
                                    [sem.id]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5 rounded border-amber-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span>
                                Salin otomatis Rombel, Pengampu &amp; TP dari Semester{" "}
                                <strong>{currentActiveSemester?.tipe}</strong> saat diaktifkan
                              </span>
                            </label>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="space-y-2 pt-2.5 border-t border-slate-100/90">
                          {!sem.isAktif && (
                            <button
                              type="button"
                              onClick={() => handleAktifkanSemester(sem, ta.nama)}
                              disabled={isPending && loadingKey === `aktif_${sem.id}`}
                              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              {isPending && loadingKey === `aktif_${sem.id}` ? (
                                <>
                                  <i className="fa-solid fa-spinner fa-spin" />
                                  <span>Mengaktifkan Semester...</span>
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-bolt" />
                                  <span>Aktifkan Semester Ini</span>
                                </>
                              )}
                            </button>
                          )}

                          {!sem.isAktif &&
                            currentActiveSemester &&
                            currentActiveSemester.counts.rombel > 0 && (
                              <button
                                type="button"
                                onClick={() => handleSalinStruktur(sem.id)}
                                disabled={isPending && loadingKey === `salin_${sem.id}`}
                                className="w-full py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                {isPending && loadingKey === `salin_${sem.id}` ? (
                                  <>
                                    <i className="fa-solid fa-spinner fa-spin" />
                                    <span>Menyalin Struktur...</span>
                                  </>
                                ) : (
                                  <>
                                    <i className="fa-solid fa-copy text-[10px]" />
                                    <span>Salin Rombel &amp; TP dari Semester Aktif</span>
                                  </>
                                )}
                              </button>
                            )}

                          {sem.isAktif && sem.status === "AKTIF" && (
                            <button
                              type="button"
                              onClick={() => handleKunciSemester(sem, ta.nama)}
                              disabled={isPending && loadingKey === `kunci_${sem.id}`}
                              className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isPending && loadingKey === `kunci_${sem.id}` ? (
                                <>
                                  <i className="fa-solid fa-spinner fa-spin" />
                                  <span>Mengunci Nilai...</span>
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-lock" />
                                  <span>Kunci (Freeze) Nilai</span>
                                </>
                              )}
                            </button>
                          )}

                          {sem.status === "DIKUNCI" && (
                            <div className="space-y-1.5">
                              <div className="w-full py-1.5 px-2 text-center text-[11px] font-semibold text-rose-700 bg-rose-50/70 rounded-xl border border-rose-200">
                                <i className="fa-solid fa-lock mr-1" />
                                Nilai Dibekukan (Read-Only)
                              </div>
                              <button
                                type="button"
                                onClick={() => handleBukaKunciSemester(sem)}
                                disabled={isPending && loadingKey === `bukakunci_${sem.id}`}
                                className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <i className="fa-solid fa-lock-open text-emerald-600" />
                                <span>Buka Kunci Nilai</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
