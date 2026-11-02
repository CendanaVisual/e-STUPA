"use client";

import { useState, useTransition, useMemo } from "react";
import {
  createMapel,
  updateMapel,
  deleteMapel,
  type MapelInput,
} from "@/server/actions/mapel";

export type MapelRow = {
  id: string;
  kode: string;
  nama: string;
  kodeErapor: string | null;
  kelompok: string | null;
  urutan: number;
  isAktif: boolean;
  _count: {
    pembelajaran: number;
  };
};

interface MapelClientProps {
  initialMapels: MapelRow[];
}

export function MapelClient({ initialMapels }: MapelClientProps) {
  const [mapelList, setMapelList] = useState<MapelRow[]>(initialMapels);
  const [isPending, startTransition] = useTransition();

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterKelompok, setFilterKelompok] = useState("ALL");

  // Notifications
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form State: Tambah Mapel
  const defaultCreateState: MapelInput = {
    kode: "",
    nama: "",
    kodeErapor: "",
    kelompok: "Umum",
    urutan: mapelList.length + 1,
    isAktif: true,
  };
  const [formData, setFormData] = useState<MapelInput>(defaultCreateState);

  // Modals & Selected Mapel for Edit / Delete
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMapel, setSelectedMapel] = useState<MapelRow | null>(null);
  const [editFormData, setEditFormData] = useState<MapelInput>(defaultCreateState);

  // Filtered List
  const filteredList = useMemo(() => {
    return mapelList.filter((m) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.nama.toLowerCase().includes(q) ||
        m.kode.toLowerCase().includes(q) ||
        (m.kodeErapor && m.kodeErapor.toLowerCase().includes(q));

      const matchKelompok =
        filterKelompok === "ALL" ||
        (m.kelompok && m.kelompok.toLowerCase() === filterKelompok.toLowerCase());

      return matchSearch && matchKelompok;
    });
  }, [mapelList, search, filterKelompok]);

  // Open Edit Modal
  const handleOpenEdit = (mapel: MapelRow) => {
    setSelectedMapel(mapel);
    setEditFormData({
      id: mapel.id,
      kode: mapel.kode,
      nama: mapel.nama,
      kodeErapor: mapel.kodeErapor || "",
      kelompok: mapel.kelompok || "Umum",
      urutan: mapel.urutan || 1,
      isAktif: mapel.isAktif,
    });
    setShowEditModal(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (mapel: MapelRow) => {
    setSelectedMapel(mapel);
    setShowDeleteModal(true);
  };

  // Submit Tambah Mapel
  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createMapel(formData);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setFormData({
          kode: "",
          nama: "",
          kodeErapor: "",
          kelompok: "Umum",
          urutan: mapelList.length + 2,
          isAktif: true,
        });
        window.location.reload();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  // Submit Edit Mapel
  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await updateMapel(editFormData);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setShowEditModal(false);
        setSelectedMapel(null);
        window.location.reload();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  // Submit Delete Mapel
  const handleConfirmDelete = () => {
    if (!selectedMapel) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await deleteMapel(selectedMapel.id);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setShowDeleteModal(false);
        setMapelList((prev) => prev.filter((m) => m.id !== selectedMapel.id));
        setSelectedMapel(null);
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

      {/* Top Banner */}
      <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold inline-flex items-center gap-1.5">
            <i className="fa-solid fa-book-bookmark text-blue-600" />
            <span>Data Master Kurikulum & Mata Pelajaran</span>
          </span>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-2">
            Mata Pelajaran (Mapel)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Daftar mata pelajaran beserta kode resmi yang disinkronkan dengan E-Rapor Kemendikbudristek.
          </p>
        </div>

        <span className="px-3.5 py-2 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-extrabold font-mono shadow-xs self-start md:self-auto">
          {mapelList.length} Mata Pelajaran Terdaftar
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ===================================================================== */}
        {/* FORM TAMBAH MAPEL BARU (4 Kolom) */}
        {/* ===================================================================== */}
        <div className="lg:col-span-4 glass-light-panel rounded-3xl p-6 border border-slate-200/80 h-fit shadow-xs">
          <h3 className="text-base font-black text-slate-800 mb-3.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-plus" />
            </div>
            <span>Tambah Mapel Baru</span>
          </h3>

          <form onSubmit={handleSubmitCreate} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Kode Mapel (Singkat) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="mis. MTK, PAI, PJOK, B.IND"
                value={formData.kode}
                onChange={(e) =>
                  setFormData({ ...formData, kode: e.target.value.toUpperCase() })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition uppercase"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nama Lengkap Mata Pelajaran <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="mis. Matematika Umum"
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Kode Mapel E-Rapor (Opsional)
              </label>
              <input
                type="text"
                placeholder="mis. MAPEL-MTK-SD"
                value={formData.kodeErapor || ""}
                onChange={(e) => setFormData({ ...formData, kodeErapor: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kelompok</label>
                <select
                  value={formData.kelompok || "Umum"}
                  onChange={(e) => setFormData({ ...formData, kelompok: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="Umum">Umum</option>
                  <option value="Pilihan">Pilihan</option>
                  <option value="Muatan Lokal">Muatan Lokal</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Urut</label>
                <input
                  type="number"
                  min={1}
                  value={formData.urutan || 1}
                  onChange={(e) =>
                    setFormData({ ...formData, urutan: parseInt(e.target.value, 10) || 1 })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 mt-4 cursor-pointer shadow-md shadow-blue-600/20 transition disabled:opacity-50"
            >
              {isPending && <i className="fa-solid fa-spinner fa-spin" />}
              <span>{isPending ? "Menyimpan..." : "Simpan Mata Pelajaran"}</span>
            </button>
          </form>
        </div>

        {/* ===================================================================== */}
        {/* TABEL DAFTAR MAPEL DENGAN AKSI EDIT & HAPUS (8 Kolom) */}
        {/* ===================================================================== */}
        <div className="lg:col-span-8 glass-light-panel rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-book-open text-blue-600" />
              <span>Daftar Mata Pelajaran ({filteredList.length})</span>
            </h3>

            {/* Filter & Search Mini */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]" />
                <input
                  type="text"
                  placeholder="Cari mapel / kode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs outline-none focus:border-blue-500 w-36 sm:w-44"
                />
              </div>

              <select
                value={filterKelompok}
                onChange={(e) => setFilterKelompok(e.target.value)}
                className="py-1.5 px-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">Semua Kelompok</option>
                <option value="Umum">Umum</option>
                <option value="Pilihan">Pilihan</option>
                <option value="Muatan Lokal">Muatan Lokal</option>
              </select>
            </div>
          </div>

          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200/80">
              <i className="fa-solid fa-book-bookmark text-4xl text-slate-300 mb-2 block" />
              <p className="font-bold text-slate-600 text-sm">Tidak ada mata pelajaran yang sesuai.</p>
              <p className="text-slate-400 mt-1">Gunakan formulir di samping untuk menambahkan mata pelajaran baru.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3.5 w-14 text-center">Kode</th>
                    <th className="py-3 px-3">Nama Mata Pelajaran</th>
                    <th className="py-3 px-3">Kode E-Rapor</th>
                    <th className="py-3 px-3">Kelompok</th>
                    <th className="py-3 px-3 text-center">Kelas Mengampu</th>
                    {/* AKSI EDIT & HAPUS DI SEBELAH KELAS MENGAMPU */}
                    <th className="py-3 px-3.5 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 text-center font-mono font-bold text-blue-700">
                        <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200">
                          {m.kode}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-800">{m.nama}</p>
                        {!m.isAktif && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {m.kodeErapor || "-"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {m.kelompok || "Umum"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-mono font-bold text-[11px]">
                          {m._count.pembelajaran} Kelas
                        </span>
                      </td>
                      {/* AKSI EDIT & HAPUS */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            title="Edit Mata Pelajaran"
                            onClick={() => handleOpenEdit(m)}
                            className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center transition cursor-pointer"
                          >
                            <i className="fa-solid fa-pen-to-square text-xs" />
                          </button>
                          <button
                            type="button"
                            title="Hapus Mata Pelajaran"
                            onClick={() => handleOpenDelete(m)}
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
      </div>

      {/* ========================================================================= */}
      {/* MODAL: EDIT MATA PELAJARAN */}
      {/* ========================================================================= */}
      {showEditModal && selectedMapel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-pen-to-square" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Edit Mata Pelajaran
                  </h3>
                  <p className="text-xs text-slate-500">
                    Perbarui nama, kode kurikulum, atau kelompok mapel.
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
                  Kode Mapel (Singkat) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.kode}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      kode: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap Mata Pelajaran <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.nama}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, nama: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kode Mapel E-Rapor (Opsional)
                </label>
                <input
                  type="text"
                  value={editFormData.kodeErapor || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, kodeErapor: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kelompok</label>
                  <select
                    value={editFormData.kelompok || "Umum"}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, kelompok: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                  >
                    <option value="Umum">Umum</option>
                    <option value="Pilihan">Pilihan</option>
                    <option value="Muatan Lokal">Muatan Lokal</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Urut</label>
                  <input
                    type="number"
                    min={1}
                    value={editFormData.urutan || 1}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        urutan: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Keaktifan</label>
                <select
                  value={editFormData.isAktif ? "true" : "false"}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      isAktif: e.target.value === "true",
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="true">Aktif (Diajarkan di Sekolah)</option>
                  <option value="false">Nonaktif / Diarsipkan</option>
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
      {/* MODAL: KONFIRMASI HAPUS MATA PELAJARAN */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedMapel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-xl mx-auto">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-800">
                Hapus Mata Pelajaran?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anda akan menghapus mata pelajaran{" "}
                <span className="font-bold text-slate-800">
                  "{selectedMapel.nama}" ({selectedMapel.kode})
                </span>{" "}
                dari database sekolah.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-800 text-[11px] font-semibold space-y-1">
              <p className="flex items-center gap-1.5 font-bold">
                <i className="fa-solid fa-circle-exclamation" />
                <span>Peringatan Penghapusan:</span>
              </p>
              <ul className="list-disc list-inside text-[10px] space-y-0.5 pl-1">
                <li>Kelas Mengampu: {selectedMapel._count.pembelajaran} Kelas</li>
                <li>Riwayat pembelajaran dan nilai yang terikat akan ikut dibersihkan secara aman.</li>
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
                <span>{isPending ? "Menghapus..." : "Ya, Hapus Mapel"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
