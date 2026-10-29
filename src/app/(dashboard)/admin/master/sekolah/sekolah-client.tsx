"use client";

import { useState, useTransition } from "react";
import { updateProfilSekolah } from "@/server/actions/sekolah";

export type SekolahData = {
  id?: string;
  npsn: string;
  nama: string;
  bentukPendidikan: string | null;
  alamat: string | null;
  desaKelurahan: string | null;
  kecamatan: string | null;
  kabupatenKota: string | null;
  provinsi: string | null;
  kodePos: string | null;
  telepon: string | null;
  email: string | null;
  website: string | null;
  namaKepsek: string | null;
  nipKepsek: string | null;
};

interface SekolahClientProps {
  initialData: SekolahData | null;
}

export function SekolahClient({ initialData }: SekolahClientProps) {
  const [formData, setFormData] = useState<SekolahData>({
    npsn: initialData?.npsn || "50103069",
    nama: initialData?.nama || "SD Negeri 7 Pedungan",
    bentukPendidikan: initialData?.bentukPendidikan || "SD",
    alamat: initialData?.alamat || "Jl. Pulau Moyo No. 63 Pedungan",
    desaKelurahan: initialData?.desaKelurahan || "Pedungan",
    kecamatan: initialData?.kecamatan || "Denpasar Selatan",
    kabupatenKota: initialData?.kabupatenKota || "Kota Denpasar",
    provinsi: initialData?.provinsi || "Bali",
    kodePos: initialData?.kodePos || "80222",
    telepon: initialData?.telepon || "(0361) 720123",
    email: initialData?.email || "sdn7pedungan63@gmail.com",
    website: initialData?.website || "",
    namaKepsek: initialData?.namaKepsek || "Drs. I Made Sujana, M.Pd.",
    nipKepsek: initialData?.nipKepsek || "196805121992031008",
  });

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleChange = (field: keyof SekolahData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await updateProfilSekolah({
        npsn: formData.npsn,
        nama: formData.nama,
        bentukPendidikan: formData.bentukPendidikan || "SD",
        alamat: formData.alamat || "",
        desaKelurahan: formData.desaKelurahan || "",
        kecamatan: formData.kecamatan || "",
        kabupatenKota: formData.kabupatenKota || "",
        provinsi: formData.provinsi || "",
        kodePos: formData.kodePos || "",
        telepon: formData.telepon || "",
        email: formData.email || "",
        website: formData.website || "",
        namaKepsek: formData.namaKepsek || "",
        nipKepsek: formData.nipKepsek || "",
      });

      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFeedback({ type: "success", message: res.message });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const handleReset = () => {
    if (initialData) {
      setFormData({
        npsn: initialData.npsn || "",
        nama: initialData.nama || "",
        bentukPendidikan: initialData.bentukPendidikan || "SD",
        alamat: initialData.alamat || "",
        desaKelurahan: initialData.desaKelurahan || "",
        kecamatan: initialData.kecamatan || "",
        kabupatenKota: initialData.kabupatenKota || "",
        provinsi: initialData.provinsi || "",
        kodePos: initialData.kodePos || "",
        telepon: initialData.telepon || "",
        email: initialData.email || "",
        website: initialData.website || "",
        namaKepsek: initialData.namaKepsek || "",
        nipKepsek: initialData.nipKepsek || "",
      });
      setFeedback({ type: "success", message: "Formulir dikembalikan ke data tersimpan." });
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifikasi Status */}
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
            <i className="fa-solid fa-school" />
            <span>Data Master Satuan Pendidikan</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Profil Satuan Pendidikan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Informasi resmi satuan pendidikan yang menjadi rujukan kop surat dokumen, biodata sekolah pada buku induk, serta halaman sampul dan lembar titimangsa E-Rapor.
          </p>
        </div>

        <div className="flex items-center gap-2.5 font-mono">
          <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            NPSN: {formData.npsn || "-"}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold uppercase">
            Jenjang: {formData.bentukPendidikan || "SD"}
          </span>
        </div>
      </div>

      {/* Kartu Pratinjau Kop Sekolah Resmi */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-eye text-blue-500" />
            <span>Pratinjau Kop Surat Resmi E-Rapor</span>
          </span>
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Aktif di E-Rapor
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50/70 rounded-2xl border border-slate-200/70">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-md shadow-blue-500/20 shrink-0">
            <i className="fa-solid fa-graduation-cap" />
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              PEMERINTAH {formData.kabupatenKota?.toUpperCase() || "KOTA DENPASAR"} · DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA
            </p>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight mt-0.5 uppercase truncate">
              {formData.nama || "SD NEGERI 7 PEDUNGAN"}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {formData.alamat || "Jl. Pulau Moyo No. 63 Pedungan"}
              {formData.desaKelurahan ? `, Kel. ${formData.desaKelurahan}` : ""}
              {formData.kecamatan ? `, Kec. ${formData.kecamatan}` : ""}
              {formData.kabupatenKota ? `, ${formData.kabupatenKota}` : ""}
              {formData.kodePos ? ` · Kode Pos: ${formData.kodePos}` : ""}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-[11px] text-slate-500 mt-2">
              {formData.telepon && (
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-phone text-slate-400" />
                  <span>{formData.telepon}</span>
                </span>
              )}
              {formData.email && (
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-envelope text-slate-400" />
                  <span>{formData.email}</span>
                </span>
              )}
              {formData.website && (
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-globe text-slate-400" />
                  <span>{formData.website}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Formulir Input Data Profil Sekolah */}
      <div className="glass-light-panel rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SEKSI 1: IDENTITAS SATUAN PENDIDIKAN */}
          <div>
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 mb-5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Identitas Satuan Pendidikan</h3>
                <p className="text-[11px] text-slate-400">Data nomor pokok dan nama resmi lembaga pendidikan</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Pokok Sekolah Nasional (NPSN) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.npsn}
                  onChange={(e) => handleChange("npsn", e.target.value.trim())}
                  placeholder="mis. 50103069"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">Nomor unik 8 digit terdaftar di Kemdikbudristek.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Resmi Sekolah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => handleChange("nama", e.target.value)}
                  placeholder="mis. SD Negeri 7 Pedungan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">Sesuai nomenklatur SK Pendirian / Izin Operasional resmi.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Bentuk Pendidikan / Jenjang
                </label>
                <select
                  value={formData.bentukPendidikan || "SD"}
                  onChange={(e) => handleChange("bentukPendidikan", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="SD">SD (Sekolah Dasar)</option>
                  <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                  <option value="SMA">SMA (Sekolah Menengah Atas)</option>
                  <option value="SMK">SMK (Sekolah Menengah Kejuruan)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Website Resmi Sekolah (Opsional)
                </label>
                <input
                  type="text"
                  value={formData.website || ""}
                  onChange={(e) => handleChange("website", e.target.value)}
                  placeholder="mis. https://sdn7pedungan.sch.id"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SEKSI 2: ALAMAT & LOKASI SATUAN PENDIDIKAN */}
          <div>
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 mb-5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Alamat & Wilayah Administratif</h3>
                <p className="text-[11px] text-slate-400">Lokasi fisik sekolah sesuai data kewilayahan Dapodik</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alamat Jalan Lengkap
                </label>
                <input
                  type="text"
                  value={formData.alamat || ""}
                  onChange={(e) => handleChange("alamat", e.target.value)}
                  placeholder="mis. Jl. Pulau Moyo No. 63 Pedungan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Desa / Kelurahan
                </label>
                <input
                  type="text"
                  value={formData.desaKelurahan || ""}
                  onChange={(e) => handleChange("desaKelurahan", e.target.value)}
                  placeholder="mis. Pedungan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kecamatan
                </label>
                <input
                  type="text"
                  value={formData.kecamatan || ""}
                  onChange={(e) => handleChange("kecamatan", e.target.value)}
                  placeholder="mis. Denpasar Selatan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kabupaten / Kota
                </label>
                <input
                  type="text"
                  value={formData.kabupatenKota || ""}
                  onChange={(e) => handleChange("kabupatenKota", e.target.value)}
                  placeholder="mis. Kota Denpasar"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Provinsi
                </label>
                <input
                  type="text"
                  value={formData.provinsi || ""}
                  onChange={(e) => handleChange("provinsi", e.target.value)}
                  placeholder="mis. Bali"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kode Pos
                </label>
                <input
                  type="text"
                  value={formData.kodePos || ""}
                  onChange={(e) => handleChange("kodePos", e.target.value)}
                  placeholder="mis. 80222"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 font-bold focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Telepon
                </label>
                <input
                  type="text"
                  value={formData.telepon || ""}
                  onChange={(e) => handleChange("telepon", e.target.value)}
                  placeholder="mis. (0361) 720123"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Resmi Sekolah
                </label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="mis. sdn7pedungan63@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SEKSI 3: PIMPINAN SATUAN PENDIDIKAN */}
          <div>
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 mb-5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Pimpinan Satuan Pendidikan</h3>
                <p className="text-[11px] text-slate-400">Nama dan NIP Kepala Sekolah untuk penandatanganan titimangsa rapor</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Lengkap Kepala Sekolah (Beserta Gelar)
                </label>
                <input
                  type="text"
                  value={formData.namaKepsek || ""}
                  onChange={(e) => handleChange("namaKepsek", e.target.value)}
                  placeholder="mis. Drs. I Made Sujana, M.Pd."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  NIP Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={formData.nipKepsek || ""}
                  onChange={(e) => handleChange("nipKepsek", e.target.value)}
                  placeholder="mis. 196805121992031008"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">Kosongkan atau beri tanda strip (-) jika belum memiliki NIP.</p>
              </div>
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={handleReset}
              disabled={isPending}
              className="py-2.5 px-5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              <i className="fa-solid fa-rotate-left mr-1.5" />
              <span>Kembalikan Data Awal</span>
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="py-2.5 px-7 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Menyimpan ke Database...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk" />
                  <span>Simpan Profil Sekolah</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
