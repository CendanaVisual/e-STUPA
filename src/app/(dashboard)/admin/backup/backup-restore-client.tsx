"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  backupSemesterFull,
  restoreSemesterFull,
  backupPerMenu,
  restorePerMenu,
  actionSnapshotArsip,
} from "@/server/actions/backup";

interface BackupLogItem {
  id: string;
  createdAt: string | Date;
  jenis: string;
  status: string;
  jumlahBaris: number;
  catatan?: string | null;
  semester?: {
    tipe: string;
    tahunAjaran?: {
      nama: string;
    } | null;
  } | null;
}

interface BackupRestoreClientProps {
  semester: {
    id: string;
    kode: string;
    tipe: string;
    tahunAjaran?: {
      nama: string;
    } | null;
  } | null;
  backupLogs: BackupLogItem[];
  arsipCount: number;
}

const MENU_MODULES = [
  {
    key: "SISWA_ROMBEL",
    title: "Data Murid & Rombel",
    icon: "fa-solid fa-users-line",
    color: "emerald",
    bgClass: "bg-emerald-50 border-emerald-200 text-emerald-700",
    btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
    desc: "Master identitas siswa, NISN, penempatan rombel kelas, dan nomor absen.",
  },
  {
    key: "GTK_USER",
    title: "Data GTK & Akun Guru",
    icon: "fa-solid fa-user-tie",
    color: "indigo",
    bgClass: "bg-indigo-50 border-indigo-200 text-indigo-700",
    btnClass: "bg-indigo-600 hover:bg-indigo-700 text-white",
    desc: "Data pendidik, NUPTK, tugas kepegawaian, dan akun login pendidik.",
  },
  {
    key: "PEMBELAJARAN_NILAI",
    title: "Pembelajaran & Nilai",
    icon: "fa-solid fa-book-bookmark",
    color: "blue",
    bgClass: "bg-blue-50 border-blue-200 text-blue-700",
    btnClass: "bg-blue-600 hover:bg-blue-700 text-white",
    desc: "Mata pelajaran, pengampu rombel, bobot penilaian, dan nilai rapor siswa.",
  },
  {
    key: "PRESENSI",
    title: "Presensi Harian",
    icon: "fa-solid fa-calendar-check",
    color: "amber",
    bgClass: "bg-amber-50 border-amber-200 text-amber-700",
    btnClass: "bg-amber-600 hover:bg-amber-700 text-white",
    desc: "Rekapitulasi kehadiran harian siswa (Hadir, Sakit, Izin, Alpa) semester aktif.",
  },
  {
    key: "KESISWAAN",
    title: "Kesiswaan, BK & Prestasi",
    icon: "fa-solid fa-award",
    color: "purple",
    bgClass: "bg-purple-50 border-purple-200 text-purple-700",
    btnClass: "bg-purple-600 hover:bg-purple-700 text-white",
    desc: "Jurnal dimensi profil lulusan, bimbingan konseling, dan prestasi murid.",
  },
  {
    key: "EKSKUL_KALENDER",
    title: "Ekskul & Kalender",
    icon: "fa-solid fa-compass",
    color: "rose",
    bgClass: "bg-rose-50 border-rose-200 text-rose-700",
    btnClass: "bg-rose-600 hover:bg-rose-700 text-white",
    desc: "Master ekstrakurikuler, nilai kegiatan ekskul, serta agenda kalender pendidikan.",
  },
];

export function BackupRestoreClient({
  semester,
  backupLogs,
  arsipCount,
}: BackupRestoreClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // File input refs for full restore and per-menu restore
  const fullRestoreInputRef = useRef<HTMLInputElement>(null);
  const menuRestoreInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 1. BACKUP 1 SEMESTER PENUH
  const handleBackupFull = async () => {
    try {
      setLoading("backup_full");
      setFeedback(null);
      const res = await backupSemesterFull();
      if (res.success && res.data) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `backup-eSTUPA-semester-${semester?.kode || "aktif"}-${timestamp}.json`;
        downloadJson(res.data, filename);
        setFeedback({
          type: "success",
          message: res.message || "Berkas cadangan semester berhasil diunduh!",
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Gagal mencadangkan semester.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Terjadi kesalahan sistem saat backup semester.",
      });
    } finally {
      setLoading(null);
    }
  };

  // 2. RESTORE 1 SEMESTER PENUH
  const handleFileChangeFullRestore = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setFeedback({
        type: "error",
        message: "Format berkas tidak valid! Harap pilih berkas .json hasil backup e-STUPA.",
      });
      if (fullRestoreInputRef.current) fullRestoreInputRef.current.value = "";
      return;
    }

    const confirmRestore = window.confirm(
      `PERINGATAN PEMULIHAN DATA:\n\nApakah Anda yakin ingin memulihkan data semester dari file "${file.name}"?\nData yang cocok akan disinkronkan dan diperbarui.`
    );

    if (!confirmRestore) {
      if (fullRestoreInputRef.current) fullRestoreInputRef.current.value = "";
      return;
    }

    try {
      setLoading("restore_full");
      setFeedback(null);

      const fileText = await file.text();
      const parsedData = JSON.parse(fileText);

      const res = await restoreSemesterFull(parsedData);
      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || "Pemulihan data semester berhasil!",
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Gagal memulihkan data semester.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Gagal membaca atau memproses berkas JSON cadangan.",
      });
    } finally {
      setLoading(null);
      if (fullRestoreInputRef.current) fullRestoreInputRef.current.value = "";
    }
  };

  // 3. BACKUP PER MENU UTAMA
  const handleBackupMenu = async (menuKey: string, title: string) => {
    try {
      setLoading(`backup_menu_${menuKey}`);
      setFeedback(null);
      const res = await backupPerMenu(menuKey);
      if (res.success && res.data) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `backup-eSTUPA-modul-${menuKey.toLowerCase()}-${timestamp}.json`;
        downloadJson(res.data, filename);
        setFeedback({
          type: "success",
          message: `Cadangan modul "${title}" berhasil diunduh (${res.data.count} data)!`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: res.message || `Gagal mencadangkan modul ${title}.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || `Terjadi kendala saat mencadangkan ${title}.`,
      });
    } finally {
      setLoading(null);
    }
  };

  // 4. RESTORE PER MENU UTAMA
  const handleFileChangeMenuRestore = async (
    menuKey: string,
    title: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setFeedback({
        type: "error",
        message: "Format berkas harus .json hasil cadangan e-STUPA.",
      });
      return;
    }

    const confirmRestore = window.confirm(
      `Konfirmasi Pemulihan Modul:\n\nApakah Anda yakin ingin memulihkan modul "${title}" dari berkas "${file.name}"?`
    );

    if (!confirmRestore) {
      const inputRef = menuRestoreInputRefs.current[menuKey];
      if (inputRef) inputRef.value = "";
      return;
    }

    try {
      setLoading(`restore_menu_${menuKey}`);
      setFeedback(null);

      const fileText = await file.text();
      const parsedData = JSON.parse(fileText);

      const res = await restorePerMenu(parsedData);
      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || `Pemulihan modul "${title}" berhasil!`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: res.message || `Gagal memulihkan modul ${title}.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Gagal memproses data pemulihan modul.",
      });
    } finally {
      setLoading(null);
      const inputRef = menuRestoreInputRefs.current[menuKey];
      if (inputRef) inputRef.value = "";
    }
  };

  // 5. SNAPSHOT ARSIP NILAI
  const handleSnapshot = async () => {
    const confirmSnapshot = window.confirm(
      "Apakah Anda yakin ingin membuat snapshot arsip nilai semester ini? Seluruh nilai akhir rapor saat ini akan disimpan permanen ke tabel Arsip Historis."
    );
    if (!confirmSnapshot) return;

    try {
      setLoading("snapshot_arsip");
      setFeedback(null);
      const res = await actionSnapshotArsip();
      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || "Snapshot arsip nilai berhasil dibuat!",
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Gagal membuat snapshot arsip.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Terjadi kesalahan saat membuat snapshot.",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
              : "bg-rose-50 border-rose-300 text-rose-800"
          }`}
        >
          <div className="text-lg mt-0.5">
            <i
              className={`fa-solid ${
                feedback.type === "success"
                  ? "fa-circle-check text-emerald-600"
                  : "fa-circle-exclamation text-rose-600"
              }`}
            />
          </div>
          <div className="flex-1 text-xs sm:text-sm font-semibold">
            {feedback.message}
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold inline-flex items-center gap-1.5">
            <i className="fa-solid fa-database" />
            Pusat Keamanan & Pemulihan Basis Data
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Backup & Restore Data Akademik
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Kelola pencadangan (backup) dan pemulihan (restore) seluruh data sekolah dalam 1 semester penuh, opsi pencadangan selektif per menu utama, serta pembekuan snapshot nilai historis permanen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
            <i className="fa-solid fa-calendar-days text-slate-500 mr-1.5" />
            T.A. {semester?.tahunAjaran?.nama ?? "2026/2027"} ({semester?.tipe ?? "Ganjil"})
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold font-mono">
            <i className="fa-solid fa-box-archive mr-1.5" />
            {arsipCount} Nilai Terarsip
          </span>
        </div>
      </div>

      {/* SECTION 1: BACKUP & RESTORE 1 SEMESTER PENUH */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Backup 1 Semester */}
        <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col justify-between space-y-4 hover:shadow-md transition">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl shadow-xs">
                <i className="fa-solid fa-cloud-arrow-down" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-600">
                  Cadangan Lengkap
                </span>
                <h3 className="text-lg font-extrabold text-slate-800">
                  Backup Seluruh Data 1 Semester
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Mengekstrak dan mengunduh seluruh data semester aktif dalam format berkas terstruktur <strong>.json</strong>. Meliputi data Rombel, Murid, Penugasan Guru, Presensi, Penilaian Rapor, Jurnal Dimensi Lulusan, BK, Prestasi, dan Kalender Pendidikan.
            </p>

            <div className="mt-4 p-3 rounded-2xl bg-blue-50/60 border border-blue-200/70 text-[11px] text-blue-800 flex items-center gap-2">
              <i className="fa-solid fa-shield-halved text-blue-600 text-sm" />
              <span>Format cadangan resmi e-STUPA v2.0 siap disimpan di drive penyimpanan sekolah.</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleBackupFull}
              disabled={loading === "backup_full"}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition disabled:opacity-50"
            >
              {loading === "backup_full" ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Memproses Cadangan Semester...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-download" />
                  <span>Unduh Cadangan 1 Semester (.json)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card Restore 1 Semester */}
        <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col justify-between space-y-4 hover:shadow-md transition">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl shadow-xs">
                <i className="fa-solid fa-clock-rotate-left" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-600">
                  Pemulihan Data
                </span>
                <h3 className="text-lg font-extrabold text-slate-800">
                  Restore Data 1 Semester
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Mengembalikan atau menyinkronkan kembali seluruh data sekolah dari berkas cadangan <strong>.json</strong> semester yang pernah diunduh sebelumnya. Sistem memproses data secara aman tanpa merusak integritas tabel lainnya.
            </p>

            <div className="mt-4 p-3 rounded-2xl bg-amber-50/60 border border-amber-200/70 text-[11px] text-amber-800 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm" />
              <span>Data yang cocok akan diperbarui sesuai isi berkas cadangan yang Anda unggah.</span>
            </div>
          </div>

          <div className="pt-2">
            {/* Hidden Input File */}
            <input
              type="file"
              ref={fullRestoreInputRef}
              onChange={handleFileChangeFullRestore}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fullRestoreInputRef.current?.click()}
              disabled={loading === "restore_full"}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition disabled:opacity-50"
            >
              {loading === "restore_full" ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Memulihkan Data Semester...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-upload" />
                  <span>Pilih Berkas Cadangan & Restore (.json)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: OPSI BACKUP DATA PER MENU UTAMA */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-cubes text-blue-600" />
              <span>Opsi Backup & Restore per Menu Utama</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pencadangan selektif per modul untuk fleksibilitas pemeliharaan data berkala per bidang.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
            6 Modul Utama Tersedia
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {MENU_MODULES.map((m) => (
            <div
              key={m.key}
              className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-blue-300 hover:shadow-sm transition flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm border ${m.bgClass}`}
                  >
                    <i className={m.icon} />
                  </div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 line-clamp-1">
                    {m.title}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {m.desc}
                </p>
              </div>

              {/* Hidden input file for this module */}
              <input
                type="file"
                ref={(el) => {
                  menuRestoreInputRefs.current[m.key] = el;
                }}
                onChange={(e) => handleFileChangeMenuRestore(m.key, m.title, e)}
                accept=".json"
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => handleBackupMenu(m.key, m.title)}
                  disabled={loading === `backup_menu_${m.key}`}
                  className="py-2 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                  title={`Unduh file backup modul ${m.title}`}
                >
                  {loading === `backup_menu_${m.key}` ? (
                    <i className="fa-solid fa-spinner fa-spin text-xs" />
                  ) : (
                    <i className="fa-solid fa-download text-xs text-blue-600" />
                  )}
                  <span>Backup</span>
                </button>

                <button
                  onClick={() => menuRestoreInputRefs.current[m.key]?.click()}
                  disabled={loading === `restore_menu_${m.key}`}
                  className="py-2 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                  title={`Pulihkan modul ${m.title} dari file .json`}
                >
                  {loading === `restore_menu_${m.key}` ? (
                    <i className="fa-solid fa-spinner fa-spin text-xs" />
                  ) : (
                    <i className="fa-solid fa-upload text-xs text-amber-600" />
                  )}
                  <span>Restore</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: SNAPSHOT HISTORIS & RIWAYAT AKTIVITAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Snapshot Panel (5 Cols) */}
        <div className="lg:col-span-5 glass-light-panel rounded-3xl p-6 border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-lg">
              <i className="fa-solid fa-camera-retro" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                Snapshot Arsip Nilai Historis
              </h3>
              <p className="text-[11px] text-slate-500">
                Semester Aktif:{" "}
                {semester
                  ? `${semester.tahunAjaran?.nama ?? "2026/2027"} — ${semester.tipe}`
                  : "Belum Ada"}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Membekukan nilai akhir seluruh siswa ke dalam tabel <strong>Arsip Historis (ArsipNilai)</strong> secara permanen. Nilai tetap abadi meskipun siswa naik kelas atau lulus di tahun ajaran mendatang.
          </p>

          <button
            onClick={handleSnapshot}
            disabled={loading === "snapshot_arsip"}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition disabled:opacity-50"
          >
            {loading === "snapshot_arsip" ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" />
                <span>Membekukan Nilai ke Arsip...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk" />
                <span>Jalankan Snapshot Arsip Sekarang</span>
              </>
            )}
          </button>

          <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 text-[11px] text-slate-600 space-y-1">
            <p className="font-bold text-blue-800 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-info" />
              <span>Integritas Arsip Nilai</span>
            </p>
            <p>
              Tabel ArsipNilai menyimpan data secara denormalisasi teks lengkap (Nama Siswa, NISN, Rombel, Nama Mapel, Guru). Jika siswa naik kelas atau lulus, nilai semester ini tetap tersimpan utuh.
            </p>
          </div>
        </div>

        {/* Riwayat Backup Log (7 Cols) */}
        <div className="lg:col-span-7 glass-light-panel rounded-3xl p-6 border border-slate-200/80">
          <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-blue-600" />
            <span>Riwayat Aktivitas Backup & Restore</span>
          </h3>

          {backupLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              <i className="fa-solid fa-database text-3xl text-slate-300 mb-2 block" />
              <p className="font-semibold text-slate-600">Belum ada aktivitas cadangan tercatat.</p>
              <p>Gunakan tombol backup 1 semester atau opsi per modul di atas untuk mulai mencadangkan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 max-h-[350px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3.5">Waktu</th>
                    <th className="py-3 px-3">Jenis / Modul</th>
                    <th className="py-3 px-3">Semester</th>
                    <th className="py-3 px-3 text-center">Data</th>
                    <th className="py-3 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backupLogs.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 block">
                          {b.jenis}
                        </span>
                        {b.catatan && (
                          <span className="text-[10px] text-slate-500 block truncate max-w-[200px]" title={b.catatan}>
                            {b.catatan}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {b.semester
                          ? `${b.semester.tahunAjaran?.nama ?? "2026/2027"} (${b.semester.tipe})`
                          : "-"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-blue-700 whitespace-nowrap">
                        {b.jumlahBaris} Entitas
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${
                            b.status === "BERHASIL"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
