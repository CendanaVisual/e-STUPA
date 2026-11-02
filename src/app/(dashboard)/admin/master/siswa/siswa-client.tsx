"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import {
  createMurid,
  updateMurid,
  deleteMurid,
  importMuridFromFile,
  type MuridInput,
} from "@/server/actions/siswa";

export type MuridRow = {
  id: string;
  nisn: string;
  nis: string | null;
  nama: string;
  jenisKelamin: "L" | "P";
  agama: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null; // format YYYY-MM-DD
  alamat: string | null;
  anakKe: string | null;
  tahunMasuk: string | null;
  namaAyah: string | null;
  pekerjaanAyah: string | null;
  namaIbu: string | null;
  pekerjaanIbu: string | null;
  namaWali: string | null;
  kjp: boolean;
  pip: boolean;
  bantuanLain: string | null;
  status: "AKTIF" | "LULUS" | "PINDAH" | "KELUAR";
  rombel: {
    id: string;
    nama: string;
    tingkat: number;
  } | null;
  noUrut: number | null;
};

export type AvailableRombel = {
  id: string;
  nama: string;
  tingkat: number;
};

interface SiswaClientProps {
  initialSiswa: MuridRow[];
  availableRombels: AvailableRombel[];
  semesterNama?: string;
}

export function SiswaClient({
  initialSiswa,
  availableRombels,
  semesterNama,
}: SiswaClientProps) {
  const [siswaList, setSiswaList] = useState<MuridRow[]>(initialSiswa);
  const [isPending, startTransition] = useTransition();

  // Search & Filters
  const [search, setSearch] = useState("");
  const [filterKelas, setFilterKelas] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterBantuan, setFilterBantuan] = useState("ALL");

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

  // Selected Student for Edit/Delete
  const [selectedStudent, setSelectedStudent] = useState<MuridRow | null>(null);

  // Form State: Tambah Murid
  const initialFormState: MuridInput = {
    nisn: "",
    nis: "",
    nama: "",
    jenisKelamin: "L",
    agama: "Islam",
    rombelId: availableRombels[0]?.id || "",
    kelasNama: availableRombels[0]?.nama || "",
    noUrut: null,
    tempatLahir: "",
    tanggalLahir: "",
    alamat: "",
    anakKe: "1",
    tahunMasuk: String(new Date().getFullYear()),
    namaAyah: "",
    pekerjaanAyah: "",
    namaIbu: "",
    pekerjaanIbu: "",
    namaWali: "",
    kjp: false,
    pip: false,
    bantuanLain: "",
    status: "AKTIF",
  };
  const [addForm, setAddForm] = useState<MuridInput>(initialFormState);
  const [editForm, setEditForm] = useState<MuridInput>(initialFormState);

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    total: number;
    added: number;
    updated: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Statistics
  const totalMurid = siswaList.length;
  const totalLaki = siswaList.filter((s) => s.jenisKelamin === "L").length;
  const totalPerempuan = siswaList.filter((s) => s.jenisKelamin === "P").length;
  const totalBantuan = siswaList.filter(
    (s) => s.kjp || s.pip || (s.bantuanLain && s.bantuanLain.trim() !== "")
  ).length;

  // Filtered List
  const filteredList = useMemo(() => {
    return siswaList.filter((s) => {
      // Filter Kelas
      if (filterKelas !== "ALL") {
        const rombelNama = s.rombel?.nama || "Tanpa Kelas";
        if (rombelNama !== filterKelas) return false;
      }
      // Filter Status
      if (filterStatus !== "ALL" && s.status !== filterStatus) {
        return false;
      }
      // Filter Bantuan
      if (filterBantuan === "KJP" && !s.kjp) return false;
      if (filterBantuan === "PIP" && !s.pip) return false;
      if (filterBantuan === "NONE" && (s.kjp || s.pip || s.bantuanLain)) return false;
      if (filterBantuan === "ANY" && !s.kjp && !s.pip && !s.bantuanLain) return false;

      // Filter Search (Nama, NISN, NIS)
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchNama = s.nama.toLowerCase().includes(q);
      const matchNisn = s.nisn.toLowerCase().includes(q);
      const matchNis = s.nis ? s.nis.toLowerCase().includes(q) : false;
      return matchNama || matchNisn || matchNis;
    });
  }, [siswaList, search, filterKelas, filterStatus, filterBantuan]);

  // Handle Tambah Murid Manual
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createMurid(addForm);
      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFeedback({ type: "success", message: res.message });
        setShowAddModal(false);
        setAddForm(initialFormState);
        window.location.reload();
      }
    });
  };

  // Open Edit Modal
  const openEditModal = (student: MuridRow) => {
    setSelectedStudent(student);
    setEditForm({
      id: student.id,
      nisn: student.nisn,
      nis: student.nis || "",
      nama: student.nama,
      jenisKelamin: student.jenisKelamin,
      agama: student.agama || "",
      rombelId: student.rombel?.id || "",
      kelasNama: student.rombel?.nama || "",
      noUrut: student.noUrut || null,
      tempatLahir: student.tempatLahir || "",
      tanggalLahir: student.tanggalLahir || "",
      alamat: student.alamat || "",
      anakKe: student.anakKe || "",
      tahunMasuk: student.tahunMasuk || "",
      namaAyah: student.namaAyah || "",
      pekerjaanAyah: student.pekerjaanAyah || "",
      namaIbu: student.namaIbu || "",
      pekerjaanIbu: student.pekerjaanIbu || "",
      namaWali: student.namaWali || "",
      kjp: student.kjp,
      pip: student.pip,
      bantuanLain: student.bantuanLain || "",
      status: student.status,
    });
    setFeedback(null);
    setShowEditModal(true);
  };

  // Handle Edit Submit
  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await updateMurid(editForm);
      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFeedback({ type: "success", message: res.message });
        setShowEditModal(false);
        window.location.reload();
      }
    });
  };

  // Open Delete Modal
  const openDeleteModal = (student: MuridRow) => {
    setSelectedStudent(student);
    setFeedback(null);
    setShowDeleteModal(true);
  };

  // Handle Delete Submit
  const handleDeleteSubmit = () => {
    if (!selectedStudent) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await deleteMurid(selectedStudent.id);
      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFeedback({ type: "success", message: res.message });
        setShowDeleteModal(false);
        setSiswaList((prev) => prev.filter((s) => s.id !== selectedStudent.id));
      }
    });
  };

  // Handle File Upload & Import
  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({ type: "error", message: "Silakan pilih file terlebih dahulu." });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    startTransition(async () => {
      const res = await importMuridFromFile(formData);
      if (!res.success && res.total === 0) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setImportResult({
          total: res.total,
          added: res.added,
          updated: res.updated,
          failed: res.failed,
          errors: res.errors,
        });
        setFeedback({
          type: res.success ? "success" : "error",
          message: res.message,
        });
        if (res.added > 0 || res.updated > 0) {
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Notifikasi Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 border shadow-sm transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            <i
              className={`fa-solid ${
                feedback.type === "success"
                  ? "fa-circle-check text-emerald-600 text-base"
                  : "fa-triangle-exclamation text-rose-600 text-base"
              }`}
            />
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <i className="fa-solid fa-user-graduate" />
            <span>Master Data Murid & Dapodik</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Data Murid (Peserta Didik)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Kelola master data murid: identitas, penempatan rombel kelas, data orang tua, bantuan (KJP/PIP), dan status keaktifan.
          </p>
        </div>

        {/* Action Buttons: Tambah Murid Manual & Impor Murid */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tombol Action Input Tambah Murid Manual */}
          <button
            onClick={() => {
              setFeedback(null);
              setAddForm(initialFormState);
              setShowAddModal(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
          >
            <i className="fa-solid fa-user-plus" />
            <span>+ Tambah Murid Manual</span>
          </button>

          {/* Tombol Action Impor Murid */}
          <button
            onClick={() => {
              setFeedback(null);
              setSelectedFile(null);
              setImportResult(null);
              setShowImportModal(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20"
          >
            <i className="fa-solid fa-file-import" />
            <span>Impor Murid</span>
          </button>

          {/* Tombol Unduh Template Cepat */}
          <a
            href="/api/admin/template/murid?format=xlsx"
            download="Template_Master_Data_Murid.xlsx"
            className="py-2.5 px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            title="Unduh Template Excel Master Murid"
          >
            <i className="fa-solid fa-download text-blue-600" />
            <span>Unduh Template</span>
          </a>
        </div>
      </div>

      {/* 4 Kartu Statistik Cepat */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-lg font-bold">
            <i className="fa-solid fa-users" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Murid</p>
            <p className="text-xl font-extrabold text-slate-800">{totalMurid}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-lg font-bold">
            <i className="fa-solid fa-mars" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Laki-laki (L)</p>
            <p className="text-xl font-extrabold text-slate-800">{totalLaki}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-lg font-bold">
            <i className="fa-solid fa-venus" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Perempuan (P)</p>
            <p className="text-xl font-extrabold text-slate-800">{totalPerempuan}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-lg font-bold">
            <i className="fa-solid fa-hand-holding-dollar" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Penerima Bantuan</p>
            <p className="text-xl font-extrabold text-slate-800">{totalBantuan}</p>
          </div>
        </div>
      </div>

      {/* Filter & Bar Pencarian */}
      <div className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NISN, atau NIS..."
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-500 shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Filter Rombel / Kelas */}
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
          >
            <option value="ALL">Semua Kelas</option>
            {availableRombels.map((r) => (
              <option key={r.id} value={r.nama}>
                Kelas {r.nama}
              </option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="LULUS">Lulus</option>
            <option value="PINDAH">Pindah / Mutasi</option>
            <option value="KELUAR">Keluar / Nonaktif</option>
          </select>

          {/* Filter Bantuan */}
          <select
            value={filterBantuan}
            onChange={(e) => setFilterBantuan(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
          >
            <option value="ALL">Semua Bantuan</option>
            <option value="KJP">Penerima KJP</option>
            <option value="PIP">Penerima PIP</option>
            <option value="ANY">Ada Bantuan (KJP/PIP/Lain)</option>
            <option value="NONE">Tanpa Bantuan</option>
          </select>
        </div>

        <div className="text-xs font-bold text-slate-500 font-mono">
          Menampilkan {filteredList.length} dari {totalMurid} murid
        </div>
      </div>

      {/* Tabel Data Murid */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-3">NISN</th>
                <th className="py-3.5 px-3">NIS</th>
                <th className="py-3.5 px-4">Nama Peserta Didik</th>
                <th className="py-3.5 px-3 text-center">L/P</th>
                <th className="py-3.5 px-3">Rombel / Kelas</th>
                <th className="py-3.5 px-3 text-center">Bantuan</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-center w-28 bg-blue-50/50">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto mb-2">
                      <i className="fa-solid fa-user-slash" />
                    </div>
                    <p className="font-bold text-slate-700 text-sm">Tidak ada data murid yang sesuai</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Coba sesuaikan kata kunci pencarian, bersihkan filter, atau tambahkan data murid baru.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((s, idx) => {
                  const rombelNama = s.rombel?.nama || "-";
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition group">
                      <td className="py-3 px-4 text-center font-mono text-slate-400">
                        {s.noUrut || idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-700">
                        {s.nisn}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {s.nis || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800">{s.nama}</p>
                        {s.tempatLahir && s.tanggalLahir && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {s.tempatLahir}, {s.tanggalLahir}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-[10px] font-mono ${
                            s.jenisKelamin === "L"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {s.jenisKelamin}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {rombelNama !== "-" ? `Kelas ${rombelNama}` : "-"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {s.kjp && (
                            <span className="px-1.5 py-0.5 rounded-md font-bold text-[9px] bg-amber-50 text-amber-700 border border-amber-200">
                              KJP
                            </span>
                          )}
                          {s.pip && (
                            <span className="px-1.5 py-0.5 rounded-md font-bold text-[9px] bg-cyan-50 text-cyan-700 border border-cyan-200">
                              PIP
                            </span>
                          )}
                          {s.bantuanLain && (
                            <span
                              className="px-1.5 py-0.5 rounded-md font-bold text-[9px] bg-purple-50 text-purple-700 border border-purple-200 truncate max-w-[80px]"
                              title={s.bantuanLain}
                            >
                              {s.bantuanLain}
                            </span>
                          )}
                          {!s.kjp && !s.pip && !s.bantuanLain && (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1 ${
                            s.status === "AKTIF"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : s.status === "LULUS"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : s.status === "PINDAH"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.status === "AKTIF" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <span>{s.status}</span>
                        </span>
                      </td>

                      {/* Kolom Aksi Edit & Hapus di sebelah kanan Status */}
                      <td className="py-3 px-4 text-center bg-blue-50/20">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(s)}
                            disabled={isPending}
                            title="Edit Data Murid"
                            className="w-7 h-7 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center text-xs transition cursor-pointer shadow-2xs"
                          >
                            <i className="fa-solid fa-pen-to-square text-[11px]" />
                          </button>

                          <button
                            onClick={() => openDeleteModal(s)}
                            disabled={isPending}
                            title="Hapus Murid dari Database"
                            className="w-7 h-7 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 flex items-center justify-center text-xs transition cursor-pointer shadow-2xs"
                          >
                            <i className="fa-regular fa-trash-can text-[11px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL TAMBAH MURID MANUAL ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-base">
                  <i className="fa-solid fa-user-plus" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    Tambah Murid Manual
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Input data peserta didik baru ke database sekolah
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-6">
              {/* BAGIAN 1: IDENTITAS UTAMA */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <i className="fa-solid fa-id-card text-blue-500" />
                  <span>1. Identitas Pokok Murid</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NISN <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={addForm.nisn}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, nisn: e.target.value.trim() }))
                      }
                      placeholder="mis. 0151234567"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NIS / NIPD
                    </label>
                    <input
                      type="text"
                      value={addForm.nis || ""}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, nis: e.target.value.trim() }))
                      }
                      placeholder="mis. 2400123"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Jenis Kelamin <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAddForm((p) => ({ ...p, jenisKelamin: "L" }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          addForm.jenisKelamin === "L"
                            ? "bg-blue-50 border-blue-500 text-blue-700 font-extrabold"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>Laki-laki</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddForm((p) => ({ ...p, jenisKelamin: "P" }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          addForm.jenisKelamin === "P"
                            ? "bg-rose-50 border-rose-500 text-rose-700 font-extrabold"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>Perempuan</span>
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Lengkap Peserta Didik <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={addForm.nama}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, nama: e.target.value }))
                      }
                      placeholder="mis. Aisyah Putri"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Agama
                    </label>
                    <select
                      value={addForm.agama || "Islam"}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, agama: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="Islam">Islam</option>
                      <option value="Kristen">Kristen</option>
                      <option value="Katolik">Katolik</option>
                      <option value="Hindu">Hindu</option>
                      <option value="Buddha">Buddha</option>
                      <option value="Khonghucu">Khonghucu</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tempat Lahir
                    </label>
                    <input
                      type="text"
                      value={addForm.tempatLahir || ""}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, tempatLahir: e.target.value }))
                      }
                      placeholder="mis. Denpasar"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tanggal Lahir (YYYY-MM-DD)
                    </label>
                    <input
                      type="date"
                      value={addForm.tanggalLahir || ""}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, tanggalLahir: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Anak Ke-
                    </label>
                    <input
                      type="text"
                      value={addForm.anakKe || ""}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, anakKe: e.target.value }))
                      }
                      placeholder="mis. 1, 2"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Alamat Tempat Tinggal
                    </label>
                    <input
                      type="text"
                      value={addForm.alamat || ""}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, alamat: e.target.value }))
                      }
                      placeholder="mis. Jl. Pulau Moyo No. 45 Pedungan"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* BAGIAN 2: ROMBEL, NOMOR URUT & STATUS */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <i className="fa-solid fa-chalkboard-user text-purple-500" />
                  <span>2. Rombel & Status Murid</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pilih Kelas / Rombel
                    </label>
                    <select
                      value={addForm.kelasNama || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = availableRombels.find((r) => r.nama === val);
                        setAddForm((p) => ({
                          ...p,
                          kelasNama: val,
                          rombelId: match?.id || "",
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">-- Tanpa Rombel --</option>
                      {availableRombels.map((r) => (
                        <option key={r.id} value={r.nama}>
                          Kelas {r.nama} (Tingkat {r.tingkat})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      No. Urut / No. Absen
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={addForm.noUrut ?? ""}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          noUrut: e.target.value ? parseInt(e.target.value, 10) : null,
                        }))
                      }
                      placeholder="mis. 1, 2"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Murid
                    </label>
                    <select
                      value={addForm.status || "AKTIF"}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          status: e.target.value as MuridInput["status"],
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="AKTIF">Aktif</option>
                      <option value="LULUS">Lulus</option>
                      <option value="PINDAH">Pindah / Mutasi</option>
                      <option value="KELUAR">Keluar / Nonaktif</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* BAGIAN 3: ORANG TUA & BANTUAN */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <i className="fa-solid fa-hands-holding-child text-emerald-500" />
                  <span>3. Orang Tua & Bantuan Kesejahteraan</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Ayah
                    </label>
                    <input
                      type="text"
                      value={addForm.namaAyah || ""}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, namaAyah: e.target.value }))
                      }
                      placeholder="mis. Budi Hartono"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pekerjaan Ayah
                    </label>
                    <input
                      type="text"
                      value={addForm.pekerjaanAyah || ""}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, pekerjaanAyah: e.target.value }))
                      }
                      placeholder="mis. Karyawan Swasta"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Ibu
                    </label>
                    <input
                      type="text"
                      value={addForm.namaIbu || ""}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, namaIbu: e.target.value }))
                      }
                      placeholder="mis. Sri Rahayu"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pekerjaan Ibu
                    </label>
                    <input
                      type="text"
                      value={addForm.pekerjaanIbu || ""}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, pekerjaanIbu: e.target.value }))
                      }
                      placeholder="mis. Ibu Rumah Tangga"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <span className="block text-xs font-bold text-slate-700">
                      Bantuan yang Diterima
                    </span>
                    <div className="flex flex-wrap items-center gap-6">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addForm.kjp}
                          onChange={(e) =>
                            setAddForm((p) => ({ ...p, kjp: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                        />
                        <span>Penerima KJP</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addForm.pip}
                          onChange={(e) =>
                            setAddForm((p) => ({ ...p, pip: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 accent-cyan-600"
                        />
                        <span>Penerima PIP</span>
                      </label>
                    </div>

                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Bantuan Lainnya (Opsional)
                      </label>
                      <input
                        type="text"
                        value={addForm.bantuanLain || ""}
                        onChange={(e) =>
                          setAddForm((p) => ({ ...p, bantuanLain: e.target.value }))
                        }
                        placeholder="mis. Beasiswa Baznas / Yayasan"
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tombol Simpan */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check" />
                      <span>Simpan Murid Baru</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT MURID ================= */}
      {showEditModal && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-base">
                  <i className="fa-solid fa-pen-to-square" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    Edit Data Murid
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Perbarui data diri, kelas, atau informasi bantuan murid
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-6">
              {/* BAGIAN 1: IDENTITAS UTAMA */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <i className="fa-solid fa-id-card text-blue-500" />
                  <span>1. Identitas Pokok Murid</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NISN <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.nisn}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, nisn: e.target.value.trim() }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NIS / NIPD
                    </label>
                    <input
                      type="text"
                      value={editForm.nis || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, nis: e.target.value.trim() }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Jenis Kelamin
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditForm((p) => ({ ...p, jenisKelamin: "L" }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          editForm.jenisKelamin === "L"
                            ? "bg-blue-50 border-blue-500 text-blue-700 font-extrabold"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>Laki-laki</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditForm((p) => ({ ...p, jenisKelamin: "P" }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          editForm.jenisKelamin === "P"
                            ? "bg-rose-50 border-rose-500 text-rose-700 font-extrabold"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>Perempuan</span>
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Lengkap Peserta Didik <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.nama}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, nama: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Agama
                    </label>
                    <select
                      value={editForm.agama || "Islam"}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, agama: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="Islam">Islam</option>
                      <option value="Kristen">Kristen</option>
                      <option value="Katolik">Katolik</option>
                      <option value="Hindu">Hindu</option>
                      <option value="Buddha">Buddha</option>
                      <option value="Khonghucu">Khonghucu</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tempat Lahir
                    </label>
                    <input
                      type="text"
                      value={editForm.tempatLahir || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, tempatLahir: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tanggal Lahir (YYYY-MM-DD)
                    </label>
                    <input
                      type="date"
                      value={editForm.tanggalLahir || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, tanggalLahir: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Anak Ke-
                    </label>
                    <input
                      type="text"
                      value={editForm.anakKe || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, anakKe: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Alamat Tempat Tinggal
                    </label>
                    <input
                      type="text"
                      value={editForm.alamat || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, alamat: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* BAGIAN 2: ROMBEL, NOMOR URUT & STATUS */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <i className="fa-solid fa-chalkboard-user text-purple-500" />
                  <span>2. Rombel & Status Murid</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pilih Kelas / Rombel
                    </label>
                    <select
                      value={editForm.kelasNama || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = availableRombels.find((r) => r.nama === val);
                        setEditForm((p) => ({
                          ...p,
                          kelasNama: val,
                          rombelId: match?.id || "",
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">-- Tanpa Rombel --</option>
                      {availableRombels.map((r) => (
                        <option key={r.id} value={r.nama}>
                          Kelas {r.nama} (Tingkat {r.tingkat})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      No. Urut / No. Absen
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={editForm.noUrut ?? ""}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          noUrut: e.target.value ? parseInt(e.target.value, 10) : null,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Murid
                    </label>
                    <select
                      value={editForm.status || "AKTIF"}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          status: e.target.value as MuridInput["status"],
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="AKTIF">Aktif</option>
                      <option value="LULUS">Lulus</option>
                      <option value="PINDAH">Pindah / Mutasi</option>
                      <option value="KELUAR">Keluar / Nonaktif</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* BAGIAN 3: ORANG TUA & BANTUAN */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <i className="fa-solid fa-hands-holding-child text-emerald-500" />
                  <span>3. Orang Tua & Bantuan Kesejahteraan</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Ayah
                    </label>
                    <input
                      type="text"
                      value={editForm.namaAyah || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, namaAyah: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pekerjaan Ayah
                    </label>
                    <input
                      type="text"
                      value={editForm.pekerjaanAyah || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, pekerjaanAyah: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Ibu
                    </label>
                    <input
                      type="text"
                      value={editForm.namaIbu || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, namaIbu: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pekerjaan Ibu
                    </label>
                    <input
                      type="text"
                      value={editForm.pekerjaanIbu || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, pekerjaanIbu: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <span className="block text-xs font-bold text-slate-700">
                      Bantuan yang Diterima
                    </span>
                    <div className="flex flex-wrap items-center gap-6">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.kjp}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, kjp: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                        />
                        <span>Penerima KJP</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.pip}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, pip: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 accent-cyan-600"
                        />
                        <span>Penerima PIP</span>
                      </label>
                    </div>

                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Bantuan Lainnya (Opsional)
                      </label>
                      <input
                        type="text"
                        value={editForm.bantuanLain || ""}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, bantuanLain: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tombol Simpan Perubahan */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL HAPUS MURID ================= */}
      {showDeleteModal && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-xl mx-auto shadow-xs">
              <i className="fa-solid fa-trash-can" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-800">
                Hapus Data Murid?
              </h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus data murid{" "}
                <span className="font-bold text-slate-800">
                  {selectedStudent.nama}
                </span>{" "}
                (NISN: <span className="font-mono">{selectedStudent.nisn}</span>)?
              </p>
              <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-2.5 mt-2">
                <i className="fa-solid fa-triangle-exclamation mr-1" />
                Data nilai, presensi, dan riwayat rapor murid ini akan ikut terhapus secara permanen.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-rose-500/20 disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-trash-can" />
                    <span>Ya, Hapus Murid</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL IMPOR MURID ================= */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-base">
                  <i className="fa-solid fa-file-import" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    Impor Data Murid
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Unggah data massal dari file Excel (.xlsx) atau CSV (.csv)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* OPSI 1: UNDUH TEMPLATE */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <i className="fa-solid fa-file-excel text-emerald-600" />
                  <span>1. Unduh Template Isian Murid</span>
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Format Standar
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Gunakan template resmi berisi 20 kolom (NISN, Nama, Rombel/Kelas, Tanggal Lahir, Orang Tua, KJP/PIP) agar proses impor berjalan lancar tanpa kendala.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href="/api/admin/template/murid?format=xlsx"
                  download="Template_Master_Data_Murid.xlsx"
                  className="flex-1 py-2 px-3 rounded-xl bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition"
                >
                  <i className="fa-solid fa-file-excel" />
                  <span>Unduh Format Excel (.xlsx)</span>
                </a>
                <a
                  href="/api/admin/template/murid?format=csv"
                  download="Template_Master_Data_Murid.csv"
                  className="py-2 px-3 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition"
                  title="Unduh format teks CSV"
                >
                  <i className="fa-solid fa-file-csv" />
                  <span>CSV</span>
                </a>
              </div>
            </div>

            {/* OPSI 2: UNGGAH FILE */}
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <span className="block text-xs font-extrabold text-slate-700 mb-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-cloud-arrow-up text-blue-600" />
                  <span>2. Unggah File yang Sudah Diisi</span>
                </span>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                    selectedFile
                      ? "border-emerald-400 bg-emerald-50/40"
                      : "border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                    }}
                  />

                  {selectedFile ? (
                    <div className="space-y-1">
                      <i className="fa-solid fa-file-circle-check text-emerald-600 text-3xl mb-1" />
                      <p className="text-xs font-bold text-slate-800 truncate max-w-xs mx-auto">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {(selectedFile.size / 1024).toFixed(1)} KB · Klik untuk mengganti
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <i className="fa-solid fa-cloud-arrow-up text-slate-400 text-3xl mb-1" />
                      <p className="text-xs font-bold text-slate-700">
                        Klik untuk memilih file Excel / CSV
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Mendukung file .xlsx, .xls, atau .csv (maksimal 10 MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ringkasan Hasil Impor jika ada */}
              {importResult && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <i className="fa-solid fa-square-poll-vertical text-blue-600" />
                    <span>Laporan Hasil Impor:</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold">DITAMBAH</span>
                      <span className="text-sm font-extrabold text-emerald-600">
                        {importResult.added}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold">DIPERBARUI</span>
                      <span className="text-sm font-extrabold text-blue-600">
                        {importResult.updated}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold">GAGAL</span>
                      <span className="text-sm font-extrabold text-rose-600">
                        {importResult.failed}
                      </span>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-[10px] text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100 max-h-24 overflow-y-auto font-mono">
                      {importResult.errors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tombol Aksi Impor */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isPending}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Memproses Data...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-file-import" />
                      <span>Mulai Proses Impor</span>
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
