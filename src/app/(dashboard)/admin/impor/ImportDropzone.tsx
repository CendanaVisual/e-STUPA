"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportDropzone() {
  const router = useRouter();
  const [jenis, setJenis] = useState("siswa");
  const [file, setFile] = useState<File | null>(null);
  const [headerRow, setHeaderRow] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{
    totalBaris?: number;
    ditambah?: number;
    diperbarui?: number;
    gagal?: number;
    error?: string;
  } | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("headerRow", String(headerRow));

    try {
      const res = await fetch(`/api/admin/impor/${jenis}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error || "Gagal mengimpor berkas" });
      } else {
        setResult(data);
        router.refresh();
      }
    } catch {
      setResult({ error: "Terjadi kesalahan jaringan saat mengunggah berkas" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-light-panel rounded-3xl p-6 border border-slate-200/80">
      <form onSubmit={handleUpload} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Pilih Jenis Data Master yang Diimpor
            </label>
            <select
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="siswa">Data Peserta Didik (Kunci: NISN)</option>
              <option value="gtk">Data Pendidik & GTK (Kunci: NUPTK / NIK)</option>
              <option value="rombel">Data Rombongan Belajar / Kelas</option>
              <option value="mapel">Data Mata Pelajaran</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Baris Header Kolom (Biasanya Baris 1)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={headerRow}
              onChange={(e) => setHeaderRow(parseInt(e.target.value) || 1)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-sky-50/30 rounded-2xl p-6 text-center transition-colors">
          <input
            type="file"
            id="dapodikFileInput"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <label htmlFor="dapodikFileInput" className="cursor-pointer block">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-2 text-xl shadow-xs">
              <i className="fa-solid fa-cloud-arrow-up" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              {file ? file.name : "Klik di sini untuk memilih berkas Excel atau CSV"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Mendukung format .xlsx, .xls, dan .csv resmi hasil unduhan Dapodik lokal
            </p>
          </label>
        </div>

        {result?.error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-rose-500" />
            <span>{result.error}</span>
          </div>
        )}

        {result?.totalBaris !== undefined && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-circle-check text-emerald-600" />
              <span>
                Impor berhasil: Total {result.totalBaris} baris diproses (+{result.ditambah} baru, ~
                {result.diperbarui} diperbarui, {result.gagal} gagal)
              </span>
            </span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!file || isUploading}
            className="py-2.5 px-6 rounded-xl btn-soft-primary text-xs font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isUploading ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin" />
                <span>Memproses Impor...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-upload" />
                <span>Unggah & Sinkronkan Data</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
