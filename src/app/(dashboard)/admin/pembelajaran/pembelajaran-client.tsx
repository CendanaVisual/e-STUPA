"use client";

import React, { useState, useTransition, useMemo } from "react";
import {
  createPembelajaran,
  updatePembelajaran,
  deletePembelajaran,
  syncAllGuruKelasPembelajaran,
} from "@/server/actions/pembelajaran";
import {
  getFaseByTingkat,
  MAPEL_GURU_KELAS_BY_FASE,
  type Fase,
} from "@/lib/services/pembelajaran-utils";

export interface PembelajaranItem {
  id: string;
  semesterId: string;
  rombelId: string;
  mapelId: string;
  gtkId: string;
  kktp: number | null;
  bobotHarian: number;
  bobotUts: number;
  bobotUas: number;
  isFinal: boolean;
  rombel: {
    id: string;
    nama: string;
    tingkat: number;
    kurikulum: string | null;
    waliKelasId: string | null;
    waliKelas?: {
      id: string;
      nama: string;
      jenisPtk: string | null;
    } | null;
  };
  mapel: {
    id: string;
    kode: string;
    nama: string;
    kelompok: string | null;
  };
  gtk: {
    id: string;
    nama: string;
    nuptk: string | null;
    nip: string | null;
    jenisPtk: string | null;
  };
  _count?: {
    nilaiRapor: number;
  };
}

export interface RombelItem {
  id: string;
  nama: string;
  tingkat: number;
  kurikulum: string | null;
  waliKelasId: string | null;
  waliKelas?: {
    id: string;
    nama: string;
    jenisPtk: string | null;
  } | null;
}

export interface MapelItem {
  id: string;
  kode: string;
  nama: string;
  kelompok: string | null;
}

export interface GtkItem {
  id: string;
  nama: string;
  nuptk: string | null;
  nip: string | null;
  jenisPtk: string | null;
}

interface PembelajaranClientProps {
  initialPembelajarans: PembelajaranItem[];
  rombels: RombelItem[];
  mapels: MapelItem[];
  gtks: GtkItem[];
  semesterAktif: {
    id: string;
    tahunAjaran: { nama: string };
    tipe: string;
  } | null;
}

export default function PembelajaranClient({
  initialPembelajarans,
  rombels,
  mapels,
  gtks,
  semesterAktif,
}: PembelajaranClientProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // Form State Tambah
  const [selectedRombelId, setSelectedRombelId] = useState<string>("");
  const [selectedGtkId, setSelectedGtkId] = useState<string>("");
  const [selectedMapelId, setSelectedMapelId] = useState<string>("");
  const [kktp, setKktp] = useState<number>(75);
  const [bobotHarian, setBobotHarian] = useState<number>(30);
  const [bobotUts, setBobotUts] = useState<number>(40);
  const [bobotUas, setBobotUas] = useState<number>(30);
  const [autoSyncGuruKelas, setAutoSyncGuruKelas] = useState<boolean>(true);

  // Modal State Edit
  const [editingItem, setEditingItem] = useState<PembelajaranItem | null>(null);
  const [editGtkId, setEditGtkId] = useState<string>("");
  const [editKktp, setEditKktp] = useState<number>(75);
  const [editBobotHarian, setEditBobotHarian] = useState<number>(30);
  const [editBobotUts, setEditBobotUts] = useState<number>(40);
  const [editBobotUas, setEditBobotUas] = useState<number>(30);
  const [editSyncWaliKelas, setEditSyncWaliKelas] = useState<boolean>(true);

  // Modal State Hapus
  const [deletingItem, setDeletingItem] = useState<PembelajaranItem | null>(null);

  // Filter & Search Table
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterRombel, setFilterRombel] = useState<string>("ALL");
  const [filterMapel, setFilterMapel] = useState<string>("ALL");
  const [filterJenisPtk, setFilterJenisPtk] = useState<string>("ALL");

  // Rombel & GTK terpilih pada form tambah
  const selectedRombel = useMemo(
    () => rombels.find((r) => r.id === selectedRombelId),
    [rombels, selectedRombelId]
  );
  const selectedGtk = useMemo(
    () => gtks.find((g) => g.id === selectedGtkId),
    [gtks, selectedGtkId]
  );

  const isSelectedGtkGuruKelas = useMemo(() => {
    if (!selectedGtk || !selectedGtk.jenisPtk) return false;
    const norm = selectedGtk.jenisPtk.toLowerCase().trim();
    return norm === "guru kelas" || norm.includes("guru kelas");
  }, [selectedGtk]);

  const selectedRombelFaseInfo = useMemo(() => {
    if (!selectedRombel) return null;
    return getFaseByTingkat(selectedRombel.tingkat);
  }, [selectedRombel]);

  const mapelFaseList = useMemo(() => {
    if (!selectedRombelFaseInfo) return [];
    return MAPEL_GURU_KELAS_BY_FASE[selectedRombelFaseInfo.fase];
  }, [selectedRombelFaseInfo]);

  // Total Bobot Validations
  const totalBobotTambah = bobotHarian + bobotUts + bobotUas;
  const isBobotTambahValid = totalBobotTambah === 100;

  const totalBobotEdit = editBobotHarian + editBobotUts + editBobotUas;
  const isBobotEditValid = totalBobotEdit === 100;

  // Filter Table List
  const filteredPembelajarans = useMemo(() => {
    return initialPembelajarans.filter((p) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchKelas = p.rombel.nama.toLowerCase().includes(q);
        const matchMapel =
          p.mapel.nama.toLowerCase().includes(q) || p.mapel.kode.toLowerCase().includes(q);
        const matchGtk =
          p.gtk.nama.toLowerCase().includes(q) || (p.gtk.nuptk && p.gtk.nuptk.includes(q));
        if (!matchKelas && !matchMapel && !matchGtk) return false;
      }

      // Filter Rombel
      if (filterRombel !== "ALL" && p.rombelId !== filterRombel) {
        return false;
      }

      // Filter Mapel
      if (filterMapel !== "ALL" && p.mapelId !== filterMapel) {
        return false;
      }

      // Filter Jenis PTK
      if (filterJenisPtk !== "ALL") {
        const isGk =
          p.gtk.jenisPtk?.toLowerCase().trim() === "guru kelas" ||
          p.gtk.jenisPtk?.toLowerCase().includes("guru kelas");
        if (filterJenisPtk === "GURU_KELAS" && !isGk) return false;
        if (filterJenisPtk === "GURU_MAPEL" && isGk) return false;
      }

      return true;
    });
  }, [initialPembelajarans, searchQuery, filterRombel, filterMapel, filterJenisPtk]);

  // Quick Stats
  const uniqueRombelsCount = useMemo(() => {
    const set = new Set(initialPembelajarans.map((p) => p.rombelId));
    return set.size;
  }, [initialPembelajarans]);

  const uniqueGtksCount = useMemo(() => {
    const set = new Set(initialPembelajarans.map((p) => p.gtkId));
    return set.size;
  }, [initialPembelajarans]);

  const guruKelasPembelajaranCount = useMemo(() => {
    return initialPembelajarans.filter(
      (p) =>
        p.gtk.jenisPtk?.toLowerCase().trim() === "guru kelas" ||
        p.gtk.jenisPtk?.toLowerCase().includes("guru kelas")
    ).length;
  }, [initialPembelajarans]);

  // Handlers
  const handleResetTambahForm = () => {
    setSelectedRombelId("");
    setSelectedGtkId("");
    setSelectedMapelId("");
    setKktp(75);
    setBobotHarian(30);
    setBobotUts(40);
    setBobotUas(30);
    setAutoSyncGuruKelas(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!semesterAktif) {
      setFeedback({ type: "error", message: "Tidak ada semester aktif." });
      return;
    }
    if (!selectedRombelId || !selectedGtkId) {
      setFeedback({ type: "error", message: "Rombel dan Guru Pengampu wajib dipilih." });
      return;
    }
    if (!isBobotTambahValid) {
      setFeedback({
        type: "error",
        message: `Total bobot harus 100% (saat ini ${totalBobotTambah}%).`,
      });
      return;
    }
    if (!isSelectedGtkGuruKelas && !selectedMapelId) {
      setFeedback({ type: "error", message: "Mata pelajaran wajib dipilih untuk Guru Mapel." });
      return;
    }

    startTransition(async () => {
      const res = await createPembelajaran({
        semesterId: semesterAktif.id,
        rombelId: selectedRombelId,
        gtkId: selectedGtkId,
        mapelId: selectedMapelId,
        kktp,
        bobotHarian,
        bobotUts,
        bobotUas,
        autoSyncGuruKelas: isSelectedGtkGuruKelas ? autoSyncGuruKelas : false,
      });

      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        handleResetTambahForm();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleOpenEdit = (item: PembelajaranItem) => {
    setEditingItem(item);
    setEditGtkId(item.gtkId);
    setEditKktp(item.kktp ?? 75);
    setEditBobotHarian(item.bobotHarian);
    setEditBobotUts(item.bobotUts);
    setEditBobotUas(item.bobotUas);
    setEditSyncWaliKelas(true);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editGtkId) {
      setFeedback({ type: "error", message: "Guru Pengampu wajib dipilih." });
      return;
    }
    if (!isBobotEditValid) {
      setFeedback({
        type: "error",
        message: `Total bobot harus 100% (saat ini ${totalBobotEdit}%).`,
      });
      return;
    }

    startTransition(async () => {
      const res = await updatePembelajaran({
        id: editingItem.id,
        gtkId: editGtkId,
        kktp: editKktp,
        bobotHarian: editBobotHarian,
        bobotUts: editBobotUts,
        bobotUas: editBobotUas,
        syncWaliKelas: editSyncWaliKelas,
      });

      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setEditingItem(null);
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleDeleteSubmit = () => {
    if (!deletingItem) return;
    startTransition(async () => {
      const res = await deletePembelajaran(deletingItem.id);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setDeletingItem(null);
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleSyncAllGuruKelas = () => {
    if (!window.confirm("Sinkronkan seluruh rombel yang memiliki Wali Kelas Guru Kelas sesuai pembagian mata pelajaran Fase A, B, & C?")) {
      return;
    }
    startTransition(async () => {
      const res = await syncAllGuruKelasPembelajaran();
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-sm transition animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-3">
            <i
              className={`fa-solid ${
                feedback.type === "success" ? "fa-circle-check text-emerald-600" : "fa-triangle-exclamation text-rose-600"
              } text-lg shrink-0`}
            />
            <p className="text-xs sm:text-sm font-semibold">{feedback.message}</p>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold inline-flex items-center gap-1.5">
            <i className="fa-solid fa-chalkboard" />
            <span>Plotting & Penugasan Mengajar Kurikulum Merdeka</span>
          </span>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-2">
            Pembelajaran & Guru Pengampu
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Atur penugasan mengajar Guru × Mata Pelajaran × Rombel. Terintegrasi dengan logika otomatis{" "}
            <b>Guru Kelas & Wali Kelas</b> untuk Fase A (Kelas 1–2), Fase B (Kelas 3–4), dan Fase C (Kelas 5–6).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleSyncAllGuruKelas}
            disabled={isPending}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black text-xs shadow-md shadow-teal-700/20 transition cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <i className={`fa-solid ${isPending ? "fa-spinner fa-spin" : "fa-bolt-lightning"}`} />
            <span>Sinkronkan Semua Guru Kelas</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Pembelajaran
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-list-check" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 mt-2 font-mono">
            {initialPembelajarans.length}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Penugasan terjadwal</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Rombel Terpetakan
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-users-rectangle" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 mt-2 font-mono">
            {uniqueRombelsCount} <span className="text-xs text-slate-400 font-normal">/ {rombels.length}</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Kelas aktif terisi</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Guru Pengampu
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-chalkboard-user" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 mt-2 font-mono">
            {uniqueGtksCount} <span className="text-xs text-slate-400 font-normal">/ {gtks.length}</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Pendidik bertugas</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Guru Kelas Mapel
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-graduation-cap" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 mt-2 font-mono">
            {guruKelasPembelajaranCount}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Mapel Fase A/B/C terpetakan</p>
        </div>
      </div>

      {/* Main Grid: Form Tambah & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL KIRI: FORM TAMBAH (Col 1-4) */}
        <div className="lg:col-span-4 glass-light-panel rounded-3xl p-5 sm:p-6 border border-slate-200/80 h-fit space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-plus-circle text-teal-600" />
              <span>Tambah Penugasan Mengajar</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Input mata pelajaran atau sinkronkan paket Guru Kelas.
            </p>
          </div>

          {!semesterAktif ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              Tidak ada semester aktif. Aktifkan semester terlebih dahulu melalui menu Tahun Ajaran.
            </div>
          ) : (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Pilih Rombel */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rombel / Kelas <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedRombelId}
                  onChange={(e) => setSelectedRombelId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-teal-500 cursor-pointer shadow-xs"
                >
                  <option value="">-- Pilih Rombel / Kelas --</option>
                  {rombels.map((r) => {
                    const faseInfo = getFaseByTingkat(r.tingkat);
                    return (
                      <option key={r.id} value={r.id}>
                        Kelas {r.nama} (Tingkat {r.tingkat} • {faseInfo.label})
                      </option>
                    );
                  })}
                </select>
                {selectedRombel && (
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    Wali Kelas saat ini:{" "}
                    <span className="font-bold text-slate-700">
                      {selectedRombel.waliKelas?.nama || "Belum Ditentukan"}
                    </span>
                  </p>
                )}
              </div>

              {/* Pilih Guru Pengampu */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Guru Pengampu (GTK) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedGtkId}
                  onChange={(e) => setSelectedGtkId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-teal-500 cursor-pointer shadow-xs"
                >
                  <option value="">-- Pilih Guru Pengampu --</option>
                  {gtks.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama} [{g.jenisPtk || "GTK"}]
                    </option>
                  ))}
                </select>
              </div>

              {/* LOGIKA GURU KELAS: NOTICE & AUTO-SYNC CHECKBOX */}
              {selectedRombel && selectedGtk && isSelectedGtkGuruKelas && (
                <div className="p-3.5 bg-gradient-to-br from-teal-50/90 to-emerald-50/80 rounded-2xl border border-teal-200/90 text-xs space-y-2.5">
                  <div className="flex items-center gap-2 font-black text-teal-800">
                    <i className="fa-solid fa-sparkles text-teal-600" />
                    <span>Mode Otomatis Guru Kelas</span>
                  </div>

                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Guru ini berstatus <b>Guru Kelas</b>. Status penugasan wali kelas untuk{" "}
                    <b>Kelas {selectedRombel.nama}</b> akan disinkronkan, dan otomatis mengampu mata
                    pelajaran <b>{selectedRombelFaseInfo?.label}</b>:
                  </p>

                  <div className="bg-white/80 rounded-xl p-2.5 border border-teal-100">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 mb-1">
                      Mata Pelajaran {selectedRombelFaseInfo?.fase.replace("_", " ")} ({mapelFaseList.length} Mapel):
                    </p>
                    <ul className="grid grid-cols-1 gap-1 text-[11px] font-semibold text-slate-700">
                      {mapelFaseList.map((m) => (
                        <li key={m.kode} className="flex items-center gap-1.5">
                          <i className="fa-solid fa-circle-check text-emerald-600 text-[9px]" />
                          <span>{m.nama}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <label className="flex items-start gap-2 pt-1 font-bold text-teal-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoSyncGuruKelas}
                      onChange={(e) => setAutoSyncGuruKelas(e.target.checked)}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="text-[11px] leading-tight">
                      Otomatis petakan seluruh mata pelajaran di atas & jadikan Wali Kelas
                    </span>
                  </label>
                </div>
              )}

              {/* Pilih Mata Pelajaran (hanya aktif jika bukan mode auto-sync guru kelas) */}
              {(!isSelectedGtkGuruKelas || !autoSyncGuruKelas) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedMapelId}
                    onChange={(e) => setSelectedMapelId(e.target.value)}
                    required={!isSelectedGtkGuruKelas || !autoSyncGuruKelas}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-teal-500 cursor-pointer shadow-xs"
                  >
                    <option value="">-- Pilih Mata Pelajaran --</option>
                    {mapels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama} ({m.kode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* KKTP */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Batas KKTP / KKM</label>
                <input
                  type="number"
                  min={50}
                  max={95}
                  value={kktp}
                  onChange={(e) => setKktp(parseInt(e.target.value, 10) || 75)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Bobot Penilaian */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Bobot Penilaian: Harian / UTS / UAS (%)
                  </label>
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      isBobotTambahValid ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    Total: {totalBobotTambah}% {isBobotTambahValid ? "✓" : "✗ (harus 100%)"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Harian (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={bobotHarian}
                      onChange={(e) => setBobotHarian(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">UTS (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={bobotUts}
                      onChange={(e) => setBobotUts(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">UAS (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={bobotUas}
                      onChange={(e) => setBobotUas(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending || !isBobotTambahValid}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-xs transition disabled:opacity-50"
              >
                <i className={`fa-solid ${isPending ? "fa-spinner fa-spin" : "fa-plus"}`} />
                <span>
                  {isSelectedGtkGuruKelas && autoSyncGuruKelas
                    ? "Simpan & Sinkronkan Paket Guru Kelas"
                    : "Simpan Penugasan"}
                </span>
              </button>
            </form>
          )}
        </div>

        {/* PANEL KANAN: DAFTAR PEMBELAJARAN (Col 5-12) */}
        <div className="lg:col-span-8 glass-light-panel rounded-3xl p-5 sm:p-6 border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-list-check text-teal-600" />
                <span>Daftar Pembelajaran Semester Aktif</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Menampilkan {filteredPembelajarans.length} dari {initialPembelajarans.length} penugasan.
              </p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-5 relative">
              <i className="fa-solid fa-search absolute left-3 top-3 text-slate-400 text-xs" />
              <input
                type="text"
                placeholder="Cari kelas, mapel, atau nama guru..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={filterRombel}
                onChange={(e) => setFilterRombel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">Semua Rombel</option>
                {rombels.map((r) => (
                  <option key={r.id} value={r.id}>
                    Kelas {r.nama} (Tingkat {r.tingkat})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <select
                value={filterMapel}
                onChange={(e) => setFilterMapel(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">Semua Mapel</option>
                {mapels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.kode}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <select
                value={filterJenisPtk}
                onChange={(e) => setFilterJenisPtk(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">Semua Guru</option>
                <option value="GURU_KELAS">Guru Kelas</option>
                <option value="GURU_MAPEL">Guru Mapel</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {filteredPembelajarans.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200/80">
              <i className="fa-solid fa-chalkboard text-4xl text-slate-300 mb-3 block" />
              <p className="font-bold text-slate-700 text-sm">Tidak ada pembelajaran yang sesuai.</p>
              <p className="text-slate-500 mt-1 max-w-md mx-auto">
                Silakan tambah penugasan baru di panel kiri atau klik tombol &quot;Sinkronkan Semua Guru Kelas&quot;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Kelas</th>
                    <th className="py-3 px-3">Mata Pelajaran</th>
                    <th className="py-3 px-3">Guru Pengampu</th>
                    <th className="py-3 px-3 text-center">KKTP &amp; Bobot</th>
                    <th className="py-3 px-3 text-center">E-Rapor</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredPembelajarans.map((p) => {
                    const isGk =
                      p.gtk.jenisPtk?.toLowerCase().trim() === "guru kelas" ||
                      p.gtk.jenisPtk?.toLowerCase().includes("guru kelas");
                    const isWali = p.rombel.waliKelasId === p.gtk.id;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        {/* Kelas */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-black text-[11px] shrink-0 font-mono">
                              {p.rombel.nama}
                            </span>
                            <div>
                              <p className="font-bold text-slate-800 leading-tight">Kelas {p.rombel.nama}</p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Tingkat {p.rombel.tingkat} • {getFaseByTingkat(p.rombel.tingkat).fase.replace("_", " ")}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Mata Pelajaran */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800 leading-tight">
                            {p.mapel.nama}
                          </div>
                          <span className="text-[10px] text-blue-600 font-mono font-bold">
                            {p.mapel.kode}
                          </span>
                        </td>

                        {/* Guru Pengampu */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                            <span>{p.gtk.nama}</span>
                            {isWali && (
                              <span className="px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black">
                                Wali Kelas
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                isGk ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {p.gtk.jenisPtk || "GTK"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              NUPTK: {p.gtk.nuptk || "-"}
                            </span>
                          </div>
                        </td>

                        {/* KKTP & Bobot */}
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-[10px]">
                            KKTP {p.kktp ?? 75}
                          </span>
                          <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                            {p.bobotHarian}% / {p.bobotUts}% / {p.bobotUas}%
                          </p>
                        </td>

                        {/* E-Rapor Download */}
                        <td className="py-3 px-3 text-center">
                          <a
                            href={`/api/guru/ekspor/${p.id}`}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-[11px] transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Unduh Lembar Nilai E-Rapor"
                          >
                            <i className="fa-solid fa-file-excel text-emerald-600" />
                            <span>.xlsx</span>
                          </a>
                        </td>

                        {/* Aksi: Edit & Hapus */}
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {/* Tombol Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center text-xs transition cursor-pointer active:scale-95"
                              title="Edit Penugasan Mengajar"
                            >
                              <i className="fa-solid fa-pen-to-square" />
                            </button>

                            {/* Tombol Hapus */}
                            <button
                              type="button"
                              onClick={() => setDeletingItem(p)}
                              className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center text-xs transition cursor-pointer active:scale-95"
                              title="Hapus Penugasan Mengajar"
                            >
                              <i className="fa-solid fa-trash-can" />
                            </button>
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

      {/* MODAL EDIT PEMBELAJARAN */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-pen-to-square" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Edit Penugasan Mengajar</h3>
                  <p className="text-[11px] text-slate-400">
                    Kelas {editingItem.rombel.nama} • {editingItem.mapel.nama}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-3.5">
              {/* Info Rombel & Mapel */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Kelas</span>
                  <p className="font-bold text-slate-800">Kelas {editingItem.rombel.nama}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Mata Pelajaran</span>
                  <p className="font-bold text-blue-700">{editingItem.mapel.nama} ({editingItem.mapel.kode})</p>
                </div>
              </div>

              {/* Pilih Guru Pengampu Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Guru Pengampu (GTK) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editGtkId}
                  onChange={(e) => setEditGtkId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  {gtks.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama} [{g.jenisPtk || "GTK"}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Checkbox Sinkronkan Wali Kelas jika Guru Kelas */}
              {(() => {
                const curGtk = gtks.find((g) => g.id === editGtkId);
                const isGk =
                  curGtk?.jenisPtk?.toLowerCase().trim() === "guru kelas" ||
                  curGtk?.jenisPtk?.toLowerCase().includes("guru kelas");
                if (!isGk) return null;
                return (
                  <label className="flex items-start gap-2 p-2.5 bg-teal-50/70 border border-teal-200 rounded-xl cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editSyncWaliKelas}
                      onChange={(e) => setEditSyncWaliKelas(e.target.checked)}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-teal-900 leading-tight">
                      Sinkronkan status Wali Kelas {editingItem.rombel.nama} ke {curGtk?.nama}
                    </span>
                  </label>
                );
              })()}

              {/* KKTP */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Batas KKTP / KKM</label>
                <input
                  type="number"
                  min={50}
                  max={95}
                  value={editKktp}
                  onChange={(e) => setEditKktp(parseInt(e.target.value, 10) || 75)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Bobot Penilaian */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Bobot Penilaian: Harian / UTS / UAS (%)
                  </label>
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      isBobotEditValid ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    Total: {totalBobotEdit}% {isBobotEditValid ? "✓" : "✗"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editBobotHarian}
                    onChange={(e) => setEditBobotHarian(parseInt(e.target.value, 10) || 0)}
                    className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono font-bold"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editBobotUts}
                    onChange={(e) => setEditBobotUts(parseInt(e.target.value, 10) || 0)}
                    className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono font-bold"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editBobotUas}
                    onChange={(e) => setEditBobotUas(parseInt(e.target.value, 10) || 0)}
                    className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !isBobotEditValid}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <i className={`fa-solid ${isPending ? "fa-spinner fa-spin" : "fa-check"}`} />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HAPUS PEMBELAJARAN */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-base">
                <i className="fa-solid fa-triangle-exclamation" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Hapus Penugasan Mengajar</h3>
                <p className="text-[11px] text-slate-400">Konfirmasi penghapusan data dari database</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1.5 leading-relaxed">
              <p>
                Anda akan menghapus penugasan mengajar mata pelajaran <b>{deletingItem.mapel.nama}</b> di{" "}
                <b>Kelas {deletingItem.rombel.nama}</b> dengan guru pengampu <b>{deletingItem.gtk.nama}</b>.
              </p>
              <p className="text-[11px] text-rose-700 font-medium">
                ⚠️ Catatan: Seluruh data penilaian harian dan nilai rapor yang terhubung ke pembelajaran ini
                juga akan ikut dibersihkan secara otomatis.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isPending}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <i className={`fa-solid ${isPending ? "fa-spinner fa-spin" : "fa-trash-can"}`} />
                <span>Ya, Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
