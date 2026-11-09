"use client";

import { useState, useTransition, useRef } from "react";
import {
  updateProfilSekolah,
  updateCapTtdKepsekAction,
} from "@/server/actions/sekolah";
import { processTransparentSignature } from "@/lib/image-transparent";

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
  capTtdKepsekUrl?: string | null;
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
    telepon: initialData?.telepon ?? "",
    email: initialData?.email || "sdn7pedungan63@gmail.com",
    website: initialData?.website ?? "",
    namaKepsek: initialData?.namaKepsek ?? "",
    nipKepsek: initialData?.nipKepsek ?? "",
    capTtdKepsekUrl: initialData?.capTtdKepsekUrl ?? null,
  });

  const capFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingCap, setIsProcessingCap] = useState(false);
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
        capTtdKepsekUrl: formData.capTtdKepsekUrl ?? null,
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
        capTtdKepsekUrl: initialData.capTtdKepsekUrl ?? null,
      });
      setFeedback({ type: "success", message: "Formulir dikembalikan ke data tersimpan." });
    }
  };

  const handleUploadCapTtd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setIsProcessingCap(true);

    try {
      const transparentDataUrl = await processTransparentSignature(file, 650, 360);
      setFormData((prev) => ({ ...prev, capTtdKepsekUrl: transparentDataUrl }));
      const res = await updateCapTtdKepsekAction(transparentDataUrl);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Gagal memproses berkas CAP Sekolah & TTD KEPSEK.",
      });
    } finally {
      setIsProcessingCap(false);
      if (capFileInputRef.current) capFileInputRef.current.value = "";
    }
  };

  const handleRemoveCapTtd = () => {
    setFeedback(null);
    startTransition(async () => {
      setFormData((prev) => ({ ...prev, capTtdKepsekUrl: null }));
      const res = await updateCapTtdKepsekAction(null);
      if (res.success) {
        setFeedback({ type: "success", message: res.message });
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
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
                  placeholder="Masukkan nomor telepon sekolah"
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
                  placeholder="Masukkan nama lengkap Kepala Sekolah beserta gelar"
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
                  placeholder="Masukkan NIP Kepala Sekolah (18 digit)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">Kosongkan atau beri tanda strip (-) jika belum memiliki NIP.</p>
              </div>

              {/* KOLOM UPLOAD CAP SEKOLAH & TTD KEPSEK (AUTO TRANSPARAN) */}
              <div className="md:col-span-2 pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Upload File &ldquo;CAP Sekolah &amp; TTD KEPSEK&rdquo; (.jpg, .jpeg, .png — Otomatis Transparan)
                </label>
                <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div
                      className="w-48 h-32 rounded-2xl border-2 border-slate-200 flex items-center justify-center p-2 shrink-0 overflow-hidden"
                      style={{
                        backgroundImage:
                          "linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)",
                        backgroundSize: "14px 14px",
                        backgroundPosition: "0 0, 0 7px, 7px -7px, -7px 0px",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      {formData.capTtdKepsekUrl ? (
                        <img
                          src={formData.capTtdKepsekUrl}
                          alt="CAP Sekolah & TTD KEPSEK"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-center text-slate-400 px-2">
                          <i className="fa-solid fa-stamp text-2xl mb-1 block" />
                          <span className="text-[10px] font-bold">
                            Belum Ada CAP &amp; TTD Kepsek
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5 text-center sm:text-left">
                      <input
                        ref={capFileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        onChange={handleUploadCapTtd}
                        className="hidden"
                      />
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <button
                          type="button"
                          disabled={isProcessingCap || isPending}
                          onClick={() => capFileInputRef.current?.click()}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          <i
                            className={`fa-solid ${
                              isProcessingCap ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"
                            }`}
                          />
                          <span>
                            {isProcessingCap
                              ? "Menghapus Background..."
                              : "Upload CAP Sekolah & TTD KEPSEK"}
                          </span>
                        </button>
                        {formData.capTtdKepsekUrl && (
                          <button
                            type="button"
                            disabled={isProcessingCap || isPending}
                            onClick={handleRemoveCapTtd}
                            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition cursor-pointer"
                          >
                            <i className="fa-regular fa-trash-can mr-1" />
                            Hapus
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 max-w-md">
                        Unggah gambar gabungan stempel sekolah &amp; tanda tangan Kepala Sekolah berekstensi <b>.jpg, .jpeg, atau .png</b>. Latar kertas putih otomatis dihapus menjadi transparan dan disematkan pada setiap nama Kepala Sekolah di seluruh berkas ekspor (Leger, Rekap Presensi, &amp; E-Rapor).
                      </p>
                    </div>
                  </div>

                  {/* Simulasi Pratinjau Penempatan di Atas Nama Kepala Sekolah */}
                  <div className="w-full lg:w-64 p-3.5 rounded-2xl bg-white border border-slate-200 text-center shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Pratinjau pada Berkas Ekspor
                    </p>
                    <p className="text-[10px] text-slate-600 leading-tight">
                      Mengetahui,
                      <br />
                      Kepala Sekolah
                    </p>
                    <div className="h-14 flex items-center justify-center my-0.5">
                      {formData.capTtdKepsekUrl ? (
                        <img
                          src={formData.capTtdKepsekUrl}
                          alt="Simulasi CAP & TTD"
                          className="max-h-16 max-w-[160px] object-contain"
                        />
                      ) : (
                        <span className="text-[10px] italic text-slate-300">
                          (Area CAP &amp; TTD Transparan)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-extrabold underline text-slate-800 truncate">
                      {formData.namaKepsek || "Kepala Sekolah"}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500">
                      NIP. {formData.nipKepsek || "-"}
                    </p>
                  </div>
                </div>
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
