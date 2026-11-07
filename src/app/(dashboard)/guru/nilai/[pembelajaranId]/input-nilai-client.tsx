"use client";

import React, { useState, useEffect, useMemo, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  simpanNilaiBatchAction,
  tambahKolomPenilaianAction,
  hapusKolomPenilaianAction,
  generateDefaultPenilaianAction,
  type KategoriPenilaianInput,
} from "@/server/actions/penilaian";
import { hitungNilaiAkhirLengkap } from "@/lib/grading/calc";

export interface PenilaianColItem {
  id: string;
  kategori: KategoriPenilaianInput;
  urutan: number;
  nama: string;
  tujuanPembelajaran: string | null;
}

export interface AnggotaNilaiItem {
  id: string;
  siswaId: string;
  noAbsen: number | null;
  nisn: string;
  nama: string;
}

interface InputNilaiClientProps {
  pembelajaran: {
    id: string;
    mapelNama: string;
    rombelNama: string;
    tahunAjaranNama: string;
    semesterTipe: string;
    semesterStatus: string;
    bobotHarian: number;
    bobotUts: number;
    bobotUas: number;
    kktp: number;
  };
  penilaianList: PenilaianColItem[];
  anggotaList: AnggotaNilaiItem[];
  initialScores: Record<string, string>; // key: `${penilaianId}_${siswaId}` -> string score
}

interface StoredDraftPayload {
  updatedAt: string;
  values: Record<string, string>;
}

const KATEGORI_BADGE_MAP: Record<
  KategoriPenilaianInput,
  { label: string; badgeClass: string; thClass: string; placeholder: string }
> = {
  HARIAN: {
    label: "TP / Formatif",
    badgeClass: "text-blue-600",
    thClass: "bg-blue-50/40",
    placeholder: "Nama kolom, mis. TP 3",
  },
  SLM: {
    label: "SLM",
    badgeClass: "text-indigo-600",
    thClass: "bg-indigo-50/40",
    placeholder: "Nama kolom, mis. SLM 1",
  },
  UTS: {
    label: "STS",
    badgeClass: "text-amber-600",
    thClass: "bg-amber-50/40",
    placeholder: "Nama kolom, mis. STS",
  },
  UAS: {
    label: "SAS",
    badgeClass: "text-teal-600",
    thClass: "bg-teal-50/40",
    placeholder: "Nama kolom, mis. SAS",
  },
};

export default function InputNilaiClient({
  pembelajaran,
  penilaianList,
  anggotaList,
  initialScores,
}: InputNilaiClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isReadOnly = pembelajaran.semesterStatus !== "AKTIF";
  const draftStorageKey = `stupa_nilai_draft_v1_${pembelajaran.id}`;

  // Baseline server values & current live cell values
  const [baselineScores, setBaselineScores] = useState<Record<string, string>>(initialScores);
  const [scores, setScores] = useState<Record<string, string>>(initialScores);
  const scoresRef = useRef<Record<string, string>>(initialScores);
  scoresRef.current = scores;

  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [restoredDraftBanner, setRestoredDraftBanner] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Form state Tambah Kolom Asesmen
  const [newKategori, setNewKategori] = useState<KategoriPenilaianInput>("HARIAN");
  const [newNamaKolom, setNewNamaKolom] = useState<string>("");

  // Sync baseline when server props refresh (e.g. after adding/removing a column), preserving unsaved edits!
  useEffect(() => {
    setBaselineScores(initialScores);
    setScores((prev) => {
      const merged = { ...initialScores };
      for (const [k, v] of Object.entries(prev)) {
        if (v !== baselineScores[k]) {
          merged[k] = v;
        }
      }
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScores]);

  // Check if there are unsaved changes compared to server baseline
  const dirtyCount = useMemo(() => {
    const allKeys = new Set([...Object.keys(baselineScores), ...Object.keys(scores)]);
    let diff = 0;
    allKeys.forEach((k) => {
      const a = (baselineScores[k] ?? "").trim();
      const b = (scores[k] ?? "").trim();
      if (a !== b) diff++;
    });
    return diff;
  }, [baselineScores, scores]);

  const isDirty = dirtyCount > 0;
  const isDirtyRef = useRef<boolean>(false);
  isDirtyRef.current = isDirty;

  // Flush current unsaved edits to localStorage
  const persistDraftNow = useCallback(
    (currentValues: Record<string, string>) => {
      if (typeof window === "undefined" || isReadOnly) return;
      try {
        const diffValues: Record<string, string> = {};
        const allKeys = new Set([
          ...Object.keys(baselineScores),
          ...Object.keys(currentValues),
        ]);
        allKeys.forEach((k) => {
          const baseVal = (baselineScores[k] ?? "").trim();
          const curVal = (currentValues[k] ?? "").trim();
          if (curVal !== baseVal) {
            diffValues[k] = curVal;
          }
        });

        if (Object.keys(diffValues).length === 0) {
          window.localStorage.removeItem(draftStorageKey);
          setDraftSavedAt(null);
          return;
        }

        const nowIso = new Date().toISOString();
        const payload: StoredDraftPayload = {
          updatedAt: nowIso,
          values: diffValues,
        };
        window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
        setDraftSavedAt(nowIso);
      } catch (e) {
        console.warn("[Draft Auto-Save Warning]:", e);
      }
    },
    [baselineScores, draftStorageKey, isReadOnly]
  );

  // Restore draft automatically on mount if any unsaved draft exists in localStorage
  useEffect(() => {
    if (typeof window === "undefined" || isReadOnly) return;
    setIsOnline(window.navigator.onLine);

    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDraftPayload;
        if (parsed && parsed.values && typeof parsed.values === "object") {
          const restored: Record<string, string> = { ...initialScores };
          let restoredCount = 0;
          for (const [k, v] of Object.entries(parsed.values)) {
            if ((initialScores[k] ?? "").trim() !== String(v).trim()) {
              restored[k] = String(v);
              restoredCount++;
            }
          }
          if (restoredCount > 0) {
            setScores(restored);
            setDraftSavedAt(parsed.updatedAt || new Date().toISOString());
            setRestoredDraftBanner(true);
          } else {
            window.localStorage.removeItem(draftStorageKey);
          }
        }
      }
    } catch {
      // Ignore malformed draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey, isReadOnly]);

  // Debounced auto-save on every score change
  useEffect(() => {
    if (isReadOnly) return;
    const timer = window.setTimeout(() => {
      persistDraftNow(scores);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [scores, persistDraftNow, isReadOnly]);

  // Online/offline listeners + emergency flush on page exit / tab hide / network loss
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (isDirtyRef.current) {
        persistDraftNow(scoresRef.current);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isDirtyRef.current) {
        persistDraftNow(scoresRef.current);
      }
    };
    const handlePageHide = () => {
      if (isDirtyRef.current) {
        persistDraftNow(scoresRef.current);
      }
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        persistDraftNow(scoresRef.current);
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [persistDraftNow]);

  // Realtime calculation per student: Rata TP, Rata SLM, Nilai Akhir, Status
  const realtimeCalcBySiswa = useMemo(() => {
    const map: Record<
      string,
      {
        rataTp: number | null;
        rataSlm: number | null;
        nilaiAkhir: number | null;
        isTuntas: boolean;
      }
    > = {};

    for (const agg of anggotaList) {
      const harianVals: (number | null)[] = [];
      const slmVals: (number | null)[] = [];
      const utsVals: (number | null)[] = [];
      const uasVals: (number | null)[] = [];

      for (const col of penilaianList) {
        const raw = scores[`${col.id}_${agg.siswaId}`]?.trim() ?? "";
        if (raw === "") continue;
        const parsed = parseFloat(raw);
        if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) continue;

        if (col.kategori === "HARIAN") harianVals.push(parsed);
        else if (col.kategori === "SLM") slmVals.push(parsed);
        else if (col.kategori === "UTS") utsVals.push(parsed);
        else if (col.kategori === "UAS") uasVals.push(parsed);
      }

      const calc = hitungNilaiAkhirLengkap(
        {
          harian: harianVals,
          slm: slmVals,
          uts: utsVals,
          uas: uasVals,
        },
        {
          bobotHarian: pembelajaran.bobotHarian,
          bobotUts: pembelajaran.bobotUts,
          bobotUas: pembelajaran.bobotUas,
        }
      );

      map[agg.siswaId] = {
        rataTp: calc.rataHarian,
        rataSlm: calc.rataSlm,
        nilaiAkhir: calc.nilaiAkhir,
        isTuntas: calc.nilaiAkhir !== null && calc.nilaiAkhir >= pembelajaran.kktp,
      };
    }

    return map;
  }, [anggotaList, penilaianList, scores, pembelajaran.bobotHarian, pembelajaran.bobotUts, pembelajaran.bobotUas, pembelajaran.kktp]);

  const handleCellChange = (penilaianId: string, siswaId: string, value: string) => {
    if (isReadOnly) return;
    setScores((prev) => ({
      ...prev,
      [`${penilaianId}_${siswaId}`]: value,
    }));
  };

  const handleDiscardDraft = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey);
    }
    setScores({ ...baselineScores });
    setDraftSavedAt(null);
    setRestoredDraftBanner(false);
    setFeedback({
      type: "info",
      message: "Draft lokal dihapus dan nilai dikembalikan ke data terakhir di server.",
    });
  };

  const handleTambahKolom = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !newNamaKolom.trim()) return;

    // Pastikan perubahan nilai saat ini tersimpan di draft sebelum refresh kolom
    persistDraftNow(scores);

    startTransition(async () => {
      const res = await tambahKolomPenilaianAction(
        pembelajaran.id,
        newKategori,
        newNamaKolom.trim()
      );
      if (res.success) {
        setNewNamaKolom("");
        setFeedback({ type: "success", message: res.message });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleHapusKolom = (col: PenilaianColItem) => {
    if (isReadOnly) return;
    const ok = window.confirm(
      `Hapus kolom asesmen "${col.nama}" beserta nilai di kolom tersebut?`
    );
    if (!ok) return;

    persistDraftNow(scores);

    startTransition(async () => {
      const res = await hapusKolomPenilaianAction(pembelajaran.id, col.id);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleGenerateStandar = () => {
    if (isReadOnly) return;
    startTransition(async () => {
      const res = await generateDefaultPenilaianAction(pembelajaran.id);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleSimpanSeluruhNilai = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!isOnline) {
      persistDraftNow(scores);
      setFeedback({
        type: "error",
        message:
          "Perangkat sedang offline. Seluruh nilai Anda sudah diamankan otomatis pada Draft perangkat dan dapat disimpan ke server segera setelah koneksi kembali online.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await simpanNilaiBatchAction(pembelajaran.id, scores);
        if (res.success) {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(draftStorageKey);
          }
          setBaselineScores({ ...scores });
          setDraftSavedAt(null);
          setRestoredDraftBanner(false);
          setFeedback({ type: "success", message: res.message });
          router.refresh();
        } else {
          persistDraftNow(scores);
          setFeedback({
            type: "error",
            message: `${res.message} (Draft nilai tetap aman tersimpan di perangkat Anda).`,
          });
        }
      } catch {
        persistDraftNow(scores);
        setFeedback({
          type: "error",
          message:
            "Gagal terhubung ke server karena gangguan jaringan. Jangan khawatir, seluruh nilai Anda telah tersimpan otomatis di Draft perangkat.",
        });
      }
    });
  };

  const formattedDraftTime = useMemo(() => {
    if (!draftSavedAt) return null;
    try {
      return new Date(draftSavedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return null;
    }
  }, [draftSavedAt]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] tracking-wider uppercase">
              Penilaian Akademik Realtime
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {pembelajaran.tahunAjaranNama} {pembelajaran.semesterTipe}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {pembelajaran.mapelNama} — {pembelajaran.rombelNama}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Bobot Asesmen: Formatif/TP {pembelajaran.bobotHarian}% • SLM/STS{" "}
            {pembelajaran.bobotUts}% • SAS {pembelajaran.bobotUas}% • KKTP {pembelajaran.kktp}
            {isReadOnly && " • 🔒 Semester dikunci (read-only)"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Indikator Koneksi & Auto-Draft */}
          <div
            className={`px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${
              !isOnline
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : isDirty
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                !isOnline
                  ? "bg-rose-500 animate-pulse"
                  : isDirty
                  ? "bg-amber-500 animate-pulse"
                  : "bg-emerald-500"
              }`}
            />
            <span>
              {!isOnline
                ? "Offline • Draft Lokal Aktif"
                : isDirty
                ? `Draft Otomatis${formattedDraftTime ? ` (${formattedDraftTime})` : ""} • ${dirtyCount} sel belum disimpan`
                : "Tersimpan di Server"}
            </span>
          </div>

          <a
            href={`/api/guru/ekspor/${pembelajaran.id}`}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-file-excel text-sm" />
            <span>Unduh Format E-Rapor (4 Sheet)</span>
          </a>
        </div>
      </div>

      {/* BANNER PEMULIHAN DRAFT OTOMATIS */}
      {restoredDraftBanner && isDirty && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <i className="fa-solid fa-clock-rotate-left text-amber-600 text-sm mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-extrabold">
                Draft nilai yang belum sempat disimpan berhasil dipulihkan otomatis!
              </p>
              <p className="text-amber-800 mt-0.5">
                Terdapat <b>{dirtyCount} perubahan nilai</b> dari sesi sebelumnya
                {formattedDraftTime ? ` (pukul ${formattedDraftTime})` : ""}. Klik{" "}
                <b>Simpan Seluruh Nilai</b> untuk menyimpan permanen ke database.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 text-[11px] font-bold transition cursor-pointer"
            >
              Abaikan Draft
            </button>
            <button
              type="button"
              onClick={() => setRestoredDraftBanner(false)}
              className="text-amber-500 hover:text-amber-700 px-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>
      )}

      {/* BANNER FEEDBACK AKSI */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-xs ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : feedback.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <i
              className={`fa-solid ${
                feedback.type === "success"
                  ? "fa-circle-check text-emerald-600"
                  : feedback.type === "error"
                  ? "fa-triangle-exclamation text-rose-600"
                  : "fa-circle-info text-blue-600"
              } text-sm shrink-0`}
            />
            <span className="text-xs font-semibold">{feedback.message}</span>
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

      {/* FORM TAMBAH KOLOM ASESMEN BARU */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <form
          onSubmit={handleTambahKolom}
          className="flex flex-wrap items-center gap-3 w-full lg:w-auto"
        >
          <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <i className="fa-solid fa-plus-circle text-blue-600" />
            Tambah Kolom Asesmen:
          </span>
          <select
            value={newKategori}
            onChange={(e) => setNewKategori(e.target.value as KategoriPenilaianInput)}
            disabled={isReadOnly || isPending}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="HARIAN">Formatif / TP</option>
            <option value="SLM">SLM (Sumatif Lingkup Materi)</option>
            <option value="UTS">STS (Tengah Semester)</option>
            <option value="UAS">SAS (Akhir Semester)</option>
          </select>
          <input
            type="text"
            value={newNamaKolom}
            onChange={(e) => setNewNamaKolom(e.target.value)}
            required
            disabled={isReadOnly || isPending}
            placeholder={KATEGORI_BADGE_MAP[newKategori].placeholder}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 min-w-[180px]"
          />
          <button
            type="submit"
            disabled={isReadOnly || isPending || !newNamaKolom.trim()}
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition cursor-pointer disabled:opacity-50"
          >
            {isPending ? "Memproses..." : "Tambah Kolom"}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {penilaianList.length === 0 && !isReadOnly && (
            <button
              type="button"
              onClick={handleGenerateStandar}
              disabled={isPending}
              className="py-1.5 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-xs" />
              <span>Buat Kolom Standar (TP, SLM, STS, SAS)</span>
            </button>
          )}

          <div className="text-xs text-slate-500 font-medium">
            Total: <span className="font-bold text-slate-800">{anggotaList.length} Siswa</span> •{" "}
            <span className="font-bold text-slate-800">{penilaianList.length} Kolom Penilaian</span>
          </div>
        </div>
      </div>

      {/* GRID INPUT NILAI INTERAKTIF REALTIME */}
      <form
        onSubmit={handleSimpanSeluruhNilai}
        className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">Lembar Penilaian Siswa</h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Rata TP, Rata SLM, Nilai Akhir, dan Status dihitung otomatis secara <b>realtime</b>{" "}
              saat nilai diketik, serta diamankan otomatis sebagai draft lokal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && !isReadOnly && (
              <button
                type="button"
                onClick={handleDiscardDraft}
                disabled={isPending}
                className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition cursor-pointer"
              >
                Reset Perubahan
              </button>
            )}
            <button
              type="submit"
              disabled={isReadOnly || isPending}
              className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white text-xs font-bold shadow-md shadow-blue-500/15 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <i className={`fa-solid ${isPending ? "fa-spinner fa-spin" : "fa-floppy-disk"}`} />
              <span>{isPending ? "Menyimpan..." : "Simpan Seluruh Nilai"}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                <th className="py-3 px-3 w-10 text-center border-r border-slate-200">No</th>
                <th className="py-3 px-3 w-28 border-r border-slate-200">NISN</th>
                <th className="py-3 px-3 min-w-[180px] border-r border-slate-200 sticky left-0 bg-slate-50/90 z-10">
                  Nama Siswa
                </th>
                {penilaianList.map((k) => {
                  const meta = KATEGORI_BADGE_MAP[k.kategori] || KATEGORI_BADGE_MAP.HARIAN;
                  return (
                    <th
                      key={k.id}
                      className={`py-2.5 px-2 text-center border-r border-slate-200 min-w-[82px] group relative ${meta.thClass}`}
                      title={k.tujuanPembelajaran || k.nama}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-bold text-slate-800">{k.nama}</span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleHapusKolom(k)}
                            title={`Hapus kolom ${k.nama}`}
                            className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 transition cursor-pointer text-[10px]"
                          >
                            <i className="fa-solid fa-trash-can" />
                          </button>
                        )}
                      </div>
                      <span className={`text-[8px] font-mono font-bold block ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                    </th>
                  );
                })}
                <th className="py-3 px-3 text-center border-r border-slate-200 bg-blue-50/60 text-blue-800 min-w-[76px]">
                  Rata TP
                </th>
                <th className="py-3 px-3 text-center border-r border-slate-200 bg-indigo-50/60 text-indigo-800 min-w-[82px]">
                  Rata SLM
                </th>
                <th className="py-3 px-3 text-center border-r border-slate-200 bg-blue-100/60 text-blue-900 min-w-[86px]">
                  Nilai Akhir
                </th>
                <th className="py-3 px-3 text-center bg-teal-50/60 text-teal-800 min-w-[86px]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {anggotaList.map((agg, idx) => {
                const live = realtimeCalcBySiswa[agg.siswaId];
                const rataTp = live?.rataTp ?? null;
                const rataSlm = live?.rataSlm ?? null;
                const na = live?.nilaiAkhir ?? null;
                const isTuntas = live?.isTuntas ?? false;

                return (
                  <tr key={agg.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-400 border-r border-slate-100">
                      {agg.noAbsen ?? idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 border-r border-slate-100">
                      {agg.nisn}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-100 sticky left-0 bg-white z-0">
                      {agg.nama}
                    </td>
                    {penilaianList.map((k) => {
                      const cellKey = `${k.id}_${agg.siswaId}`;
                      const curVal = scores[cellKey] ?? "";
                      const isCellDirty = (baselineScores[cellKey] ?? "").trim() !== curVal.trim();

                      return (
                        <td key={k.id} className="p-1 border-r border-slate-100 text-center">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            disabled={isReadOnly}
                            value={curVal}
                            onChange={(e) => handleCellChange(k.id, agg.siswaId, e.target.value)}
                            className={`w-16 text-center py-1 rounded-lg border font-mono text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                              isCellDirty
                                ? "border-amber-400 bg-amber-50/60"
                                : "border-slate-200 bg-slate-50"
                            }`}
                          />
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700 border-r border-slate-100 bg-blue-50/20">
                      {rataTp !== null ? rataTp : "–"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700 border-r border-slate-100 bg-indigo-50/20">
                      {rataSlm !== null ? rataSlm : "–"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-extrabold text-blue-900 border-r border-slate-100 bg-blue-50/40">
                      {na !== null ? na : "–"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {na !== null ? (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
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
