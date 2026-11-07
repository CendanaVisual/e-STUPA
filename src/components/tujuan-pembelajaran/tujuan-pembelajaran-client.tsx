"use client";

import React, { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  simpanTpManualBatch,
  updateTpItem,
  hapusTpItem,
  imporTpExcel,
} from "@/server/actions/tujuan-pembelajaran";

export interface TpMapelOption {
  id: string;
  kode: string;
  nama: string;
  kelompok: string | null;
}

export interface TpItemData {
  id: string;
  tingkat: number;
  mapelId: string;
  kodeTp: string;
  tujuanPembelajaran: string;
  ruangLingkupMateri: string;
  urutan: number;
}

export interface TpMappingInfo {
  tingkat: number;
  mapelId: string;
  rombelNames: string[];
  guruNames: string[];
}

export interface TingkatOption {
  tingkat: number;
  faseLabel: string;
  mapels: TpMapelOption[];
}

interface DraftManualRow {
  tempId: string;
  kodeTp: string;
  tujuanPembelajaran: string;
  ruangLingkupMateri: string;
}

interface TujuanPembelajaranClientProps {
  role: "SUPERADMIN" | "GURU";
  tingkatOptions: TingkatOption[];
  initialItems: TpItemData[];
  mappings: TpMappingInfo[];
  semesterLabel: string;
  guruName?: string;
}

export default function TujuanPembelajaranClient({
  role,
  tingkatOptions,
  initialItems,
  mappings,
  semesterLabel,
  guruName,
}: TujuanPembelajaranClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultTingkat = tingkatOptions[0]?.tingkat ?? 1;
  const [selectedTingkat, setSelectedTingkat] = useState<number>(defaultTingkat);

  const currentTingkatObj =
    tingkatOptions.find((t) => t.tingkat === selectedTingkat) || tingkatOptions[0];

  const [selectedMapelId, setSelectedMapelId] = useState<string>(
    currentTingkatObj?.mapels[0]?.id || "",
  );

  // Pastikan selectedMapelId selalu valid saat ganti tingkat
  const validMapelsForTingkat = currentTingkatObj?.mapels || [];
  const effectiveMapelId = validMapelsForTingkat.some((m) => m.id === selectedMapelId)
    ? selectedMapelId
    : validMapelsForTingkat[0]?.id || "";

  const activeMapel = validMapelsForTingkat.find((m) => m.id === effectiveMapelId) || null;

  // State baris manual baru (input langsung di kolom tabel)
  const [draftRows, setDraftRows] = useState<DraftManualRow[]>([]);

  // State inline edit baris eksisting
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    kodeTp: string;
    tujuanPembelajaran: string;
    ruangLingkupMateri: string;
  }>({ kodeTp: "", tujuanPembelajaran: "", ruangLingkupMateri: "" });

  // State modal impor & dropdown unduh template
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // State feedback banner & loading key
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Filter item sesuai tingkat & mapel aktif
  const currentItems = initialItems
    .filter((it) => it.tingkat === selectedTingkat && it.mapelId === effectiveMapelId)
    .filter((it) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        it.kodeTp.toLowerCase().includes(q) ||
        it.tujuanPembelajaran.toLowerCase().includes(q) ||
        it.ruangLingkupMateri.toLowerCase().includes(q)
      );
    });

  // Info mapping pengampu untuk (tingkat, mapelId) aktif
  const activeMapping = mappings.find(
    (m) => m.tingkat === selectedTingkat && m.mapelId === effectiveMapelId,
  );

  const countByTingkat = (t: number) =>
    initialItems.filter((it) => it.tingkat === t).length;

  const countByTingkatAndMapel = (t: number, mId: string) =>
    initialItems.filter((it) => it.tingkat === t && it.mapelId === mId).length;

  // Handler pindah tingkat kelas
  const handleSelectTingkat = (t: number) => {
    setSelectedTingkat(t);
    const tObj = tingkatOptions.find((opt) => opt.tingkat === t);
    if (tObj && tObj.mapels.length > 0) {
      if (!tObj.mapels.some((m) => m.id === selectedMapelId)) {
        setSelectedMapelId(tObj.mapels[0].id);
      }
    }
    setEditingId(null);
    setDraftRows([]);
  };

  // Handler pindah mata pelajaran
  const handleSelectMapel = (mId: string) => {
    setSelectedMapelId(mId);
    setEditingId(null);
    setDraftRows([]);
  };

  // Tambah baris input manual secara langsung di kolom tabel
  const handleAddManualRow = () => {
    const nextNum = currentItems.length + draftRows.length + 1;
    const suggestedKode = `TP.${selectedTingkat}.${nextNum}`;
    setDraftRows((prev) => [
      ...prev,
      {
        tempId: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        kodeTp: suggestedKode,
        tujuanPembelajaran: "",
        ruangLingkupMateri: "",
      },
    ]);
  };

  const handleUpdateDraftRow = (
    tempId: string,
    field: keyof Omit<DraftManualRow, "tempId">,
    val: string,
  ) => {
    setDraftRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, [field]: val } : r)),
    );
  };

  const handleRemoveDraftRow = (tempId: string) => {
    setDraftRows((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  // Simpan satu baris manual
  const handleSaveSingleDraft = (row: DraftManualRow) => {
    if (!effectiveMapelId) return;
    if (!row.kodeTp.trim() || !row.tujuanPembelajaran.trim()) {
      setFeedback({
        type: "error",
        message: "Kolom Kode TP dan Tujuan Pembelajaran wajib diisi.",
      });
      return;
    }

    setLoadingKey(`save_draft_${row.tempId}`);
    setFeedback(null);

    startTransition(async () => {
      const res = await simpanTpManualBatch({
        tingkat: selectedTingkat,
        mapelId: effectiveMapelId,
        items: [
          {
            kodeTp: row.kodeTp,
            tujuanPembelajaran: row.tujuanPembelajaran,
            ruangLingkupMateri: row.ruangLingkupMateri,
          },
        ],
      });

      setLoadingKey(null);
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });

      if (res.success) {
        setDraftRows((prev) => prev.filter((r) => r.tempId !== row.tempId));
        router.refresh();
      }
    });
  };

  // Simpan seluruh baris input manual sekaligus
  const handleSaveAllDrafts = () => {
    if (!effectiveMapelId || draftRows.length === 0) return;

    const incomplete = draftRows.some(
      (r) => !r.kodeTp.trim() || !r.tujuanPembelajaran.trim(),
    );
    if (incomplete) {
      setFeedback({
        type: "error",
        message:
          "Pastikan seluruh baris baru telah terisi Kode TP dan Tujuan Pembelajaran sebelum menyimpan.",
      });
      return;
    }

    setLoadingKey("save_all_drafts");
    setFeedback(null);

    startTransition(async () => {
      const res = await simpanTpManualBatch({
        tingkat: selectedTingkat,
        mapelId: effectiveMapelId,
        items: draftRows.map((r) => ({
          kodeTp: r.kodeTp,
          tujuanPembelajaran: r.tujuanPembelajaran,
          ruangLingkupMateri: r.ruangLingkupMateri,
        })),
      });

      setLoadingKey(null);
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });

      if (res.success) {
        setDraftRows([]);
        router.refresh();
      }
    });
  };

  // Mulai edit baris eksisting
  const handleStartEdit = (item: TpItemData) => {
    setEditingId(item.id);
    setEditForm({
      kodeTp: item.kodeTp,
      tujuanPembelajaran: item.tujuanPembelajaran,
      ruangLingkupMateri: item.ruangLingkupMateri === "-" ? "" : item.ruangLingkupMateri,
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.kodeTp.trim() || !editForm.tujuanPembelajaran.trim()) {
      setFeedback({
        type: "error",
        message: "Kode TP dan Tujuan Pembelajaran wajib diisi.",
      });
      return;
    }

    setLoadingKey(`edit_${id}`);
    setFeedback(null);

    startTransition(async () => {
      const res = await updateTpItem(id, editForm);
      setLoadingKey(null);
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });

      if (res.success) {
        setEditingId(null);
        router.refresh();
      }
    });
  };

  // Hapus baris eksisting
  const handleDeleteItem = (item: TpItemData) => {
    const ok = window.confirm(
      `Hapus Tujuan Pembelajaran "${item.kodeTp}"?\n\nData ini akan dihapus permanen dari database.`,
    );
    if (!ok) return;

    setLoadingKey(`delete_${item.id}`);
    setFeedback(null);

    startTransition(async () => {
      const res = await hapusTpItem(item.id);
      setLoadingKey(null);
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });

      if (res.success) {
        router.refresh();
      }
    });
  };

  // Impor dari Excel
  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({
        type: "error",
        message: "Pilih berkas Excel (.xlsx) atau .csv terlebih dahulu.",
      });
      return;
    }

    setLoadingKey("import_excel");
    setFeedback(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("tingkat", String(selectedTingkat));
      fd.append("mapelId", effectiveMapelId);

      const res = await imporTpExcel(fd);
      setLoadingKey(null);
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });

      if (res.success) {
        setShowImportModal(false);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    });
  };

  // Jika Guru belum memiliki penugasan tingkat & mapel dari Superadmin
  if (tingkatOptions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80">
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold inline-flex items-center gap-1.5">
            <i className="fa-solid fa-bullseye" />
            Pemetaan Kurikulum Merdeka • {semesterLabel}
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Tujuan Pembelajaran &amp; Ruang Lingkup Materi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Daftar Tujuan Pembelajaran sesuai penugasan kelas dan mata pelajaran dari Superadmin.
          </p>
        </div>

        <div className="glass-light-panel rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-2xl mx-auto">
            <i className="fa-solid fa-chalkboard-user" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">
            Belum Ada Penugasan Kelas &amp; Mata Pelajaran
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Akun Anda {guruName ? `(${guruName})` : ""} belum dipetakan ke Rombel atau Mata Pelajaran pada semester aktif. Silakan hubungi Superadmin untuk mengatur penugasan di menu <strong>Pembelajaran &amp; Pengampu</strong>.
          </p>
        </div>
      </div>
    );
  }

  const templateUrlXlsx = `/api/template/tujuan-pembelajaran?tingkat=${selectedTingkat}&mapelKode=${encodeURIComponent(
    activeMapel?.kode || "MTK",
  )}&format=xlsx`;
  const templateUrlCsv = `/api/template/tujuan-pembelajaran?tingkat=${selectedTingkat}&mapelKode=${encodeURIComponent(
    activeMapel?.kode || "MTK",
  )}&format=csv`;

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
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

      {/* TOP HEADER BANNER & GLOBAL ACTION BUTTONS */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold inline-flex items-center gap-1.5">
              <i className="fa-solid fa-bullseye" />
              {role === "SUPERADMIN"
                ? "Master Mapping TP Kelas 1–6"
                : "Tujuan Pembelajaran Pengampu"}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold font-mono">
              {semesterLabel}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold font-mono">
              Total {initialItems.length} TP
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Tujuan Pembelajaran &amp; Ruang Lingkup Materi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            {role === "SUPERADMIN"
              ? "Kelola dan petakan Kode TP, Tujuan Pembelajaran, serta Ruang Lingkup Materi untuk Tingkat Kelas 1 s/d 6 per Mata Pelajaran. Otomatis tersinkronisasi ke dashboard Guru Pengampu."
              : "Kelola Kode TP, Tujuan Pembelajaran, dan Ruang Lingkup Materi sesuai pembagian Tingkat Kelas dan Mata Pelajaran yang Anda ampu."}
          </p>
        </div>

        {/* Action Buttons: Unduh Template, Impor Excel, Tambah Kolom/Baris Manual */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Dropdown Unduh Template TP Excel */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplateMenu((prev) => !prev)}
              className="py-2.5 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-2xs transition cursor-pointer"
            >
              <i className="fa-solid fa-file-arrow-down text-emerald-600" />
              <span>Unduh Template TP Excel</span>
              <i className="fa-solid fa-chevron-down text-[10px] text-slate-400" />
            </button>

            {showTemplateMenu && (
              <div
                onMouseLeave={() => setShowTemplateMenu(false)}
                className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-40 space-y-1"
              >
                <a
                  href={templateUrlXlsx}
                  onClick={() => setShowTemplateMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-emerald-50 text-xs font-bold text-slate-700 hover:text-emerald-800 transition"
                >
                  <i className="fa-solid fa-file-excel text-emerald-600 text-sm" />
                  <div>
                    <span className="block">Template Excel (.xlsx)</span>
                    <span className="text-[10px] font-normal text-slate-400">
                      Kelas {selectedTingkat} • {activeMapel?.kode || "Semua Mapel"}
                    </span>
                  </div>
                </a>
                <a
                  href={templateUrlCsv}
                  onClick={() => setShowTemplateMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-blue-50 text-xs font-bold text-slate-700 hover:text-blue-800 transition"
                >
                  <i className="fa-solid fa-file-csv text-blue-600 text-sm" />
                  <div>
                    <span className="block">Template CSV (.csv)</span>
                    <span className="text-[10px] font-normal text-slate-400">
                      Format ringan siap impor
                    </span>
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Tombol Impor dari Excel */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <i className="fa-solid fa-file-import" />
            <span>Impor dari Excel</span>
          </button>

          {/* Tombol Tambah Input Manual di Kolom */}
          <button
            type="button"
            onClick={handleAddManualRow}
            className="py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <i className="fa-solid fa-plus" />
            <span>Tambah Baris Manual</span>
          </button>
        </div>
      </div>

      {/* PEMBAGIAN TINGKAT KELAS (1 - 6) */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <i className="fa-solid fa-layer-group text-blue-600" />
            <span>Pilih Tingkat Kelas</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            {currentTingkatObj?.faseLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {tingkatOptions.map((opt) => {
            const isSelected = opt.tingkat === selectedTingkat;
            const totalTp = countByTingkat(opt.tingkat);

            return (
              <button
                key={opt.tingkat}
                type="button"
                onClick={() => handleSelectTingkat(opt.tingkat)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-gradient-to-br from-blue-600 to-teal-500 border-blue-600 text-white shadow-md shadow-blue-500/15"
                    : "bg-slate-50/80 hover:bg-white border-slate-200 text-slate-700 hover:border-blue-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black">Kelas {opt.tingkat}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-white border border-slate-200 text-slate-600"
                    }`}
                  >
                    {totalTp} TP
                  </span>
                </div>
                <p
                  className={`text-[10px] mt-1 font-semibold truncate ${
                    isSelected ? "text-blue-100" : "text-slate-400"
                  }`}
                >
                  {opt.faseLabel} • {opt.mapels.length} Mapel
                </p>
              </button>
            );
          })}
        </div>

        {/* PEMBAGIAN MATA PELAJARAN SESUAI TINGKAT */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <i className="fa-solid fa-book-bookmark text-teal-600" />
              <span>Mata Pelajaran — Kelas {selectedTingkat}</span>
            </span>

            {/* Info Mapping Pengampu */}
            {activeMapping && activeMapping.rombelNames.length > 0 ? (
              <span className="text-[11px] font-medium text-slate-600 bg-blue-50/70 border border-blue-200/70 px-3 py-1 rounded-full">
                <i className="fa-solid fa-user-check text-blue-600 mr-1.5" />
                {role === "SUPERADMIN" ? (
                  <>
                    Pengampu: <strong>{activeMapping.guruNames.join(", ")}</strong> (Kelas{" "}
                    {activeMapping.rombelNames.join(", ")})
                  </>
                ) : (
                  <>
                    Kelas Diampu: <strong>{activeMapping.rombelNames.join(", ")}</strong>
                  </>
                )}
              </span>
            ) : (
              role === "SUPERADMIN" && (
                <span className="text-[11px] text-slate-400 italic">
                  Belum ada guru pengampu diplot pada mapel Kelas {selectedTingkat} ini
                </span>
              )
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {validMapelsForTingkat.map((m) => {
              const active = m.id === effectiveMapelId;
              const cnt = countByTingkatAndMapel(selectedTingkat, m.id);

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMapel(m.id)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    active
                      ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                      : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                      active
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m.kode}
                  </span>
                  <span>{m.nama}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                      active
                        ? "bg-emerald-500 text-white"
                        : cnt > 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {cnt}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TABEL TUJUAN PEMBELAJARAN & RUANG LINGKUP MATERI */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Toolbar Tabel */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-mono text-xs">
                Kelas {selectedTingkat}
              </span>
              <span>•</span>
              <span>{activeMapel?.nama || "Mata Pelajaran"}</span>
              {activeMapel && (
                <span className="text-xs font-mono text-slate-400">
                  ({activeMapel.kode})
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Klik <strong>+ Tambah Baris Manual</strong> untuk mengetik langsung di kolom tabel, atau gunakan <strong>Impor dari Excel</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Filter */}
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Kode TP atau materi..."
                className="pl-8 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 w-52"
              />
            </div>

            {draftRows.length > 0 && (
              <button
                type="button"
                onClick={handleSaveAllDrafts}
                disabled={isPending && loadingKey === "save_all_drafts"}
                className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isPending && loadingKey === "save_all_drafts" ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk" />
                    <span>Simpan Semua Input ({draftRows.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tabel Data + Input Langsung di Kolom */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0f172a] text-white text-[10px] uppercase tracking-wider font-extrabold">
                <th className="py-3.5 px-4 w-14 text-center border-r border-slate-800">
                  No
                </th>
                <th className="py-3.5 px-4 w-36 border-r border-slate-800">
                  Kode TP
                </th>
                <th className="py-3.5 px-4 min-w-[300px] border-r border-slate-800">
                  Tujuan Pembelajaran
                </th>
                <th className="py-3.5 px-4 min-w-[230px] border-r border-slate-800">
                  Ruang Lingkup Materi
                </th>
                <th className="py-3.5 px-4 w-36 text-center">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {/* Baris Data Tersimpan */}
              {currentItems.map((item, idx) => {
                const isEditing = editingId === item.id;

                if (isEditing) {
                  return (
                    <tr key={item.id} className="bg-amber-50/50">
                      <td className="py-3 px-4 text-center font-mono font-bold text-amber-700 align-top pt-4">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <input
                          type="text"
                          value={editForm.kodeTp}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              kodeTp: e.target.value,
                            }))
                          }
                          placeholder="mis. TP.1.1"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-3 px-3 align-top">
                        <textarea
                          rows={2}
                          value={editForm.tujuanPembelajaran}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              tujuanPembelajaran: e.target.value,
                            }))
                          }
                          placeholder="Tulis deskripsi Tujuan Pembelajaran..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 resize-y"
                        />
                      </td>
                      <td className="py-3 px-3 align-top">
                        <textarea
                          rows={2}
                          value={editForm.ruangLingkupMateri}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              ruangLingkupMateri: e.target.value,
                            }))
                          }
                          placeholder="Tulis Ruang Lingkup Materi..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 resize-y"
                        />
                      </td>
                      <td className="py-3 px-3 text-center align-top">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={isPending && loadingKey === `edit_${item.id}`}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                            title="Simpan Perubahan"
                          >
                            <i
                              className={`fa-solid ${
                                isPending && loadingKey === `edit_${item.id}`
                                  ? "fa-spinner fa-spin"
                                  : "fa-check"
                              }`}
                            />
                            <span>Simpan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] cursor-pointer transition"
                            title="Batal"
                          >
                            Batal
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition group"
                  >
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400 border-r border-slate-100">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 border-r border-slate-100">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono font-extrabold text-xs inline-block">
                        {item.kodeTp}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 font-medium leading-relaxed border-r border-slate-100">
                      {item.tujuanPembelajaran}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-semibold leading-relaxed border-r border-slate-100">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50/70 border border-teal-200/70 text-teal-800 text-xs">
                        <i className="fa-solid fa-bookmark text-[10px] text-teal-600" />
                        <span>{item.ruangLingkupMateri || "-"}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                          title="Edit Tujuan Pembelajaran & Ruang Lingkup Materi"
                        >
                          <i className="fa-solid fa-pen-to-square" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          disabled={isPending && loadingKey === `delete_${item.id}`}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                          title="Hapus Baris Ini"
                        >
                          <i
                            className={`fa-solid ${
                              isPending && loadingKey === `delete_${item.id}`
                                ? "fa-spinner fa-spin"
                                : "fa-trash"
                            }`}
                          />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* BARIS INPUT MANUAL SECARA LANGSUNG DI KOLOM */}
              {draftRows.map((draft, dIdx) => (
                <tr key={draft.tempId} className="bg-blue-50/40">
                  <td className="py-3 px-4 text-center font-mono font-bold text-blue-600 align-top pt-4 border-r border-blue-100/70">
                    +{dIdx + 1}
                  </td>
                  <td className="py-3 px-3 align-top border-r border-blue-100/70">
                    <input
                      type="text"
                      value={draft.kodeTp}
                      onChange={(e) =>
                        handleUpdateDraftRow(draft.tempId, "kodeTp", e.target.value)
                      }
                      placeholder="Kode TP (mis. TP.1)"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-blue-300 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </td>
                  <td className="py-3 px-3 align-top border-r border-blue-100/70">
                    <textarea
                      rows={2}
                      value={draft.tujuanPembelajaran}
                      onChange={(e) =>
                        handleUpdateDraftRow(
                          draft.tempId,
                          "tujuanPembelajaran",
                          e.target.value,
                        )
                      }
                      placeholder="Ketik langsung Tujuan Pembelajaran di sini..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-blue-300 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-y"
                    />
                  </td>
                  <td className="py-3 px-3 align-top border-r border-blue-100/70">
                    <textarea
                      rows={2}
                      value={draft.ruangLingkupMateri}
                      onChange={(e) =>
                        handleUpdateDraftRow(
                          draft.tempId,
                          "ruangLingkupMateri",
                          e.target.value,
                        )
                      }
                      placeholder="Ketik Ruang Lingkup Materi sesuai mapel..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-blue-300 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-y"
                    />
                  </td>
                  <td className="py-3 px-3 text-center align-top">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveSingleDraft(draft)}
                        disabled={
                          isPending && loadingKey === `save_draft_${draft.tempId}`
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                        title="Simpan Baris Ini"
                      >
                        <i
                          className={`fa-solid ${
                            isPending && loadingKey === `save_draft_${draft.tempId}`
                              ? "fa-spinner fa-spin"
                              : "fa-check"
                          }`}
                        />
                        <span>Simpan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftRow(draft.tempId)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs transition cursor-pointer"
                        title="Batalkan Baris"
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Empty State ketika belum ada data & belum ada draft */}
              {currentItems.length === 0 && draftRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 px-6 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto">
                        <i className="fa-solid fa-list-check" />
                      </div>
                      <p className="text-sm font-extrabold text-slate-700">
                        Belum ada Tujuan Pembelajaran untuk Kelas {selectedTingkat} —{" "}
                        {activeMapel?.nama || ""}
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Anda dapat langsung menambahkan baris input manual pada tabel di bawah ini atau mengimpor dari berkas Excel menggunakan template yang tersedia.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleAddManualRow}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                        >
                          <i className="fa-solid fa-plus" />
                          <span>Input Manual di Kolom</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowImportModal(true)}
                          className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <i className="fa-solid fa-file-excel" />
                          <span>Impor dari Excel</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Tabel: Tombol Cepat Tambah Kolom / Baris Input Manual */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleAddManualRow}
            className="py-2 px-4 rounded-xl bg-white hover:bg-blue-50 border border-dashed border-blue-300 text-blue-700 text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer"
          >
            <i className="fa-solid fa-plus-circle" />
            <span>+ Tambah Kolom / Baris Input Manual</span>
          </button>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
            <span>
              Tersimpan: <strong className="text-slate-800">{currentItems.length} Baris</strong>
            </span>
            {draftRows.length > 0 && (
              <>
                <span>•</span>
                <span className="text-blue-700 font-bold">
                  {draftRows.length} Baris Baru Belum Disimpan
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL IMPOR DARI EXCEL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-base">
                  <i className="fa-solid fa-file-excel" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    Impor Tujuan Pembelajaran dari Excel
                  </h3>
                  <p className="text-xs text-slate-400">
                    Target default: Kelas {selectedTingkat} • {activeMapel?.nama} ({activeMapel?.kode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedFile(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base" />
              </button>
            </div>

            {/* Unduh Template Box di dalam Modal */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-emerald-900">
                <p className="font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-download text-emerald-600" />
                  <span>Belum punya format Excel?</span>
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Unduh template resmi yang sudah dilengkapi kolom Kode TP, Tujuan Pembelajaran &amp; Ruang Lingkup Materi.
                </p>
              </div>
              <a
                href={templateUrlXlsx}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 inline-flex items-center gap-1.5 shadow-2xs transition"
              >
                <i className="fa-solid fa-file-arrow-down" />
                <span>Unduh Template (.xlsx)</span>
              </a>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Berkas Excel (.xlsx) atau CSV (.csv) *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-bold file:cursor-pointer cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-700">Ketentuan Kolom Template:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>
                    <strong>Kode TP</strong>, <strong>Tujuan Pembelajaran</strong>, dan{" "}
                    <strong>Ruang Lingkup Materi</strong> akan diimpor otomatis.
                  </li>
                  <li>
                    Jika kolom <em>Tingkat Kelas</em> dan <em>Kode Mapel</em> diisi pada Excel, sistem dapat mengimpor ke banyak tingkat/mapel sekaligus dalam 1x unggah.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || (isPending && loadingKey === "import_excel")}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {isPending && loadingKey === "import_excel" ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Mengimpor Data...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-cloud-arrow-up" />
                      <span>Mulai Impor TP</span>
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
