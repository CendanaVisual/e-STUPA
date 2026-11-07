"use client";

import React, { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  updateProfilMandiriGuru,
  updateMediaProfilGuru,
} from "@/server/actions/gtk";
import {
  processProfilePhoto,
  processTransparentSignature,
} from "@/lib/image-transparent";

export type ProfilPendidikData = {
  gtkId: string | null;
  username: string;
  nama: string;
  nip: string;
  nuptk: string;
  nik: string;
  jenisKelamin: "L" | "P" | null;
  tempatLahir: string;
  tanggalLahir: string;
  jenisPtk: string;
  statusKepegawaian: string;
  email: string;
  noHp: string;
  fotoUrl: string | null;
  ttdUrl: string | null;
  waliKelas: { id: string; nama: string; tingkat: number }[];
  pembelajaran: {
    id: string;
    mapelNama: string;
    mapelKode: string;
    rombelNama: string;
    tingkat: number;
  }[];
};

interface ProfilPendidikClientProps {
  initialData: ProfilPendidikData;
  semesterLabel: string;
}

export function ProfilPendidikClient({
  initialData,
  semesterLabel,
}: ProfilPendidikClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isProcessingFoto, setIsProcessingFoto] = useState(false);
  const [isProcessingTtd, setIsProcessingTtd] = useState(false);

  const fotoInputRef = useRef<HTMLInputElement | null>(null);
  const ttdInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState({
    nama: initialData.nama,
    nip: initialData.nip,
    nuptk: initialData.nuptk,
    nik: initialData.nik,
    jenisKelamin: initialData.jenisKelamin || ("L" as "L" | "P"),
    tempatLahir: initialData.tempatLahir,
    tanggalLahir: initialData.tanggalLahir,
    jenisPtk: initialData.jenisPtk || "Guru Mapel",
    statusKepegawaian: initialData.statusKepegawaian || "PNS / PPPK",
    email: initialData.email,
    noHp: initialData.noHp,
    fotoUrl: initialData.fotoUrl,
    ttdUrl: initialData.ttdUrl,
    username: initialData.username,
    newPassword: "",
  });

  const [showPass, setShowPass] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setIsProcessingFoto(true);

    try {
      const processedUrl = await processProfilePhoto(file, 360);
      setFormData((prev) => ({ ...prev, fotoUrl: processedUrl }));

      const res = await updateMediaProfilGuru({ fotoUrl: processedUrl });
      if (res.success) {
        setFeedback({
          type: "success",
          message:
            "Foto profil pendidik berhasil diunggah dan tampil otomatis di Dashboard Guru & Superadmin!",
        });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Gagal memproses berkas foto profil.",
      });
    } finally {
      setIsProcessingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
    }
  };

  const handleHapusFoto = () => {
    setFeedback(null);
    startTransition(async () => {
      setFormData((prev) => ({ ...prev, fotoUrl: null }));
      const res = await updateMediaProfilGuru({ fotoUrl: null });
      if (res.success) {
        setFeedback({ type: "success", message: "Foto profil telah dihapus." });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleUploadTtd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setIsProcessingTtd(true);

    try {
      const transparentPngUrl = await processTransparentSignature(file, 600, 320);
      setFormData((prev) => ({ ...prev, ttdUrl: transparentPngUrl }));

      const res = await updateMediaProfilGuru({ ttdUrl: transparentPngUrl });
      if (res.success) {
        setFeedback({
          type: "success",
          message:
            "TTD Pendidik berhasil dikonversi otomatis ke latar transparan dan siap terpasang pada seluruh berkas ekspor!",
        });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Gagal memproses berkas tanda tangan.",
      });
    } finally {
      setIsProcessingTtd(false);
      if (ttdInputRef.current) ttdInputRef.current.value = "";
    }
  };

  const handleHapusTtd = () => {
    setFeedback(null);
    startTransition(async () => {
      setFormData((prev) => ({ ...prev, ttdUrl: null }));
      const res = await updateMediaProfilGuru({ ttdUrl: null });
      if (res.success) {
        setFeedback({ type: "success", message: "Berkas TTD Pendidik telah dihapus." });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await updateProfilMandiriGuru({
        nama: formData.nama,
        nip: formData.nip || null,
        nuptk: formData.nuptk || null,
        nik: formData.nik || null,
        jenisKelamin: formData.jenisKelamin,
        tempatLahir: formData.tempatLahir || null,
        tanggalLahir: formData.tanggalLahir || null,
        jenisPtk: formData.jenisPtk || "Guru Mapel",
        statusKepegawaian: formData.statusKepegawaian || "PNS / PPPK",
        email: formData.email || null,
        noHp: formData.noHp || null,
        fotoUrl: formData.fotoUrl,
        ttdUrl: formData.ttdUrl,
        username: formData.username,
        newPassword: formData.newPassword || null,
      });

      if (!res.success) {
        setFeedback({ type: "error", message: res.message });
      } else {
        setFormData((prev) => ({ ...prev, newPassword: "" }));
        setFeedback({ type: "success", message: res.message });
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* BANNER FEEDBACK */}
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
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="glass-light-panel rounded-3xl p-6 sm:p-7 border border-blue-200/70 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm bg-gradient-to-r from-blue-50/70 via-white to-teal-50/50">
        <div className="flex items-center gap-4">
          {formData.fotoUrl ? (
            <img
              src={formData.fotoUrl}
              alt={formData.nama}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white ring-2 ring-blue-200 shadow-md shrink-0"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 text-white flex items-center justify-center text-2xl font-extrabold shadow-md shrink-0">
              {formData.nama ? formData.nama.charAt(0).toUpperCase() : "G"}
            </div>
          )}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200 text-blue-800 text-[11px] font-bold">
              <i className="fa-solid fa-id-card-clip" />
              <span>Biodata GTK Terintegrasi Superadmin</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1.5">
              Profil Pendidik
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-xl">
              Kelola biodata pendidik (GTK), foto profil, dan tanda tangan digital transparan secara mandiri. Seluruh perubahan tersinkronisasi langsung ke pusat data Superadmin.
            </p>
          </div>
        </div>

        <Link
          href="/guru"
          className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition inline-flex items-center gap-2 self-start md:self-center shadow-xs"
        >
          <i className="fa-solid fa-arrow-left text-[11px]" />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>

      {/* KOLOM SEJAJAR: UPLOAD FOTO PROFIL & UPLOAD TTD PENDIDIK (AUTO TRANSPARAN) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* KIRI: UPLOAD FOTO PROFIL */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">
                <i className="fa-solid fa-camera" />
                <span>Upload Foto Profil</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400">
                .jpg / .jpeg / .png
              </span>
            </div>
            <h2 className="text-sm font-extrabold text-slate-800 pt-1">
              Foto Profil Pendidik
            </h2>
            <p className="text-xs text-slate-500">
              Foto ini tampil presisi di sebelah kiri teks <b>&ldquo;Selamat Datang&rdquo;</b> pada halaman utama Dashboard Guru serta di daftar GTK Superadmin.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
            {formData.fotoUrl ? (
              <img
                src={formData.fotoUrl}
                alt="Pratinjau Foto Profil"
                className="w-28 h-28 rounded-2xl object-cover border-2 border-white ring-2 ring-blue-200 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 border-2 border-dashed border-slate-300 text-slate-400 flex flex-col items-center justify-center shrink-0">
                <i className="fa-solid fa-user-tie text-3xl mb-1" />
                <span className="text-[10px] font-bold">Belum Ada Foto</span>
              </div>
            )}

            <div className="space-y-2.5 w-full text-center sm:text-left">
              <input
                ref={fotoInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={handleUploadFoto}
                className="hidden"
              />
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  disabled={isProcessingFoto || isPending}
                  onClick={() => fotoInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <i
                    className={`fa-solid ${
                      isProcessingFoto ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"
                    }`}
                  />
                  <span>{isProcessingFoto ? "Memproses..." : "Pilih Foto Profil"}</span>
                </button>
                {formData.fotoUrl && (
                  <button
                    type="button"
                    disabled={isProcessingFoto || isPending}
                    onClick={handleHapusFoto}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition cursor-pointer"
                  >
                    <i className="fa-regular fa-trash-can mr-1" />
                    Hapus
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Mendukung berkas <b>.jpg, .jpeg, .png</b>. Dipotong otomatis persegi agar rapi &amp; proporsional.
              </p>
            </div>
          </div>
        </div>

        {/* KANAN (SEJAJAR): UPLOAD TTD PENDIDIK (AUTO TRANSPARAN) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-[11px] font-bold">
                <i className="fa-solid fa-signature" />
                <span>Upload TTD Pendidik (Auto-Transparan)</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400">
                .jpg / .jpeg / .png
              </span>
            </div>
            <h2 className="text-sm font-extrabold text-slate-800 pt-1">
              Tanda Tangan Digital Pendidik
            </h2>
            <p className="text-xs text-slate-500">
              Latar belakang putih/kertas otomatis dihapus menjadi <b>transparan</b> agar menyatu rapi di atas nama Anda pada seluruh berkas ekspor (Leger, Rekap Presensi, &amp; E-Rapor).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
            <div
              className="w-40 h-28 rounded-2xl border-2 border-slate-200 flex items-center justify-center p-2 shrink-0 overflow-hidden relative"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)",
                backgroundSize: "14px 14px",
                backgroundPosition: "0 0, 0 7px, 7px -7px, -7px 0px",
                backgroundColor: "#ffffff",
              }}
            >
              {formData.ttdUrl ? (
                <img
                  src={formData.ttdUrl}
                  alt="Pratinjau TTD Pendidik Transparan"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-400">
                  <i className="fa-solid fa-file-signature text-2xl mb-1 block" />
                  <span className="text-[10px] font-bold">Belum Ada TTD</span>
                </div>
              )}
            </div>

            <div className="space-y-2.5 w-full text-center sm:text-left">
              <input
                ref={ttdInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={handleUploadTtd}
                className="hidden"
              />
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  disabled={isProcessingTtd || isPending}
                  onClick={() => ttdInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <i
                    className={`fa-solid ${
                      isProcessingTtd ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"
                    }`}
                  />
                  <span>{isProcessingTtd ? "Menghapus Background..." : "Upload TTD Pendidik"}</span>
                </button>
                {formData.ttdUrl && (
                  <button
                    type="button"
                    disabled={isProcessingTtd || isPending}
                    onClick={handleHapusTtd}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition cursor-pointer"
                  >
                    <i className="fa-regular fa-trash-can mr-1" />
                    Hapus
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Unggah foto/scan tanda tangan di kertas putih (<b>.jpg, .jpeg, .png</b>) — background otomatis diubah transparan!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* INFO PENUGASAN MENGAJAR AKTIF */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-chalkboard-user text-blue-600" />
            <h3 className="text-sm font-extrabold text-slate-800">
              Penugasan Mengajar Aktif ({semesterLabel})
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            Tersinkronisasi dengan Menu Pembelajaran &amp; Pengampu
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {initialData.waliKelas.length > 0 &&
            initialData.waliKelas.map((w) => (
              <span
                key={w.id}
                className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <i className="fa-solid fa-crown text-amber-500" />
                <span>
                  Wali Kelas {w.nama} (Tingkat {w.tingkat})
                </span>
              </span>
            ))}

          {initialData.pembelajaran.length > 0 ? (
            initialData.pembelajaran.map((p) => (
              <Link
                key={p.id}
                href={`/guru/nilai/${p.id}`}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold inline-flex items-center gap-1.5 transition"
              >
                <i className="fa-solid fa-book-open text-blue-600 text-[10px]" />
                <span>
                  {p.mapelNama} — Kelas {p.rombelNama}
                </span>
              </Link>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">
              Belum ada penugasan mata pelajaran pada semester aktif ini.
            </span>
          )}
        </div>
      </div>

      {/* FORMULIR EDIT MANDIRI DATA GTK / PENDIDIK */}
      <div className="glass-light-panel rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SEKSI 1: DATA IDENTITAS PENDIDIK (GTK) */}
          <div>
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 mb-5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  Identitas &amp; Kepegawaian GTK
                </h3>
                <p className="text-[11px] text-slate-400">
                  Data di bawah ini sama dengan Data GTK di Dashboard Superadmin dan dapat Anda perbarui secara mandiri
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Lengkap &amp; Gelar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData((p) => ({ ...p, nama: e.target.value }))}
                  placeholder="mis. Ni Luh Putu Sari, S.Pd."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Jenis Kelamin
                </label>
                <select
                  value={formData.jenisKelamin}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, jenisKelamin: e.target.value as "L" | "P" }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  NIP (Nomor Induk Pegawai)
                </label>
                <input
                  type="text"
                  value={formData.nip}
                  onChange={(e) => setFormData((p) => ({ ...p, nip: e.target.value }))}
                  placeholder="Kosongkan jika belum ada"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  NUPTK
                </label>
                <input
                  type="text"
                  value={formData.nuptk}
                  onChange={(e) => setFormData((p) => ({ ...p, nuptk: e.target.value }))}
                  placeholder="16 digit NUPTK (opsional)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  NIK (KTP)
                </label>
                <input
                  type="text"
                  value={formData.nik}
                  onChange={(e) => setFormData((p) => ({ ...p, nik: e.target.value }))}
                  placeholder="16 digit NIK (opsional)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Jenis PTK
                </label>
                <select
                  value={formData.jenisPtk}
                  onChange={(e) => setFormData((p) => ({ ...p, jenisPtk: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="Guru Kelas">Guru Kelas</option>
                  <option value="Guru Mapel">Guru Mapel</option>
                  <option value="Guru Agama">Guru Agama</option>
                  <option value="Guru PJOK">Guru PJOK</option>
                  <option value="Tenaga Kependidikan">Tenaga Kependidikan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Status Kepegawaian
                </label>
                <select
                  value={formData.statusKepegawaian}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, statusKepegawaian: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="PNS">PNS</option>
                  <option value="PPPK">PPPK</option>
                  <option value="PNS / PPPK">PNS / PPPK</option>
                  <option value="Guru Honor Sekolah">Guru Honor Sekolah</option>
                  <option value="Honor Daerah">Honor Daerah</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tempat Lahir
                </label>
                <input
                  type="text"
                  value={formData.tempatLahir}
                  onChange={(e) => setFormData((p) => ({ ...p, tempatLahir: e.target.value }))}
                  placeholder="mis. Denpasar"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tanggal Lahir
                </label>
                <input
                  type="date"
                  value={formData.tanggalLahir}
                  onChange={(e) => setFormData((p) => ({ ...p, tanggalLahir: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Aktif
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="mis. guru@sekolah.sch.id"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  value={formData.noHp}
                  onChange={(e) => setFormData((p) => ({ ...p, noHp: e.target.value }))}
                  placeholder="mis. 081234567890"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SEKSI 2: AKUN LOGIN PENDIDIK */}
          <div>
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 mb-5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  Kredensial Akun Login
                </h3>
                <p className="text-[11px] text-slate-400">
                  Perbarui username atau ganti kata sandi login apabila diperlukan
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Username Login <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, username: e.target.value.toLowerCase().trim() }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kata Sandi Baru (Kosongkan jika tidak ingin mengganti)
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, newPassword: e.target.value }))
                    }
                    placeholder="Minimal 6 karakter jika ingin diganti"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* TOMBOL SIMPAN */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
            <button
              type="submit"
              disabled={isPending}
              className="py-2.5 px-7 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Menyinkronkan Data...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk" />
                  <span>Simpan &amp; Sinkronkan Profil Pendidik</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
