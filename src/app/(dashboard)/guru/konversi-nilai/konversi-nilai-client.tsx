"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useTransition,
  useCallback,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  transferNilaiKonversiAction,
  tarikNilaiAkhirPembelajaranAction,
  type TransferNilaiTargetType,
} from "@/server/actions/penilaian";
import { hitungNilaiAkhirLengkap } from "@/lib/grading/calc";

export interface SiswaKonversiItem {
  siswaId: string;
  noUrut: number;
  nisn: string;
  nama: string;
  jenisKelamin: "L" | "P";
}

export interface TpKonversiOption {
  kodeTp: string;
  deskripsi: string;
  penilaianId: string | null;
}

export interface SlmKonversiOption {
  penilaianId: string | null;
  nama: string;
}

export interface MapelKonversiOption {
  pembelajaranId: string;
  mapelId: string;
  mapelKode: string;
  mapelNama: string;
  kktp: number;
  bobotHarian: number;
  bobotUts: number;
  bobotUas: number;
  penilaianCols: { id: string; kategori: string }[];
  nilaiAkhirMap: Record<string, number>;
  tpOptions: TpKonversiOption[];
  slmOptions: SlmKonversiOption[];
  stsOption: { penilaianId: string | null; nama: string };
  sasOption: { penilaianId: string | null; nama: string };
}

export interface RombelKonversiOption {
  id: string;
  nama: string;
  tingkat: number;
  waliKelasNama: string;
  isWaliKelas: boolean;
  siswaList: SiswaKonversiItem[];
  mapelList: MapelKonversiOption[];
}

interface StoredKonversiDraft {
  rombelId: string;
  pembelajaranId?: string;
  updatedAt: string;
  nilaiTertinggiDiinginkan: string;
  nilaiTerendahDiinginkan: string;
  roundingMode: "DECIMAL_2" | "INTEGER";
  nilaiDasarMap: Record<string, string>; // key: siswaId -> raw input string
  nilaiKonversiMap: Record<string, number | null>; // key: siswaId -> hasil konversi
}

interface StoredActiveSelection {
  rombelId: string;
  pembelajaranId: string;
}

interface KonversiNilaiClientProps {
  rombelOptions: RombelKonversiOption[];
  initialRombelId: string;
  initialPembelajaranId?: string;
  semesterLabel: string;
  semesterStatus: string;
  guruNama: string;
  peranLabel: string;
}

const SELECTION_STORAGE_KEY = "stupa_konversi_active_selection_v2";

function buildDraftKey(rombelId: string, pembelajaranId: string): string {
  if (pembelajaranId) {
    return `stupa_konversi_nilai_draft_v2_${rombelId}_${pembelajaranId}`;
  }
  return `stupa_konversi_nilai_draft_v1_${rombelId}`;
}

function readDraftFromLocalStorage(
  rombelId: string,
  pembelajaranId: string
): StoredKonversiDraft | null {
  if (typeof window === "undefined" || !rombelId) return null;
  try {
    const primaryKey = buildDraftKey(rombelId, pembelajaranId);
    const rawPrimary = window.localStorage.getItem(primaryKey);
    if (rawPrimary) {
      const parsed = JSON.parse(rawPrimary) as StoredKonversiDraft;
      if (parsed && typeof parsed === "object") return parsed;
    }
    // Fallback ke draft v1 berbasis rombelId jika ada
    const legacyKey = `stupa_konversi_nilai_draft_v1_${rombelId}`;
    const rawLegacy = window.localStorage.getItem(legacyKey);
    if (rawLegacy) {
      const parsedLegacy = JSON.parse(rawLegacy) as StoredKonversiDraft;
      if (parsedLegacy && typeof parsedLegacy === "object") return parsedLegacy;
    }
  } catch {
    // Abaikan jika JSON rusak
  }
  return null;
}

export default function KonversiNilaiClient({
  rombelOptions,
  initialRombelId,
  initialPembelajaranId = "",
  semesterLabel,
  semesterStatus,
  guruNama,
  peranLabel,
}: KonversiNilaiClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPulling, startPullTransition] = useTransition();

  // Tentukan Rombel & Mapel awal (prioritas URL -> localStorage -> opsi pertama)
  const initialSelection = useMemo((): StoredActiveSelection => {
    let rId =
      initialRombelId && rombelOptions.some((r) => r.id === initialRombelId)
        ? initialRombelId
        : "";
    let pId = initialPembelajaranId || "";

    if (typeof window !== "undefined" && !rId) {
      try {
        const rawSel = window.localStorage.getItem(SELECTION_STORAGE_KEY);
        if (rawSel) {
          const parsedSel = JSON.parse(rawSel) as StoredActiveSelection;
          if (parsedSel?.rombelId && rombelOptions.some((r) => r.id === parsedSel.rombelId)) {
            rId = parsedSel.rombelId;
            pId = parsedSel.pembelajaranId || "";
          }
        }
      } catch {
        // Ignore
      }
    }

    if (!rId) {
      rId = rombelOptions[0]?.id || "";
    }

    const rObj = rombelOptions.find((r) => r.id === rId) ?? rombelOptions[0];
    if (rObj) {
      if (!pId || !rObj.mapelList.some((m) => m.pembelajaranId === pId)) {
        pId = rObj.mapelList[0]?.pembelajaranId || "";
      }
    }

    return { rombelId: rId, pembelajaranId: pId };
  }, [initialRombelId, initialPembelajaranId, rombelOptions]);

  const [selectedRombelId, setSelectedRombelId] = useState<string>(initialSelection.rombelId);
  const [selectedPembelajaranId, setSelectedPembelajaranId] = useState<string>(
    initialSelection.pembelajaranId
  );

  const activeRombel = useMemo(
    () => rombelOptions.find((r) => r.id === selectedRombelId) ?? rombelOptions[0] ?? null,
    [rombelOptions, selectedRombelId]
  );

  const activeMapelOption = useMemo(() => {
    if (!activeRombel) return null;
    return (
      activeRombel.mapelList.find((m) => m.pembelajaranId === selectedPembelajaranId) ??
      activeRombel.mapelList[0] ??
      null
    );
  }, [activeRombel, selectedPembelajaranId]);

  const activeRombelId = activeRombel?.id || "";
  const activePembelajaranId = activeMapelOption?.pembelajaranId || "";

  // State 4 Kolom di atas tabel & Nilai Dasar per siswa (terhidrasi langsung dari localStorage)
  const [nilaiTertinggiDiinginkan, setNilaiTertinggiDiinginkan] = useState<string>(() => {
    const d = readDraftFromLocalStorage(
      initialSelection.rombelId,
      initialSelection.pembelajaranId
    );
    return d?.nilaiTertinggiDiinginkan ?? "";
  });
  const [nilaiTerendahDiinginkan, setNilaiTerendahDiinginkan] = useState<string>(() => {
    const d = readDraftFromLocalStorage(
      initialSelection.rombelId,
      initialSelection.pembelajaranId
    );
    return d?.nilaiTerendahDiinginkan ?? "";
  });
  const [nilaiDasarMap, setNilaiDasarMap] = useState<Record<string, string>>(() => {
    const d = readDraftFromLocalStorage(
      initialSelection.rombelId,
      initialSelection.pembelajaranId
    );
    return d?.nilaiDasarMap || {};
  });
  const [roundingMode, setRoundingMode] = useState<"DECIMAL_2" | "INTEGER">(() => {
    const d = readDraftFromLocalStorage(
      initialSelection.rombelId,
      initialSelection.pembelajaranId
    );
    return d?.roundingMode === "DECIMAL_2" ? "DECIMAL_2" : "INTEGER";
  });

  // Cache lokal Nilai Akhir per pembelajaran (agar jika baru ditransfer langsung terbarui)
  const [localNilaiAkhirOverride, setLocalNilaiAkhirOverride] = useState<
    Record<string, Record<string, number>>
  >({});

  // Status penyimpanan sementara (Draft Offline / Auto-Save)
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = useState<boolean>(false);
  const isHydratedRef = useRef<boolean>(false);

  // Notifikasi & Modal Transfer Nilai
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
    linkPembelajaranId?: string;
    linkRombelId?: string;
  } | null>(null);

  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [selectedTargetType, setSelectedTargetType] = useState<TransferNilaiTargetType>("TP");
  const [selectedTpKode, setSelectedTpKode] = useState<string>("");
  const [selectedSlmKey, setSelectedSlmKey] = useState<string>("");

  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // ===========================================================================
  // 1. PERHITUNGAN REALTIME:
  //    - Nilai Tertinggi (dari Kolom Nilai Dasar yang terisi, tidak bisa diedit)
  //    - Nilai Terendah (dari Kolom Nilai Dasar yang terisi, tidak bisa diedit)
  //    - Nilai Konversi per baris siswa:
  //      = Nilai Terendah Diinginkan + ((Kolom Nilai Dasar - Nilai Terendah) / (Nilai Tertinggi - Nilai Terendah) * (Nilai Tertinggi Diinginkan - Nilai Terendah Diinginkan))
  // ===========================================================================
  const parsedNilaiDasarEntries = useMemo(() => {
    if (!activeRombel) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const s of activeRombel.siswaList) {
      const raw = (nilaiDasarMap[s.siswaId] ?? "").trim().replace(",", ".");
      if (raw === "") continue;
      const num = Number(raw);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        map.set(s.siswaId, num);
      }
    }
    return map;
  }, [activeRombel, nilaiDasarMap]);

  const { nilaiTertinggiDasar, nilaiTerendahDasar, filledCount } = useMemo(() => {
    const values = Array.from(parsedNilaiDasarEntries.values());
    if (values.length === 0) {
      return {
        nilaiTertinggiDasar: null as number | null,
        nilaiTerendahDasar: null as number | null,
        filledCount: 0,
      };
    }
    return {
      nilaiTertinggiDasar: Math.max(...values),
      nilaiTerendahDasar: Math.min(...values),
      filledCount: values.length,
    };
  }, [parsedNilaiDasarEntries]);

  const parsedTargetMax = useMemo(() => {
    const raw = nilaiTertinggiDiinginkan.trim().replace(",", ".");
    if (raw === "") return null;
    const n = Number(raw);
    return !Number.isNaN(n) && Number.isFinite(n) ? n : null;
  }, [nilaiTertinggiDiinginkan]);

  const parsedTargetMin = useMemo(() => {
    const raw = nilaiTerendahDiinginkan.trim().replace(",", ".");
    if (raw === "") return null;
    const n = Number(raw);
    return !Number.isNaN(n) && Number.isFinite(n) ? n : null;
  }, [nilaiTerendahDiinginkan]);

  const isDesiredRangeValid = useMemo(() => {
    return (
      parsedTargetMax !== null &&
      parsedTargetMin !== null &&
      parsedTargetMax >= parsedTargetMin
    );
  }, [parsedTargetMax, parsedTargetMin]);

  // Hitung Nilai Konversi secara realtime untuk setiap siswa
  const nilaiKonversiMap = useMemo(() => {
    const result: Record<string, number | null> = {};
    if (!activeRombel) return result;

    for (const s of activeRombel.siswaList) {
      const nilaiDasar = parsedNilaiDasarEntries.get(s.siswaId);
      if (
        nilaiDasar === undefined ||
        nilaiTertinggiDasar === null ||
        nilaiTerendahDasar === null ||
        parsedTargetMax === null ||
        parsedTargetMin === null
      ) {
        result[s.siswaId] = null;
        continue;
      }

      const selisihDasar = nilaiTertinggiDasar - nilaiTerendahDasar;
      const selisihDiinginkan = parsedTargetMax - parsedTargetMin;

      // Rumus resmi sesuai permintaan:
      // = Nilai Terendah Diinginkan + ((Kolom Nilai Dasar - Nilai Terendah) / (Nilai Tertinggi - Nilai Terendah) * (Nilai Tertinggi Diinginkan - Nilai Terendah Diinginkan))
      let rawConverted: number;
      if (selisihDasar === 0) {
        rawConverted = parsedTargetMin;
      } else {
        rawConverted =
          parsedTargetMin +
          ((nilaiDasar - nilaiTerendahDasar) / selisihDasar) * selisihDiinginkan;
      }

      result[s.siswaId] =
        roundingMode === "INTEGER"
          ? Math.round(rawConverted)
          : Math.round(rawConverted * 100) / 100;
    }

    return result;
  }, [
    activeRombel,
    parsedNilaiDasarEntries,
    nilaiTertinggiDasar,
    nilaiTerendahDasar,
    parsedTargetMax,
    parsedTargetMin,
    roundingMode,
  ]);

  // ===========================================================================
  // 2. PENYIMPANAN SEMENTARA OTOMATIS SINKRON (ANTI HILANG SAAT REFRESH / OFFLINE)
  // ===========================================================================
  const writeDraftNow = useCallback(
    (
      rId: string,
      pId: string,
      dasarMap: Record<string, string>,
      konversiMap: Record<string, number | null>,
      tMax: string,
      tMin: string,
      rMode: "DECIMAL_2" | "INTEGER"
    ) => {
      if (!rId || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          SELECTION_STORAGE_KEY,
          JSON.stringify({ rombelId: rId, pembelajaranId: pId })
        );

        const hasAnyInput =
          Object.values(dasarMap).some((v) => String(v).trim() !== "") ||
          tMax.trim() !== "" ||
          tMin.trim() !== "";

        const key = buildDraftKey(rId, pId);
        if (!hasAnyInput) {
          return;
        }

        const nowIso = new Date().toISOString();
        const payload: StoredKonversiDraft = {
          rombelId: rId,
          pembelajaranId: pId,
          updatedAt: nowIso,
          nilaiTertinggiDiinginkan: tMax,
          nilaiTerendahDiinginkan: tMin,
          roundingMode: rMode,
          nilaiDasarMap: dasarMap,
          nilaiKonversiMap: konversiMap,
        };
        window.localStorage.setItem(key, JSON.stringify(payload));
        setDraftSavedAt(
          new Date(nowIso).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch {
        // Ignore storage quota errors
      }
    },
    []
  );

  // Pulihkan draft setiap kali pasangan (activeRombelId, activePembelajaranId) berubah atau saat halaman di-refresh
  useEffect(() => {
    if (!activeRombelId || typeof window === "undefined") return;
    isHydratedRef.current = false;

    try {
      window.localStorage.setItem(
        SELECTION_STORAGE_KEY,
        JSON.stringify({
          rombelId: activeRombelId,
          pembelajaranId: activePembelajaranId,
        })
      );

      const saved = readDraftFromLocalStorage(activeRombelId, activePembelajaranId);
      if (saved) {
        setNilaiTertinggiDiinginkan(saved.nilaiTertinggiDiinginkan ?? "");
        setNilaiTerendahDiinginkan(saved.nilaiTerendahDiinginkan ?? "");
        setRoundingMode(saved.roundingMode === "DECIMAL_2" ? "DECIMAL_2" : "INTEGER");
        setNilaiDasarMap(saved.nilaiDasarMap || {});
        const hasFilled =
          Object.values(saved.nilaiDasarMap || {}).some((v) => String(v).trim() !== "") ||
          Boolean(saved.nilaiTertinggiDiinginkan?.trim()) ||
          Boolean(saved.nilaiTerendahDiinginkan?.trim());
        setRestoredFromDraft(hasFilled);
        if (saved.updatedAt) {
          setDraftSavedAt(
            new Date(saved.updatedAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          );
        }
        isHydratedRef.current = true;
        return;
      }
    } catch {
      // Abaikan jika JSON rusak
    }

    setNilaiTertinggiDiinginkan("");
    setNilaiTerendahDiinginkan("");
    setNilaiDasarMap({});
    setRestoredFromDraft(false);
    setDraftSavedAt(null);
    isHydratedRef.current = true;
  }, [activeRombelId, activePembelajaranId]);

  // Simpan otomatis setiap kali Nilai Dasar, Nilai Konversi, atau Nilai Diinginkan berubah
  useEffect(() => {
    if (!activeRombelId || !isHydratedRef.current) return;
    writeDraftNow(
      activeRombelId,
      activePembelajaranId,
      nilaiDasarMap,
      nilaiKonversiMap,
      nilaiTertinggiDiinginkan,
      nilaiTerendahDiinginkan,
      roundingMode
    );
  }, [
    activeRombelId,
    activePembelajaranId,
    nilaiDasarMap,
    nilaiKonversiMap,
    nilaiTertinggiDiinginkan,
    nilaiTerendahDiinginkan,
    roundingMode,
    writeDraftNow,
  ]);

  // Pantau status koneksi internet & paksa simpan saat halaman di-refresh / ditutup
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(window.navigator.onLine);

    const flushCurrent = () => {
      if (activeRombelId && isHydratedRef.current) {
        writeDraftNow(
          activeRombelId,
          activePembelajaranId,
          nilaiDasarMap,
          nilaiKonversiMap,
          nilaiTertinggiDiinginkan,
          nilaiTerendahDiinginkan,
          roundingMode
        );
      }
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      flushCurrent();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushCurrent();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeunload", flushCurrent);
    window.addEventListener("pagehide", flushCurrent);
    document.addEventListener("visibilitychange", flushCurrent);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeunload", flushCurrent);
      window.removeEventListener("pagehide", flushCurrent);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    activeRombelId,
    activePembelajaranId,
    nilaiDasarMap,
    nilaiKonversiMap,
    nilaiTertinggiDiinginkan,
    nilaiTerendahDiinginkan,
    roundingMode,
    writeDraftNow,
  ]);

  // Sinkronisasi pilihan TP & SLM default saat mata pelajaran yang dipilih berubah
  useEffect(() => {
    if (!activeMapelOption) return;
    if (activeMapelOption.tpOptions.length > 0) {
      setSelectedTpKode((prev) =>
        activeMapelOption.tpOptions.some((t) => t.kodeTp === prev)
          ? prev
          : activeMapelOption.tpOptions[0].kodeTp
      );
    } else {
      setSelectedTpKode("TP 1");
    }

    if (activeMapelOption.slmOptions.length > 0) {
      setSelectedSlmKey((prev) =>
        activeMapelOption.slmOptions.some((s) => s.nama === prev)
          ? prev
          : activeMapelOption.slmOptions[0].nama
      );
    } else {
      setSelectedSlmKey("SLM 1");
    }
  }, [activeMapelOption]);

  // Handler pergantian Kelas yang Diampu
  const handleSelectRombel = (newRombelId: string) => {
    setSelectedRombelId(newRombelId);
    const targetR = rombelOptions.find((r) => r.id === newRombelId);
    const nextPId = targetR?.mapelList[0]?.pembelajaranId || "";
    setSelectedPembelajaranId(nextPId);
    setFeedback(null);
  };

  // Handler pergantian Mata Pelajaran (Kode Mapel yang Diampu)
  const handleSelectMapel = (newPembelajaranId: string) => {
    setSelectedPembelajaranId(newPembelajaranId);
    setFeedback(null);
  };

  // Handler perubahan Nilai Dasar per siswa (simpan sinkron ke localStorage)
  const handleNilaiDasarChange = (siswaId: string, val: string) => {
    setNilaiDasarMap((prev) => {
      const next = {
        ...prev,
        [siswaId]: val,
      };
      writeDraftNow(
        activeRombelId,
        activePembelajaranId,
        next,
        nilaiKonversiMap,
        nilaiTertinggiDiinginkan,
        nilaiTerendahDiinginkan,
        roundingMode
      );
      return next;
    });
  };

  // Handler perubahan Nilai Tertinggi & Terendah Diinginkan (simpan sinkron ke localStorage)
  const handleTargetMaxChange = (val: string) => {
    setNilaiTertinggiDiinginkan(val);
    writeDraftNow(
      activeRombelId,
      activePembelajaranId,
      nilaiDasarMap,
      nilaiKonversiMap,
      val,
      nilaiTerendahDiinginkan,
      roundingMode
    );
  };

  const handleTargetMinChange = (val: string) => {
    setNilaiTerendahDiinginkan(val);
    writeDraftNow(
      activeRombelId,
      activePembelajaranId,
      nilaiDasarMap,
      nilaiKonversiMap,
      nilaiTertinggiDiinginkan,
      val,
      roundingMode
    );
  };

  // Fitur Paste langsung dari kolom Excel ke kolom Nilai Dasar
  const handlePasteNilaiDasar = (
    startIndex: number,
    e: React.ClipboardEvent<HTMLInputElement>
  ) => {
    if (!activeRombel) return;
    const text = e.clipboardData.getData("text");
    if (!text || (!text.includes("\n") && !text.includes("\r"))) return;

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length <= 1) return;

    e.preventDefault();
    setNilaiDasarMap((prev) => {
      const next = { ...prev };
      lines.forEach((lineVal, offset) => {
        const targetSiswa = activeRombel.siswaList[startIndex + offset];
        if (!targetSiswa) return;
        const firstCell = lineVal.split("\t")[0]?.trim().replace(",", ".") ?? "";
        if (firstCell !== "" && !Number.isNaN(Number(firstCell))) {
          next[targetSiswa.siswaId] = firstCell;
        }
      });
      writeDraftNow(
        activeRombelId,
        activePembelajaranId,
        next,
        nilaiKonversiMap,
        nilaiTertinggiDiinginkan,
        nilaiTerendahDiinginkan,
        roundingMode
      );
      return next;
    });
  };

  // ===========================================================================
  // 3. FITUR TOMBOL ACTION "TARIK NILAI AKHIR":
  //    Menarik data Nilai Akhir di Kelas yang Diampu & Mapel yang Diampu,
  //    meletakkannya langsung di Kolom Nilai (Nilai Dasar), dan langsung
  //    mengonversi nilainya secara realtime!
  // ===========================================================================
  const handleTarikNilaiAkhir = () => {
    if (!activeRombel || !activeMapelOption) {
      setFeedback({
        type: "error",
        message: "Pilih Kelas dan Mata Pelajaran yang diampu terlebih dahulu.",
      });
      return;
    }

    setFeedback(null);

    // 1. Kumpulkan Nilai Akhir dari data server + cache lokal + draft belum disimpan di lembar penilaian
    const mergedScores: Record<string, number> = {
      ...activeMapelOption.nilaiAkhirMap,
      ...(localNilaiAkhirOverride[activeMapelOption.pembelajaranId] || {}),
    };

    // Periksa juga apabila ada draft lokal di Kelas & Input Nilai (stupa_nilai_draft_v1_${pembelajaranId})
    if (typeof window !== "undefined" && activeMapelOption.penilaianCols.length > 0) {
      try {
        const rawNilaiDraft = window.localStorage.getItem(
          `stupa_nilai_draft_v1_${activeMapelOption.pembelajaranId}`
        );
        if (rawNilaiDraft) {
          const parsedDraft = JSON.parse(rawNilaiDraft) as {
            values?: Record<string, string>;
          };
          if (parsedDraft?.values && typeof parsedDraft.values === "object") {
            for (const s of activeRombel.siswaList) {
              const harianVals: (number | null)[] = [];
              const slmVals: (number | null)[] = [];
              const utsVals: (number | null)[] = [];
              const uasVals: (number | null)[] = [];
              let hasDraftCell = false;

              for (const col of activeMapelOption.penilaianCols) {
                const cellKey = `${col.id}_${s.siswaId}`;
                const rawCell = parsedDraft.values[cellKey]?.trim() ?? "";
                if (rawCell === "") continue;
                const num = parseFloat(rawCell);
                if (Number.isNaN(num) || num < 0 || num > 100) continue;
                hasDraftCell = true;
                if (col.kategori === "HARIAN") harianVals.push(num);
                else if (col.kategori === "SLM") slmVals.push(num);
                else if (col.kategori === "UTS") utsVals.push(num);
                else if (col.kategori === "UAS") uasVals.push(num);
              }

              if (hasDraftCell) {
                const calc = hitungNilaiAkhirLengkap(
                  { harian: harianVals, slm: slmVals, uts: utsVals, uas: uasVals },
                  {
                    bobotHarian: activeMapelOption.bobotHarian,
                    bobotUts: activeMapelOption.bobotUts,
                    bobotUas: activeMapelOption.bobotUas,
                  }
                );
                if (calc.nilaiAkhir !== null) {
                  mergedScores[s.siswaId] = Math.round(calc.nilaiAkhir);
                }
              }
            }
          }
        }
      } catch {
        // Ignore
      }
    }

    const applyPulledScores = (scoresToApply: Record<string, number>, msg?: string) => {
      const nextDasarMap: Record<string, string> = {};
      let count = 0;
      for (const s of activeRombel.siswaList) {
        const val = scoresToApply[s.siswaId];
        if (val !== undefined && val !== null && !Number.isNaN(val)) {
          nextDasarMap[s.siswaId] = String(Math.round(val));
          count++;
        }
      }

      if (count === 0) {
        setFeedback({
          type: "error",
          message:
            msg ||
            `Belum ada data Nilai Akhir pada mata pelajaran ${activeMapelOption.mapelKode} (${activeMapelOption.mapelNama}) di Kelas ${activeRombel.nama}.`,
        });
        return;
      }

      // Pastikan Nilai Tertinggi Diinginkan & Nilai Terendah Diinginkan terisi agar langsung terkonversi realtime
      const nextTargetMin =
        nilaiTerendahDiinginkan.trim() !== ""
          ? nilaiTerendahDiinginkan
          : String(activeMapelOption.kktp || 75);
      const nextTargetMax =
        nilaiTertinggiDiinginkan.trim() !== "" ? nilaiTertinggiDiinginkan : "95";

      setNilaiTerendahDiinginkan(nextTargetMin);
      setNilaiTertinggiDiinginkan(nextTargetMax);
      setNilaiDasarMap(nextDasarMap);

      writeDraftNow(
        activeRombel.id,
        activeMapelOption.pembelajaranId,
        nextDasarMap,
        nilaiKonversiMap,
        nextTargetMax,
        nextTargetMin,
        roundingMode
      );

      setFeedback({
        type: "success",
        message:
          msg ||
          `Berhasil menarik ${count} Nilai Akhir mata pelajaran ${activeMapelOption.mapelKode} (${activeMapelOption.mapelNama}) — Kelas ${activeRombel.nama} ke Kolom Nilai Dasar dan langsung dikonversi!`,
      });
    };

    // Terapkan langsung data lokal yang tersedia agar respons instan
    if (Object.keys(mergedScores).length > 0) {
      applyPulledScores(mergedScores);
    }

    // Jika online, sinkronkan juga data terbaru dari database server
    if (isOnline) {
      startPullTransition(async () => {
        try {
          const res = await tarikNilaiAkhirPembelajaranAction(
            activeMapelOption.pembelajaranId
          );
          if (res.success && res.scores) {
            const combined = { ...mergedScores, ...res.scores };
            applyPulledScores(combined, res.message);
          } else if (Object.keys(mergedScores).length === 0) {
            setFeedback({ type: "error", message: res.message });
          }
        } catch {
          // Jika gagal jaringan tetapi mergedScores sudah ada, tetap gunakan mergedScores
        }
      });
    }
  };

  // Navigasi tombol Enter / Panah Atas / Panah Bawah antar baris siswa
  const handleRowKeyDown = (
    rowIndex: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (!activeRombel) return;
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextEl = inputRefs.current[rowIndex + 1];
      if (nextEl) {
        nextEl.focus();
        nextEl.select();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevEl = inputRefs.current[rowIndex - 1];
      if (prevEl) {
        prevEl.focus();
        prevEl.select();
      }
    }
  };

  const handleResetAll = () => {
    if (!activeRombel) return;
    if (
      !window.confirm(
        `Kosongkan seluruh input Nilai Dasar untuk ${
          activeMapelOption
            ? `${activeMapelOption.mapelKode} (${activeMapelOption.mapelNama}) — `
            : ""
        }Kelas ${activeRombel.nama}?`
      )
    ) {
      return;
    }
    setNilaiDasarMap({});
    setRestoredFromDraft(false);
    setFeedback(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(
        buildDraftKey(activeRombel.id, activePembelajaranId)
      );
      window.localStorage.removeItem(`stupa_konversi_nilai_draft_v1_${activeRombel.id}`);
    }
    setDraftSavedAt(null);
  };

  const handleOpenTransferModal = () => {
    setFeedback(null);

    if (!activeMapelOption) {
      setFeedback({
        type: "error",
        message: "Pilih Mata Pelajaran (Kode Mapel yang Diampu) terlebih dahulu.",
      });
      return;
    }

    if (nilaiTertinggiDiinginkan.trim() === "" || parsedTargetMax === null) {
      setFeedback({
        type: "error",
        message: "Kolom 'Nilai Tertinggi Diinginkan' wajib diisi terlebih dahulu.",
      });
      return;
    }

    if (nilaiTerendahDiinginkan.trim() === "" || parsedTargetMin === null) {
      setFeedback({
        type: "error",
        message: "Kolom 'Nilai Terendah Diinginkan' wajib diisi terlebih dahulu.",
      });
      return;
    }

    if (parsedTargetMax < parsedTargetMin) {
      setFeedback({
        type: "error",
        message:
          "Nilai Tertinggi Diinginkan tidak boleh lebih kecil dari Nilai Terendah Diinginkan.",
      });
      return;
    }

    if (filledCount === 0) {
      setFeedback({
        type: "error",
        message:
          "Isi minimal 1 Nilai Dasar siswa (atau klik 'Tarik Nilai Akhir') terlebih dahulu sebelum melakukan Transfer Nilai.",
      });
      return;
    }

    setShowTransferModal(true);
  };

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRombel || !activeMapelOption) return;

    const validConvertedScores: Record<string, number> = {};
    for (const s of activeRombel.siswaList) {
      const val = nilaiKonversiMap[s.siswaId];
      if (val !== null && val !== undefined && !Number.isNaN(val)) {
        validConvertedScores[s.siswaId] =
          selectedTargetType === "NILAI_AKHIR" ? Math.round(val) : val;
      }
    }

    if (Object.keys(validConvertedScores).length === 0) {
      setFeedback({
        type: "error",
        message: "Tidak ada data Nilai Konversi yang dapat ditransfer.",
      });
      return;
    }

    let penilaianId: string | null = null;
    let kodeTp: string | null = null;
    let tujuanPembelajaranText: string | null = null;
    let namaKolom: string | null = null;

    if (selectedTargetType === "TP") {
      const tpObj = activeMapelOption.tpOptions.find(
        (t) => t.kodeTp === selectedTpKode
      );
      penilaianId = tpObj?.penilaianId ?? null;
      kodeTp = tpObj?.kodeTp || selectedTpKode || "TP 1";
      tujuanPembelajaranText = tpObj?.deskripsi ?? null;
      namaKolom = kodeTp;
    } else if (selectedTargetType === "SLM") {
      const slmObj = activeMapelOption.slmOptions.find(
        (s) => s.nama === selectedSlmKey
      );
      penilaianId = slmObj?.penilaianId ?? null;
      namaKolom = slmObj?.nama || selectedSlmKey || "SLM 1";
    } else if (selectedTargetType === "STS") {
      penilaianId = activeMapelOption.stsOption.penilaianId;
      namaKolom = activeMapelOption.stsOption.nama || "STS";
    } else if (selectedTargetType === "SAS") {
      penilaianId = activeMapelOption.sasOption.penilaianId;
      namaKolom = activeMapelOption.sasOption.nama || "SAS";
    } else if (selectedTargetType === "NILAI_AKHIR") {
      namaKolom = "Nilai Akhir";
    }

    startTransition(async () => {
      const res = await transferNilaiKonversiAction({
        pembelajaranId: activeMapelOption.pembelajaranId,
        targetType: selectedTargetType,
        penilaianId,
        kodeTp,
        tujuanPembelajaranText,
        namaKolom,
        scores: validConvertedScores,
      });

      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        if (selectedTargetType === "NILAI_AKHIR" && res.nilaiAkhirMap) {
          setLocalNilaiAkhirOverride((prev) => ({
            ...prev,
            [activeMapelOption.pembelajaranId]: {
              ...(prev[activeMapelOption.pembelajaranId] || {}),
              ...res.nilaiAkhirMap,
            },
          }));
        }

        // Sinkronkan juga draft localStorage Kelas & Input Nilai apabila mentransfer ke kolom penilaian
        if (typeof window !== "undefined" && res.penilaianId) {
          try {
            const nilaiDraftKey = `stupa_nilai_draft_v1_${activeMapelOption.pembelajaranId}`;
            const rawExistingDraft = window.localStorage.getItem(nilaiDraftKey);
            if (rawExistingDraft) {
              const parsedDraft = JSON.parse(rawExistingDraft);
              if (parsedDraft && parsedDraft.values) {
                for (const [sId, scoreVal] of Object.entries(validConvertedScores)) {
                  parsedDraft.values[`${res.penilaianId}_${sId}`] = String(scoreVal);
                }
                parsedDraft.updatedAt = new Date().toISOString();
                window.localStorage.setItem(nilaiDraftKey, JSON.stringify(parsedDraft));
              }
            }
          } catch {
            // Abaikan jika gagal update draft
          }
        }

        setShowTransferModal(false);
        setFeedback({
          type: "success",
          message: res.message,
          linkPembelajaranId: activeMapelOption.pembelajaranId,
          linkRombelId: activeRombel.id,
        });
        router.refresh();
      }
    });
  };

  if (rombelOptions.length === 0 || !activeRombel) {
    return (
      <div className="bg-white/95 rounded-3xl p-8 border border-slate-200 text-center space-y-3 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto text-2xl">
          <i className="fa-solid fa-wand-magic-sparkles" />
        </div>
        <h2 className="text-base font-extrabold text-slate-800">
          Belum Ada Kelas / Rombongan Belajar yang Diampu
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Akun Anda belum memiliki penugasan kelas atau mata pelajaran pada semester aktif ini. Silakan hubungi Superadmin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 font-bold text-[10px] tracking-wider uppercase">
              <i className="fa-solid fa-wand-magic-sparkles mr-1" />
              Alat Konversi Nilai
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px]">
              {peranLabel}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">{semesterLabel}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Konversi Nilai & Transfer ke Daftar Nilai / Nilai Akhir
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Tarik Nilai Akhir atau isi Nilai Dasar siswa, konversi otomatis ke rentang nilai yang diinginkan secara realtime, lalu transfer langsung ke TP, SLM, STS, SAS, atau Nilai Akhir.
          </p>
        </div>

        {/* INDIKATOR PENYIMPANAN SEMENTARA OTOMATIS (ANTI HILANG SAAT REFRESH / SINYAL HILANG) */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            className={`px-3.5 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              isOnline
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-700"
                : "bg-amber-50 border-amber-300 text-amber-800 animate-pulse"
            }`}
          >
            <i
              className={`fa-solid ${
                isOnline ? "fa-cloud-check text-emerald-600" : "fa-wifi-slash text-amber-600"
              }`}
            />
            <div>
              <p className="leading-tight">
                {isOnline
                  ? "Penyimpanan Sementara Aktif (Tahan Refresh)"
                  : "Sinyal Terputus — Mode Offline Aktif"}
              </p>
              <p className="text-[10px] font-medium opacity-80">
                {draftSavedAt
                  ? `Tersimpan otomatis pukul ${draftSavedAt}`
                  : "Data aman tersimpan otomatis di perangkat"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BAR PILIHAN: KELAS YANG DIAMPU + MATA PELAJARAN (DI SEBELAH KANAN)    */}
      {/* + TOMBOL ACTION "TARIK NILAI AKHIR"                                   */}
      {/* ===================================================================== */}
      <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          {/* KIRI: KELAS YANG DIAMPU */}
          <div className="md:col-span-4 space-y-1.5">
            <label
              htmlFor="select-rombel-konversi"
              className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider"
            >
              <i className="fa-solid fa-chalkboard-user text-blue-600 mr-1.5" />
              Kelas yang Diampu
            </label>
            <select
              id="select-rombel-konversi"
              value={activeRombel.id}
              onChange={(e) => handleSelectRombel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              {rombelOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  Kelas {r.nama} (Tingkat {r.tingkat}) — {r.siswaList.length} Siswa
                </option>
              ))}
            </select>
          </div>

          {/* SEBELAH KANAN KELAS YANG DIAMPU: MATA PELAJARAN (KODE MAPEL YANG DIAMPU) */}
          <div className="md:col-span-5 space-y-1.5">
            <label
              htmlFor="select-mapel-konversi"
              className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider"
            >
              <i className="fa-solid fa-book-open text-violet-600 mr-1.5" />
              Mata Pelajaran (Kode Mapel yang Diampu)
            </label>
            <select
              id="select-mapel-konversi"
              value={activeMapelOption?.pembelajaranId || ""}
              onChange={(e) => handleSelectMapel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-violet-50/50 border border-violet-300 text-xs font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
            >
              {activeRombel.mapelList.length === 0 ? (
                <option value="">-- Belum Ada Mapel Diampu --</option>
              ) : (
                activeRombel.mapelList.map((m) => (
                  <option key={m.pembelajaranId} value={m.pembelajaranId}>
                    {m.mapelKode} — {m.mapelNama} (Kelas {activeRombel.nama})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* TOMBOL ACTION "TARIK NILAI AKHIR" */}
          <div className="md:col-span-3">
            <button
              type="button"
              onClick={handleTarikNilaiAkhir}
              disabled={!activeMapelOption || isPulling}
              title="Tarik Nilai Akhir siswa dari kelas & mata pelajaran yang dipilih langsung ke Kolom Nilai Dasar dan konversi otomatis"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isPulling ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Menarik Nilai Akhir...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-arrow-down" />
                  <span>Tarik Nilai Akhir</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Ringkas Kelas & Mapel Aktif */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2.5">
            <span>
              Pendidik: <strong className="text-slate-800">{guruNama}</strong>
            </span>
            <span>•</span>
            <span>
              Kelas Aktif:{" "}
              <strong className="text-blue-700">
                Kelas {activeRombel.nama} ({activeRombel.siswaList.length} Siswa)
              </strong>
            </span>
            <span>•</span>
            <span>
              Mapel Aktif:{" "}
              <strong className="text-violet-700">
                {activeMapelOption
                  ? `${activeMapelOption.mapelKode} — ${activeMapelOption.mapelNama} (KKTP ${activeMapelOption.kktp})`
                  : "-"}
              </strong>
            </span>
          </div>

          {activeMapelOption && (
            <Link
              href={`/guru/nilai/${activeMapelOption.pembelajaranId}`}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              <span>Lihat Lembar Penilaian {activeMapelOption.mapelKode}</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
            </Link>
          )}
        </div>
      </div>

      {/* BANNER PEMULIHAN DRAFT & FEEDBACK */}
      {restoredFromDraft && (
        <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 font-semibold">
            <i className="fa-solid fa-rotate-left text-sky-600 text-sm" />
            <span>
              Data <strong>Nilai Dasar</strong> & <strong>Nilai Konversi</strong> untuk{" "}
              <strong>
                {activeMapelOption
                  ? `${activeMapelOption.mapelKode} (${activeMapelOption.mapelNama}) — `
                  : ""}
                Kelas {activeRombel.nama}
              </strong>{" "}
              tetap tersimpan dan berhasil dipulihkan otomatis.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRestoredFromDraft(false)}
            className="text-sky-700 hover:text-sky-900 font-bold text-[11px] underline cursor-pointer"
          >
            Tutup Info
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : feedback.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <i
              className={`fa-solid text-base ${
                feedback.type === "success"
                  ? "fa-circle-check text-emerald-600"
                  : feedback.type === "error"
                  ? "fa-triangle-exclamation text-rose-600"
                  : "fa-circle-info text-blue-600"
              }`}
            />
            <span>{feedback.message}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {feedback.linkPembelajaranId && (
              <Link
                href={`/guru/nilai/${feedback.linkPembelajaranId}`}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
              >
                <i className="fa-solid fa-table-list" />
                <span>Buka Lembar Penilaian &rarr;</span>
              </Link>
            )}
            {feedback.linkRombelId && (
              <Link
                href={`/guru/leger?rombelId=${feedback.linkRombelId}`}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
              >
                <i className="fa-solid fa-list-check" />
                <span>Lihat Leger Nilai &rarr;</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-1.5 rounded-lg hover:bg-black/5 text-slate-500 cursor-pointer"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4 KOLOM PARAMETER KONVERSI + TOMBOL ACTION "TRANSFER NILAI"           */}
      {/* ===================================================================== */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-sliders text-violet-600" />
              <span>Parameter Konversi Nilai & Transfer Daftar Nilai</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Nilai Tertinggi & Terendah dihitung otomatis dari Kolom Nilai Dasar yang terisi. Isi Nilai Tertinggi & Terendah Diinginkan untuk melihat hasil konversi realtime.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setRoundingMode("INTEGER");
                  writeDraftNow(
                    activeRombelId,
                    activePembelajaranId,
                    nilaiDasarMap,
                    nilaiKonversiMap,
                    nilaiTertinggiDiinginkan,
                    nilaiTerendahDiinginkan,
                    "INTEGER"
                  );
                }}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  roundingMode === "INTEGER"
                    ? "bg-white text-violet-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Bulat (Satuan)
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoundingMode("DECIMAL_2");
                  writeDraftNow(
                    activeRombelId,
                    activePembelajaranId,
                    nilaiDasarMap,
                    nilaiKonversiMap,
                    nilaiTertinggiDiinginkan,
                    nilaiTerendahDiinginkan,
                    "DECIMAL_2"
                  );
                }}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  roundingMode === "DECIMAL_2"
                    ? "bg-white text-violet-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Presisi (2 Desimal)
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetAll}
              disabled={filledCount === 0}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold transition disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5"
              title="Kosongkan seluruh Nilai Dasar"
            >
              <i className="fa-solid fa-trash-can" />
              <span>Reset Nilai</span>
            </button>
          </div>
        </div>

        {/* DERETAN 4 KOLOM + 1 TOMBOL ACTION "TRANSFER NILAI" DI SEBELAHNYA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-stretch">
          {/* KOLOM 1: NILAI TERTINGGI (OTOMATIS DARI NILAI DASAR, TIDAK BISA DIEDIT) */}
          <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                1. Nilai Tertinggi
              </label>
              <span className="px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-600 text-[9px] font-bold uppercase">
                Otomatis • Terkunci
              </span>
            </div>
            <input
              type="text"
              readOnly
              disabled
              value={nilaiTertinggiDasar !== null ? String(nilaiTertinggiDasar) : "-"}
              aria-label="Nilai Tertinggi dari Nilai Dasar"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-200/60 border border-slate-300 text-slate-800 font-mono text-lg font-black text-center cursor-not-allowed select-none"
            />
            <p className="text-[10px] text-slate-400 font-medium mt-1.5">
              Diambil otomatis dari Nilai Dasar tertinggi ({filledCount} siswa terisi)
            </p>
          </div>

          {/* KOLOM 2: NILAI TERENDAH (OTOMATIS DARI NILAI DASAR, TIDAK BISA DIEDIT) */}
          <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                2. Nilai Terendah
              </label>
              <span className="px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-600 text-[9px] font-bold uppercase">
                Otomatis • Terkunci
              </span>
            </div>
            <input
              type="text"
              readOnly
              disabled
              value={nilaiTerendahDasar !== null ? String(nilaiTerendahDasar) : "-"}
              aria-label="Nilai Terendah dari Nilai Dasar"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-200/60 border border-slate-300 text-slate-800 font-mono text-lg font-black text-center cursor-not-allowed select-none"
            />
            <p className="text-[10px] text-slate-400 font-medium mt-1.5">
              Diambil otomatis dari Nilai Dasar terendah ({filledCount} siswa terisi)
            </p>
          </div>

          {/* KOLOM 3: NILAI TERTINGGI DIINGINKAN (MANUAL, WAJIB ISI) */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/90 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="input-target-max"
                className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800"
              >
                3. Nilai Tertinggi Diinginkan <span className="text-rose-600">*</span>
              </label>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase">
                Wajib Isi
              </span>
            </div>
            <input
              id="input-target-max"
              type="number"
              step="any"
              required
              placeholder="Contoh: 95"
              value={nilaiTertinggiDiinginkan}
              onChange={(e) => handleTargetMaxChange(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl bg-white border font-mono text-lg font-black text-center focus:outline-none focus:ring-2 transition ${
                nilaiTertinggiDiinginkan.trim() === "" || parsedTargetMax === null
                  ? "border-rose-400 text-rose-700 focus:ring-rose-500/30"
                  : "border-emerald-300 text-emerald-900 focus:ring-emerald-500/30 focus:border-emerald-500"
              }`}
            />
            <p className="text-[10px] text-emerald-700/80 font-medium mt-1.5">
              Batas atas nilai hasil konversi (diisi manual, wajib diisi)
            </p>
          </div>

          {/* KOLOM 4: NILAI TERENDAH DIINGINKAN (MANUAL, WAJIB ISI) */}
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/90 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="input-target-min"
                className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800"
              >
                4. Nilai Terendah Diinginkan <span className="text-rose-600">*</span>
              </label>
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[9px] font-bold uppercase">
                Wajib Isi
              </span>
            </div>
            <input
              id="input-target-min"
              type="number"
              step="any"
              required
              placeholder="Contoh: 75"
              value={nilaiTerendahDiinginkan}
              onChange={(e) => handleTargetMinChange(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl bg-white border font-mono text-lg font-black text-center focus:outline-none focus:ring-2 transition ${
                nilaiTerendahDiinginkan.trim() === "" || parsedTargetMin === null
                  ? "border-rose-400 text-rose-700 focus:ring-rose-500/30"
                  : "border-blue-300 text-blue-900 focus:ring-blue-500/30 focus:border-blue-500"
              }`}
            />
            <p className="text-[10px] text-blue-700/80 font-medium mt-1.5">
              Batas bawah nilai hasil konversi (diisi manual, wajib diisi)
            </p>
          </div>

          {/* TOMBOL ACTION DI SEBELAH 4 KOLOM: "TRANSFER NILAI" */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-white flex flex-col justify-between shadow-md shadow-indigo-500/15">
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-indigo-100 mb-1">
                <span>Mapel: {activeMapelOption?.mapelKode || "-"}</span>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {filledCount}/{activeRombel.siswaList.length} Siswa
                </span>
              </div>
              <p className="text-xs font-bold text-white/95 leading-snug">
                Kirim ke TP, SLM, STS, SAS, atau Nilai Akhir ({activeMapelOption?.mapelKode || "-"})
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenTransferModal}
              disabled={semesterStatus !== "AKTIF"}
              className="mt-3 w-full py-2.5 px-4 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <i className="fa-solid fa-paper-plane" />
              <span>Transfer Nilai</span>
            </button>
          </div>
        </div>

        {/* INFORMASI RUMUS AKTIF */}
        <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-2 font-mono">
            <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-800 font-bold font-sans text-[10px]">
              RUMUS KONVERSI
            </span>
            <span className="font-semibold text-slate-700">
              = Nilai Terendah Diinginkan + ((Kolom Nilai Dasar - Nilai Terendah) / (Nilai Tertinggi - Nilai Terendah) * (Nilai Tertinggi Diinginkan - Nilai Terendah Diinginkan))
            </span>
          </div>
          {!isDesiredRangeValid && (
            <span className="text-rose-600 font-bold">
              <i className="fa-solid fa-circle-exclamation mr-1" />
              Isi Nilai Tertinggi & Terendah Diinginkan untuk menampilkan Nilai Konversi!
            </span>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TABEL DAFTAR NAMA SISWA: KOLOM NILAI DASAR & KOLOM NILAI KONVERSI     */}
      {/* ===================================================================== */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">
              Daftar Peserta Didik • Kelas {activeRombel.nama}
              {activeMapelOption
                ? ` • ${activeMapelOption.mapelKode} (${activeMapelOption.mapelNama})`
                : ""}
            </h3>
            <p className="text-[11px] text-slate-500">
              Ketik manual pada <strong>Kolom Nilai (Nilai Dasar)</strong>, tempel (Paste) dari Excel, atau klik tombol <strong>Tarik Nilai Akhir</strong> di atas.
            </p>
          </div>
          <div className="text-xs font-bold text-slate-600">
            Terisi:{" "}
            <span className="text-blue-700 font-extrabold">{filledCount}</span> dari{" "}
            <span className="text-slate-800 font-extrabold">
              {activeRombel.siswaList.length}
            </span>{" "}
            siswa
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white text-[11px] font-extrabold uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-14 border-r border-slate-700">No</th>
                <th className="py-3.5 px-4 w-32 border-r border-slate-700">NISN</th>
                <th className="py-3.5 px-4 border-r border-slate-700">Nama Peserta Didik</th>
                <th className="py-3.5 px-3 text-center w-16 border-r border-slate-700">L/P</th>
                <th className="py-3.5 px-5 text-center w-52 bg-blue-900/90 border-r border-slate-700">
                  <div>Kolom Nilai</div>
                  <div className="text-[9px] font-normal text-blue-200 normal-case mt-0.5">
                    (Nilai Dasar — Manual / Tarik Nilai Akhir)
                  </div>
                </th>
                <th className="py-3.5 px-5 text-center w-52 bg-violet-900/90">
                  <div>Kolom Nilai Konversi</div>
                  <div className="text-[9px] font-normal text-violet-200 normal-case mt-0.5">
                    (Hasil Konversi Realtime)
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {activeRombel.siswaList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                    Belum ada data peserta didik pada kelas ini.
                  </td>
                </tr>
              ) : (
                activeRombel.siswaList.map((siswa, idx) => {
                  const rawNilaiDasar = nilaiDasarMap[siswa.siswaId] ?? "";
                  const hasilKonversi = nilaiKonversiMap[siswa.siswaId] ?? null;
                  const hasNilaiDasar = parsedNilaiDasarEntries.has(siswa.siswaId);
                  const isHighest =
                    hasNilaiDasar &&
                    nilaiTertinggiDasar !== null &&
                    parsedNilaiDasarEntries.get(siswa.siswaId) === nilaiTertinggiDasar;
                  const isLowest =
                    hasNilaiDasar &&
                    nilaiTerendahDasar !== null &&
                    parsedNilaiDasarEntries.get(siswa.siswaId) === nilaiTerendahDasar &&
                    nilaiTertinggiDasar !== nilaiTerendahDasar;

                  return (
                    <tr
                      key={siswa.siswaId}
                      className={`transition-colors ${
                        hasNilaiDasar
                          ? "bg-white hover:bg-blue-50/30"
                          : "bg-slate-50/30 hover:bg-slate-100/50"
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-500 border-r border-slate-100">
                        {siswa.noUrut}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 border-r border-slate-100">
                        {siswa.nisn}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-800 border-r border-slate-100">
                        <div className="flex items-center justify-between gap-2">
                          <span>{siswa.nama}</span>
                          {isHighest && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase shrink-0">
                              Tertinggi
                            </span>
                          )}
                          {isLowest && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase shrink-0">
                              Terendah
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-600 border-r border-slate-100">
                        {siswa.jenisKelamin}
                      </td>

                      {/* KOLOM 1: NILAI (NILAI DASAR DIISI MANUAL / DITARIK DARI NILAI AKHIR) */}
                      <td className="py-2 px-4 border-r border-slate-100 bg-blue-50/20">
                        <input
                          ref={(el) => {
                            inputRefs.current[idx] = el;
                          }}
                          type="number"
                          step="any"
                          placeholder="Ketik nilai..."
                          value={rawNilaiDasar}
                          onChange={(e) =>
                            handleNilaiDasarChange(siswa.siswaId, e.target.value)
                          }
                          onKeyDown={(e) => handleRowKeyDown(idx, e)}
                          onPaste={(e) => handlePasteNilaiDasar(idx, e)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 focus:outline-none font-mono text-sm font-extrabold text-center text-slate-900 transition"
                        />
                      </td>

                      {/* KOLOM 2: NILAI KONVERSI (HASIL KONVERSI REALTIME) */}
                      <td className="py-2 px-4 bg-violet-50/25 text-center">
                        <input
                          type="text"
                          readOnly
                          tabIndex={-1}
                          value={hasilKonversi !== null ? String(hasilKonversi) : "-"}
                          aria-label={`Nilai Konversi ${siswa.nama}`}
                          className={`w-full px-3 py-2 rounded-xl border font-mono text-sm font-black text-center select-all cursor-default ${
                            hasilKonversi !== null
                              ? "bg-violet-100/80 border-violet-300 text-violet-900 shadow-2xs"
                              : "bg-slate-100 border-slate-200 text-slate-400"
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL ACTION "TRANSFER NILAI"                                         */}
      {/* (Mengacu pada Kelas & Mata Pelajaran yang dipilih di bar atas,        */}
      {/*  dengan Pilihan Transfer ke: TP / SLM / STS / SAS / Nilai Akhir)      */}
      {/* ===================================================================== */}
      {showTransferModal && activeMapelOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-slate-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-lg shrink-0">
                  <i className="fa-solid fa-paper-plane" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Transfer Nilai Konversi
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kelas {activeRombel.nama} •{" "}
                    <strong className="text-violet-700">
                      {activeMapelOption.mapelKode} ({activeMapelOption.mapelNama})
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="space-y-4">
              {/* INFO KELAS & MATA PELAJARAN YANG DIPILIH */}
              <div className="p-3.5 rounded-2xl bg-violet-50/70 border border-violet-200 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-600 block">
                    Kelas & Mata Pelajaran Tujuan
                  </span>
                  <p className="font-extrabold text-slate-900 mt-0.5">
                    Kelas {activeRombel.nama} • {activeMapelOption.mapelKode} —{" "}
                    {activeMapelOption.mapelNama}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-white border border-violet-200 text-violet-700 font-mono font-bold text-[11px] shrink-0">
                  {filledCount} Siswa
                </span>
              </div>

              {/* PILIHAN TRANSFER KE (TP / SLM / STS / SAS / NILAI AKHIR) */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Pilihan Transfer ke (TP / SLM / STS / SAS / Nilai Akhir){" "}
                  <span className="text-rose-600">*</span>
                </label>

                {/* Dropdown terpadu berisi Kode TP (Menu Tujuan Pembelajaran), SLM (Daftar Nilai), STS, SAS, & Nilai Akhir */}
                <select
                  required
                  value={
                    selectedTargetType === "TP"
                      ? `TP::${selectedTpKode}`
                      : selectedTargetType === "SLM"
                      ? `SLM::${selectedSlmKey}`
                      : selectedTargetType === "STS"
                      ? "STS::STS"
                      : selectedTargetType === "SAS"
                      ? "SAS::SAS"
                      : "NILAI_AKHIR::NILAI_AKHIR"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith("TP::")) {
                      setSelectedTargetType("TP");
                      setSelectedTpKode(val.slice(4));
                    } else if (val.startsWith("SLM::")) {
                      setSelectedTargetType("SLM");
                      setSelectedSlmKey(val.slice(5));
                    } else if (val === "STS::STS") {
                      setSelectedTargetType("STS");
                    } else if (val === "SAS::SAS") {
                      setSelectedTargetType("SAS");
                    } else if (val === "NILAI_AKHIR::NILAI_AKHIR") {
                      setSelectedTargetType("NILAI_AKHIR");
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                >
                  <optgroup label="Nilai Akhir Rapor (Sesuai Kelas & Mapel yang Dipilih)">
                    <option value="NILAI_AKHIR::NILAI_AKHIR">
                      Nilai Akhir — {activeMapelOption.mapelKode} ({activeMapelOption.mapelNama})
                    </option>
                  </optgroup>

                  <optgroup
                    label={`Tujuan Pembelajaran (TP — ${
                      activeMapelOption.tpOptions.length || 0
                    } Kode TP di Menu Tujuan Pembelajaran)`}
                  >
                    {activeMapelOption.tpOptions.length > 0 ? (
                      activeMapelOption.tpOptions.map((tp) => (
                        <option key={`TP::${tp.kodeTp}`} value={`TP::${tp.kodeTp}`}>
                          TP: {tp.kodeTp} —{" "}
                          {tp.deskripsi.length > 60
                            ? `${tp.deskripsi.slice(0, 60)}...`
                            : tp.deskripsi}
                        </option>
                      ))
                    ) : (
                      <option value="TP::TP 1">
                        TP: TP 1 (Buat Kolom TP 1 Otomatis)
                      </option>
                    )}
                  </optgroup>

                  <optgroup
                    label={`Sumatif Lingkup Materi (SLM — ${
                      activeMapelOption.slmOptions.length || 0
                    } Kolom di Daftar Nilai)`}
                  >
                    {activeMapelOption.slmOptions.length > 0 ? (
                      activeMapelOption.slmOptions.map((slm) => (
                        <option key={`SLM::${slm.nama}`} value={`SLM::${slm.nama}`}>
                          SLM: {slm.nama}
                        </option>
                      ))
                    ) : (
                      <option value="SLM::SLM 1">
                        SLM: SLM 1 (Buat Kolom SLM 1 Otomatis)
                      </option>
                    )}
                  </optgroup>

                  <optgroup label="Sumatif Tengah & Akhir Semester (STS & SAS)">
                    <option value="STS::STS">
                      STS — Sumatif Tengah Semester ({activeMapelOption.stsOption.nama || "STS"})
                    </option>
                    <option value="SAS::SAS">
                      SAS — Sumatif Akhir Semester ({activeMapelOption.sasOption.nama || "SAS"})
                    </option>
                  </optgroup>
                </select>

                {/* Tombol Kategori Cepat (TP / SLM / STS / SAS / Nilai Akhir) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {(
                    [
                      {
                        type: "TP" as const,
                        label: "TP",
                        sub: `${activeMapelOption.tpOptions.length || 0} Kode TP`,
                        icon: "fa-bullseye",
                      },
                      {
                        type: "SLM" as const,
                        label: "SLM",
                        sub: `${activeMapelOption.slmOptions.length || 1} SLM`,
                        icon: "fa-layer-group",
                      },
                      {
                        type: "STS" as const,
                        label: "STS",
                        sub: "Tengah Sem.",
                        icon: "fa-file-pen",
                      },
                      {
                        type: "SAS" as const,
                        label: "SAS",
                        sub: "Akhir Sem.",
                        icon: "fa-award",
                      },
                      {
                        type: "NILAI_AKHIR" as const,
                        label: "Nilai Akhir",
                        sub: "Rapor Bulat",
                        icon: "fa-star",
                      },
                    ]
                  ).map((item) => {
                    const active = selectedTargetType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setSelectedTargetType(item.type)}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                          active
                            ? "bg-violet-600 text-white border-violet-600 shadow-xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:border-violet-300"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-black">
                          <span className="truncate">{item.label}</span>
                          <i className={`fa-solid ${item.icon} text-[10px] opacity-80`} />
                        </div>
                        <p
                          className={`text-[9px] mt-0.5 truncate ${
                            active ? "text-violet-100" : "text-slate-400"
                          }`}
                        >
                          {item.sub}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DETAIL PILIHAN KODE TP ATAU KOLOM SLM */}
              {selectedTargetType === "TP" && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Detail Kode TP (Sesuai Menu Tujuan Pembelajaran){" "}
                    <span className="text-rose-600">*</span>
                  </label>
                  {activeMapelOption.tpOptions.length > 0 ? (
                    <select
                      required
                      value={selectedTpKode}
                      onChange={(e) => setSelectedTpKode(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                    >
                      {activeMapelOption.tpOptions.map((tp) => (
                        <option key={tp.kodeTp} value={tp.kodeTp}>
                          {tp.kodeTp} —{" "}
                          {tp.deskripsi.length > 65
                            ? `${tp.deskripsi.slice(0, 65)}...`
                            : tp.deskripsi}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        required
                        value={selectedTpKode}
                        onChange={(e) => setSelectedTpKode(e.target.value)}
                        placeholder="Mis. TP 1"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800"
                      />
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                        Belum ada Kode TP pada menu Tujuan Pembelajaran untuk mapel ini. Kolom{" "}
                        <strong>{selectedTpKode || "TP 1"}</strong> akan dibuat otomatis pada Daftar Nilai.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedTargetType === "SLM" && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Detail Kolom SLM (Sesuai Data SLM di Daftar Nilai){" "}
                    <span className="text-rose-600">*</span>
                  </label>
                  {activeMapelOption.slmOptions.length > 0 ? (
                    <select
                      required
                      value={selectedSlmKey}
                      onChange={(e) => setSelectedSlmKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                    >
                      {activeMapelOption.slmOptions.map((slm) => (
                        <option key={slm.nama} value={slm.nama}>
                          {slm.nama} (Sumatif Lingkup Materi)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <select
                        required
                        value={selectedSlmKey || "SLM 1"}
                        onChange={(e) => setSelectedSlmKey(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800"
                      >
                        <option value="SLM 1">SLM 1 (Buat Kolom SLM Otomatis)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {selectedTargetType === "STS" && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center gap-2.5">
                  <i className="fa-solid fa-file-pen text-amber-600 text-base" />
                  <span>
                    Nilai Konversi akan ditransfer langsung ke kolom{" "}
                    <strong>STS (Sumatif Tengah Semester)</strong> pada mata pelajaran{" "}
                    <strong>
                      {activeMapelOption.mapelKode} ({activeMapelOption.mapelNama})
                    </strong>
                    .
                  </span>
                </div>
              )}

              {selectedTargetType === "SAS" && (
                <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs text-teal-900 font-semibold flex items-center gap-2.5">
                  <i className="fa-solid fa-award text-teal-600 text-base" />
                  <span>
                    Nilai Konversi akan ditransfer langsung ke kolom{" "}
                    <strong>SAS (Sumatif Akhir Semester)</strong> pada mata pelajaran{" "}
                    <strong>
                      {activeMapelOption.mapelKode} ({activeMapelOption.mapelNama})
                    </strong>
                    .
                  </span>
                </div>
              )}

              {selectedTargetType === "NILAI_AKHIR" && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center gap-2.5">
                  <i className="fa-solid fa-star text-emerald-600 text-base" />
                  <span>
                    Nilai Konversi (dibulatkan ke <strong>bilangan bulat</strong>) akan dikirim langsung menjadi{" "}
                    <strong>Nilai Akhir</strong> mata pelajaran{" "}
                    <strong>
                      {activeMapelOption.mapelKode} ({activeMapelOption.mapelNama})
                    </strong>{" "}
                    pada <strong>Kelas {activeRombel.nama}</strong> (tersinkronisasi ke Lembar Penilaian Siswa, Leger Nilai, & Ekspor E-Rapor).
                  </span>
                </div>
              )}

              {/* RINGKASAN NILAI YANG AKAN DITRANSFER */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Jumlah Siswa Ditransfer:</span>
                  <span className="font-extrabold text-slate-800">
                    {filledCount} dari {activeRombel.siswaList.length} Siswa
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Rentang Nilai Dasar:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {nilaiTerendahDasar ?? "-"} s.d. {nilaiTertinggiDasar ?? "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Rentang Nilai Konversi:</span>
                  <span className="font-mono font-extrabold text-violet-700">
                    {parsedTargetMin ?? "-"} s.d. {parsedTargetMax ?? "-"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  disabled={isPending}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !activeMapelOption}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-extrabold shadow-md shadow-indigo-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Mentransfer Nilai...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane" />
                      <span>Transfer Nilai Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
