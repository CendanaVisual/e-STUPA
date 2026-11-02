"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import Link from "next/link";
import {
  createRombel,
  updateRombel,
  deleteRombel,
  importRombelFromFile,
  type RombelInput,
} from "@/server/actions/rombel";

export function extractTingkat(namaKelas: string): number {
  const clean = namaKelas.trim().toUpperCase();
  const digitMatch = clean.match(/(?:KELAS\s*)?(\d{1,2})/i);
  if (digitMatch && digitMatch[1]) {
    const val = parseInt(digitMatch[1], 10);
    if (val >= 1 && val <= 12) return val;
  }
  if (/^XII/i.test(clean)) return 12;
  if (/^XI/i.test(clean)) return 11;
  if (/^X/i.test(clean)) return 10;
  if (/^IX/i.test(clean)) return 9;
  if (/^VIII/i.test(clean)) return 8;
  if (/^VII/i.test(clean)) return 7;
  if (/^VI/i.test(clean)) return 6;
  if (/^V/i.test(clean)) return 5;
  if (/^IV/i.test(clean)) return 4;
  if (/^III/i.test(clean)) return 3;
  if (/^II/i.test(clean)) return 2;
  if (/^I/i.test(clean)) return 1;
  return 1;
}

export type RombelRow = {
  id: string;
  nama: string;
  tingkat: number;
  kurikulum: string | null;
  waliKelasId: string | null;
  waliKelas: {
    id: string;
    nama: string;
    nip: string | null;
    nuptk: string | null;
    jenisKelamin: "L" | "P" | null;
  } | null;
  _count: {
    anggota: number;
    pembelajaran: number;
  };
};

export type AvailableGtk = {
  id: string;
  nama: string;
  nip: string | null;
  nuptk: string | null;
  jenisPtk: string | null;
};

interface RombelClientProps {
  initialRombels: RombelRow[];
  availableGtks: AvailableGtk[];
  semesterNama?: string;
  tahunAjaranNama?: string;
}

export function RombelClient({
  initialRombels,
  availableGtks,
  semesterNama,
  tahunAjaranNama,
}: RombelClientProps) {
  const [rombelList, setRombelList] = useState<RombelRow[]>(initialRombels);
  const [isPending, startTransition] = useTransition();

  // Search, Filters & View Mode
  const [search, setSearch] = useState("");
  const [filterTingkat, setFilterTingkat] = useState("ALL");
  const [filterWali, setFilterWali] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Notifications
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Selected Rombel for Edit / Delete
  const [selectedRombel, setSelectedRombel] = useState<RombelRow | null>(null);

  // Form State: Tambah Rombel
  const initialFormState: RombelInput = {
    nama: "",
    tingkat: 1,
    kurikulum: "Kurikulum Merdeka",
    waliKelasId: "",
  };
  const [formData, setFormData] = useState<RombelInput>(initialFormState);

  // Form State: Edit Rombel
  const [editFormData, setEditFormData] = useState<RombelInput>(initialFormState);

  // Import State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  // Stats calculation
  const stats = useMemo(() => {
    const totalKelas = rombelList.length;
    const totalSiswa = rombelList.reduce((acc, r) => acc + (r._count?.anggota || 0), 0);
    const adaWali = rombelList.filter((r) => r.waliKelas !== null).length;
    const rataRata = totalKelas > 0 ? Math.round(totalSiswa / totalKelas) : 0;
    return { totalKelas, totalSiswa, adaWali, rataRata };
  }, [rombelList]);

  // Filtered Rombel list
  const filteredList = useMemo(() => {
    return rombelList.filter((r) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.nama.toLowerCase().includes(q) ||
        (r.waliKelas && r.waliKelas.nama.toLowerCase().includes(q)) ||
        (r.waliKelas?.nip && r.waliKelas.nip.toLowerCase().includes(q));

      const matchTingkat =
        filterTingkat === "ALL" || String(r.tingkat) === filterTingkat;

      const matchWali =
        filterWali === "ALL" ||
        (filterWali === "HAS_WALI" && r.waliKelas !== null) ||
        (filterWali === "NO_WALI" && r.waliKelas === null);

      return matchSearch && matchTingkat && matchWali;
    });
  }, [rombelList, search, filterTingkat, filterWali]);

  // Helper mapping fase Kurikulum Merdeka
  const getFase = (tingkat: number) => {
    if (tingkat <= 2) return "Fase A (Kelas 1-2)";
    if (tingkat <= 4) return "Fase B (Kelas 3-4)";
    if (tingkat <= 6) return "Fase C (Kelas 5-6)";
    if (tingkat <= 9) return "Fase D (SMP/MTs)";
    return "Fase E/F (SMA/SMK)";
  };

  // Open Edit Modal
  const handleOpenEdit = (rombel: RombelRow) => {
    setSelectedRombel(rombel);
    setEditFormData({
      id: rombel.id,
      nama: rombel.nama,
      tingkat: rombel.tingkat,
      kurikulum: rombel.kurikulum || "Kurikulum Merdeka",
      waliKelasId: rombel.waliKelasId || "",
    });
    setShowEditModal(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (rombel: RombelRow) => {
    setSelectedRombel(rombel);
    setShowDeleteModal(true);
  };

  // Submit Tambah Rombel Manual
  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createRombel(formData);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setShowAddModal(false);
        setFormData(initialFormState);
        window.location.reload();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  // Submit Edit Rombel
  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await updateRombel(editFormData);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setShowEditModal(false);
        setSelectedRombel(null);
        window.location.reload();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  // Submit Delete Rombel
  const handleConfirmDelete = () => {
    if (!selectedRombel) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await deleteRombel(selectedRombel.id);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setShowDeleteModal(false);
        setRombelList((prev) => prev.filter((r) => r.id !== selectedRombel.id));
        setSelectedRombel(null);
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  // Submit Import Rombel
  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({ type: "error", message: "Silakan pilih berkas Excel atau CSV terlebih dahulu." });
      return;
    }

    const bodyData = new FormData();
    bodyData.append("file", selectedFile);

    setFeedback(null);
    setImportSummary(null);

    startTransition(async () => {
      const res = await importRombelFromFile(bodyData);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setImportSummary(res.message);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Alert Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs transition-all ${
            feedback.type === "success"
              ? "bg-teal-50/90 border-teal-200 text-teal-800"
              : "bg-rose-50/90 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-3">
            <i
              className={`text-base ${
                feedback.type === "success"
                  ? "fa-solid fa-circle-check text-teal-600"
                  : "fa-solid fa-triangle-exclamation text-rose-600"
              }`}
            />
            <span className="leading-relaxed">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>
      )}

      {/* Top Banner & Header Action Buttons */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold inline-flex items-center gap-1.5">
              <i className="fa-solid fa-layer-group text-teal-600" />
              <span>Data Master Akademik & Rombel</span>
            </span>
            {semesterNama && (
              <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                {semesterNama}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Rombongan Belajar (Rombel & Kelas)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Kelola daftar kelas pada semester aktif, penugasan wali kelas, serta keterhubungan dengan pembagian anggota murid dan mata pelajaran.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Tombol Unduh Template Dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="py-2.5 px-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-xs transition"
            >
              <i className="fa-solid fa-download text-slate-500" />
              <span>Unduh Template</span>
              <i className="fa-solid fa-chevron-down text-[10px] text-slate-400" />
            </button>
            <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 hidden group-hover:block z-40">
              <a
                href="/api/admin/template/rombel?format=xlsx"
                download="Template_Rombel_Kelas.xlsx"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition"
              >
                <i className="fa-solid fa-file-excel text-teal-600 text-sm" />
                <span>Template Excel (.xlsx)</span>
              </a>
              <a
                href="/api/admin/template/rombel?format=csv"
                download="Template_Rombel_Kelas.csv"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
              >
                <i className="fa-solid fa-file-csv text-blue-600 text-sm" />
                <span>Template CSV (.csv)</span>
              </a>
            </div>
          </div>

          {/* Tombol Impor Rombel */}
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setSelectedFile(null);
              setShowImportModal(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-teal-600/20 transition cursor-pointer"
          >
            <i className="fa-solid fa-file-import" />
            <span>Impor Rombel & Kelas</span>
          </button>

          {/* Tombol Tambah Rombel Manual */}
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setFormData(initialFormState);
              setShowAddModal(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <i className="fa-solid fa-plus" />
            <span>+ Tambah Rombel & Kelas Manual</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-layer-group" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Kelas</span>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1">{stats.totalKelas}</p>
            <span className="text-[10px] text-slate-500 font-medium">Rombel aktif semester ini</span>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-user-graduate" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Murid Terdaftar</span>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1">{stats.totalSiswa}</p>
            <span className="text-[10px] text-slate-500 font-medium">Siswa terbagi di rombel</span>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-crown" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Wali Kelas Ada</span>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1">{stats.adaWali}</p>
            <span className="text-[10px] text-amber-700 font-medium">Dari {stats.totalKelas} kelas aktif</span>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-chart-pie" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rata-rata Kelas</span>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1">{stats.rataRata}</p>
            <span className="text-[10px] text-purple-700 font-medium">Siswa per rombel</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/95 rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Cari berdasarkan Nama Kelas, atau Nama Wali Kelas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Tingkat */}
          <select
            value={filterTingkat}
            onChange={(e) => setFilterTingkat(e.target.value)}
            className="py-2 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 outline-none focus:border-teal-500"
          >
            <option value="ALL">Semua Tingkat</option>
            <option value="1">Tingkat 1 (Kelas 1)</option>
            <option value="2">Tingkat 2 (Kelas 2)</option>
            <option value="3">Tingkat 3 (Kelas 3)</option>
            <option value="4">Tingkat 4 (Kelas 4)</option>
            <option value="5">Tingkat 5 (Kelas 5)</option>
            <option value="6">Tingkat 6 (Kelas 6)</option>
          </select>

          {/* Filter Wali */}
          <select
            value={filterWali}
            onChange={(e) => setFilterWali(e.target.value)}
            className="py-2 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 outline-none focus:border-teal-500"
          >
            <option value="ALL">Semua Status Wali</option>
            <option value="HAS_WALI">Sudah Ada Wali</option>
            <option value="NO_WALI">Belum Ada Wali</option>
          </select>

          {/* Toggle View Mode */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "table"
                  ? "bg-white text-teal-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Tampilan Tabel"
            >
              <i className="fa-solid fa-table-list" />
              <span className="hidden sm:inline">Tabel</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "grid"
                  ? "bg-white text-teal-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Tampilan Kartu"
            >
              <i className="fa-solid fa-table-cells-large" />
              <span className="hidden sm:inline">Kartu</span>
            </button>
          </div>

          {(search || filterTingkat !== "ALL" || filterWali !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setFilterTingkat("ALL");
                setFilterWali("ALL");
              }}
              className="py-2 px-3 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-arrows-rotate text-[10px]" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Konten Data Rombel */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-school text-teal-600" />
            <span>Daftar Rombel & Kelas ({filteredList.length} dari {rombelList.length} Kelas)</span>
          </h3>
        </div>

        {filteredList.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200/80">
            <i className="fa-solid fa-users-rectangle text-5xl text-slate-300 mb-3 block" />
            <p className="font-bold text-slate-700 text-sm">Tidak ada data rombel yang sesuai.</p>
            <p className="text-slate-500 mt-1 max-w-md mx-auto">
              Periksa kembali kata kunci pencarian Anda, atau tambahkan kelas baru secara manual atau impor dari Excel.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setFormData(initialFormState);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition"
              >
                <i className="fa-solid fa-plus" />
                <span>Tambah Rombel Manual</span>
              </button>
            </div>
          </div>
        ) : viewMode === "table" ? (
          /* ========================================================================= */
          /* TAMPILAN TABEL DATA ROMBEL & KELAS */
          /* ========================================================================= */
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-3.5 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Nama Kelas</th>
                  <th className="py-3.5 px-3">Tingkat & Fase</th>
                  <th className="py-3.5 px-3">Kurikulum</th>
                  <th className="py-3.5 px-4">Wali Kelas</th>
                  <th className="py-3.5 px-3 text-center">Jumlah Murid</th>
                  <th className="py-3.5 px-3 text-center">Mata Pelajaran</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-3.5 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3.5 text-center font-mono text-slate-400 font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                          {r.nama}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-800 text-xs">Kelas {r.nama}</p>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Rombongan Belajar
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="space-y-0.5">
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 font-mono font-bold text-[10px]">
                          Tingkat {r.tingkat}
                        </span>
                        <p className="text-[10px] text-slate-500">{getFase(r.tingkat)}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        {r.kurikulum || "Kurikulum Merdeka"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {r.waliKelas ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-crown text-[10px]" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-xs">{r.waliKelas.nama}</p>
                            <p className="font-mono text-[10px] text-slate-400">
                              NIP: {r.waliKelas.nip || "-"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(r)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-800 border border-slate-200 text-[10px] font-bold text-slate-500 transition cursor-pointer flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-user-plus text-[9px]" />
                          <span>Pilih Wali Kelas</span>
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <Link
                        href={`/admin/master/siswa?kelas=${encodeURIComponent(r.nama)}`}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold text-[11px] hover:bg-blue-100 transition"
                      >
                        <i className="fa-solid fa-users text-[9px]" />
                        <span>{r._count.anggota} Murid</span>
                      </Link>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-mono font-bold text-[11px]">
                        {r._count.pembelajaran} Mapel
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                        Aktif
                      </span>
                    </td>
                    {/* AKSI EDIT & HAPUS */}
                    <td className="py-3.5 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          title="Edit Rombel & Kelas"
                          onClick={() => handleOpenEdit(r)}
                          className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center transition cursor-pointer"
                        >
                          <i className="fa-solid fa-pen-to-square text-xs" />
                        </button>
                        <button
                          type="button"
                          title="Hapus Rombel & Kelas"
                          onClick={() => handleOpenDelete(r)}
                          className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center transition cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ========================================================================= */
          /* TAMPILAN KARTU GRID ROMBEL & KELAS */
          /* ========================================================================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredList.map((r) => (
              <div
                key={r.id}
                className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-teal-300 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 font-mono font-bold text-xs">
                      Tingkat {r.tingkat}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit Rombel"
                        onClick={() => handleOpenEdit(r)}
                        className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center transition"
                      >
                        <i className="fa-solid fa-pen-to-square text-xs" />
                      </button>
                      <button
                        type="button"
                        title="Hapus Rombel"
                        onClick={() => handleOpenDelete(r)}
                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center transition"
                      >
                        <i className="fa-solid fa-trash-can text-xs" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-xl font-extrabold text-slate-800">Kelas {r.nama}</h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {getFase(r.tingkat)} • {r.kurikulum || "Kurikulum Merdeka"}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                    <p className="flex items-center justify-between">
                      <span>Wali Kelas:</span>
                      <strong className="text-slate-700 truncate max-w-[140px] text-right">
                        {r.waliKelas?.nama || "Belum Ditentukan"}
                      </strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Jumlah Siswa:</span>
                      <strong className="font-mono text-blue-700 font-bold">{r._count.anggota} Siswa</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Mata Pelajaran:</span>
                      <strong className="font-mono text-purple-700 font-bold">{r._count.pembelajaran} Mapel</strong>
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                    Status: Aktif
                  </span>
                  <Link
                    href={`/admin/master/siswa?kelas=${encodeURIComponent(r.nama)}`}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 transition flex items-center gap-1"
                  >
                    <span>Lihat Murid</span>
                    <i className="fa-solid fa-arrow-right text-[10px]" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH ROMBEL & KELAS MANUAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-layer-group" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Tambah Rombel & Kelas Manual
                  </h3>
                  <p className="text-xs text-slate-500">
                    Daftarkan rombongan belajar baru pada semester aktif.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition"
              >
                <i className="fa-solid fa-xmark text-base" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Kelas <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 1A, 2B, 5A, atau 6"
                  value={formData.nama}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    const detectedTingkat = extractTingkat(val);
                    setFormData({
                      ...formData,
                      nama: val,
                      tingkat: detectedTingkat,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition font-bold text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Format disarankan: Angka tingkat diikuti huruf paralel (misal: 1A, 1B, 5A).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tingkat Kelas (1-12)
                  </label>
                  <select
                    value={formData.tingkat || 1}
                    onChange={(e) =>
                      setFormData({ ...formData, tingkat: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 outline-none font-semibold text-slate-700"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Tingkat {lvl} {lvl <= 6 ? `(Kelas ${lvl} SD)` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kurikulum
                  </label>
                  <input
                    type="text"
                    value={formData.kurikulum || "Kurikulum Merdeka"}
                    onChange={(e) => setFormData({ ...formData, kurikulum: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Wali Kelas (Opsional)
                </label>
                <select
                  value={formData.waliKelasId || ""}
                  onChange={(e) => setFormData({ ...formData, waliKelasId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 outline-none font-semibold text-slate-700"
                >
                  <option value="">-- Belum Ditentukan --</option>
                  {availableGtks.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama} {g.nip ? `(NIP: ${g.nip})` : ""} - {g.jenisPtk || "Guru"}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Wali kelas akan memiliki akses input presensi, leger, dan cetak rapor kelas ini.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPending && <i className="fa-solid fa-spinner fa-spin" />}
                  <span>{isPending ? "Menyimpan..." : "Simpan Kelas"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT ROMBEL & KELAS */}
      {/* ========================================================================= */}
      {showEditModal && selectedRombel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-pen-to-square" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Edit Rombel & Kelas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Perbarui nama kelas, tingkat, atau penugasan wali kelas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition"
              >
                <i className="fa-solid fa-xmark text-base" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Kelas <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.nama}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, nama: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 outline-none font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tingkat Kelas (1-12)
                  </label>
                  <select
                    value={editFormData.tingkat || 1}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        tingkat: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 outline-none font-semibold text-slate-700"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Tingkat {lvl} {lvl <= 6 ? `(Kelas ${lvl} SD)` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kurikulum
                  </label>
                  <input
                    type="text"
                    value={editFormData.kurikulum || "Kurikulum Merdeka"}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, kurikulum: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Wali Kelas
                </label>
                <select
                  value={editFormData.waliKelasId || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, waliKelasId: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 outline-none font-semibold text-slate-700"
                >
                  <option value="">-- Belum Ditentukan --</option>
                  {availableGtks.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama} {g.nip ? `(NIP: ${g.nip})` : ""} - {g.jenisPtk || "Guru"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPending && <i className="fa-solid fa-spinner fa-spin" />}
                  <span>{isPending ? "Menyimpan Perubahan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KONFIRMASI HAPUS ROMBEL */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedRombel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-xl mx-auto">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-800">
                Hapus Rombel & Kelas?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anda akan menghapus data kelas{" "}
                <span className="font-bold text-slate-800">"Kelas {selectedRombel.nama}"</span>.
                Keterhubungan anggota murid dan pembelajaran di kelas ini pada semester aktif akan dibersihkan.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-800 text-[11px] font-semibold space-y-1">
              <p className="flex items-center gap-1.5 font-bold">
                <i className="fa-solid fa-circle-exclamation" />
                <span>Rincian yang Terpengaruh:</span>
              </p>
              <ul className="list-disc list-inside text-[10px] space-y-0.5 pl-1">
                <li>Jumlah Murid: {selectedRombel._count.anggota} Siswa</li>
                <li>Mata Pelajaran: {selectedRombel._count.pembelajaran} Mapel</li>
                <li>Wali Kelas: {selectedRombel.waliKelas?.nama || "Belum Ditentukan"}</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-md shadow-rose-600/20 text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPending && <i className="fa-solid fa-spinner fa-spin" />}
                <span>{isPending ? "Menghapus..." : "Ya, Hapus Kelas"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPOR DATA ROMBEL DARI FILE */}
      {/* ========================================================================= */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-file-import" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Impor Rombel & Kelas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Unggah berkas Excel (.xlsx) atau CSV sesuai template resmi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition"
              >
                <i className="fa-solid fa-xmark text-base" />
              </button>
            </div>

            {/* Pilihan Unduh Template */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/80 to-emerald-50/60 border border-teal-200 space-y-2">
              <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-info text-teal-600" />
                <span>Belum punya format template? Unduh di bawah ini:</span>
              </span>
              <p className="text-[11px] text-teal-800 leading-relaxed">
                Format kolom resmi: <br />
                <code className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-900 font-mono font-bold text-[10px]">
                  Nama Kelas, Nama Wali Kelas (opsional)
                </code>
              </p>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href="/api/admin/template/rombel?format=xlsx"
                  download="Template_Rombel_Kelas.xlsx"
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition"
                >
                  <i className="fa-solid fa-file-excel" />
                  <span>Unduh Format Excel (.xlsx)</span>
                </a>
                <a
                  href="/api/admin/template/rombel?format=csv"
                  download="Template_Rombel_Kelas.csv"
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-teal-100 text-teal-800 border border-teal-300 font-bold text-[11px] flex items-center gap-1.5 transition"
                >
                  <i className="fa-solid fa-file-csv" />
                  <span>Unduh CSV (.csv)</span>
                </a>
              </div>
            </div>

            {/* Area Unggah File */}
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  selectedFile
                    ? "border-teal-500 bg-teal-50/50"
                    : "border-slate-300 hover:border-teal-400 bg-slate-50/50 hover:bg-teal-50/20"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                />

                {selectedFile ? (
                  <div className="space-y-1">
                    <i className="fa-solid fa-file-circle-check text-3xl text-teal-600" />
                    <p className="font-bold text-slate-800 text-xs">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Klik untuk ganti berkas
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-400" />
                    <p className="font-bold text-slate-700 text-xs">
                      Pilih berkas Excel / CSV dari komputer Anda
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Mendukung format .xlsx, .xls, dan .csv
                    </p>
                  </div>
                )}
              </div>

              {importSummary && (
                <div className="p-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium">
                  {importSummary}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition text-xs"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isPending}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-md shadow-teal-600/20 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPending && <i className="fa-solid fa-spinner fa-spin" />}
                  <span>{isPending ? "Mengimpor..." : "Mulai Impor Data"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
