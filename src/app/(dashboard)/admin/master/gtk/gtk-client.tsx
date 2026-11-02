"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import Link from "next/link";
import {
  createGtk,
  updateGtk,
  deleteGtk,
  importGtkFromFile,
  type GtkInput,
} from "@/server/actions/gtk";

export type GtkRow = {
  id: string;
  nama: string;
  nuptk: string | null;
  nip: string | null;
  nik: string | null;
  jenisKelamin: "L" | "P" | null;
  jenisPtk: string | null;
  statusKepegawaian: string | null;
  email: string | null;
  noHp: string | null;
  isAktif: boolean;
  user: {
    id: string;
    username: string;
    isActive: boolean;
  } | null;
  waliKelas: {
    id: string;
    nama: string;
    tingkat: number;
  }[];
  pembelajaran: {
    id: string;
    mapel: {
      id: string;
      nama: string;
      kode: string;
    };
    rombel: {
      id: string;
      nama: string;
    };
  }[];
};

export type AvailableRombel = {
  id: string;
  nama: string;
  tingkat: number;
};

export type AvailableMapel = {
  id: string;
  nama: string;
  kode: string;
};

interface GtkClientProps {
  initialGtk: GtkRow[];
  availableRombels: AvailableRombel[];
  availableMapels: AvailableMapel[];
  semesterNama?: string;
}

export function GtkClient({
  initialGtk,
  availableRombels,
  availableMapels,
  semesterNama,
}: GtkClientProps) {
  const [gtkList, setGtkList] = useState<GtkRow[]>(initialGtk);
  const [isPending, startTransition] = useTransition();

  // Search & Filters
  const [search, setSearch] = useState("");
  const [filterJenisPtk, setFilterJenisPtk] = useState("ALL");
  const [filterStatusPegawai, setFilterStatusPegawai] = useState("ALL");
  const [filterAkun, setFilterAkun] = useState("ALL");

  // Notifications / Feedback
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Selected GTK for Edit / Delete
  const [selectedGtk, setSelectedGtk] = useState<GtkRow | null>(null);

  // Form State: Tambah GTK
  const defaultFormState: GtkInput = {
    nama: "",
    nip: "",
    nuptk: "",
    nik: "",
    jenisKelamin: "L",
    jenisPtk: "Guru Mapel",
    statusKepegawaian: "PNS / PPPK",
    email: "",
    noHp: "",
    isAktif: true,
    createAccount: true,
    username: "",
    password: "",
    waliKelasRombelId: "",
    mapelIds: [],
  };

  const [formData, setFormData] = useState<GtkInput>(defaultFormState);

  // Form State: Edit GTK
  const [editFormData, setEditFormData] = useState<GtkInput>(defaultFormState);

  // Import State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    const total = gtkList.length;
    const lk = gtkList.filter((g) => g.jenisKelamin === "L").length;
    const pr = gtkList.filter((g) => g.jenisKelamin === "P").length;
    const punyaAkun = gtkList.filter((g) => g.user !== null).length;
    return { total, lk, pr, punyaAkun };
  }, [gtkList]);

  // Filtered GTK list
  const filteredList = useMemo(() => {
    return gtkList.filter((g) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        g.nama.toLowerCase().includes(q) ||
        (g.nip && g.nip.toLowerCase().includes(q)) ||
        (g.nuptk && g.nuptk.toLowerCase().includes(q)) ||
        (g.user && g.user.username.toLowerCase().includes(q));

      const matchJenis =
        filterJenisPtk === "ALL" ||
        (g.jenisPtk && g.jenisPtk.toLowerCase().includes(filterJenisPtk.toLowerCase()));

      const matchStatusPegawai =
        filterStatusPegawai === "ALL" ||
        (g.statusKepegawaian &&
          g.statusKepegawaian.toLowerCase().includes(filterStatusPegawai.toLowerCase()));

      const matchAkun =
        filterAkun === "ALL" ||
        (filterAkun === "HAS_ACCOUNT" && g.user !== null) ||
        (filterAkun === "NO_ACCOUNT" && g.user === null);

      return matchSearch && matchJenis && matchStatusPegawai && matchAkun;
    });
  }, [gtkList, search, filterJenisPtk, filterStatusPegawai, filterAkun]);

  // Open Edit Modal
  const handleOpenEdit = (gtk: GtkRow) => {
    setSelectedGtk(gtk);
    const uniqueMapelIds = Array.from(
      new Set(gtk.pembelajaran.map((p) => p.mapel.id))
    );
    setEditFormData({
      id: gtk.id,
      nama: gtk.nama,
      nip: gtk.nip || "",
      nuptk: gtk.nuptk || "",
      nik: gtk.nik || "",
      jenisKelamin: gtk.jenisKelamin || "L",
      jenisPtk: gtk.jenisPtk || "Guru Mapel",
      statusKepegawaian: gtk.statusKepegawaian || "PNS / PPPK",
      email: gtk.email || "",
      noHp: gtk.noHp || "",
      isAktif: gtk.isAktif,
      createAccount: !gtk.user,
      username: gtk.user?.username || "",
      password: "",
      waliKelasRombelId: gtk.waliKelas[0]?.id || "",
      mapelIds: uniqueMapelIds,
    });
    setShowEditModal(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (gtk: GtkRow) => {
    setSelectedGtk(gtk);
    setShowDeleteModal(true);
  };

  // Submit Tambah GTK Manual
  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createGtk(formData);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setShowAddModal(false);
        setFormData(defaultFormState);
        window.location.reload();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  // Submit Edit GTK
  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await updateGtk(editFormData);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setShowEditModal(false);
        setSelectedGtk(null);
        window.location.reload();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  // Submit Delete GTK
  const handleConfirmDelete = () => {
    if (!selectedGtk) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await deleteGtk(selectedGtk.id);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setShowDeleteModal(false);
        setGtkList((prev) => prev.filter((g) => g.id !== selectedGtk.id));
        setSelectedGtk(null);
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  // Submit Import GTK
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
      const res = await importGtkFromFile(bodyData);
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
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-800"
              : "bg-rose-50/90 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-3">
            <i
              className={`text-base ${
                feedback.type === "success"
                  ? "fa-solid fa-circle-check text-emerald-600"
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
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold inline-flex items-center gap-1.5">
              <i className="fa-solid fa-chalkboard-user text-emerald-600" />
              <span>Data Master Pendidik & Tenaga Kependidikan</span>
            </span>
            {semesterNama && (
              <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                {semesterNama}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Data GTK / Guru
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Kelola data pendidik, penugasan wali kelas, mata pelajaran yang diampu, serta akun login portal guru secara lengkap dan terintegrasi.
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
                href="/api/admin/template/gtk?format=xlsx"
                download="Template_Data_Guru.xlsx"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
              >
                <i className="fa-solid fa-file-excel text-emerald-600 text-sm" />
                <span>Template Excel (.xlsx)</span>
              </a>
              <a
                href="/api/admin/template/gtk?format=csv"
                download="Template_Data_Guru.csv"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
              >
                <i className="fa-solid fa-file-csv text-blue-600 text-sm" />
                <span>Template CSV (.csv)</span>
              </a>
            </div>
          </div>

          {/* Tombol Impor GTK */}
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setSelectedFile(null);
              setShowImportModal(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <i className="fa-solid fa-file-import" />
            <span>Impor GTK / Guru</span>
          </button>

          {/* Tombol Tambah GTK Manual */}
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setFormData(defaultFormState);
              setShowAddModal(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <i className="fa-solid fa-plus" />
            <span>+ Tambah GTK / Guru Manual</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-users" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total GTK</span>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1">{stats.total}</p>
            <span className="text-[10px] text-slate-500 font-medium">Terdaftar di sistem</span>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-mars" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Guru Laki-Laki</span>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1">{stats.lk}</p>
            <span className="text-[10px] text-slate-500 font-medium">Pendidik laki-laki</span>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-200 text-pink-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-venus" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Guru Perempuan</span>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1">{stats.pr}</p>
            <span className="text-[10px] text-slate-500 font-medium">Pendidik perempuan</span>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-key" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Akun Login Aktif</span>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1">{stats.punyaAkun}</p>
            <span className="text-[10px] text-emerald-600 font-medium">Punya kredensial login</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/95 rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Cari berdasarkan Nama, NIP, NUPTK, atau Username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Jenis PTK */}
          <select
            value={filterJenisPtk}
            onChange={(e) => setFilterJenisPtk(e.target.value)}
            className="py-2 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Jenis PTK</option>
            <option value="Guru Kelas">Guru Kelas</option>
            <option value="Guru Mapel">Guru Mapel</option>
            <option value="Guru BK">Guru BK / Konseling</option>
            <option value="Tendik">Tenaga Kependidikan</option>
            <option value="Kepala Sekolah">Kepala Sekolah</option>
          </select>

          {/* Filter Status Pegawai */}
          <select
            value={filterStatusPegawai}
            onChange={(e) => setFilterStatusPegawai(e.target.value)}
            className="py-2 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Kepegawaian</option>
            <option value="PNS">PNS</option>
            <option value="PPPK">PPPK</option>
            <option value="Honor">Honor / GTT</option>
            <option value="Tetap">Guru Tetap Yayasan</option>
          </select>

          {/* Filter Akun */}
          <select
            value={filterAkun}
            onChange={(e) => setFilterAkun(e.target.value)}
            className="py-2 px-3 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Akun</option>
            <option value="HAS_ACCOUNT">Sudah Ada Akun</option>
            <option value="NO_ACCOUNT">Belum Ada Akun</option>
          </select>

          {(search || filterJenisPtk !== "ALL" || filterStatusPegawai !== "ALL" || filterAkun !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setFilterJenisPtk("ALL");
                setFilterStatusPegawai("ALL");
                setFilterAkun("ALL");
              }}
              className="py-2 px-3 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-arrows-rotate text-[10px]" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabel Data GTK */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-id-card-clip text-emerald-600" />
            <span>Daftar Guru & GTK ({filteredList.length} dari {gtkList.length})</span>
          </h3>
        </div>

        {filteredList.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200/80">
            <i className="fa-solid fa-chalkboard-user text-5xl text-slate-300 mb-3 block" />
            <p className="font-bold text-slate-700 text-sm">Tidak ada data GTK yang sesuai.</p>
            <p className="text-slate-500 mt-1 max-w-md mx-auto">
              Periksa kembali kata kunci pencarian Anda, atau tambahkan data guru baru secara manual atau impor dari Excel.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setFormData(defaultFormState);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition"
              >
                <i className="fa-solid fa-plus" />
                <span>Tambah GTK Manual</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-3.5 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Nama Lengkap & Gelar</th>
                  <th className="py-3.5 px-3">NUPTK / NIP</th>
                  <th className="py-3.5 px-3">Jenis PTK</th>
                  <th className="py-3.5 px-3">Status Kepegawaian</th>
                  <th className="py-3.5 px-3">Penugasan</th>
                  <th className="py-3.5 px-3 text-center">Akun Login</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-3.5 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((g, idx) => (
                  <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3.5 text-center font-mono text-slate-400 font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {g.nama.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-xs truncate">{g.nama}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            {g.jenisKelamin && (
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold ${
                                  g.jenisKelamin === "L"
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "bg-pink-50 text-pink-700"
                                }`}
                              >
                                {g.jenisKelamin === "L" ? "Laki-laki" : "Perempuan"}
                              </span>
                            )}
                            {g.noHp && <span>• {g.noHp}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="space-y-0.5">
                        <div className="font-mono font-bold text-blue-700 text-xs">
                          {g.nuptk || "-"}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          NIP: {g.nip || "-"}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-700">
                      {g.jenisPtk || "Guru Mapel"}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {g.statusKepegawaian || "PNS / PPPK"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="space-y-1">
                        {g.waliKelas.length > 0 && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            <i className="fa-solid fa-crown text-[9px]" />
                            <span>Wali Kelas {g.waliKelas.map((w) => w.nama).join(", ")}</span>
                          </div>
                        )}
                        {g.pembelajaran.length > 0 ? (
                          <div className="text-[10px] text-slate-500 line-clamp-1">
                            {Array.from(new Set(g.pembelajaran.map((p) => p.mapel.nama))).join(", ")}
                          </div>
                        ) : g.waliKelas.length === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">Belum ada penugasan</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {g.user ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] font-mono flex items-center gap-1">
                            <i className="fa-solid fa-check text-[9px]" />
                            <span>@{g.user.username}</span>
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(g)}
                          className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 font-bold text-[10px] text-slate-500 transition cursor-pointer"
                        >
                          + Buat Akun
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {g.isAktif ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    {/* AKSI EDIT & HAPUS */}
                    <td className="py-3.5 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          title="Edit Data GTK"
                          onClick={() => handleOpenEdit(g)}
                          className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center transition cursor-pointer"
                        >
                          <i className="fa-solid fa-pen-to-square text-xs" />
                        </button>
                        <button
                          type="button"
                          title="Hapus Data GTK"
                          onClick={() => handleOpenDelete(g)}
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
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH GTK MANUAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-scale-up my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-user-plus" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Tambah GTK / Guru Manual
                  </h3>
                  <p className="text-xs text-slate-500">
                    Lengkapi identitas pendidik untuk ditambahkan ke database sekolah.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Lengkap & Gelar <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso, S.Pd., M.Pd."
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    NUPTK (16 Digit)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 199008102019011001"
                    value={formData.nuptk || ""}
                    onChange={(e) => setFormData({ ...formData, nuptk: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    NIP (18 Digit)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 198501152010011002"
                    value={formData.nip || ""}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={formData.jenisKelamin || "L"}
                    onChange={(e) =>
                      setFormData({ ...formData, jenisKelamin: e.target.value as "L" | "P" })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-semibold text-slate-700"
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jenis PTK
                  </label>
                  <select
                    value={formData.jenisPtk || "Guru Mapel"}
                    onChange={(e) => setFormData({ ...formData, jenisPtk: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-semibold text-slate-700"
                  >
                    <option value="Guru Mapel">Guru Mapel</option>
                    <option value="Guru Kelas">Guru Kelas</option>
                    <option value="Guru BK">Guru BK / Konseling</option>
                    <option value="Tendik">Tenaga Kependidikan</option>
                    <option value="Kepala Sekolah">Kepala Sekolah</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Status Kepegawaian
                  </label>
                  <select
                    value={formData.statusKepegawaian || "PNS / PPPK"}
                    onChange={(e) => setFormData({ ...formData, statusKepegawaian: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-semibold text-slate-700"
                  >
                    <option value="PNS">PNS</option>
                    <option value="PPPK">PPPK</option>
                    <option value="Guru Honorer">Guru Honorer / GTT</option>
                    <option value="Guru Tetap Yayasan">Guru Tetap Yayasan</option>
                    <option value="Tenaga Honor Sekolah">Tenaga Honor Sekolah</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 081234567890"
                    value={formData.noHp || ""}
                    onChange={(e) => setFormData({ ...formData, noHp: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Email Pendidik (Opsional)
                  </label>
                  <input
                    type="email"
                    placeholder="Contoh: guru@sekolah.sch.id"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                </div>

                {/* Penugasan Wali Kelas */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Penugasan Wali Kelas (Opsional)
                  </label>
                  <select
                    value={formData.waliKelasRombelId || ""}
                    onChange={(e) => setFormData({ ...formData, waliKelasRombelId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-semibold text-slate-700"
                  >
                    <option value="">-- Bukan Wali Kelas --</option>
                    {availableRombels.map((r) => (
                      <option key={r.id} value={r.id}>
                        Kelas {r.nama} (Tingkat {r.tingkat})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Keaktifan */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Status Keaktifan
                  </label>
                  <select
                    value={formData.isAktif ? "true" : "false"}
                    onChange={(e) => setFormData({ ...formData, isAktif: e.target.value === "true" })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-semibold text-slate-700"
                  >
                    <option value="true">Aktif Mengajar</option>
                    <option value="false">Nonaktif / Cuti</option>
                  </select>
                </div>
              </div>

              {/* Pembuatan Akun Login */}
              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200/80 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.createAccount || false}
                    onChange={(e) => setFormData({ ...formData, createAccount: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="font-bold text-blue-900 text-xs">
                    Buat Akun Login Portal Guru Sekaligus
                  </span>
                </label>

                {formData.createAccount && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block font-semibold text-blue-900 mb-1">
                        Username Login (Opsional, kosongkan = auto NIP / Nama)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: budi.santoso"
                        value={formData.username || ""}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-blue-900 mb-1">
                        Password (Opsional, default: guru123)
                      </label>
                      <input
                        type="text"
                        placeholder="Min 6 karakter (default: guru123)"
                        value={formData.password || ""}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Tombol Simpan & Batal */}
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
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPending && <i className="fa-solid fa-spinner fa-spin" />}
                  <span>{isPending ? "Menyimpan..." : "Simpan GTK"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT DATA GTK */}
      {/* ========================================================================= */}
      {showEditModal && selectedGtk && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-scale-up my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-pen-to-square" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Edit Data GTK / Guru
                  </h3>
                  <p className="text-xs text-slate-500">
                    Perbarui profil, data kepegawaian, atau kredensial akun login.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Lengkap & Gelar <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.nama}
                    onChange={(e) => setEditFormData({ ...editFormData, nama: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    NUPTK
                  </label>
                  <input
                    type="text"
                    value={editFormData.nuptk || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, nuptk: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    NIP
                  </label>
                  <input
                    type="text"
                    value={editFormData.nip || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, nip: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={editFormData.jenisKelamin || "L"}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, jenisKelamin: e.target.value as "L" | "P" })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-semibold text-slate-700"
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jenis PTK
                  </label>
                  <select
                    value={editFormData.jenisPtk || "Guru Mapel"}
                    onChange={(e) => setEditFormData({ ...editFormData, jenisPtk: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-semibold text-slate-700"
                  >
                    <option value="Guru Mapel">Guru Mapel</option>
                    <option value="Guru Kelas">Guru Kelas</option>
                    <option value="Guru BK">Guru BK / Konseling</option>
                    <option value="Tendik">Tenaga Kependidikan</option>
                    <option value="Kepala Sekolah">Kepala Sekolah</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Status Kepegawaian
                  </label>
                  <select
                    value={editFormData.statusKepegawaian || "PNS / PPPK"}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, statusKepegawaian: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-semibold text-slate-700"
                  >
                    <option value="PNS">PNS</option>
                    <option value="PPPK">PPPK</option>
                    <option value="Guru Honorer">Guru Honorer / GTT</option>
                    <option value="Guru Tetap Yayasan">Guru Tetap Yayasan</option>
                    <option value="Tenaga Honor Sekolah">Tenaga Honor Sekolah</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    value={editFormData.noHp || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, noHp: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Penugasan Wali Kelas
                  </label>
                  <select
                    value={editFormData.waliKelasRombelId || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, waliKelasRombelId: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-semibold text-slate-700"
                  >
                    <option value="">-- Bukan Wali Kelas --</option>
                    {availableRombels.map((r) => (
                      <option key={r.id} value={r.id}>
                        Kelas {r.nama} (Tingkat {r.tingkat})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Status Keaktifan
                  </label>
                  <select
                    value={editFormData.isAktif ? "true" : "false"}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, isAktif: e.target.value === "true" })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none font-semibold text-slate-700"
                  >
                    <option value="true">Aktif Mengajar</option>
                    <option value="false">Nonaktif / Cuti</option>
                  </select>
                </div>
              </div>

              {/* Manajemen Akun Login GTK */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-2">
                    <i className="fa-solid fa-key text-blue-600" />
                    <span>Akun Login Portal Guru</span>
                  </span>
                  {selectedGtk.user ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px] font-bold">
                      Akun Terdaftar: @{selectedGtk.user.username}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                      Belum Memiliki Akun
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Username Login
                    </label>
                    <input
                      type="text"
                      placeholder="Username untuk login guru"
                      value={editFormData.username || ""}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, username: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Reset Password (Kosongkan jika tidak ingin diubah)
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan password baru"
                      value={editFormData.password || ""}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, password: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tombol Simpan & Batal */}
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
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
      {/* MODAL: KONFIRMASI HAPUS GTK */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedGtk && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-xl mx-auto">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-800">
                Hapus Data GTK / Guru?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anda akan menghapus data guru{" "}
                <span className="font-bold text-slate-800">"{selectedGtk.nama}"</span>.
                Akun login dan riwayat penugasan yang terhubung juga akan dibersihkan dari database.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-800 text-[11px] font-semibold space-y-1">
              <p className="flex items-center gap-1.5 font-bold">
                <i className="fa-solid fa-circle-exclamation" />
                <span>Peringatan Penghapusan:</span>
              </p>
              <ul className="list-disc list-inside text-[10px] space-y-0.5 pl-1">
                <li>NIP: {selectedGtk.nip || selectedGtk.nuptk || "Tanpa NIP"}</li>
                <li>Akun: {selectedGtk.user ? `@${selectedGtk.user.username}` : "Belum ada akun"}</li>
                <li>Tindakan ini permanen dan tidak dapat dibatalkan.</li>
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
                <span>{isPending ? "Menghapus..." : "Ya, Hapus Data"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPOR DATA GTK DARI FILE */}
      {/* ========================================================================= */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-file-import" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Impor Data GTK / Guru
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
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/60 border border-emerald-200 space-y-2">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-info text-emerald-600" />
                <span>Belum punya format template? Unduh di bawah ini:</span>
              </span>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Format kolom resmi: <br />
                <code className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold text-[10px]">
                  Nama, NIP, Username, Password, Kelas Diampu (opsional), Mapel Diampu
                </code>
              </p>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href="/api/admin/template/gtk?format=xlsx"
                  download="Template_Data_Guru.xlsx"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition"
                >
                  <i className="fa-solid fa-file-excel" />
                  <span>Unduh Format Excel (.xlsx)</span>
                </a>
                <a
                  href="/api/admin/template/gtk?format=csv"
                  download="Template_Data_Guru.csv"
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] flex items-center gap-1.5 transition"
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
                    ? "border-emerald-500 bg-emerald-50/50"
                    : "border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/20"
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
                    <i className="fa-solid fa-file-circle-check text-3xl text-emerald-600" />
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
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-md shadow-emerald-600/20 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
