"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  tambahEkskul,
  editEkskul,
  hapusEkskul,
  type EkskulInput,
} from "@/server/actions/ekskul";

export type EkskulCardItem = {
  id: string;
  nama: string;
  kategori: string | null;
  deskripsi: string | null;
  pembina: string | null;
  hari: string | null;
  jam: string | null;
  kuota: number | null;
  lokasi: string | null;
  isAktif: boolean;
  pesertaCount: number;
};

interface EkskulMasterClientProps {
  initialEkskulList: EkskulCardItem[];
  taNama: string;
}

export function EkskulMasterClient({
  initialEkskulList,
  taNama,
}: EkskulMasterClientProps) {
  const [ekskulList, setEkskulList] = useState<EkskulCardItem[]>(initialEkskulList);
  const [isPending, startTransition] = useTransition();

  // Modals & Selected Ekskul
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEkskul, setSelectedEkskul] = useState<EkskulCardItem | null>(null);

  // Form state: Tambah
  const defaultFormState: EkskulInput = {
    nama: "",
    kategori: "Kesenian",
    pembina: "",
    hari: "",
    jam: "",
    lokasi: "",
    kuota: null,
    deskripsi: "",
    isAktif: true,
  };
  const [addData, setAddData] = useState<EkskulInput>(defaultFormState);

  // Form state: Edit
  const [editData, setEditData] = useState<EkskulInput>(defaultFormState);

  // Notifications
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Open Edit Modal
  const handleOpenEdit = (e: EkskulCardItem) => {
    setSelectedEkskul(e);
    setEditData({
      id: e.id,
      nama: e.nama,
      kategori: e.kategori || "Kesenian",
      pembina: e.pembina || "",
      hari: e.hari || "",
      jam: e.jam || "",
      lokasi: e.lokasi || "",
      kuota: e.kuota,
      deskripsi: e.deskripsi || "",
      isAktif: e.isAktif,
    });
    setShowEditModal(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (e: EkskulCardItem) => {
    setSelectedEkskul(e);
    setShowDeleteModal(true);
  };

  // Submit Tambah
  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        await tambahEkskul(addData);
        setFeedback({ type: "success", message: `Ekstrakurikuler "${addData.nama}" berhasil ditambahkan!` });
        setShowAddModal(false);
        setAddData(defaultFormState);
        window.location.reload();
      } catch (err: unknown) {
        setFeedback({
          type: "error",
          message: err instanceof Error ? err.message : "Gagal menambahkan ekstrakurikuler.",
        });
      }
    });
  };

  // Submit Edit
  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        await editEkskul(editData);
        setFeedback({ type: "success", message: `Data ekstrakurikuler "${editData.nama}" berhasil diperbarui!` });
        setShowEditModal(false);
        setSelectedEkskul(null);
        window.location.reload();
      } catch (err: unknown) {
        setFeedback({
          type: "error",
          message: err instanceof Error ? err.message : "Gagal memperbarui data ekstrakurikuler.",
        });
      }
    });
  };

  // Submit Delete
  const handleConfirmDelete = () => {
    if (!selectedEkskul) return;
    setFeedback(null);

    startTransition(async () => {
      try {
        await hapusEkskul(selectedEkskul.id);
        setFeedback({ type: "success", message: `Ekstrakurikuler "${selectedEkskul.nama}" berhasil dihapus!` });
        setShowDeleteModal(false);
        setEkskulList((prev) => prev.filter((item) => item.id !== selectedEkskul.id));
        setSelectedEkskul(null);
      } catch (err: unknown) {
        setFeedback({
          type: "error",
          message: err instanceof Error ? err.message : "Gagal menghapus data ekstrakurikuler.",
        });
      }
    });
  };

  return (
    <div className="space-y-4">
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

      {/* Header Bar */}
      <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-100">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
          {ekskulList.length} KEGIATAN · TA {taNama}
        </div>

        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setAddData(defaultFormState);
            setShowAddModal(true);
          }}
          className="px-5 py-2.5 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs shadow-md shadow-sky-600/20 flex items-center gap-2 transition cursor-pointer"
        >
          <i className="fa-solid fa-plus text-xs" />
          <span>Tambah Ekskul</span>
        </button>
      </div>

      {ekskulList.length === 0 ? (
        <div className="p-12 text-center text-slate-400 font-bold">
          Belum ada kegiatan ekstrakurikuler. Silakan klik tombol <b>Tambah Ekskul</b> di atas.
        </div>
      ) : (
        <div className="space-y-3">
          {ekskulList.map((e) => {
            const jadwalStr = `${e.hari || "-"}${e.jam ? ` (${e.jam})` : ""}`;

            return (
              <div
                key={e.id}
                className="border border-slate-100 hover:border-slate-200 rounded-2xl p-4 transition bg-white group hover:shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-medal text-lg" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800 text-sm">{e.nama}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {e.kategori || "Umum"}
                        </span>
                        {!e.isAktif && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-200 uppercase">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 flex flex-wrap items-center gap-1.5">
                        <span>
                          Pembina: <strong className="text-slate-600">{e.pembina || "-"}</strong>
                        </span>
                        <span>•</span>
                        <span className="text-sky-700 font-bold">{e.pesertaCount} peserta</span>
                        {e.kuota ? <span>/ {e.kuota} kuota</span> : null}
                        <span>•</span>
                        <span>Jadwal: {jadwalStr}</span>
                        {e.lokasi ? <span>• Lokasi: {e.lokasi}</span> : null}
                      </div>
                      {e.deskripsi && (
                        <p className="text-[11px] font-medium text-slate-500 mt-1 italic">
                          {e.deskripsi}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* AKSI DI SEBELAH MENU KELOLA: [Kelola] [Edit] [Hapus] */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Tombol Kelola */}
                    <Link
                      href={`/admin/master/ekskul?tab=peserta&ekskulId=${e.id}`}
                      className="text-sky-700 bg-sky-50 hover:bg-sky-100 px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-users text-[11px]" />
                      <span>Kelola</span>
                    </Link>

                    {/* Tombol Edit di Sebelah Kelola */}
                    <button
                      type="button"
                      title="Edit Kegiatan Ekskul"
                      onClick={() => handleOpenEdit(e)}
                      className="text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-pen-to-square text-[11px]" />
                      <span>Edit</span>
                    </button>

                    {/* Tombol Hapus di Sebelah Kelola */}
                    <button
                      type="button"
                      title="Hapus Kegiatan Ekskul"
                      onClick={() => handleOpenDelete(e)}
                      className="text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can text-[11px]" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH EKSTRAKURIKULER BARU */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-plus" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Tambah Ekstrakurikuler Baru
                  </h3>
                  <p className="text-xs text-slate-500">
                    Lengkapi informasi kegiatan ekstrakurikuler sekolah.
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

            <form onSubmit={handleSubmitAdd} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Kegiatan <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addData.nama}
                  onChange={(e) => setAddData({ ...addData, nama: e.target.value })}
                  placeholder="mis. Praja Muda Karana (Pramuka)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={addData.kategori || "Kesenian"}
                    onChange={(e) => setAddData({ ...addData, kategori: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:bg-white focus:border-sky-500 outline-none cursor-pointer"
                  >
                    <option value="Kepanduan / Pramuka">Kepanduan / Pramuka</option>
                    <option value="Olahraga">Olahraga</option>
                    <option value="Kesenian">Kesenian & Budaya</option>
                    <option value="Sains & Teknologi">Sains & Riset</option>
                    <option value="Kemanusiaan / Kesehatan">Kemanusiaan (PMR)</option>
                    <option value="Keagamaan">Keagamaan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Pembina</label>
                  <input
                    type="text"
                    value={addData.pembina || ""}
                    onChange={(e) => setAddData({ ...addData, pembina: e.target.value })}
                    placeholder="Nama guru/pelatih"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hari Latihan</label>
                  <input
                    type="text"
                    value={addData.hari || ""}
                    onChange={(e) => setAddData({ ...addData, hari: e.target.value })}
                    placeholder="mis. Jumat"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Pelaksanaan</label>
                  <input
                    type="text"
                    value={addData.jam || ""}
                    onChange={(e) => setAddData({ ...addData, jam: e.target.value })}
                    placeholder="mis. 14:30 - 16:30"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lokasi Latihan</label>
                  <input
                    type="text"
                    value={addData.lokasi || ""}
                    onChange={(e) => setAddData({ ...addData, lokasi: e.target.value })}
                    placeholder="Lapangan / Aula"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kuota Maksimal</label>
                  <input
                    type="number"
                    value={addData.kuota ?? ""}
                    onChange={(e) =>
                      setAddData({
                        ...addData,
                        kuota: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    placeholder="30"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deskripsi Kegiatan</label>
                <textarea
                  rows={2}
                  value={addData.deskripsi || ""}
                  onChange={(e) => setAddData({ ...addData, deskripsi: e.target.value })}
                  placeholder="Keterangan singkat fokus pengembangan diri..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                />
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
                  className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition shadow-md shadow-sky-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPending && <i className="fa-solid fa-spinner fa-spin" />}
                  <span>{isPending ? "Menyimpan..." : "Simpan Kegiatan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT EKSTRAKURIKULER */}
      {/* ========================================================================= */}
      {showEditModal && selectedEkskul && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-pen-to-square" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Edit Ekstrakurikuler
                  </h3>
                  <p className="text-xs text-slate-500">
                    Perbarui rincian kegiatan, jadwal, atau pembina ekskul.
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

            <form onSubmit={handleSubmitEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Kegiatan <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editData.nama}
                  onChange={(e) => setEditData({ ...editData, nama: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={editData.kategori || "Kesenian"}
                    onChange={(e) => setEditData({ ...editData, kategori: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:bg-white focus:border-sky-500 outline-none cursor-pointer"
                  >
                    <option value="Kesenian">Kesenian & Budaya</option>
                    <option value="Olahraga">Olahraga</option>
                    <option value="Kepanduan / Pramuka">Kepanduan / Pramuka</option>
                    <option value="Sains & Teknologi">Sains & Riset</option>
                    <option value="Keagamaan">Keagamaan</option>
                    <option value="Kemanusiaan / Kesehatan">Kemanusiaan (PMR)</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pembina / Pelatih</label>
                  <input
                    type="text"
                    value={editData.pembina || ""}
                    onChange={(e) => setEditData({ ...editData, pembina: e.target.value })}
                    placeholder="Nama guru/pelatih"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hari Latihan</label>
                  <input
                    type="text"
                    value={editData.hari || ""}
                    onChange={(e) => setEditData({ ...editData, hari: e.target.value })}
                    placeholder="mis. Jumat"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Pelaksanaan</label>
                  <input
                    type="text"
                    value={editData.jam || ""}
                    onChange={(e) => setEditData({ ...editData, jam: e.target.value })}
                    placeholder="mis. 14:30 - 16:30"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lokasi Latihan</label>
                  <input
                    type="text"
                    value={editData.lokasi || ""}
                    onChange={(e) => setEditData({ ...editData, lokasi: e.target.value })}
                    placeholder="Lapangan / Aula"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kuota Maksimal</label>
                  <input
                    type="number"
                    value={editData.kuota ?? ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        kuota: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    placeholder="30"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Keaktifan</label>
                <select
                  value={editData.isAktif ? "true" : "false"}
                  onChange={(e) =>
                    setEditData({ ...editData, isAktif: e.target.value === "true" })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:bg-white focus:border-sky-500 outline-none cursor-pointer"
                >
                  <option value="true">Aktif Berjalan</option>
                  <option value="false">Nonaktif / Diliburkan</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deskripsi Kegiatan</label>
                <textarea
                  rows={2}
                  value={editData.deskripsi || ""}
                  onChange={(e) => setEditData({ ...editData, deskripsi: e.target.value })}
                  placeholder="Keterangan singkat fokus pengembangan diri..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                />
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
                  className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition shadow-md shadow-sky-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
      {/* MODAL: KONFIRMASI HAPUS EKSTRAKURIKULER */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedEkskul && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-xl mx-auto">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-800">
                Hapus Ekstrakurikuler?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anda akan menghapus kegiatan{" "}
                <span className="font-bold text-slate-800">"{selectedEkskul.nama}"</span>.
                Semua data pendaftaran peserta dan catatan penilaian kegiatan ini akan dibersihkan.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-800 text-[11px] font-semibold space-y-1">
              <p className="flex items-center gap-1.5 font-bold">
                <i className="fa-solid fa-circle-exclamation" />
                <span>Rincian Terpengaruh:</span>
              </p>
              <ul className="list-disc list-inside text-[10px] space-y-0.5 pl-1">
                <li>Jumlah Peserta Terdaftar: {selectedEkskul.pesertaCount} Murid</li>
                <li>Pembina: {selectedEkskul.pembina || "Belum ada"}</li>
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
                <span>{isPending ? "Menghapus..." : "Ya, Hapus Ekskul"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
